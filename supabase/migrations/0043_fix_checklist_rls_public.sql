-- ============================================================
-- Fix RLS: Permitir leitura e escrita para checklist_os e checklist_itens (Web + APK)
-- ============================================================

ALTER TABLE checklist_os ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_all_checklist_os" ON checklist_os;
DROP POLICY IF EXISTS "auth_all_checklist_itens" ON checklist_itens;
DROP POLICY IF EXISTS "permitir_todos_checklist_os" ON checklist_os;
DROP POLICY IF EXISTS "permitir_todos_checklist_itens" ON checklist_itens;

CREATE POLICY "permitir_todos_checklist_os" ON checklist_os FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "permitir_todos_checklist_itens" ON checklist_itens FOR ALL TO public USING (true) WITH CHECK (true);
