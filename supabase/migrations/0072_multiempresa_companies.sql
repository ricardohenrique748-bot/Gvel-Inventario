-- Multi-empresa (Fase 1) — fundação: tabela `companies`, vínculo de `usuarios`
-- com a empresa e as funções auxiliares que o RLS de todas as demais tabelas
-- vai usar (migration 0073). Não apaga nem altera nenhum dado existente.

create extension if not exists "pgcrypto";

-- ========== Tabela companies ==========

create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cnpj text,
  logo text,
  sistema_label text not null default 'SISTEMA',
  primary_color text not null default '#E23B2E',
  secondary_color text,
  observacoes text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table companies enable row level security;

-- Empresa principal já existente. Id fixo (gerado uma única vez) para que as
-- próximas migrations possam referenciá-lo sem depender de variáveis entre
-- arquivos de migration.
insert into companies (id, name, cnpj, logo, sistema_label, primary_color, observacoes, status)
values (
  '0923c894-85ca-45c1-ba1b-3124d19b4d65',
  'G VEL DIESEL & TRANSPORTES LTDA',
  '09.521.849/0001-90',
  null,
  'CENTER TRUCK',
  '#E23B2E',
  'Empresa Principal',
  'active'
)
on conflict (id) do nothing;

create or replace function set_companies_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists companies_set_updated_at on companies;
create trigger companies_set_updated_at
  before update on companies
  for each row execute function set_companies_updated_at();

-- ========== usuarios: vínculo com empresa ==========

alter table usuarios add column if not exists company_id uuid references companies(id);
alter table usuarios add column if not exists is_master_admin boolean not null default false;

update usuarios set company_id = '0923c894-85ca-45c1-ba1b-3124d19b4d65' where company_id is null;

alter table usuarios alter column company_id set not null;

create index if not exists idx_usuarios_company on usuarios (company_id);

-- Preserva o acesso total que essas duas contas já têm hoje (ver
-- isAdminUsuario em src/lib/permissoes.ts) — agora também como master admin
-- da plataforma multi-empresa.
update usuarios
set is_master_admin = true
where lower(email) in ('victor@gveldiesel.com', 'ricardo_h.16@hotmail.com');

-- ========== Funções auxiliares para RLS ==========

-- security definer: precisa ignorar o RLS de `usuarios` para não cair em
-- recursão (a política de `usuarios` também vai chamar esta função).
create or replace function current_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select company_id from usuarios where id = auth.uid()
$$;

create or replace function is_master_admin_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_master_admin from usuarios where id = auth.uid()), false)
$$;

-- ========== RLS de usuarios e companies ==========

-- Remove TODAS as policies existentes em `usuarios` antes de criar a nova,
-- em vez de tentar adivinhar nomes: RLS combina policies permissivas com OR,
-- então qualquer policy antiga esquecida (ex.: "authenticated_all_usuarios",
-- "atualizar_usuarios") continuaria liberando acesso irrestrito por baixo da
-- nova política de isolamento.
do $$
declare
  pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'usuarios'
  loop
    execute format('drop policy %I on usuarios', pol.policyname);
  end loop;
end $$;

create policy "usuarios_isolamento_empresa" on usuarios for all
  using (company_id = current_company_id() or is_master_admin_user())
  with check (company_id = current_company_id() or is_master_admin_user());

create policy "companies_leitura_propria_ou_master" on companies for select
  using (id = current_company_id() or is_master_admin_user());

create policy "companies_update_admin_empresa_ou_master" on companies for update
  using (
    is_master_admin_user()
    or (id = current_company_id() and exists (
      select 1 from usuarios where id = auth.uid() and nivel = 'admin'
    ))
  )
  with check (
    is_master_admin_user()
    or (id = current_company_id() and exists (
      select 1 from usuarios where id = auth.uid() and nivel = 'admin'
    ))
  );

create policy "companies_insert_master" on companies for insert
  with check (is_master_admin_user());

create policy "companies_delete_master" on companies for delete
  using (is_master_admin_user());
