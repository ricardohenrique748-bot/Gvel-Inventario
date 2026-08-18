-- ============================================================
-- Gvel Diesel — Checklist / O.S no Supabase
-- Migra os dados de O.S e itens do checklist do localStorage
-- para o banco, habilitando sincronização APK ↔ Web em tempo real.
-- ============================================================

-- 1. Tabela principal da Ordem de Serviço por movimentação
create table if not exists checklist_os (
  id               uuid primary key default gen_random_uuid(),
  movimentacao_id  uuid not null references movimentacoes (id) on delete cascade,
  mecanico         text,
  funcao           text,
  setor            text,
  data_hora_abertura   timestamptz,
  data_hora_fechamento timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint checklist_os_movimentacao_unique unique (movimentacao_id)
);

-- 2. Tabela dos itens individuais do checklist
create table if not exists checklist_itens (
  id               uuid primary key default gen_random_uuid(),
  movimentacao_id  uuid not null references movimentacoes (id) on delete cascade,
  item_id          text not null,       -- ex: "mec_motor_transmissao"
  secao_id         text not null,       -- ex: "mecanica"
  label            text not null,       -- nome exibido
  is_custom        boolean not null default false,
  checked          boolean not null default false,
  hora_inicio      text,                -- "HH:mm"
  hora_fim         text,                -- "HH:mm"
  mecanico         text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint checklist_itens_unique unique (movimentacao_id, item_id)
);

-- 3. Trigger updated_at para checklist_os
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_checklist_os_updated_at
  before update on checklist_os
  for each row execute function set_updated_at();

create trigger trg_checklist_itens_updated_at
  before update on checklist_itens
  for each row execute function set_updated_at();

-- 4. RLS — apenas usuários autenticados acessam
alter table checklist_os    enable row level security;
alter table checklist_itens enable row level security;

create policy "auth_all_checklist_os" on checklist_os for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "auth_all_checklist_itens" on checklist_itens for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- 5. Índices de performance
create index if not exists idx_checklist_os_movimentacao
  on checklist_os (movimentacao_id);

create index if not exists idx_checklist_itens_movimentacao
  on checklist_itens (movimentacao_id);

-- 6. Realtime
alter publication supabase_realtime add table checklist_os;
alter publication supabase_realtime add table checklist_itens;
alter publication supabase_realtime add table movimentacoes;

alter table checklist_os    replica identity full;
alter table checklist_itens replica identity full;
alter table movimentacoes   replica identity full;
