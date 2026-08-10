-- Gvel Diesel — garante que toda conta de autenticação tenha um perfil em `usuarios`,
-- mesmo se criada fora do fluxo da Edge Function `create-usuario` (ex.: convite manual
-- pelo Supabase Studio, magic link, etc). Sem isso, o nome de quem registrou a
-- movimentação fica em branco na tela ("Registrado por: —"), porque o join com
-- `usuarios` não encontra correspondência para o `usuario_entrada_id`/`usuario_saida_id`.
-- Rode este arquivo no SQL Editor do seu projeto Supabase (ou via `supabase db push`)
-- depois de já ter aplicado as migrations anteriores.

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.usuarios (id, nome, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)), new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Backfill: cria perfil para contas de autenticação já existentes que ficaram órfãs
-- (login válido em auth.users, mas sem linha correspondente em usuarios).
insert into public.usuarios (id, nome, email)
select u.id, split_part(u.email, '@', 1), u.email
from auth.users u
left join public.usuarios p on p.id = u.id
where p.id is null;
