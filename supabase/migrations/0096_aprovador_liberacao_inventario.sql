-- Aprovador da Liberação do Veículo passa a ser inventario@gveldiesel.com
-- (antes mariaclara@gveldiesel.com, migration 0086). Mesma regra de
-- APROVADOR_LIBERACAO_EMAIL em src/pages/inspecao/types.ts.

create or replace function trava_aprovacao_liberacao()
returns trigger
language plpgsql
as $$
declare
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if new.modelo is distinct from 'liberacao' then
    return new;
  end if;

  if new.status_liberacao is not null
     and (tg_op = 'INSERT' or old.status_liberacao is distinct from new.status_liberacao) then
    if v_email <> 'inventario@gveldiesel.com' then
      raise exception 'Somente inventario@gveldiesel.com pode aprovar a liberação do veículo.';
    end if;
    new.aprovado_por := v_email;
    new.aprovado_em := now();
  end if;

  -- Depois de aprovada, ninguém além do aprovador altera a liberação.
  if tg_op = 'UPDATE' and old.status_liberacao is not null and v_email <> 'inventario@gveldiesel.com' then
    raise exception 'Liberação já aprovada não pode ser alterada.';
  end if;

  return new;
end;
$$;
