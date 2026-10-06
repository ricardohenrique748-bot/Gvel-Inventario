-- Clientes do Controle de Viagens — cadastro próprio, separado de `clientes`
-- (que é o cadastro do pátio/inventário de caminhões). Até aqui o formulário
-- de viagem listava os clientes do pátio, misturando os dois cadastros.
--
-- viagens_frota.cliente_id é text sem FK e a viagem também guarda
-- cliente_nome, então trocar a origem não quebra nenhuma viagem antiga.
-- Mesmo assim, o backfill abaixo cria um cliente de viagem para cada nome já
-- usado nas viagens e reaponta cliente_id pra ele, pra filtros e edição
-- continuarem funcionando com os registros existentes.

create table if not exists clientes_viagem (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  nome text not null,
  created_at timestamptz not null default now(),
  unique (company_id, nome)
);
create index if not exists idx_clientes_viagem_company on clientes_viagem (company_id);

alter table clientes_viagem enable row level security;
drop policy if exists isolamento_empresa_clientes_viagem on clientes_viagem;
create policy isolamento_empresa_clientes_viagem on clientes_viagem
  for all using (company_id = current_company_id()) with check (company_id = current_company_id());

drop trigger if exists stamp_company_id_clientes_viagem on clientes_viagem;
create trigger stamp_company_id_clientes_viagem
  before insert on clientes_viagem
  for each row execute function stamp_company_id();

-- Backfill: um cliente de viagem por (empresa, nome) já usado nas viagens.
insert into clientes_viagem (company_id, nome)
select distinct v.company_id, upper(trim(v.cliente_nome))
  from viagens_frota v
 where v.cliente_nome is not null and trim(v.cliente_nome) <> ''
on conflict (company_id, nome) do nothing;

update viagens_frota v
   set cliente_id = cv.id::text
  from clientes_viagem cv
 where cv.company_id = v.company_id
   and cv.nome = upper(trim(v.cliente_nome));
