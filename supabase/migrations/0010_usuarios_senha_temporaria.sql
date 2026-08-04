-- Gvel Diesel — sinaliza quando o usuário precisa trocar a senha temporária
-- definida pelo admin no cadastro (força a troca no primeiro login).
-- Rode este arquivo no SQL Editor do seu projeto Supabase (ou via `supabase db push`)
-- depois de já ter aplicado as migrations anteriores.

alter table usuarios add column if not exists deve_trocar_senha boolean not null default false;
