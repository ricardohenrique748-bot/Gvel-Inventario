-- Dados por divisão (GVel Diesel, GVel Leves, GV Distribuidora, GV
-- Transportes, Investimento) do painel "Visão Geral" do Financeiro — hoje
-- fixos no código (DADOS_MESES em Financeiro.tsx). Esta tabela permite
-- atualizar esses números por mês via importação de Excel, sem precisar
-- editar código a cada fechamento. Só os valores de faturamento/receitas/
-- despesas por divisão viram banco — os rankings de Top Clientes e Top
-- Planos de Conta continuam fixos no código por enquanto (fora do escopo
-- desta migration).

create table if not exists painel_gerencial_divisoes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  mes text not null,
  divisao_id text not null,
  divisao_nome text not null,
  faturamento numeric not null default 0,
  receitas numeric not null default 0,
  despesas numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, mes, divisao_id)
);

alter table painel_gerencial_divisoes enable row level security;
create index if not exists idx_painel_gerencial_divisoes_company on painel_gerencial_divisoes (company_id);

drop trigger if exists stamp_company_id_painel_gerencial_divisoes on painel_gerencial_divisoes;
create trigger stamp_company_id_painel_gerencial_divisoes
  before insert on painel_gerencial_divisoes
  for each row execute function stamp_company_id();

create or replace function set_painel_gerencial_divisoes_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists painel_gerencial_divisoes_set_updated_at on painel_gerencial_divisoes;
create trigger painel_gerencial_divisoes_set_updated_at
  before update on painel_gerencial_divisoes
  for each row execute function set_painel_gerencial_divisoes_updated_at();

-- Mesmo padrão restrito das demais tabelas de negócio (0077): sempre a
-- própria empresa, sem bypass de master admin — quem quiser mexer nos
-- dados de outra empresa "entra" nela pelo seletor de empresa.
create policy "isolamento_empresa_painel_gerencial_divisoes" on painel_gerencial_divisoes for all
  using (company_id = current_company_id())
  with check (company_id = current_company_id());
