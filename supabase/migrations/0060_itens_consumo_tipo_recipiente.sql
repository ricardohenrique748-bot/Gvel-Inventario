-- ============================================================
-- 0060: Tipo de Recipiente dos Insumos (Barril x Cilindro de Gás)
-- ============================================================
-- Até agora todo insumo com capacidade_maxima preenchida virava um
-- "barril" visualmente (tambor de óleo). Isso adiciona um segundo tipo de
-- recipiente — cilindro de gás refrigerante — para itens como o R-134a,
-- que não têm a cara de um tambor de óleo comum.

ALTER TABLE itens_consumo
  ADD COLUMN IF NOT EXISTS tipo_recipiente text NOT NULL DEFAULT 'barril'
  CHECK (tipo_recipiente IN ('barril', 'cilindro_gas'));
