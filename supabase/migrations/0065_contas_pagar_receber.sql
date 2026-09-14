-- ============================================================
-- 0065: Contas a Pagar / Receber (Controle de Viagens, grupo Gestão)
--
-- Lançamento financeiro completo — separado do Fluxo de Caixa simples do
-- Financeiro (fluxo_caixa_lancamentos: só entrada/saída + descrição +
-- valor). Este é uma conta a pagar/receber "de verdade": centro de custo,
-- tipo de lançamento, vencimento, status, e vínculos opcionais com
-- veículo, fornecedor e conta bancária. Vive dentro de Gestão de Frotas ->
-- Controle de Viagens (não em Financeiro) — decisão explícita do usuário.
--
-- `fornecedores` é um cadastro novo e separado de `pessoas` (criada na
-- 0064) — por pedido explícito: fornecedor/favorecido é conceito distinto
-- de "pessoa" ligada a viagem.
-- ============================================================

CREATE TABLE IF NOT EXISTS fornecedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE fornecedores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "permitir_todos_fornecedores" ON fornecedores;
CREATE POLICY "permitir_todos_fornecedores" ON fornecedores FOR ALL TO public USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE fornecedores;

CREATE TABLE IF NOT EXISTS contas_pagar_receber (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao text,
  centro_custo_id text NOT NULL,
  centro_custo_nome text,
  tipo_movimentacao text NOT NULL CHECK (tipo_movimentacao IN ('despesa', 'receita')),
  tipo_lancamento_id text NOT NULL,
  tipo_lancamento_nome text,
  valor numeric(14, 2) NOT NULL DEFAULT 0,
  data_lancamento date NOT NULL,
  data_vencimento date NOT NULL,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'atrasado', 'cancelado')),
  veiculo_id text,
  placa text,
  fornecedor_id text,
  fornecedor_nome text,
  conta_bancaria_id text,
  conta_bancaria_nome text,
  observacoes text,
  numero_parcelas integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contas_pr_status ON contas_pagar_receber (status);
CREATE INDEX IF NOT EXISTS idx_contas_pr_data_vencimento ON contas_pagar_receber (data_vencimento);

ALTER TABLE contas_pagar_receber ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "permitir_todos_contas_pagar_receber" ON contas_pagar_receber;
CREATE POLICY "permitir_todos_contas_pagar_receber" ON contas_pagar_receber FOR ALL TO public USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE contas_pagar_receber;
