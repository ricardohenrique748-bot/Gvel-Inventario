-- ============================================================
-- 0068: Código do Banco em Contas Bancárias
--
-- O formulário de Nova Conta Bancária passou a pedir "Código do Banco"
-- (ex: 341) separado do "Nome do Banco" (ex: Itaú) — antes só existia um
-- campo `banco` livre.
-- ============================================================

ALTER TABLE contas_bancarias
  ADD COLUMN IF NOT EXISTS codigo_banco text NOT NULL DEFAULT '';
