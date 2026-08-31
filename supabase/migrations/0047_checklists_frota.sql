-- ============================================================
-- 0047: Checklist de Vistoria da Frota Leve no Banco
-- ============================================================
-- Antes esse checklist (Frotas > Checklist) ficava só no localStorage do
-- navegador, incluindo as fotos em base64 — nunca ia para o servidor, então
-- não tinha backup e não aparecia em outro aparelho. Esta migration cria as
-- tabelas para guardar isso de verdade no Supabase.

-- 1. Tabela dos registros de checklist (um por vistoria realizada)
CREATE TABLE IF NOT EXISTS checklists_frota (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Id do veículo no catálogo local da Frota Própria (não é FK para "veiculos"
  -- porque esse catálogo de frota própria é local/hardcoded, não a tabela de
  -- veículos do pátio).
  veiculo_id text,
  placa text NOT NULL,
  modelo_nome text,
  cliente_nome text,
  motorista_nome text NOT NULL,
  inspetor_nome text NOT NULL,
  km_atual integer NOT NULL DEFAULT 0,
  resultado text NOT NULL CHECK (resultado IN ('aprovado', 'aprovado_com_ressalvas', 'reprovado')),
  status_preventiva text,
  km_ultima_preventiva integer,
  km_limite_preventiva integer,
  km_restante_preventiva integer,
  km_rodados_preventiva integer,
  mensagem_preventiva text,
  observacoes_gerais text,
  foto_painel_url text,
  foto_capo_url text,
  foto_interna_url text,
  foto_frente_url text,
  foto_lado_esquerdo_url text,
  foto_traseira_url text,
  foto_lado_direito_url text,
  foto_pneu_diant_esq_url text,
  foto_pneu_diant_dir_url text,
  foto_pneu_tras_esq_url text,
  foto_pneu_tras_dir_url text,
  data_hora timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Itens checados dentro de cada registro (pneus, freios, iluminação, etc.)
CREATE TABLE IF NOT EXISTS checklist_frota_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id uuid NOT NULL REFERENCES checklists_frota (id) ON DELETE CASCADE,
  item_id text,
  categoria text NOT NULL,
  nome text NOT NULL,
  status text NOT NULL CHECK (status IN ('conforme', 'nao_conforme', 'nao_se_aplica')),
  observacao text
);

CREATE INDEX IF NOT EXISTS idx_checklist_frota_itens_checklist_id ON checklist_frota_itens (checklist_id);
CREATE INDEX IF NOT EXISTS idx_checklists_frota_veiculo_id ON checklists_frota (veiculo_id);
CREATE INDEX IF NOT EXISTS idx_checklists_frota_data_hora ON checklists_frota (data_hora DESC);

-- 3. RLS aberta, no mesmo padrão das demais tabelas do app (permitir_todos_*)
ALTER TABLE checklists_frota ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_frota_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "permitir_todos_checklists_frota" ON checklists_frota;
DROP POLICY IF EXISTS "permitir_todos_checklist_frota_itens" ON checklist_frota_itens;

CREATE POLICY "permitir_todos_checklists_frota"
  ON checklists_frota FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "permitir_todos_checklist_frota_itens"
  ON checklist_frota_itens FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- 4. Notificação em tempo real, mesmo padrão das outras tabelas
ALTER PUBLICATION supabase_realtime ADD TABLE checklists_frota;
ALTER PUBLICATION supabase_realtime ADD TABLE checklist_frota_itens;
