-- Gvel Diesel — status de manutenção vira uma lista cadastrável (como pátios/marcas),
-- em vez de um valor fixo (corretiva/preventiva).
-- Rode este arquivo no SQL Editor do seu projeto Supabase (ou via `supabase db push`)
-- depois de já ter aplicado as migrations anteriores.

create table if not exists status_manutencao (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  created_at timestamptz not null default now()
);

alter table status_manutencao enable row level security;

create policy "authenticated_all_status_manutencao" on status_manutencao for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

insert into status_manutencao (nome) values ('Corretiva'), ('Preventiva')
on conflict (nome) do nothing;

alter table movimentacoes add column if not exists status_id uuid references status_manutencao (id);

update movimentacoes m
set status_id = s.id
from status_manutencao s
where m.tipo_manutencao = 'corretiva' and s.nome = 'Corretiva' and m.status_id is null;

update movimentacoes m
set status_id = s.id
from status_manutencao s
where m.tipo_manutencao = 'preventiva' and s.nome = 'Preventiva' and m.status_id is null;

alter table movimentacoes drop column if exists tipo_manutencao;

create index if not exists idx_movimentacoes_status_id on movimentacoes (status_id);
