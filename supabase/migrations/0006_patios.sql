-- Gvel Diesel — cadastro de pátios (múltiplos locais físicos) e vínculo com movimentações.
-- Rode este arquivo no SQL Editor do seu projeto Supabase (ou via `supabase db push`)
-- depois de já ter aplicado as migrations anteriores.

create table if not exists patios (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  created_at timestamptz not null default now()
);

alter table patios enable row level security;

create policy "authenticated_all_patios" on patios for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

alter table movimentacoes add column if not exists patio_id uuid references patios (id);

create index if not exists idx_movimentacoes_patio on movimentacoes (patio_id);
