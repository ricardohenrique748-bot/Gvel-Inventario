-- ============================================================
-- 0062: Controle de Viagens da Frota
--
-- Nova aba em Gestão de Frotas para registrar viagens dos veículos:
-- origem/destino, motorista, datas/horas de saída e chegada, KM inicial e
-- final (KM rodado é calculado na aplicação) e finalidade/observações.
--
-- Os veículos da frota não têm uma tabela própria no banco (vivem numa
-- lista oficial no código + edições do usuário no localStorage), então aqui
-- guardamos a placa e o nome do veículo direto na viagem — mesmo padrão já
-- usado em `checklists_frota` e `consumo_baixas` pra dados denormalizados.
-- ============================================================

CREATE TABLE IF NOT EXISTS viagens_frota (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  veiculo_id text,
  placa text NOT NULL,
  veiculo_nome text,
  motorista_nome text NOT NULL,
  origem text NOT NULL,
  destino text NOT NULL,
  data_hora_saida timestamptz NOT NULL,
  data_hora_chegada timestamptz,
  km_saida integer NOT NULL,
  km_chegada integer,
  finalidade text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_viagens_frota_placa ON viagens_frota (placa);
CREATE INDEX IF NOT EXISTS idx_viagens_frota_data_hora_saida ON viagens_frota (data_hora_saida DESC);

-- RLS: mesmo modelo de acesso público usado nas outras tabelas de frota —
-- o controle de quem pode ver/editar é feito na aplicação, não via RLS.
ALTER TABLE viagens_frota ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "permitir_todos_viagens_frota" ON viagens_frota;

CREATE POLICY "permitir_todos_viagens_frota"
  ON viagens_frota FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE viagens_frota;
