-- ============================================================
-- 0106: Fotos da saída do veículo
--
-- Ao registrar a saída, o app (APK e web) passa a exigir fotos novas do
-- veículo — frente, laterais, traseira e painel (carreta não tem painel).
-- Ficam separadas das fotos da entrada para dar para comparar como o
-- veículo entrou e como saiu.
--
-- Os arquivos vão para o mesmo bucket, em entrada/<movimentacao>/saida-*.jpg.
-- Saídas antigas ficam com essas colunas vazias.
-- Pode rodar de novo sem problema.
-- ============================================================

alter table movimentacoes
  add column if not exists foto_saida_frente_url text,
  add column if not exists foto_saida_lado_esquerdo_url text,
  add column if not exists foto_saida_lado_direito_url text,
  add column if not exists foto_saida_traseira_url text,
  add column if not exists foto_saida_painel_url text;
