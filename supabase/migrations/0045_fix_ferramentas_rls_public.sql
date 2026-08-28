-- ============================================================
-- Fix RLS: Permitir leitura e escrita pública para ferramentas e ferramentas_retiradas
-- ============================================================

ALTER TABLE ferramentas ENABLE ROW LEVEL SECURITY;
ALTER TABLE ferramentas_retiradas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura ferramentas para autenticados" ON ferramentas;
DROP POLICY IF EXISTS "Permitir insercao ferramentas para autenticados" ON ferramentas;
DROP POLICY IF EXISTS "Permitir atualizacao ferramentas para autenticados" ON ferramentas;
DROP POLICY IF EXISTS "Permitir exclusao ferramentas para autenticados" ON ferramentas;

DROP POLICY IF EXISTS "Permitir leitura ferramentas_retiradas para autenticados" ON ferramentas_retiradas;
DROP POLICY IF EXISTS "Permitir insercao ferramentas_retiradas para autenticados" ON ferramentas_retiradas;
DROP POLICY IF EXISTS "Permitir atualizacao ferramentas_retiradas para autenticados" ON ferramentas_retiradas;
DROP POLICY IF EXISTS "Permitir exclusao ferramentas_retiradas para autenticados" ON ferramentas_retiradas;

DROP POLICY IF EXISTS "permitir_todos_ferramentas" ON ferramentas;
DROP POLICY IF EXISTS "permitir_todos_ferramentas_retiradas" ON ferramentas_retiradas;

CREATE POLICY "permitir_todos_ferramentas" ON ferramentas FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "permitir_todos_ferramentas_retiradas" ON ferramentas_retiradas FOR ALL TO public USING (true) WITH CHECK (true);
