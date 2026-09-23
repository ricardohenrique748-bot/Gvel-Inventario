-- Multi-empresa (Fase 1) — fecha uma brecha de escalonamento de privilégio:
-- a policy "usuarios_isolamento_empresa" (0072) só exige que company_id não
-- mude sem ser master admin, mas não protegia a coluna is_master_admin.
-- Um usuário comum atualizando a própria linha sem mexer no company_id
-- passava no WITH CHECK mesmo definindo is_master_admin = true sozinho.
--
-- Este trigger bloqueia qualquer alteração em is_master_admin feita por
-- quem não é master admin, mesmo que a chamada não passe pela tela (ex.:
-- alguém chamando a API do Supabase direto). A tela (UsuariosTab) só envia
-- essa coluna quando quem está logado já é master admin, então isso nunca
-- deve disparar em uso normal — só protege contra tentativa de burlar.

create or replace function protect_is_master_admin()
returns trigger
language plpgsql
as $$
begin
  if new.is_master_admin is distinct from old.is_master_admin then
    -- auth.uid() só existe numa requisição de usuário logado (anon/authenticated,
    -- passando pelo RLS). Chamadas com a service role key (nossas Edge
    -- Functions, ex.: create-usuario) não têm auth.uid() — essas já validam
    -- a permissão no próprio código da função antes de chegar aqui, e a
    -- service role já ignora RLS por natureza, então não se aplica esse bloqueio.
    if auth.uid() is not null and not is_master_admin_user() then
      raise exception 'Apenas um admin master pode alterar esta permissão.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists usuarios_protect_master_admin on usuarios;
create trigger usuarios_protect_master_admin
  before update on usuarios
  for each row execute function protect_is_master_admin();
