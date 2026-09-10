-- ============================================================
-- 0058: Lançamentos do Fluxo de Caixa (Financeiro)
-- ============================================================
-- Registro manual de entradas e saídas de caixa, no mesmo formato da
-- planilha de controle já usada pela empresa (data, movimentação,
-- descrição, valor e observação).

CREATE TABLE IF NOT EXISTS fluxo_caixa_lancamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data date NOT NULL,
  movimentacao text NOT NULL CHECK (movimentacao IN ('entrada', 'saida')),
  descricao text NOT NULL,
  valor numeric(14, 2) NOT NULL CHECK (valor >= 0),
  observacao text,
  usuario_nome text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fluxo_caixa_lancamentos_data ON fluxo_caixa_lancamentos (data DESC, created_at DESC);

ALTER TABLE fluxo_caixa_lancamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "permitir_todos_fluxo_caixa_lancamentos" ON fluxo_caixa_lancamentos;

CREATE POLICY "permitir_todos_fluxo_caixa_lancamentos"
  ON fluxo_caixa_lancamentos FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE fluxo_caixa_lancamentos;
