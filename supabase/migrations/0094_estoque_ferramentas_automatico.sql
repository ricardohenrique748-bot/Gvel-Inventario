-- Inventário de ferramentas — o banco passa a manter o disponível sempre certo.
--
-- Antes o app fazia "ler disponível, somar/subtrair, gravar" a cada retirada,
-- devolução, exclusão ou edição. Qualquer falha silenciosa (erro ignorado,
-- duas operações ao mesmo tempo lendo o mesmo valor antigo, retirada excluída
-- só na cópia local) deixava a ferramenta "em uso" sem retirada aberta — ex.:
-- VCI 3 SCANIA devolvida e ainda 0/1, CHAVE ALLEN 19MM sem nenhuma saída.
--
-- Regra única: disponível = total − soma das retiradas com status 'em_uso'
-- (nunca abaixo de 0). O que o app gravar em quantidade_disponivel é
-- recalculado por esta regra, então o estoque não diverge mais.

create or replace function ferramenta_qtd_em_uso(p_ferramenta_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(quantidade), 0)::integer
    from ferramentas_retiradas
   where ferramenta_id = p_ferramenta_id
     and status = 'em_uso'
$$;

-- Toda gravação em ferramentas recalcula o disponível.
create or replace function ferramentas_recalcula_disponivel()
returns trigger
language plpgsql
as $$
begin
  new.quantidade_disponivel := greatest(0, coalesce(new.quantidade_total, 0) - ferramenta_qtd_em_uso(new.id));
  return new;
end;
$$;

drop trigger if exists trg_ferramentas_recalcula_disponivel on ferramentas;
create trigger trg_ferramentas_recalcula_disponivel
  before insert or update on ferramentas
  for each row execute function ferramentas_recalcula_disponivel();

-- Toda mudança nas retiradas (retirada, devolução, exclusão, troca de
-- ferramenta/quantidade) recalcula a(s) ferramenta(s) envolvida(s).
create or replace function retiradas_recalcula_ferramenta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    update ferramentas set quantidade_disponivel = quantidade_disponivel where id = old.ferramenta_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') and (tg_op = 'INSERT' or new.ferramenta_id is distinct from old.ferramenta_id) then
    update ferramentas set quantidade_disponivel = quantidade_disponivel where id = new.ferramenta_id;
  end if;
  return null; -- AFTER trigger
end;
$$;

drop trigger if exists trg_retiradas_recalcula_ferramenta on ferramentas_retiradas;
create trigger trg_retiradas_recalcula_ferramenta
  after insert or update or delete on ferramentas_retiradas
  for each row execute function retiradas_recalcula_ferramenta();

-- Acerta agora todas as ferramentas que já estão divergentes.
update ferramentas f
   set quantidade_disponivel = quantidade_disponivel
 where f.quantidade_disponivel <> greatest(0, f.quantidade_total - ferramenta_qtd_em_uso(f.id));
