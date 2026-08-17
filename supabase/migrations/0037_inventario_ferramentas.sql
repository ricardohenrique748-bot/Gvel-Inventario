-- Migration 0037: Inventário e Controle de Retirada de Ferramentas

create table if not exists ferramentas (
  id uuid primary key default gen_random_uuid(),
  codigo text,
  nome text not null,
  categoria text default 'Geral',
  quantidade_total integer not null default 1,
  quantidade_disponivel integer not null default 1,
  localizacao text,
  observacoes text,
  created_at timestamptz not null default now()
);

create table if not exists ferramentas_retiradas (
  id uuid primary key default gen_random_uuid(),
  ferramenta_id uuid not null references ferramentas (id) on delete cascade,
  veiculo_id uuid references veiculos (id) on delete set null,
  placa text not null,
  responsavel text not null,
  quantidade integer not null default 1,
  data_hora_retirada timestamptz not null default now(),
  data_hora_devolucao timestamptz,
  status text not null default 'em_uso' check (status in ('em_uso', 'devolvido', 'avaria_perda')),
  observacoes_retirada text,
  observacoes_devolucao text,
  created_at timestamptz not null default now()
);

-- RLS
alter table ferramentas enable row level security;
alter table ferramentas_retiradas enable row level security;

create policy "Permitir leitura ferramentas para autenticados"
  on ferramentas for select
  to authenticated
  using (true);

create policy "Permitir insercao ferramentas para autenticados"
  on ferramentas for insert
  to authenticated
  with check (true);

create policy "Permitir atualizacao ferramentas para autenticados"
  on ferramentas for update
  to authenticated
  using (true);

create policy "Permitir exclusao ferramentas para autenticados"
  on ferramentas for delete
  to authenticated
  using (true);

create policy "Permitir leitura ferramentas_retiradas para autenticados"
  on ferramentas_retiradas for select
  to authenticated
  using (true);

create policy "Permitir insercao ferramentas_retiradas para autenticados"
  on ferramentas_retiradas for insert
  to authenticated
  with check (true);

create policy "Permitir atualizacao ferramentas_retiradas para autenticados"
  on ferramentas_retiradas for update
  to authenticated
  using (true);

create policy "Permitir exclusao ferramentas_retiradas para autenticados"
  on ferramentas_retiradas for delete
  to authenticated
  using (true);
