-- Gvel Diesel — adiciona data/hora de fechamento das etapas do trajeto de uma movimentação,
-- para permitir finalizar uma etapa (ex: OS) depois de aberta.
-- Rode este arquivo no SQL Editor do seu projeto Supabase (ou via `supabase db push`)
-- depois de já ter aplicado as migrations anteriores.

alter table movimentacao_historico add column if not exists data_hora_fechamento timestamptz;
