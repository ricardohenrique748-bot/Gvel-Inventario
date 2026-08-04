-- Gvel Diesel — cadastro de frota ganha cor e ano do veículo.
-- Rode este arquivo no SQL Editor do seu projeto Supabase (ou via `supabase db push`)
-- depois de já ter aplicado as migrations anteriores.

alter table veiculos add column if not exists cor text;
alter table veiculos add column if not exists ano integer;
