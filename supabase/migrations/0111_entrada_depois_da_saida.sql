-- ============================================================
-- 0111: Ordem das datas de entrada e saída (Gvel e Localiza)
--
-- Regra pedida pela operação:
--   1. A saída de uma movimentação tem que ser DEPOIS da entrada dela.
--   2. Uma nova entrada da mesma placa só pode ser DEPOIS da última saída —
--      os períodos no pátio (entrada → saída) de uma placa nunca se sobrepõem.
--      Entrada ainda aberta (sem saída) conta como "até hoje e além".
--
-- Isso também barra o caso que gerou entradas fantasmas "no pátio": uma
-- entrada aberta com data ANTERIOR a outra movimentação já encerrada da mesma
-- placa (ex.: SHH4B90 — aberta em 05/08 e outra de 10/08 a 26/08).
--
-- Vale para app, navegador e SQL manual. Só confere linhas que estão sendo
-- gravadas agora — dados antigos não são alterados (veja a consulta no fim
-- para listar conflitos que já existam).
-- ============================================================

create or replace function public.valida_periodo_movimentacao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conflito record;
  v_placa text;
begin
  if new.data_hora_entrada is null then
    return new;
  end if;

  if new.data_hora_saida is not null and new.data_hora_saida <= new.data_hora_entrada then
    raise exception 'A data de saída (%) tem que ser depois da entrada (%).',
      to_char(new.data_hora_saida at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'),
      to_char(new.data_hora_entrada at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI')
      using errcode = 'P0001';
  end if;

  select o.data_hora_entrada, o.data_hora_saida
    into v_conflito
    from movimentacoes o
   where o.veiculo_id = new.veiculo_id
     and o.id <> new.id
     and tstzrange(o.data_hora_entrada, coalesce(o.data_hora_saida, 'infinity'::timestamptz))
         && tstzrange(new.data_hora_entrada, coalesce(new.data_hora_saida, 'infinity'::timestamptz))
   order by o.data_hora_entrada desc
   limit 1;

  if found then
    select placa into v_placa from veiculos where id = new.veiculo_id;
    if v_conflito.data_hora_saida is null then
      raise exception 'A placa % ainda está no pátio (entrada de %). Registre a saída antes de dar uma nova entrada.',
        coalesce(v_placa, ''),
        to_char(v_conflito.data_hora_entrada at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI')
        using errcode = 'P0001';
    else
      raise exception 'A placa % já tem uma movimentação de % até %. A entrada tem que ser depois da última saída.',
        coalesce(v_placa, ''),
        to_char(v_conflito.data_hora_entrada at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'),
        to_char(v_conflito.data_hora_saida at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI')
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists valida_periodo_movimentacao on movimentacoes;
create trigger valida_periodo_movimentacao
  before insert or update of veiculo_id, data_hora_entrada, data_hora_saida on movimentacoes
  for each row
  execute function public.valida_periodo_movimentacao();

-- Conflitos que já existem (não bloqueiam nada, só aparecem se alguém editar
-- as datas dessas movimentações). Rode à parte para conferir:
--
-- select v.placa,
--        a.data_hora_entrada as entrada_a, a.data_hora_saida as saida_a,
--        b.data_hora_entrada as entrada_b, b.data_hora_saida as saida_b
--   from movimentacoes a
--   join movimentacoes b on b.veiculo_id = a.veiculo_id and b.id > a.id
--   join veiculos v on v.id = a.veiculo_id
--  where tstzrange(a.data_hora_entrada, coalesce(a.data_hora_saida, 'infinity'))
--     && tstzrange(b.data_hora_entrada, coalesce(b.data_hora_saida, 'infinity'))
--  order by v.placa;
