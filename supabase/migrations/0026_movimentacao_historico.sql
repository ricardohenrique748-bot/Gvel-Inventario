-- Gvel Diesel — histórico de etapas/destinos intermediários de uma movimentação
-- Permite rastrear onde o caminhão foi durante sua permanência no pátio,
-- desde a entrada até a saída final.
-- Rode este arquivo no SQL Editor do seu projeto Supabase (ou via `supabase db push`)
-- depois de já ter aplicado as migrations anteriores.

create table if not exists movimentacao_historico (
  id uuid primary key default gen_random_uuid(),
  movimentacao_id uuid not null references movimentacoes (id) on delete cascade,
  descricao text not null,
  data_hora timestamptz not null default now(),
  usuario_id uuid references usuarios (id),
  created_at timestamptz not null default now()
);

alter table movimentacao_historico enable row level security;

create policy "authenticated_all_movimentacao_historico" on movimentacao_historico for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create index if not exists idx_movimentacao_historico_movimentacao
  on movimentacao_historico (movimentacao_id);
create index if not exists idx_movimentacao_historico_data_hora
  on movimentacao_historico (data_hora);
