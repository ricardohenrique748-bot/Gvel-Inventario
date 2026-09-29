-- Aprovação da Liberação do Veículo.
-- Qualquer usuário faz o checklist (fotos) e envia; a liberação fica
-- "aguardando aprovação" (status_liberacao nulo). Só o aprovador
-- (mariaclara@gveldiesel.com) pode definir o status final
-- (liberado / liberado_restricao / nao_liberado).
--
-- A trava fica no banco (trigger), não só na tela: o RLS de `inspecoes`
-- deixa qualquer usuário da empresa fazer update.

alter table inspecoes
  add column if not exists aprovado_por text,
  add column if not exists aprovado_em timestamptz;

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
    if v_email <> 'mariaclara@gveldiesel.com' then
      raise exception 'Somente mariaclara@gveldiesel.com pode aprovar a liberação do veículo.';
    end if;
    new.aprovado_por := v_email;
    new.aprovado_em := now();
  end if;

  -- Depois de aprovada, ninguém além do aprovador altera a liberação.
  if tg_op = 'UPDATE' and old.status_liberacao is not null and v_email <> 'mariaclara@gveldiesel.com' then
    raise exception 'Liberação já aprovada não pode ser alterada.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_trava_aprovacao_liberacao on inspecoes;
create trigger trg_trava_aprovacao_liberacao
  before insert or update on inspecoes
  for each row execute function trava_aprovacao_liberacao();
