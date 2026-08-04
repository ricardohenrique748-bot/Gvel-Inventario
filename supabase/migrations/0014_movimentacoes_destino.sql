-- Gvel Diesel — adiciona o campo destino na saída de veículo.
-- Rode este arquivo no SQL Editor do seu projeto Supabase (ou via `supabase db push`)
-- depois de já ter aplicado as migrations anteriores.

alter table movimentacoes add column if not exists destino text;
