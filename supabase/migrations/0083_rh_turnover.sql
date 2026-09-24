-- Turnover do RH — admissões e desligamentos lançados direto no sistema (aba
-- "Turnover" do RH), em vez de vir de planilha. Cada linha é um colaborador:
-- data_admissao sempre preenchida; data_demissao preenchida quando saiu.
--
-- `empresa` é a empresa do grupo (GVEL DIESEL, GVEL LEVES, GV TRANSPORTES...),
-- com o mesmo nome curto usado nas abas da folha — é assim que a tela casa
-- com o quadro ativo pra calcular a taxa de turnover.

create table if not exists rh_turnover (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  nome text not null,
  cargo text not null default '',
  empresa text not null,
  data_admissao date not null,
  data_demissao date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_rh_turnover_company on rh_turnover (company_id);
create index if not exists idx_rh_turnover_admissao on rh_turnover (data_admissao desc);

alter table rh_turnover enable row level security;

drop policy if exists isolamento_empresa_rh_turnover on rh_turnover;
create policy isolamento_empresa_rh_turnover on rh_turnover
  for all using (company_id = current_company_id()) with check (company_id = current_company_id());

drop trigger if exists stamp_company_id_rh_turnover on rh_turnover;
create trigger stamp_company_id_rh_turnover
  before insert on rh_turnover
  for each row execute function stamp_company_id();

-- Carga inicial: movimentações enviadas pelo RH em set/2026 (GVEL).
do $$
declare
  v_gvel_id uuid := '0923c894-85ca-45c1-ba1b-3124d19b4d65';
begin
  if exists (select 1 from rh_turnover where company_id = v_gvel_id) then
    return;
  end if;

  insert into rh_turnover (company_id, nome, cargo, empresa, data_admissao, data_demissao) values
    (v_gvel_id, 'MARCELO JORGE SANTOS', 'ANALISTA DE FROTA', 'GVEL DIESEL', '2026-08-01', null),
    (v_gvel_id, 'HELIO DE OLIVEIRA MACHADO', 'PINTOR AUTOMOTIVO', 'GVEL DIESEL', '2026-08-01', null),
    (v_gvel_id, 'LEONARDO SANTOS NASCIMENTO', 'POLIDOR', 'GVEL DIESEL', '2026-08-14', null),
    (v_gvel_id, 'WELLINTON DE OLIVEIRA MARQUES', 'MECANICO A', 'GVEL DIESEL', '2026-08-17', null),
    (v_gvel_id, 'BEATRIZ RODRIGUES NAVARRETE', 'AUXILIAR DE LIMPEZA', 'GVEL DIESEL', '2026-08-19', null),
    (v_gvel_id, 'RAUL ALEXANDRE DE LIMA', 'AUXILIAR ADMINISTRATIVO', 'GVEL DIESEL', '2026-09-21', null),
    (v_gvel_id, 'CAROLINA DE CASSIA FRANCO CARDOSO', 'AUXILIAR ADMINISTRATIVO', 'GVEL DIESEL', '2026-09-23', null),
    (v_gvel_id, 'MAURICIO INACIO DA SILVA', 'AUX.MECANICO', 'GVEL DIESEL', '2026-05-06', '2026-08-31'),
    (v_gvel_id, 'RODRIGO FRANCISCO', 'CORDENADOR', 'GVEL DIESEL', '2026-04-20', '2026-09-19'),
    (v_gvel_id, 'RAI MILLER LEMOS DE ASSIS', 'MECANICO DIESEL A', 'GVEL LEVES', '2026-08-01', null),
    (v_gvel_id, 'ROBERT ALVES DE FRANCA', 'AUX.MECANICO', 'GVEL LEVES', '2026-08-13', null),
    (v_gvel_id, 'MYQUEIAS RAMOS GUILHEN', 'ANALISTA DE FROTA', 'GV TRANSPORTES', '2026-08-01', null),
    (v_gvel_id, 'HUANDERSON DONIZETE DOS SANTOS', 'MOTORISTA', 'GV TRANSPORTES', '2026-08-10', null),
    (v_gvel_id, 'ANDERSON LIMA DOS SANTOS', 'MOTORISTA', 'GV TRANSPORTES', '2026-09-01', null),
    (v_gvel_id, 'DENYS RENE DE BOVI', 'MOTORISTA', 'GV TRANSPORTES', '2026-05-11', '2026-08-07'),
    (v_gvel_id, 'ANGELO JOSE DE OLIVEIRA BARBOSA NUNES', 'MOTORISTA', 'GV TRANSPORTES', '2026-05-19', '2026-08-07'),
    (v_gvel_id, 'FABIANO PEREIRA PINOTTI', 'MOTORISTA', 'GV TRANSPORTES', '2026-06-01', '2026-08-26');
end $$;

-- Faz a API do Supabase enxergar a tabela nova na hora.
notify pgrst, 'reload schema';
