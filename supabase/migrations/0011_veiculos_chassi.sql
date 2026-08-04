-- Gvel Diesel — adiciona o número do chassi ao cadastro de veículos.
-- Rode este arquivo no SQL Editor do seu projeto Supabase (ou via `supabase db push`)
-- depois de já ter aplicado as migrations anteriores.

alter table veiculos add column if not exists chassi text;
