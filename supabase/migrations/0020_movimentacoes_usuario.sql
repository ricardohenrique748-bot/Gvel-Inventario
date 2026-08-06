-- Gvel Diesel — registra qual usuário fez a entrada e qual fez a saída
-- de cada movimentação.
-- Rode este arquivo no SQL Editor do seu projeto Supabase (ou via `supabase db push`)
-- depois de já ter aplicado as migrations anteriores.

alter table movimentacoes add column if not exists usuario_entrada_id uuid references usuarios (id);
alter table movimentacoes add column if not exists usuario_saida_id uuid references usuarios (id);

create index if not exists idx_movimentacoes_usuario_entrada on movimentacoes (usuario_entrada_id);
create index if not exists idx_movimentacoes_usuario_saida on movimentacoes (usuario_saida_id);
