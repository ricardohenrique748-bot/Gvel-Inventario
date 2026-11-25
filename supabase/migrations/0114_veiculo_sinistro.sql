-- ============================================================
-- 0114: Situação "SINISTRO" no veículo (pedido para a Localiza)
--
-- Situação passa a ter 3 valores: Operante / Inoperante / Sinistro.
-- Fica em dois campos para não quebrar nada que já usa `operante`:
--   * operante (já existia)
--   * sinistro (novo) — veículo sinistrado SEMPRE fica com operante = false.
--
-- A trava da 0109 (só administrador muda a situação de veículo já
-- cadastrado) passa a valer também para o sinistro, e o histórico
-- (veiculos_situacao_historico) registra de/para do sinistro.
-- Pode rodar de novo sem problema.
-- ============================================================

alter table veiculos add column if not exists sinistro boolean not null default false;

alter table veiculos_situacao_historico add column if not exists de_sinistro boolean;
alter table veiculos_situacao_historico add column if not exists para_sinistro boolean;

-- Mantém os dois campos coerentes (vale para app antigo, navegador e SQL manual):
--   marcou sinistro      -> operante = false
--   marcou operante      -> sinistro = false
create or replace function public.normaliza_situacao_veiculo()
returns trigger
language plpgsql
as $$
begin
  if new.sinistro and new.operante then
    if tg_op = 'UPDATE' and not old.sinistro then
      new.operante := false;          -- acabou de marcar sinistro
    else
      new.sinistro := false;          -- acabou de marcar operante
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists a_normaliza_situacao_veiculo on veiculos;
create trigger a_normaliza_situacao_veiculo
  before insert or update of operante, sinistro on veiculos
  for each row
  execute function public.normaliza_situacao_veiculo();

-- Trava de administrador (0109) agora cobre operante E sinistro.
create or replace function public.trava_situacao_veiculo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome text;
  v_admin boolean := public.usuario_eh_admin();
begin
  if new.operante is not distinct from old.operante
     and new.sinistro is not distinct from old.sinistro then
    return new;
  end if;

  select nome into v_nome from usuarios where id = auth.uid();

  insert into veiculos_situacao_historico
    (veiculo_id, placa, company_id, de_operante, para_operante, de_sinistro, para_sinistro,
     resultado, usuario_id, usuario_nome)
  values
    (new.id, new.placa, new.company_id, old.operante, new.operante, old.sinistro, new.sinistro,
     case when v_admin then 'alterado' else 'bloqueado' end,
     auth.uid(), coalesce(v_nome, case when auth.uid() is null then 'SISTEMA' else null end));

  if not v_admin then
    new.operante := old.operante;
    new.sinistro := old.sinistro;
  end if;

  return new;
end;
$$;

drop trigger if exists trava_situacao_veiculo on veiculos;
create trigger trava_situacao_veiculo
  before update of operante, sinistro on veiculos
  for each row
  execute function public.trava_situacao_veiculo();
