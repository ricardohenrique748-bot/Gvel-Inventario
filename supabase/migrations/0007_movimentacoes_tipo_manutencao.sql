-- Gvel Diesel — tipo de manutenção (corretiva/preventiva) na movimentação.
-- Rode este arquivo no SQL Editor do seu projeto Supabase (ou via `supabase db push`)
-- depois de já ter aplicado as migrations anteriores.

alter table movimentacoes
  add column if not exists tipo_manutencao text
    check (tipo_manutencao in ('corretiva', 'preventiva'));
