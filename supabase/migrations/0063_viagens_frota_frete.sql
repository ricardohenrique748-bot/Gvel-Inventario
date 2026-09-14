-- ============================================================
-- 0063: Controle de Viagens Completo (Cotação de Frete)
--
-- Expande `viagens_frota` (criada na 0062, um log simples de saída/chegada
-- por hodômetro) para um formulário completo de cotação de frete:
-- participantes (cliente, centro de custo, transportadora), rota com
-- endereço estruturado, detalhes de carga e um bloco financeiro (frete,
-- impostos, comissão, custo operacional). Os campos antigos de
-- hodômetro (km_saida/km_chegada) e data/hora real continuam existindo
-- pra não quebrar registros já lançados, mas o formulário novo não
-- depende mais deles — usa distância estimada e datas previstas.
--
-- Cliente já existe (`clientes`); os demais cadastros de apoio
-- (Centro de Custo, Transportadora, Tipo de Carga, Endereço Frequente)
-- são novos e simples (id + nome), no mesmo padrão de `marcas`/`modelos`.
-- ============================================================

CREATE TABLE IF NOT EXISTS centros_custo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transportadoras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tipos_carga (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS enderecos_frequentes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  apelido text NOT NULL,
  endereco text NOT NULL,
  cidade text NOT NULL,
  uf text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE centros_custo ENABLE ROW LEVEL SECURITY;
ALTER TABLE transportadoras ENABLE ROW LEVEL SECURITY;
ALTER TABLE tipos_carga ENABLE ROW LEVEL SECURITY;
ALTER TABLE enderecos_frequentes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "permitir_todos_centros_custo" ON centros_custo;
DROP POLICY IF EXISTS "permitir_todos_transportadoras" ON transportadoras;
DROP POLICY IF EXISTS "permitir_todos_tipos_carga" ON tipos_carga;
DROP POLICY IF EXISTS "permitir_todos_enderecos_frequentes" ON enderecos_frequentes;

CREATE POLICY "permitir_todos_centros_custo" ON centros_custo FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "permitir_todos_transportadoras" ON transportadoras FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "permitir_todos_tipos_carga" ON tipos_carga FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "permitir_todos_enderecos_frequentes" ON enderecos_frequentes FOR ALL TO public USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE centros_custo;
ALTER PUBLICATION supabase_realtime ADD TABLE transportadoras;
ALTER PUBLICATION supabase_realtime ADD TABLE tipos_carga;
ALTER PUBLICATION supabase_realtime ADD TABLE enderecos_frequentes;

-- Campos antigos que o formulário novo não preenche mais diretamente
-- (origem/destino continuam recebendo um resumo textual da rota pra manter
-- a busca e a listagem funcionando; km_saida deixa de ser obrigatório).
ALTER TABLE viagens_frota ALTER COLUMN origem DROP NOT NULL;
ALTER TABLE viagens_frota ALTER COLUMN destino DROP NOT NULL;
ALTER TABLE viagens_frota ALTER COLUMN km_saida DROP NOT NULL;

ALTER TABLE viagens_frota
  ADD COLUMN IF NOT EXISTS cliente_id text,
  ADD COLUMN IF NOT EXISTS cliente_nome text,
  ADD COLUMN IF NOT EXISTS centro_custo_id text,
  ADD COLUMN IF NOT EXISTS centro_custo_nome text,
  ADD COLUMN IF NOT EXISTS transportadora_id text,
  ADD COLUMN IF NOT EXISTS transportadora_nome text,
  ADD COLUMN IF NOT EXISTS endereco_origem text,
  ADD COLUMN IF NOT EXISTS cidade_origem text,
  ADD COLUMN IF NOT EXISTS uf_origem text,
  ADD COLUMN IF NOT EXISTS data_coleta_prevista date,
  ADD COLUMN IF NOT EXISTS endereco_destino text,
  ADD COLUMN IF NOT EXISTS cidade_destino text,
  ADD COLUMN IF NOT EXISTS uf_destino text,
  ADD COLUMN IF NOT EXISTS data_entrega_prevista date,
  ADD COLUMN IF NOT EXISTS distancia_estimada_km numeric(10, 1),
  ADD COLUMN IF NOT EXISTS tempo_estimado_horas numeric(6, 1),
  ADD COLUMN IF NOT EXISTS tipo_carga_id text,
  ADD COLUMN IF NOT EXISTS tipo_carga_nome text,
  ADD COLUMN IF NOT EXISTS veiculos_carregados jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS peso_carga_toneladas numeric(10, 3),
  ADD COLUMN IF NOT EXISTS volume_m3 numeric(10, 2),
  ADD COLUMN IF NOT EXISTS forma_calculo_frete text,
  ADD COLUMN IF NOT EXISTS frete_bruto numeric(12, 2),
  ADD COLUMN IF NOT EXISTS despesas_abater numeric(12, 2),
  ADD COLUMN IF NOT EXISTS adiantamento numeric(12, 2),
  ADD COLUMN IF NOT EXISTS tipo_frete text,
  ADD COLUMN IF NOT EXISTS percentual_imposto numeric(6, 2),
  ADD COLUMN IF NOT EXISTS pessoa_imposto text,
  ADD COLUMN IF NOT EXISTS percentual_comissao numeric(6, 2),
  ADD COLUMN IF NOT EXISTS pessoa_comissao text,
  ADD COLUMN IF NOT EXISTS custo_operacional numeric(12, 2),
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'cotada';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'viagens_frota_status_check') THEN
    ALTER TABLE viagens_frota
      ADD CONSTRAINT viagens_frota_status_check
      CHECK (status IN ('cotada', 'confirmada', 'em_transito', 'entregue', 'cancelada'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_viagens_frota_status ON viagens_frota (status);
