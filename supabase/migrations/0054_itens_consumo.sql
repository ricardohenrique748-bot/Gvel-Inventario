-- ============================================================
-- 0054: Estoque de Insumos (Uso e Consumo) no Banco
--
-- Até aqui, os insumos (tambores de óleo, químicos, EPIs etc.) viviam só no
-- localStorage do navegador de cada usuário. Isso fazia com que um insumo
-- cadastrado por um usuário nunca aparecesse para outro usuário em outro
-- dispositivo/navegador. Esta migration cria as tabelas no Supabase para que
-- o estoque de insumos seja compartilhado entre todos, igual já acontece com
-- a tabela `ferramentas`.
-- ============================================================

CREATE TABLE IF NOT EXISTS itens_consumo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text,
  nome text NOT NULL,
  categoria text DEFAULT 'GERAL',
  unidade text NOT NULL DEFAULT 'UN',
  quantidade_atual integer NOT NULL DEFAULT 0,
  quantidade_minima integer NOT NULL DEFAULT 0,
  capacidade_maxima integer,
  quantidade_tambores integer,
  numero_tambor_atual integer,
  localizacao text,
  observacoes text,
  foto_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS consumo_baixas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid REFERENCES itens_consumo (id) ON DELETE SET NULL,
  item_nome text NOT NULL,
  unidade text NOT NULL,
  quantidade integer NOT NULL DEFAULT 1,
  responsavel text NOT NULL,
  foto_responsavel_url text,
  placa text,
  motivo text,
  data_hora timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_consumo_baixas_item_id ON consumo_baixas (item_id);
CREATE INDEX IF NOT EXISTS idx_consumo_baixas_data_hora ON consumo_baixas (data_hora DESC);

-- RLS: mesmo modelo de acesso público usado em `ferramentas` (ver 0046) —
-- o controle de quem pode ver/editar já é feito na aplicação, não via RLS.
ALTER TABLE itens_consumo ENABLE ROW LEVEL SECURITY;
ALTER TABLE consumo_baixas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "permitir_todos_itens_consumo" ON itens_consumo;
DROP POLICY IF EXISTS "permitir_todos_consumo_baixas" ON consumo_baixas;

CREATE POLICY "permitir_todos_itens_consumo"
  ON itens_consumo FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "permitir_todos_consumo_baixas"
  ON consumo_baixas FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE itens_consumo;
ALTER PUBLICATION supabase_realtime ADD TABLE consumo_baixas;
