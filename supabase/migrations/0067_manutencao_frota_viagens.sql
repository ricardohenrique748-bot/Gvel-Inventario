-- ============================================================
-- 0067: Manutenção de Frota (Controle de Viagens, grupo Operação)
--
-- Módulo próprio de manutenção da frota GVel usada nas viagens — separado
-- do módulo "Manutenção" que já existe no sistema. Cobre só o que foi
-- especificado com print: Ordens de Serviço, Abastecimentos, Leituras de
-- Odômetro e o resumo de Custos (as outras sub-abas do modelo de referência
-- — Revisões & Óleo, Cobertura, Checklist & Freios, Pneus, Indisponíveis,
-- Calendário, Documentos, Multas — ficam de fora até terem especificação).
-- ============================================================

CREATE TABLE IF NOT EXISTS ordens_servico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  veiculo_id text NOT NULL,
  placa text NOT NULL,
  veiculo_nome text,
  centro_custo_id text NOT NULL,
  centro_custo_nome text,
  tipo text NOT NULL DEFAULT 'preventiva' CHECK (tipo IN ('preventiva', 'corretiva')),
  status text NOT NULL DEFAULT 'solicitada'
    CHECK (status IN ('solicitada', 'em_andamento', 'aguardando_peca', 'concluida', 'cancelada')),
  prioridade text NOT NULL DEFAULT 'normal' CHECK (prioridade IN ('baixa', 'normal', 'alta', 'critica')),
  data_entrada date,
  data_conclusao date,
  descricao_servico text NOT NULL,
  oficina text NOT NULL,
  km_entrada numeric(10, 1),
  valor numeric(12, 2) NOT NULL DEFAULT 0,
  fornecedor_id text,
  fornecedor_nome text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ordens_servico_veiculo ON ordens_servico (veiculo_id);
CREATE INDEX IF NOT EXISTS idx_ordens_servico_status ON ordens_servico (status);

CREATE TABLE IF NOT EXISTS abastecimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  veiculo_id text NOT NULL,
  placa text NOT NULL,
  veiculo_nome text,
  centro_custo_id text NOT NULL,
  centro_custo_nome text,
  combustivel text NOT NULL DEFAULT 'DIESEL S10',
  data_hora timestamptz NOT NULL,
  odometro numeric(10, 1),
  horas_motor numeric(10, 1),
  posto_fornecedor text NOT NULL,
  volume numeric(10, 2) NOT NULL DEFAULT 0,
  valor_unitario numeric(10, 3),
  valor_total numeric(12, 2) NOT NULL DEFAULT 0,
  origem text NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual', 'despesa_viagem')),
  aprovado boolean NOT NULL DEFAULT true,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_abastecimentos_veiculo ON abastecimentos (veiculo_id);
CREATE INDEX IF NOT EXISTS idx_abastecimentos_data ON abastecimentos (data_hora DESC);

CREATE TABLE IF NOT EXISTS leituras_odometro (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  veiculo_id text NOT NULL,
  placa text NOT NULL,
  data_leitura timestamptz NOT NULL,
  quilometragem numeric(10, 1) NOT NULL,
  horas_motor numeric(10, 1),
  origem text NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual', 'abastecimento')),
  validada boolean NOT NULL DEFAULT true,
  justificativa text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leituras_odometro_veiculo ON leituras_odometro (veiculo_id);
CREATE INDEX IF NOT EXISTS idx_leituras_odometro_data ON leituras_odometro (data_leitura DESC);

ALTER TABLE ordens_servico ENABLE ROW LEVEL SECURITY;
ALTER TABLE abastecimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE leituras_odometro ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "permitir_todos_ordens_servico" ON ordens_servico;
DROP POLICY IF EXISTS "permitir_todos_abastecimentos" ON abastecimentos;
DROP POLICY IF EXISTS "permitir_todos_leituras_odometro" ON leituras_odometro;

CREATE POLICY "permitir_todos_ordens_servico" ON ordens_servico FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "permitir_todos_abastecimentos" ON abastecimentos FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "permitir_todos_leituras_odometro" ON leituras_odometro FOR ALL TO public USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE ordens_servico;
ALTER PUBLICATION supabase_realtime ADD TABLE abastecimentos;
ALTER PUBLICATION supabase_realtime ADD TABLE leituras_odometro;
