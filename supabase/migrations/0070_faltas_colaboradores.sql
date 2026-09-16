-- ============================================================
-- 0070: Faltas de Colaboradores (RH)
--
-- A aba "Faltas" do RH não tem planilha/API — a fonte é o "Relatório de
-- Ausências" em PDF exportado do PROPWin (o programa de ponto). O usuário
-- importa esse PDF manualmente sempre que quiser atualizar; o parser roda
-- no navegador (src/lib/faltasPdfParser.ts) e grava aqui.
--
-- UNIQUE (matricula, data): reimportar o mesmo relatório (ou um mês que se
-- sobrepõe a outro já importado) não duplica a falta do mesmo colaborador
-- no mesmo dia — só atualiza os dados (departamento/função podem mudar).
-- ============================================================

CREATE TABLE IF NOT EXISTS lotes_importacao_faltas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_arquivo text NOT NULL,
  empresa text,
  periodo_inicio date,
  periodo_fim date,
  total_registros integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS faltas_colaboradores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id uuid REFERENCES lotes_importacao_faltas (id) ON DELETE SET NULL,
  matricula text NOT NULL,
  nome text NOT NULL,
  funcao text,
  cartao text,
  departamento text,
  data date NOT NULL,
  observacao text NOT NULL DEFAULT 'FALTA',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (matricula, data)
);

CREATE INDEX IF NOT EXISTS idx_faltas_colaboradores_data ON faltas_colaboradores (data DESC);
CREATE INDEX IF NOT EXISTS idx_faltas_colaboradores_lote ON faltas_colaboradores (lote_id);
CREATE INDEX IF NOT EXISTS idx_faltas_colaboradores_departamento ON faltas_colaboradores (departamento);

ALTER TABLE lotes_importacao_faltas ENABLE ROW LEVEL SECURITY;
ALTER TABLE faltas_colaboradores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "permitir_todos_lotes_importacao_faltas" ON lotes_importacao_faltas;
DROP POLICY IF EXISTS "permitir_todos_faltas_colaboradores" ON faltas_colaboradores;

CREATE POLICY "permitir_todos_lotes_importacao_faltas" ON lotes_importacao_faltas FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "permitir_todos_faltas_colaboradores" ON faltas_colaboradores FOR ALL TO public USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE lotes_importacao_faltas;
ALTER PUBLICATION supabase_realtime ADD TABLE faltas_colaboradores;
