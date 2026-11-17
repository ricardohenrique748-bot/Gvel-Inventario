-- ============================================================
-- 0108: Veículo da frota sem seguro
--
-- Opção "Veículo sem seguro" no cadastro (Gestão de Frotas). Marcada, o
-- veículo sai do controle de seguro: mostra "SEM SEGURO" e não entra nos
-- alertas nem nas contagens de seguro vencido / a vencer / vigente.
-- Pode rodar de novo sem problema.
-- ============================================================

alter table veiculos_frota
  add column if not exists sem_seguro boolean;
