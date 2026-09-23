-- Multi-empresa (Fase 1) — o gatilho que cria automaticamente o perfil em
-- `usuarios` para toda conta nova em `auth.users` (0021_usuarios_auto_perfil)
-- agora também grava a empresa, lida de `raw_user_meta_data->>'company_id'`
-- (a Edge Function create-usuario passa isso na criação). Sem esse dado
-- (ex.: convite manual via Supabase Studio), cai na GVEL por segurança —
-- nunca fica sem empresa.

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_company_id uuid;
begin
  v_company_id := nullif(new.raw_user_meta_data->>'company_id', '')::uuid;
  if v_company_id is null or not exists (select 1 from companies where id = v_company_id) then
    v_company_id := '0923c894-85ca-45c1-ba1b-3124d19b4d65';
  end if;

  insert into public.usuarios (id, nome, email, company_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)),
    new.email,
    v_company_id
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
