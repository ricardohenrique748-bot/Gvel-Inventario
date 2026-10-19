-- Rankings do painel "Visão Geral" do Financeiro (Top 5 Clientes por
-- faturamento e Top 10 Planos de Conta por despesa), por mês. Complementa
-- painel_gerencial_divisoes (0082): a importação da planilha exportada do
-- dashboard grava os dois rankings junto com os números das divisões.
-- tipo = 'cliente' (valor = faturamento) ou 'plano' (valor = despesa).

create table if not exists painel_gerencial_rankings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  mes text not null,
  tipo text not null check (tipo in ('cliente', 'plano')),
  posicao int not null,
  nome text not null,
  valor numeric not null default 0,
  created_at timestamptz not null default now(),
  unique (company_id, mes, tipo, posicao)
);

alter table painel_gerencial_rankings enable row level security;
create index if not exists idx_painel_gerencial_rankings_company on painel_gerencial_rankings (company_id);

drop trigger if exists stamp_company_id_painel_gerencial_rankings on painel_gerencial_rankings;
create trigger stamp_company_id_painel_gerencial_rankings
  before insert on painel_gerencial_rankings
  for each row execute function stamp_company_id();

drop policy if exists "isolamento_empresa_painel_gerencial_rankings" on painel_gerencial_rankings;
create policy "isolamento_empresa_painel_gerencial_rankings" on painel_gerencial_rankings for all
  using (company_id = current_company_id())
  with check (company_id = current_company_id());

notify pgrst, 'reload schema';
