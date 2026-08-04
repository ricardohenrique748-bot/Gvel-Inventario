-- Gvel Diesel — marca se o veículo está operante ou inoperante.
-- Rode este arquivo no SQL Editor do seu projeto Supabase (ou via `supabase db push`)
-- depois de já ter aplicado as migrations anteriores.

alter table veiculos add column if not exists operante boolean not null default true;
