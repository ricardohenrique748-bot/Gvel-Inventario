-- Gvel Diesel — clientes agora são empresas: CNPJ e endereço.
-- Rode este arquivo no SQL Editor do seu projeto Supabase (ou via `supabase db push`)
-- depois de já ter aplicado 0001_init.sql e 0002_usuarios.sql.

alter table clientes rename column documento to cnpj;
alter table clientes add column if not exists endereco text;
