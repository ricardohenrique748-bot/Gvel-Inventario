-- ============================================================
-- 0046: Estrutura Completa e Permissões do Inventário no Banco
-- ============================================================

-- 1. Tabela de Ferramentas
CREATE TABLE IF NOT EXISTS ferramentas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text,
  nome text NOT NULL,
  categoria text DEFAULT 'Geral',
  tipo_ferramenta text DEFAULT 'comum',
  quantidade_total integer NOT NULL DEFAULT 1,
  quantidade_disponivel integer NOT NULL DEFAULT 1,
  localizacao text,
  observacoes text,
  foto_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Garantir colunas caso a tabela já existisse antes
ALTER TABLE ferramentas ADD COLUMN IF NOT EXISTS codigo text;
ALTER TABLE ferramentas ADD COLUMN IF NOT EXISTS categoria text DEFAULT 'Geral';
ALTER TABLE ferramentas ADD COLUMN IF NOT EXISTS tipo_ferramenta text DEFAULT 'comum';
ALTER TABLE ferramentas ADD COLUMN IF NOT EXISTS foto_url text;

-- 2. Tabela de Retiradas de Ferramentas
CREATE TABLE IF NOT EXISTS ferramentas_retiradas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ferramenta_id uuid REFERENCES ferramentas (id) ON DELETE CASCADE,
  veiculo_id uuid REFERENCES veiculos (id) ON DELETE SET NULL,
  placa text NOT NULL,
  responsavel text NOT NULL,
  quantidade integer NOT NULL DEFAULT 1,
  data_hora_retirada timestamptz NOT NULL DEFAULT now(),
  data_hora_devolucao timestamptz,
  status text NOT NULL DEFAULT 'em_uso' CHECK (status IN ('em_uso', 'devolvido', 'avaria_perda', 'devolvida')),
  observacoes_retirada text,
  observacoes_devolucao text,
  foto_url text,
  foto_responsavel_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ferramentas_retiradas ADD COLUMN IF NOT EXISTS foto_url text;
ALTER TABLE ferramentas_retiradas ADD COLUMN IF NOT EXISTS foto_responsavel_url text;

-- 3. Habilitar RLS e Criar Permissões Globais (Anon + Authenticated)
ALTER TABLE ferramentas ENABLE ROW LEVEL SECURITY;
ALTER TABLE ferramentas_retiradas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "permitir_todos_ferramentas" ON ferramentas;
DROP POLICY IF EXISTS "permitir_todos_ferramentas_retiradas" ON ferramentas_retiradas;
DROP POLICY IF EXISTS "Permitir leitura ferramentas para autenticados" ON ferramentas;
DROP POLICY IF EXISTS "Permitir insercao ferramentas para autenticados" ON ferramentas;
DROP POLICY IF EXISTS "Permitir atualizacao ferramentas para autenticados" ON ferramentas;
DROP POLICY IF EXISTS "Permitir exclusao ferramentas para autenticados" ON ferramentas;
DROP POLICY IF EXISTS "Permitir leitura ferramentas_retiradas para autenticados" ON ferramentas_retiradas;
DROP POLICY IF EXISTS "Permitir insercao ferramentas_retiradas para autenticados" ON ferramentas_retiradas;
DROP POLICY IF EXISTS "Permitir atualizacao ferramentas_retiradas para autenticados" ON ferramentas_retiradas;
DROP POLICY IF EXISTS "Permitir exclusao ferramentas_retiradas para autenticados" ON ferramentas_retiradas;

CREATE POLICY "permitir_todos_ferramentas" 
  ON ferramentas FOR ALL 
  TO public 
  USING (true) 
  WITH CHECK (true);

CREATE POLICY "permitir_todos_ferramentas_retiradas" 
  ON ferramentas_retiradas FOR ALL 
  TO public 
  USING (true) 
  WITH CHECK (true);

-- Notificação em tempo real
ALTER PUBLICATION supabase_realtime ADD TABLE ferramentas;
ALTER PUBLICATION supabase_realtime ADD TABLE ferramentas_retiradas;
