-- ============================================================
-- 0056: Quantidade Restante na Baixa de Consumo
--
-- Complementa a 0055: além de saber de qual tambor a baixa saiu, o
-- histórico precisa mostrar quanto sobrou no tambor logo depois daquela
-- baixa (ex: "restaram 20 LT"). Sem isso, só dava para ver quanto foi
-- retirado, não o saldo resultante.
-- ============================================================

ALTER TABLE consumo_baixas
  ADD COLUMN IF NOT EXISTS quantidade_restante integer;
