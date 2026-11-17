-- Liberação do Veículo sem etapa de aprovação: quem faz o checklist já define
-- o status (liberado / com restrição / não liberado) e assina. Antes só
-- inventario@gveldiesel.com podia definir o status (migration 0096).
--
-- aprovado_por / aprovado_em continuam sendo preenchidos, agora com quem
-- concluiu a liberação. Depois de concluída, só admin ou o Inventário alteram.
-- Mesma regra em src/pages/inspecao/types.ts (APROVACAO_LIBERACAO_OBRIGATORIA).

create or replace function trava_aprovacao_liberacao()
returns trigger
language plpgsql
as $$
declare
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  -- Admin conferido direto em usuarios (is_admin_empresa_user não existe em produção).
  v_pode_alterar boolean := v_email = 'inventario@gveldiesel.com'
    or exists (select 1 from usuarios u where u.id = auth.uid() and u.nivel = 'admin');
begin
  if new.modelo is distinct from 'liberacao' then
    return new;
  end if;

  -- Depois de concluída, só admin ou o Inventário alteram a liberação.
  if tg_op = 'UPDATE' and old.status_liberacao is not null and not v_pode_alterar then
    raise exception 'Liberação já concluída não pode ser alterada.';
  end if;

  if new.status_liberacao is not null
     and (tg_op = 'INSERT' or old.status_liberacao is distinct from new.status_liberacao) then
    new.aprovado_por := nullif(v_email, '');
    new.aprovado_em := now();
  end if;

  return new;
end;
$$;
