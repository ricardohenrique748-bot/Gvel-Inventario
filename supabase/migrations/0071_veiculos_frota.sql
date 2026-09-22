-- ============================================================
-- 0071: Veículos da Frota Própria no Supabase
--
-- A tela "Gestão de Frotas" guardava as edições e os cadastros dos veículos
-- só no localStorage do navegador — uma edição (ex: corrigir uma placa)
-- nunca aparecia em outro computador/celular, e podia até ser perdida ao
-- recarregar a página (a mesclagem com a lista oficial não sabia lidar com
-- uma placa editada). Esta tabela guarda essas edições e cadastros manuais
-- ("overrides"); a lista-base de veículos oficiais continua em código
-- (src/data/veiculosFrotaPadrao.ts) e é mesclada com o que está aqui em
-- tempo de execução, exatamente como já acontecia com o localStorage.
--
-- Usa "id" como texto (não uuid) porque o app já usa ids estáveis como
-- "frota_ABC1D23" ou "pesado_XXX" pros veículos oficiais.
-- ============================================================

CREATE TABLE IF NOT EXISTS veiculos_frota (
  id text PRIMARY KEY,
  placa text NOT NULL,
  tipo text NOT NULL,
  tipo_veiculo text,
  marca_nome text,
  modelo_nome text,
  cliente_nome text,
  cliente_id text,
  ano integer,
  cor text,
  setor text,
  responsavel text,
  chassi text,
  renavam text,
  categoria text,
  situacao text NOT NULL DEFAULT 'operante',
  vencimento_documento date,
  crlv_pago boolean,
  vencimento_seguro date,
  seguro_ok boolean,
  numero_tacografo text,
  emissao_tacografo date,
  vencimento_tacografo date,
  data_ultima_preventiva date,
  km_ultima_preventiva integer,
  intervalo_preventiva_km integer,
  vencimento_preventiva date,
  km_proxima_preventiva integer,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_veiculos_frota_placa ON veiculos_frota (placa);

-- Mesmo modelo de acesso público usado em outras tabelas do app (ferramentas,
-- itens_consumo etc.) — o controle de quem pode ver/editar já é feito na
-- aplicação, não via RLS.
ALTER TABLE veiculos_frota ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "permitir_todos_veiculos_frota" ON veiculos_frota;

CREATE POLICY "permitir_todos_veiculos_frota"
  ON veiculos_frota FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE veiculos_frota;
