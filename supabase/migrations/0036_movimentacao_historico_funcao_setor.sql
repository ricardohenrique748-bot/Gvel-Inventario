-- Gvel Diesel — adiciona função e setor de quem executou a etapa,
-- para filtros no Controle de Horas.
-- Rode este arquivo no SQL Editor do seu projeto Supabase (ou via `supabase db push`)
-- depois de já ter aplicado as migrations anteriores.

alter table movimentacao_historico add column if not exists funcao text;
alter table movimentacao_historico add column if not exists setor text;
