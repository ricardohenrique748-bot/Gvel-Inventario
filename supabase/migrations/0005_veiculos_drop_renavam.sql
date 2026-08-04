-- Gvel Diesel — remove o campo renavam do cadastro de veículos.
-- Rode este arquivo no SQL Editor do seu projeto Supabase (ou via `supabase db push`)
-- depois de já ter aplicado as migrations anteriores.

alter table veiculos drop column if exists renavam;
