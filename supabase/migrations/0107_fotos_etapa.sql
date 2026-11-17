-- ============================================================
-- 0107: Fotos da etapa do trajeto
--
-- Ao adicionar uma etapa no trajeto do caminhão (mudança de setor/pátio/
-- status), o app (APK e web) passa a exigir fotos novas do veículo — as
-- mesmas da saída: frente, laterais, traseira e painel (carreta sem painel).
--
-- Formato: [{"campo":"frente","label":"Frente","url":"https://..."}, ...]
-- Arquivos em entrada/<movimentacao>/etapa-<etapa>-<campo>.jpg.
-- Etapas antigas ficam sem fotos.
-- Pode rodar de novo sem problema.
-- ============================================================

alter table movimentacao_historico
  add column if not exists fotos jsonb;
