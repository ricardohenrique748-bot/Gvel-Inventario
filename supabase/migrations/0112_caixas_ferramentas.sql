-- ============================================================
-- 0112: Caixas de Ferramentas no Supabase
--
-- As caixas de ferramentas (Estoque → Caixas de Ferramentas) ficavam só no
-- localStorage do aparelho onde foram cadastradas — outro celular/computador,
-- ou o mesmo app reinstalado, mostrava "0 caixas". Esta tabela passa a ser a
-- fonte das caixas, compartilhada entre todos os usuários da empresa.
--
-- Cada caixa fica inteira em `dados` (jsonb, mesmo formato do tipo
-- CaixaFerramenta do app), pra não ter que mudar o banco a cada campo novo.
-- O app envia sozinho, uma vez, as caixas que ainda estiverem no aparelho.
-- ============================================================

create table if not exists caixas_ferramentas (
  id text primary key,
  company_id uuid not null references companies (id),
  dados jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_caixas_ferramentas_company on caixas_ferramentas (company_id);

-- company_id preenchido sozinho com a empresa ativa (mesma função das outras tabelas).
drop trigger if exists stamp_company_id_caixas_ferramentas on caixas_ferramentas;
create trigger stamp_company_id_caixas_ferramentas
  before insert on caixas_ferramentas
  for each row execute function stamp_company_id();

alter table caixas_ferramentas enable row level security;

drop policy if exists isolamento_empresa_caixas_ferramentas on caixas_ferramentas;
create policy isolamento_empresa_caixas_ferramentas on caixas_ferramentas
  for all
  using (company_id = current_company_id())
  with check (company_id = current_company_id());

do $$
begin
  alter publication supabase_realtime add table caixas_ferramentas;
exception when duplicate_object then null;
end $$;
