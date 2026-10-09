-- Reconcilia o estoque das ferramentas com as retiradas em aberto.
-- Corrige ferramentas que aparecem "em uso" sem nenhuma saída registrada
-- (retirada excluída ou editada antes da correção no app).
--
-- Regra: disponível = total − soma das retiradas com status 'em_uso'
-- (nunca abaixo de 0). Rode o PASSO 1 para ver o que muda; depois o PASSO 2.

-- PASSO 1 — prévia: só lista as ferramentas que estão divergentes.
select f.nome, f.codigo, f.quantidade_total as total,
       f.quantidade_disponivel as disponivel_atual,
       greatest(0, f.quantidade_total - coalesce(r.em_uso, 0)) as disponivel_correto,
       coalesce(r.em_uso, 0) as em_uso_pelas_retiradas
  from ferramentas f
  left join (
    select ferramenta_id, sum(quantidade) as em_uso
      from ferramentas_retiradas
     where status = 'em_uso'
     group by ferramenta_id
  ) r on r.ferramenta_id = f.id
 where f.quantidade_disponivel <> greatest(0, f.quantidade_total - coalesce(r.em_uso, 0))
 order by f.nome;

-- PASSO 2 — corrige (descomente e rode depois de conferir a prévia).
-- update ferramentas f
--    set quantidade_disponivel = greatest(0, f.quantidade_total - coalesce(r.em_uso, 0))
--   from (
--     select ff.id, (select sum(quantidade) from ferramentas_retiradas
--                     where ferramenta_id = ff.id and status = 'em_uso') as em_uso
--       from ferramentas ff
--   ) r
--  where r.id = f.id
--    and f.quantidade_disponivel <> greatest(0, f.quantidade_total - coalesce(r.em_uso, 0));
