-- ============================================================
-- 0061: Quantidades de Insumo Aceitam Decimais (ex: baixa em ML de um
-- estoque medido em LT)
--
-- Até aqui as quantidades de insumo eram `integer`, então um óleo medido em
-- LT só podia ser baixado em litros inteiros. Isso troca as colunas para
-- `numeric(12,3)` (3 casas decimais — dá pra registrar até 1 ml de precisão
-- num estoque em litros) para permitir baixas fracionárias.
-- ============================================================

ALTER TABLE itens_consumo
  ALTER COLUMN quantidade_atual TYPE numeric(12, 3),
  ALTER COLUMN quantidade_minima TYPE numeric(12, 3),
  ALTER COLUMN capacidade_maxima TYPE numeric(12, 3);

ALTER TABLE consumo_baixas
  ALTER COLUMN quantidade TYPE numeric(12, 3),
  ALTER COLUMN quantidade_restante TYPE numeric(12, 3);
