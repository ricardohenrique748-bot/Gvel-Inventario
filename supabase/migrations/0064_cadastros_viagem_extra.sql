-- ============================================================
-- 0064: Cadastros Extras do Controle de Viagens
--
-- Completa o menu de cadastros de apoio da tela de Controle de Viagens:
-- Pessoas (contatos/motoristas cadastrados), Formas de Pagamento e Tipos de
-- Lançamento (simples, id+nome, mesmo padrão de centros_custo/tipos_carga).
--
-- `contas_bancarias` já tinha um hook pronto no código (`useContas.ts`),
-- criado antes mas nunca ligado a uma tabela real — funcionava só com
-- fallback em localStorage. Esta migration cria a tabela de verdade pra ele
-- passar a persistir no banco, sem precisar mudar o hook.
-- ============================================================

CREATE TABLE IF NOT EXISTS pessoas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS formas_pagamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tipos_lancamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contas_bancarias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  banco text NOT NULL DEFAULT '',
  agencia text NOT NULL DEFAULT '',
  conta text NOT NULL DEFAULT '',
  tipo text NOT NULL DEFAULT 'corrente' CHECK (tipo IN ('corrente', 'poupanca', 'cartao', 'outro')),
  saldo_inicial numeric(14, 2) NOT NULL DEFAULT 0,
  ativa boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pessoas ENABLE ROW LEVEL SECURITY;
ALTER TABLE formas_pagamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE tipos_lancamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE contas_bancarias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "permitir_todos_pessoas" ON pessoas;
DROP POLICY IF EXISTS "permitir_todos_formas_pagamento" ON formas_pagamento;
DROP POLICY IF EXISTS "permitir_todos_tipos_lancamento" ON tipos_lancamento;
DROP POLICY IF EXISTS "permitir_todos_contas_bancarias" ON contas_bancarias;

CREATE POLICY "permitir_todos_pessoas" ON pessoas FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "permitir_todos_formas_pagamento" ON formas_pagamento FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "permitir_todos_tipos_lancamento" ON tipos_lancamento FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "permitir_todos_contas_bancarias" ON contas_bancarias FOR ALL TO public USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE pessoas;
ALTER PUBLICATION supabase_realtime ADD TABLE formas_pagamento;
ALTER PUBLICATION supabase_realtime ADD TABLE tipos_lancamento;
ALTER PUBLICATION supabase_realtime ADD TABLE contas_bancarias;
