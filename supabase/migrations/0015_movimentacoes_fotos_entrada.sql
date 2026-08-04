-- Gvel Diesel — fotos do veículo no momento da entrada (frente, lados, traseira, painel).
-- Rode este arquivo no SQL Editor do seu projeto Supabase (ou via `supabase db push`)
-- depois de já ter aplicado as migrations anteriores.

alter table movimentacoes add column if not exists foto_frente_url text;
alter table movimentacoes add column if not exists foto_lado_esquerdo_url text;
alter table movimentacoes add column if not exists foto_lado_direito_url text;
alter table movimentacoes add column if not exists foto_traseira_url text;
alter table movimentacoes add column if not exists foto_painel_url text;
