-- Gvel Diesel — adiciona o km do veículo na entrada e na saída da movimentação.
-- Rode este arquivo no SQL Editor do seu projeto Supabase (ou via `supabase db push`)
-- depois de já ter aplicado as migrations anteriores.

alter table movimentacoes add column if not exists km_entrada integer;
alter table movimentacoes add column if not exists km_saida integer;
