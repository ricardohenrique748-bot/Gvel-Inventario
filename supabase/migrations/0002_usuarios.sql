-- Gvel Diesel — cadastro de usuários (contas de login)
-- Rode este arquivo no SQL Editor do seu projeto Supabase (ou via `supabase db push`)
-- depois de já ter aplicado 0001_init.sql.

-- auth.users não pode ser lido pelo front-end sem a service role key, então
-- guardamos uma cópia leve dos dados do usuário aqui, preenchida pela Edge
-- Function `create-usuario` no momento da criação da conta.
create table if not exists usuarios (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null,
  email text not null,
  telefone text,
  created_at timestamptz not null default now()
);

alter table usuarios enable row level security;

create policy "authenticated_all_usuarios" on usuarios for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
