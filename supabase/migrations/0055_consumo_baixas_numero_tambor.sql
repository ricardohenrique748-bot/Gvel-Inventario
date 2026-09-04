-- ============================================================
-- 0055: Número do Tambor na Baixa de Consumo
--
-- Ao dar baixa num insumo tipo barril (óleo etc.), o histórico só guardava
-- quantidade, responsável e placa — não dava para saber de qual tambor
-- físico (ex: "GV 6") aquela baixa saiu. Esta coluna grava o
-- `numero_tambor_atual` do item no momento exato da baixa, permitindo
-- mostrar no histórico "Tambor GV 6 -> Placa XYZ".
-- ============================================================

ALTER TABLE consumo_baixas
  ADD COLUMN IF NOT EXISTS numero_tambor integer;
