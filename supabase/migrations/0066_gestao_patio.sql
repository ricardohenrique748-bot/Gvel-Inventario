-- ============================================================
-- 0066: Gestão de Pátio (Controle de Viagens, grupo Operação)
--
-- Pátio de veículos de terceiros (depósito/guarda), não confundir com a
-- frota própria da GVel usada em Viagens. Um cliente deixa um veículo no
-- pátio, é cobrada uma diária, e o taxímetro (dias × diária) roda até o
-- veículo sair (campo `data_hora_saida_real` preenchido = "Finalizar").
--
-- `veiculos_clientes` é um cadastro leve por cliente — permite reutilizar
-- o mesmo veículo em entradas futuras sem redigitar placa/modelo toda vez.
-- ============================================================

CREATE TABLE IF NOT EXISTS veiculos_clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES clientes (id) ON DELETE CASCADE,
  placa text NOT NULL,
  modelo text,
  marca text,
  cor text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cliente_id, placa)
);

CREATE INDEX IF NOT EXISTS idx_veiculos_clientes_cliente ON veiculos_clientes (cliente_id);

ALTER TABLE veiculos_clientes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "permitir_todos_veiculos_clientes" ON veiculos_clientes;
CREATE POLICY "permitir_todos_veiculos_clientes" ON veiculos_clientes FOR ALL TO public USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE veiculos_clientes;

CREATE TABLE IF NOT EXISTS patio_estadias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES clientes (id),
  cliente_nome text,
  veiculo_cliente_id uuid REFERENCES veiculos_clientes (id) ON DELETE SET NULL,
  placa text NOT NULL,
  modelo text,
  marca text,
  cor text,
  data_hora_entrada timestamptz NOT NULL,
  previsao_saida timestamptz,
  data_hora_saida_real timestamptz,
  valor_diaria numeric(10, 2) NOT NULL DEFAULT 0,
  centro_custo_id text NOT NULL,
  centro_custo_nome text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patio_estadias_cliente ON patio_estadias (cliente_id);
CREATE INDEX IF NOT EXISTS idx_patio_estadias_saida_real ON patio_estadias (data_hora_saida_real);

ALTER TABLE patio_estadias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "permitir_todos_patio_estadias" ON patio_estadias;
CREATE POLICY "permitir_todos_patio_estadias" ON patio_estadias FOR ALL TO public USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE patio_estadias;
