-- ============================================================
-- 0115: Seguradora do veículo da frota
--
-- Campo "Seguradora" no cadastro/edição do veículo (Gestão de Frotas),
-- para digitar o nome da seguradora do seguro. Aparece no modal de
-- detalhes do veículo, junto com o vencimento do seguro.
-- Pode rodar de novo sem problema.
-- ============================================================

alter table veiculos_frota
  add column if not exists seguradora text;
