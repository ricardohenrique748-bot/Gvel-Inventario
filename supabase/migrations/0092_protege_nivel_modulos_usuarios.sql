-- Multi-empresa — fecha a brecha de escalonamento de privilégio que voltou
-- com a 0072: ela apagou todas as policies de `usuarios` (inclusive a
-- "atualizar_usuarios" da 0012, que impedia o usuário comum de se promover)
-- e criou uma única policy FOR ALL que só confere a empresa. Com isso,
-- qualquer usuário logado podia, chamando a API do Supabase direto:
--   - mudar o próprio `nivel` para 'admin' ou liberar `modulos` para si;
--   - editar ou apagar o cadastro de colegas da mesma empresa.
-- A 0076 só protegia a coluna is_master_admin.
--
-- Regras daqui em diante (chamadas de usuário logado; a service role das
-- Edge Functions não tem auth.uid() e segue sem bloqueio, como na 0076):
--   - master admin: tudo, como antes;
--   - admin da empresa: edita qualquer usuário da própria empresa (inclusive
--     nivel e modulos), cria e remove cadastros da própria empresa;
--   - usuário comum: só edita o próprio cadastro, e só os campos pessoais
--     (nome, telefone, foto, fcm_token, deve_trocar_senha, updated_at).

-- security definer pelo mesmo motivo de current_company_id(): evita recursão
-- no RLS de `usuarios`.
create or replace function is_admin_empresa_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select nivel = 'admin' from usuarios where id = auth.uid()), false)
$$;

create or replace function protect_usuarios_campos_sensiveis()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is null or is_master_admin_user() or is_admin_empresa_user() then
    return new;
  end if;

  if new.id <> auth.uid() then
    raise exception 'Apenas um admin pode alterar o cadastro de outro usuário.';
  end if;

  if new.nivel is distinct from old.nivel
     or new.modulos is distinct from old.modulos
     or new.company_id is distinct from old.company_id
     or new.empresa_id is distinct from old.empresa_id
     or new.email is distinct from old.email then
    raise exception 'Apenas um admin pode alterar nível, módulos, empresa ou e-mail.';
  end if;

  return new;
end;
$$;

drop trigger if exists usuarios_protect_campos_sensiveis on usuarios;
create trigger usuarios_protect_campos_sensiveis
  before update on usuarios
  for each row execute function protect_usuarios_campos_sensiveis();

-- Troca a policy FOR ALL por uma por operação, para que INSERT e DELETE
-- também exijam admin (o cadastro e a exclusão normais passam pelas Edge
-- Functions create-usuario / delete-usuario, com service role).
drop policy if exists "usuarios_isolamento_empresa" on usuarios;

create policy "usuarios_select_empresa" on usuarios for select
  using (company_id = current_company_id() or is_master_admin_user());

create policy "usuarios_update_empresa" on usuarios for update
  using (company_id = current_company_id() or is_master_admin_user())
  with check (company_id = current_company_id() or is_master_admin_user());

create policy "usuarios_insert_admin" on usuarios for insert
  with check (
    is_master_admin_user()
    or (company_id = current_company_id() and is_admin_empresa_user())
  );

create policy "usuarios_delete_admin" on usuarios for delete
  using (
    is_master_admin_user()
    or (company_id = current_company_id() and is_admin_empresa_user())
  );
