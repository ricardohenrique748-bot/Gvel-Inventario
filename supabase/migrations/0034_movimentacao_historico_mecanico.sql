-- Gvel Diesel — adiciona mecânico executor, auxiliar e data/hora de abertura da OS
-- às etapas do trajeto de uma movimentação.
-- Rode este arquivo no SQL Editor do seu projeto Supabase (ou via `supabase db push`)
-- depois de já ter aplicado as migrations anteriores.

alter table movimentacao_historico add column if not exists mecanico_executor text;
alter table movimentacao_historico add column if not exists auxiliar text;
alter table movimentacao_historico add column if not exists data_hora_abertura timestamptz;
