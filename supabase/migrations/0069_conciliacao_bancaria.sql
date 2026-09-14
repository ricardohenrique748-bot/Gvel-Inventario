-- ============================================================
-- 0069: Conciliação Bancária (Controle de Viagens, grupo Gestão)
--
-- Importa um extrato bancário (OFX) como um "lote de importação", quebra
-- em transações individuais, e permite vincular cada transação a um
-- lançamento de Contas a Pagar/Receber (0065) já existente. O parser OFX
-- já existia no código (src/lib/ofxParser.ts), só nunca tinha sido ligado
-- a uma tabela/UI de verdade.
--
-- `fitid` é o identificador único da transação dentro do OFX do banco —
-- usado pra não duplicar a mesma transação se o mesmo extrato for
-- reimportado por engano.
-- ============================================================

CREATE TABLE IF NOT EXISTS lotes_importacao_extrato (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_arquivo text NOT NULL,
  banco text,
  conta_bancaria_id text,
  conta_bancaria_nome text,
  data_inicio date,
  data_fim date,
  total_transacoes integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transacoes_extrato (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id uuid NOT NULL REFERENCES lotes_importacao_extrato (id) ON DELETE CASCADE,
  fitid text NOT NULL,
  data date NOT NULL,
  descricao text NOT NULL,
  valor numeric(14, 2) NOT NULL,
  tipo text,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'conciliada', 'divergente', 'ignorada')),
  conta_pagar_receber_id uuid REFERENCES contas_pagar_receber (id) ON DELETE SET NULL,
  conta_pagar_receber_descricao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fitid)
);

CREATE INDEX IF NOT EXISTS idx_transacoes_extrato_lote ON transacoes_extrato (lote_id);
CREATE INDEX IF NOT EXISTS idx_transacoes_extrato_status ON transacoes_extrato (status);
CREATE INDEX IF NOT EXISTS idx_transacoes_extrato_data ON transacoes_extrato (data DESC);

ALTER TABLE lotes_importacao_extrato ENABLE ROW LEVEL SECURITY;
ALTER TABLE transacoes_extrato ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "permitir_todos_lotes_importacao_extrato" ON lotes_importacao_extrato;
DROP POLICY IF EXISTS "permitir_todos_transacoes_extrato" ON transacoes_extrato;

CREATE POLICY "permitir_todos_lotes_importacao_extrato" ON lotes_importacao_extrato FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "permitir_todos_transacoes_extrato" ON transacoes_extrato FOR ALL TO public USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE lotes_importacao_extrato;
ALTER PUBLICATION supabase_realtime ADD TABLE transacoes_extrato;
