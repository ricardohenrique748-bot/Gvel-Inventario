-- Gvel Diesel — adiciona "trator" e "carreta" como tipos de veículo válidos,
-- além de "pesado" e "leve" já existentes.
-- Rode este arquivo no SQL Editor do seu projeto Supabase (ou via `supabase db push`)
-- depois de já ter aplicado as migrations anteriores.

alter table veiculos drop constraint if exists veiculos_tipo_check;
alter table veiculos add constraint veiculos_tipo_check
  check (tipo in ('pesado', 'leve', 'trator', 'carreta'));
