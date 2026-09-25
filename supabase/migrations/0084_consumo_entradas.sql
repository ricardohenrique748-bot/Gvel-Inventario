-- Entradas de estoque dos insumos (óleo, lubrificantes...) com a nota
-- fiscal da compra anexada. Até aqui a reposição só somava na quantidade do
-- item, sem deixar registro — agora cada entrada vira uma linha, com o
-- arquivo da NF (PDF/XML/foto) salvo no bucket 'fotos-inspecao' em
-- `<company_id>/notas-fiscais/...`.
--
-- `tipo`: 'quantidade' = somou litros/unidades no item; 'tambor' = entrou
-- um tambor cheio na reserva (quantidade = capacidade do tambor).

create table if not exists consumo_entradas (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  item_id uuid references itens_consumo (id) on delete set null,
  item_nome text not null,
  unidade text not null default '',
  quantidade numeric not null,
  tipo text not null default 'quantidade',
  numero_nf text,
  nf_url text,
  nf_nome text,
  responsavel text,
  data_hora timestamptz not null default now()
);

create index if not exists idx_consumo_entradas_company on consumo_entradas (company_id);
create index if not exists idx_consumo_entradas_item_id on consumo_entradas (item_id);
create index if not exists idx_consumo_entradas_data_hora on consumo_entradas (data_hora desc);

alter table consumo_entradas enable row level security;

drop policy if exists isolamento_empresa_consumo_entradas on consumo_entradas;
create policy isolamento_empresa_consumo_entradas on consumo_entradas
  for all using (company_id = current_company_id()) with check (company_id = current_company_id());

drop trigger if exists stamp_company_id_consumo_entradas on consumo_entradas;
create trigger stamp_company_id_consumo_entradas
  before insert on consumo_entradas
  for each row execute function stamp_company_id();

-- Faz a API do Supabase enxergar a tabela nova na hora.
notify pgrst, 'reload schema';
