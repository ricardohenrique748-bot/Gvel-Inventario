-- Gvel Diesel — sinaliza quando uma etapa do trajeto teve OS (ordem de serviço) criada.
-- Rode este arquivo no SQL Editor do seu projeto Supabase (ou via `supabase db push`)
-- depois de já ter aplicado as migrations anteriores.

alter table movimentacao_historico add column if not exists os_criada boolean not null default false;
