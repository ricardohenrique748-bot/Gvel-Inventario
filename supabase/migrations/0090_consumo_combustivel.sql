-- ============================================================
-- 0090: Controle de Abastecimento, Consumo e Média KM/L
--
-- Nova aba "Consumo" em Gestão de Frotas. Reaproveita as tabelas que já
-- existem em vez de criar paralelas:
--   * `abastecimentos` (0067) ganha tanque cheio, motorista, posto, status
--     de revisão, fotos e auditoria;
--   * `viagens_frota` (0062) ganha condição de carga e os campos da
--     importação do MoveTruck (toneladas já existiam: peso_carga_toneladas);
--   * motoristas continuam vindo de `pessoas` (0064) — o abastecimento
--     guarda o nome denormalizado, no mesmo padrão das viagens.
--
-- Os veículos da frota não têm tabela própria completa (lista oficial em
-- código + overrides em `veiculos_frota`), então capacidade do tanque e
-- metas de km/L ficam em `metas_consumo_veiculo`, chaveada pela placa.
--
-- Os ciclos tanque cheio → tanque cheio NÃO são gravados em tabela: são
-- derivados dos abastecimentos (no app pelo serviço de domínio
-- src/pages/frotas/consumo/dominio.ts e, pro Power BI, pela view
-- `fato_ciclo` abaixo). Assim uma correção num abastecimento nunca deixa
-- um ciclo gravado desatualizado.
-- ============================================================

-- Placa sem traço/espaço e em maiúscula ('abc-1234' → 'ABC1234'). Mesma
-- regra do normalizarPlaca() do domínio no app.
create or replace function placa_normalizada(p text)
returns text
language sql
immutable
as $$ select regexp_replace(upper(coalesce(p, '')), '[^A-Z0-9]', '', 'g') $$;

-- ------------------------------------------------------------
-- Postos
-- ------------------------------------------------------------
create table if not exists postos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  nome text not null,
  cnpj text,
  cidade text,
  uf text,
  interno boolean not null default false,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_postos_company on postos (company_id);

-- ------------------------------------------------------------
-- Abastecimentos (extensão da tabela da 0067)
-- ------------------------------------------------------------
alter table abastecimentos alter column centro_custo_id drop not null;

alter table abastecimentos
  add column if not exists tanque_cheio boolean not null default false,
  add column if not exists motorista_id text,
  add column if not exists motorista_nome text,
  add column if not exists posto_id uuid references postos(id) on delete set null,
  add column if not exists status text not null default 'valido',
  add column if not exists motivos_revisao text[] not null default '{}',
  add column if not exists valor_total_informado numeric(12, 2),
  add column if not exists foto_cupom_url text,
  add column if not exists foto_painel_url text,
  add column if not exists created_by uuid default auth.uid(),
  add column if not exists created_by_nome text,
  add column if not exists updated_at timestamptz not null default now(),
  -- Justificativa da última alteração (obrigatória pra corrigir odômetro);
  -- vai junto pra auditoria pelo trigger.
  add column if not exists motivo_alteracao text;

alter table abastecimentos drop constraint if exists abastecimentos_status_check;
alter table abastecimentos add constraint abastecimentos_status_check
  check (status in ('valido', 'pendente_revisao', 'invalidado'));

alter table abastecimentos drop constraint if exists abastecimentos_origem_check;
alter table abastecimentos add constraint abastecimentos_origem_check
  check (origem in ('manual', 'despesa_viagem', 'app', 'web', 'importacao'));

create index if not exists idx_abastecimentos_placa_data on abastecimentos (company_id, placa_normalizada(placa), data_hora);
create index if not exists idx_abastecimentos_odometro on abastecimentos (company_id, placa_normalizada(placa), odometro);
create index if not exists idx_abastecimentos_status on abastecimentos (status);
create index if not exists idx_abastecimentos_tanque_cheio on abastecimentos (tanque_cheio) where tanque_cheio;
create index if not exists idx_abastecimentos_motorista on abastecimentos (motorista_nome);
create index if not exists idx_abastecimentos_posto on abastecimentos (posto_id);

-- Odômetro nunca menor que o último válido do mesmo veículo (até a data do
-- novo registro). Vale também pra sincronização offline — a regra fica no
-- banco, não só na tela. Correção é feita por UPDATE com justificativa.
create or replace function valida_odometro_abastecimento()
returns trigger
language plpgsql
as $$
declare
  v_ultimo numeric;
begin
  if new.odometro is null or new.status = 'invalidado' then
    return new;
  end if;
  select max(odometro) into v_ultimo
    from abastecimentos
   where company_id = new.company_id
     and placa_normalizada(placa) = placa_normalizada(new.placa)
     and status <> 'invalidado'
     and odometro is not null
     and data_hora <= new.data_hora
     and id <> new.id;
  if v_ultimo is not null and new.odometro < v_ultimo then
    raise exception 'ODOMETRO_MENOR: odômetro % menor que o último registrado (%) para a placa %',
      new.odometro, v_ultimo, new.placa
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_valida_odometro_abastecimento on abastecimentos;
create trigger trg_valida_odometro_abastecimento
  before insert on abastecimentos
  for each row execute function valida_odometro_abastecimento();

-- Correção de odômetro exige justificativa.
create or replace function exige_motivo_correcao_abastecimento()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  if new.odometro is distinct from old.odometro and coalesce(trim(new.motivo_alteracao), '') = '' then
    raise exception 'MOTIVO_OBRIGATORIO: informe a justificativa para corrigir o odômetro'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_motivo_correcao_abastecimento on abastecimentos;
create trigger trg_motivo_correcao_abastecimento
  before update on abastecimentos
  for each row execute function exige_motivo_correcao_abastecimento();

-- ------------------------------------------------------------
-- Auditoria dos abastecimentos (preenchida só por trigger)
-- ------------------------------------------------------------
create table if not exists auditoria_abastecimentos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  abastecimento_id uuid not null,
  acao text not null,
  usuario_id uuid,
  usuario_email text,
  valores_anteriores jsonb,
  valores_novos jsonb,
  motivo text,
  created_at timestamptz not null default now()
);
create index if not exists idx_auditoria_abastecimentos_company on auditoria_abastecimentos (company_id);
create index if not exists idx_auditoria_abastecimentos_registro on auditoria_abastecimentos (abastecimento_id, created_at desc);

create or replace function audita_abastecimento()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_acao text;
  v_email text;
begin
  select email into v_email from auth.users where id = auth.uid();

  if tg_op = 'INSERT' then
    v_acao := 'criacao';
  elsif tg_op = 'DELETE' then
    v_acao := 'exclusao';
  elsif new.status = 'invalidado' and old.status <> 'invalidado' then
    v_acao := 'invalidacao';
  elsif old.status = 'invalidado' and new.status <> 'invalidado' then
    v_acao := 'reativacao';
  elsif new.odometro is distinct from old.odometro then
    v_acao := 'correcao_odometro';
  elsif new.volume is distinct from old.volume then
    v_acao := 'correcao_litros';
  elsif new.tanque_cheio is distinct from old.tanque_cheio then
    v_acao := 'correcao_tanque_cheio';
  elsif new.status = 'valido' and old.status = 'pendente_revisao' then
    v_acao := 'validacao';
  else
    v_acao := 'edicao';
  end if;

  insert into auditoria_abastecimentos (
    company_id, abastecimento_id, acao, usuario_id, usuario_email,
    valores_anteriores, valores_novos, motivo
  ) values (
    coalesce(new.company_id, old.company_id),
    coalesce(new.id, old.id),
    v_acao,
    auth.uid(),
    v_email,
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end,
    case when tg_op = 'DELETE' then null else new.motivo_alteracao end
  );
  return null; -- AFTER trigger: retorno ignorado
end;
$$;

drop trigger if exists trg_audita_abastecimento on abastecimentos;
create trigger trg_audita_abastecimento
  after insert or update or delete on abastecimentos
  for each row execute function audita_abastecimento();

-- ------------------------------------------------------------
-- Metas e capacidade por veículo (chave: placa)
-- ------------------------------------------------------------
create table if not exists metas_consumo_veiculo (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  placa text not null,
  capacidade_tanque numeric(8, 1),
  capacidade_tanque_arla numeric(8, 1),
  meta_km_l numeric(6, 3),
  meta_km_l_carregado numeric(6, 3),
  meta_km_l_vazio numeric(6, 3),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Placa gravada já normalizada (maiúscula, sem traço) pelo app — índice
-- simples pra o upsert do PostgREST conseguir usar como on_conflict.
create unique index if not exists uq_metas_consumo_veiculo_placa on metas_consumo_veiculo (company_id, placa);

-- ------------------------------------------------------------
-- Parâmetros do módulo (uma linha por empresa)
-- ------------------------------------------------------------
create table if not exists config_consumo (
  company_id uuid primary key references companies(id) default current_company_id(),
  -- Semáforo: verde até X% abaixo da meta; amarelo até Y%; vermelho acima de Y%.
  semaforo_verde_pct numeric(5, 2) not null default 5,
  semaforo_amarelo_pct numeric(5, 2) not null default 15,
  -- Anomalias de ciclo
  anomalia_abaixo_meta_pct numeric(5, 2) not null default 15,
  anomalia_acima_meta_pct numeric(5, 2) not null default 20,
  desvios_padrao_alerta numeric(4, 2) not null default 2,
  ciclos_queda_continua integer not null default 3,
  -- Validações de abastecimento
  max_km_sem_registro numeric(8, 1) not null default 1500,
  tolerancia_capacidade_pct numeric(5, 2) not null default 5,
  tolerancia_valor_total numeric(8, 2) not null default 1,
  janela_duplicidade_min integer not null default 10,
  velocidade_max_kmh numeric(6, 1) not null default 90,
  velocidade_min_kmh numeric(6, 1) not null default 2,
  -- Mapeamento de colunas do XLSX do MoveTruck: { "PLACA": "Placa", ... }
  mapeamento_movetruck jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Alertas
-- ------------------------------------------------------------
create table if not exists alertas_consumo (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  tipo text not null check (tipo in (
    'ODOMETRO_INCONSISTENTE', 'HORIMETRO_INCONSISTENTE', 'LITROS_ACIMA_CAPACIDADE',
    'POSSIVEL_DUPLICIDADE', 'CONSUMO_ABAIXO_META', 'CONSUMO_ACIMA_META',
    'DESVIO_ESTATISTICO', 'QUEDA_CONTINUA', 'INTERVALO_ABASTECIMENTO_ANORMAL',
    'VALOR_TOTAL_DIVERGENTE'
  )),
  placa text not null,
  veiculo_id text,
  -- id do abastecimento, ou do abastecimento que fechou o ciclo
  referencia_id text not null,
  mensagem text not null,
  severidade text not null default 'media' check (severidade in ('baixa', 'media', 'alta')),
  resolvido boolean not null default false,
  resolvido_por text,
  resolvido_em timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists uq_alertas_consumo_ref on alertas_consumo (company_id, tipo, referencia_id);
create index if not exists idx_alertas_consumo_aberto on alertas_consumo (company_id, resolvido, created_at desc);

-- ------------------------------------------------------------
-- Viagens: condição de carga + importação MoveTruck
-- ------------------------------------------------------------
create table if not exists importacoes_movetruck (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  arquivo text not null,
  usuario_id uuid default auth.uid(),
  usuario_nome text,
  data_hora timestamptz not null default now(),
  quantidade_linhas integer not null default 0,
  quantidade_importada integer not null default 0,
  quantidade_atualizada integer not null default 0,
  quantidade_duplicada integer not null default 0,
  quantidade_com_erro integer not null default 0,
  status text not null check (status in ('concluida', 'parcial', 'falhou')),
  erros jsonb not null default '[]'::jsonb
);
create index if not exists idx_importacoes_movetruck_company on importacoes_movetruck (company_id, data_hora desc);

alter table viagens_frota
  add column if not exists condicao_carga text,
  add column if not exists km_rodado numeric(10, 1),
  add column if not exists fonte text not null default 'manual',
  add column if not exists importacao_id uuid references importacoes_movetruck(id) on delete set null,
  -- placa|data|origem|destino normalizados — chave lógica anti-duplicidade
  add column if not exists chave_importacao text;

alter table viagens_frota drop constraint if exists viagens_frota_condicao_carga_check;
alter table viagens_frota add constraint viagens_frota_condicao_carga_check
  check (condicao_carga is null or condicao_carga in ('carregado', 'vazio', 'misto'));

create unique index if not exists uq_viagens_frota_chave_importacao
  on viagens_frota (company_id, chave_importacao) where chave_importacao is not null;
create index if not exists idx_viagens_frota_placa_data on viagens_frota (company_id, placa_normalizada(placa), data_hora_saida);

-- ------------------------------------------------------------
-- RLS + company_id automático nas tabelas novas (padrão da 0077)
-- ------------------------------------------------------------
do $$
declare
  v_tabela text;
begin
  foreach v_tabela in array array['postos', 'metas_consumo_veiculo', 'config_consumo', 'alertas_consumo', 'importacoes_movetruck'] loop
    execute format('alter table %I enable row level security', v_tabela);
    execute format('drop policy if exists %I on %I', 'isolamento_empresa_' || v_tabela, v_tabela);
    execute format(
      'create policy %I on %I for all using (company_id = current_company_id()) with check (company_id = current_company_id())',
      'isolamento_empresa_' || v_tabela, v_tabela
    );
    if v_tabela <> 'config_consumo' then
      execute format('drop trigger if exists %I on %I', 'stamp_company_id_' || v_tabela, v_tabela);
      execute format(
        'create trigger %I before insert on %I for each row execute function stamp_company_id()',
        'stamp_company_id_' || v_tabela, v_tabela
      );
    end if;
  end loop;
end $$;

-- Auditoria: só leitura pela API; quem grava é o trigger (security definer).
alter table auditoria_abastecimentos enable row level security;
drop policy if exists leitura_empresa_auditoria_abastecimentos on auditoria_abastecimentos;
create policy leitura_empresa_auditoria_abastecimentos on auditoria_abastecimentos
  for select using (company_id = current_company_id());

-- ------------------------------------------------------------
-- Views para Power BI (security_invoker: respeitam o RLS de quem consulta)
-- Documentação das relações e medidas DAX: docs/consumo-combustivel-powerbi.md
-- ------------------------------------------------------------
create or replace view fato_abastecimento with (security_invoker = on) as
select
  a.id,
  a.company_id,
  placa_normalizada(a.placa) as placa,
  a.veiculo_id,
  nullif(upper(trim(a.motorista_nome)), '') as motorista,
  a.posto_id,
  a.posto_fornecedor as posto_nome,
  a.data_hora,
  (a.data_hora at time zone 'America/Sao_Paulo')::date as data,
  a.odometro,
  a.horas_motor as horimetro,
  a.combustivel,
  (a.combustivel ilike '%arla%') as is_arla,
  case when a.combustivel ilike '%arla%' then 0 else a.volume end as litros_diesel,
  case when a.combustivel ilike '%arla%' then a.volume else 0 end as litros_arla,
  a.volume as litros,
  a.valor_unitario as valor_litro,
  a.valor_total,
  a.tanque_cheio,
  a.status,
  a.origem
from abastecimentos a;

-- Ciclo k de um veículo = abastecimento de tanque cheio nº k (início) +
-- todos os abastecimentos de diesel seguintes até o tanque cheio nº k+1
-- (inclusive). `seq` = quantos tanques cheios vieram ANTES da linha.
-- Abastecimentos antes do primeiro tanque cheio não entram (sem média
-- retroativa). Ciclo com abastecimento pendente de revisão = invalidado.
create or replace view fato_ciclo with (security_invoker = on) as
with d as (
  select
    a.*,
    placa_normalizada(a.placa) as placa_n,
    coalesce(sum(case when a.tanque_cheio then 1 else 0 end) over (
      partition by a.company_id, placa_normalizada(a.placa)
      order by a.data_hora, a.odometro nulls last, a.id
      rows between unbounded preceding and 1 preceding
    ), 0) as seq
  from abastecimentos a
  where a.status <> 'invalidado'
    and a.combustivel not ilike '%arla%'
),
inicio as (
  select * from d where tanque_cheio
),
membros as (
  select
    company_id,
    placa_n,
    seq,
    sum(volume) as litros,
    sum(valor_total) as custo_total,
    bool_or(tanque_cheio) as fechado,
    bool_or(status = 'pendente_revisao') as tem_pendente,
    max(odometro) filter (where tanque_cheio) as odometro_fim,
    max(horas_motor) filter (where tanque_cheio) as horimetro_fim,
    max(data_hora) as data_fim,
    (array_agg(id order by data_hora desc) filter (where tanque_cheio))[1] as abastecimento_fim_id
  from d
  group by company_id, placa_n, seq
)
select
  i.id as abastecimento_inicio_id,
  m.abastecimento_fim_id,
  i.company_id,
  i.placa_n as placa,
  i.data_hora as data_inicio,
  m.data_fim,
  (coalesce(m.data_fim, i.data_hora) at time zone 'America/Sao_Paulo')::date as data_referencia,
  i.odometro as odometro_inicio,
  m.odometro_fim,
  i.horas_motor as horimetro_inicio,
  m.horimetro_fim,
  case when m.fechado then m.odometro_fim - i.odometro end as km,
  coalesce(m.litros, 0) as litros,
  case when m.fechado then m.horimetro_fim - i.horas_motor end as horas,
  coalesce(m.custo_total, 0) as custo_total,
  case
    when coalesce(m.fechado, false) = false then 'aberto'
    when m.tem_pendente or m.odometro_fim is null or i.odometro is null
      or m.odometro_fim <= i.odometro or coalesce(m.litros, 0) <= 0 then 'invalidado'
    else 'fechado'
  end as status,
  mt.meta_km_l
from inicio i
left join membros m
  on m.company_id = i.company_id and m.placa_n = i.placa_n and m.seq = i.seq + 1
left join metas_consumo_veiculo mt
  on mt.company_id = i.company_id and placa_normalizada(mt.placa) = i.placa_n;

create or replace view fato_viagem with (security_invoker = on) as
select
  v.id,
  v.company_id,
  placa_normalizada(v.placa) as placa,
  nullif(upper(trim(v.motorista_nome)), '') as motorista,
  v.data_hora_saida,
  (v.data_hora_saida at time zone 'America/Sao_Paulo')::date as data,
  v.origem,
  v.destino,
  coalesce(v.km_rodado, v.km_chegada - v.km_saida, v.distancia_estimada_km) as km,
  v.peso_carga_toneladas as toneladas,
  v.frete_bruto as valor_frete,
  v.condicao_carga,
  v.fonte
from viagens_frota v;

create or replace view dim_veiculo with (security_invoker = on) as
select distinct on (company_id, placa) company_id, placa, capacidade_tanque, meta_km_l, meta_km_l_carregado, meta_km_l_vazio
from (
  select company_id, placa_normalizada(placa) as placa, capacidade_tanque, meta_km_l, meta_km_l_carregado, meta_km_l_vazio, 0 as prioridade
    from metas_consumo_veiculo
  union all
  select company_id, placa_normalizada(placa), null, null, null, null, 1 from abastecimentos
  union all
  select company_id, placa_normalizada(placa), null, null, null, null, 1 from viagens_frota
) x
order by company_id, placa, prioridade;

create or replace view dim_motorista with (security_invoker = on) as
select distinct company_id, nullif(upper(trim(motorista_nome)), '') as motorista
from (
  select company_id, motorista_nome from abastecimentos
  union all
  select company_id, motorista_nome from viagens_frota
) x
where nullif(trim(motorista_nome), '') is not null;

create or replace view dim_posto with (security_invoker = on) as
select id, company_id, nome, cnpj, cidade, uf, interno, ativo from postos;

create or replace view dim_data as
select
  d::date as data,
  extract(year from d)::int as ano,
  extract(month from d)::int as mes,
  to_char(d, 'YYYY-MM') as ano_mes,
  extract(isodow from d)::int as dia_semana
from generate_series(date '2024-01-01', (current_date + interval '1 year')::date, interval '1 day') as d;

-- Faz a API do Supabase enxergar as tabelas/colunas novas na hora.
notify pgrst, 'reload schema';
