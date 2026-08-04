-- Gvel Diesel — schema inicial
-- Rode este arquivo no SQL Editor do seu projeto Supabase (ou via `supabase db push`).

create extension if not exists "pgcrypto";

-- ========== Tabelas ==========

create table if not exists clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  telefone text,
  documento text,
  created_at timestamptz not null default now()
);

create table if not exists marcas (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique
);

create table if not exists modelos (
  id uuid primary key default gen_random_uuid(),
  marca_id uuid not null references marcas (id) on delete cascade,
  nome text not null,
  unique (marca_id, nome)
);

create table if not exists veiculos (
  id uuid primary key default gen_random_uuid(),
  placa text not null unique,
  marca_id uuid not null references marcas (id),
  modelo_id uuid not null references modelos (id),
  cliente_id uuid not null references clientes (id),
  tipo text not null check (tipo in ('pesado', 'leve')),
  renavam text,
  created_at timestamptz not null default now()
);

create table if not exists movimentacoes (
  id uuid primary key default gen_random_uuid(),
  veiculo_id uuid not null references veiculos (id),
  motorista text,
  data_hora_entrada timestamptz not null default now(),
  data_hora_saida timestamptz,
  observacoes text,
  status text not null default 'no_patio' check (status in ('no_patio', 'saiu')),
  created_at timestamptz not null default now()
);

create table if not exists inspecoes (
  id uuid primary key default gen_random_uuid(),
  veiculo_id uuid not null references veiculos (id),
  cliente_id uuid not null references clientes (id),
  inspetor text not null,
  km integer,
  data_hora timestamptz not null default now(),
  assinatura_url text,
  responsavel_nome text,
  responsavel_cargo text,
  status_geral text not null default 'pendente' check (status_geral in ('conforme', 'nao_conforme', 'pendente')),
  created_at timestamptz not null default now()
);

create table if not exists inspecao_itens (
  id uuid primary key default gen_random_uuid(),
  inspecao_id uuid not null references inspecoes (id) on delete cascade,
  secao text not null,
  item text not null,
  status text not null check (status in ('conforme', 'nao_conforme', 'pendente')),
  observacao text,
  foto_url text
);

-- ========== Índices ==========

create index if not exists idx_modelos_marca on modelos (marca_id);
create index if not exists idx_veiculos_placa on veiculos (placa);
create index if not exists idx_veiculos_cliente on veiculos (cliente_id);
create index if not exists idx_movimentacoes_veiculo on movimentacoes (veiculo_id);
create index if not exists idx_movimentacoes_status on movimentacoes (status);
create index if not exists idx_inspecoes_veiculo on inspecoes (veiculo_id);
create index if not exists idx_inspecao_itens_inspecao on inspecao_itens (inspecao_id);

-- ========== Row Level Security ==========
-- Oficina de uso interno (não multi-tenant): qualquer usuário autenticado
-- pode ler/escrever em todas as tabelas. Refine as políticas depois se
-- precisar segmentar por papel de usuário (ex.: só admins editam clientes).

alter table clientes enable row level security;
alter table marcas enable row level security;
alter table modelos enable row level security;
alter table veiculos enable row level security;
alter table movimentacoes enable row level security;
alter table inspecoes enable row level security;
alter table inspecao_itens enable row level security;

create policy "authenticated_all_clientes" on clientes for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_all_marcas" on marcas for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_all_modelos" on modelos for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_all_veiculos" on veiculos for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_all_movimentacoes" on movimentacoes for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_all_inspecoes" on inspecoes for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_all_inspecao_itens" on inspecao_itens for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ========== Storage ==========
-- Crie os buckets abaixo pelo Dashboard (Storage) ou descomente o insert:
-- 'fotos-inspecao' (fotos dos itens do checklist) e 'assinaturas' (PNG da assinatura).

-- insert into storage.buckets (id, name, public)
-- values ('fotos-inspecao', 'fotos-inspecao', true)
-- on conflict (id) do nothing;
-- insert into storage.buckets (id, name, public)
-- values ('assinaturas', 'assinaturas', true)
-- on conflict (id) do nothing;

create policy "authenticated_read_fotos" on storage.objects for select
  using (bucket_id = 'fotos-inspecao' and auth.role() = 'authenticated');
create policy "authenticated_write_fotos" on storage.objects for insert
  with check (bucket_id = 'fotos-inspecao' and auth.role() = 'authenticated');
create policy "authenticated_read_assinaturas" on storage.objects for select
  using (bucket_id = 'assinaturas' and auth.role() = 'authenticated');
create policy "authenticated_write_assinaturas" on storage.objects for insert
  with check (bucket_id = 'assinaturas' and auth.role() = 'authenticated');

-- ========== Seed opcional de marcas comuns (caminhões/utilitários) ==========

insert into marcas (nome) values
  ('Volvo'), ('Scania'), ('Mercedes-Benz'), ('Volkswagen'), ('Iveco'),
  ('DAF'), ('Ford'), ('Fiat'), ('Chevrolet'), ('Hyundai')
on conflict (nome) do nothing;
