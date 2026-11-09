-- ============================================================
-- 0098: Empresa Localiza Pesados dentro do sistema
--
-- A Localiza passa a usar o sistema como mais uma empresa, só com o
-- Inventário de Caminhões (pátio). Ela não tem clientes (a frota é dela) e
-- tem visual próprio — ver src/lib/empresasEspeciais.ts (o id abaixo está
-- fixo lá) e a classe `marca-localiza` em src/index.css.
--
-- Também corrige uma limitação antiga do multiempresa: placa, nome de pátio
-- e nome de situação eram únicos no BANCO INTEIRO (0001/0006/0008). Com duas
-- empresas, a mesma placa ou um pátio "PATIO 1" em cada uma dava erro de
-- duplicidade. Agora são únicos por empresa.
--
-- Pode rodar de novo sem duplicar nada.
-- ============================================================

-- 1) Empresa: só o Inventário de Caminhões + Configurações de pátios e usuários.
insert into companies (id, name, sistema_label, primary_color, observacoes, status, modulos_habilitados)
values (
  '81775591-b128-476e-b630-bc88f068c6ae',
  'LOCALIZA PESADOS',
  'INVENTÁRIO DE CAMINHÕES',
  '#04662C',
  'Inventário de caminhões (pátio). Sem clientes. Visual próprio.',
  'active',
  array['inventario_caminhoes', 'config_patios', 'config_usuarios']
)
on conflict (id) do update
  set name = excluded.name,
      sistema_label = excluded.sistema_label,
      modulos_habilitados = excluded.modulos_habilitados;

-- 2) Veículo sem cliente (Localiza). As outras empresas continuam exigindo o
--    cliente na tela.
alter table veiculos alter column cliente_id drop not null;

-- 3) Unicidade por empresa, não no banco inteiro.
do $$
declare
  v record;
begin
  for v in
    select c.conname, t.relname
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
     where n.nspname = 'public'
       and c.contype = 'u'
       and array_length(c.conkey, 1) = 1
       and (
         (t.relname = 'veiculos' and c.conkey[1] = (select attnum from pg_attribute where attrelid = t.oid and attname = 'placa'))
         or (t.relname = 'patios' and c.conkey[1] = (select attnum from pg_attribute where attrelid = t.oid and attname = 'nome'))
         or (t.relname = 'status_manutencao' and c.conkey[1] = (select attnum from pg_attribute where attrelid = t.oid and attname = 'nome'))
       )
  loop
    execute format('alter table %I drop constraint %I', v.relname, v.conname);
  end loop;
end $$;

create unique index if not exists uq_veiculos_empresa_placa on veiculos (company_id, placa);
create unique index if not exists uq_patios_empresa_nome on patios (company_id, nome);
create unique index if not exists uq_status_manutencao_empresa_nome on status_manutencao (company_id, nome);

-- 4) Situações iniciais da Localiza.
insert into status_manutencao (company_id, nome) values
  ('81775591-b128-476e-b630-bc88f068c6ae', 'Corretiva'),
  ('81775591-b128-476e-b630-bc88f068c6ae', 'Preventiva')
on conflict (company_id, nome) do nothing;

-- ------------------------------------------------------------
-- Usuários da Localiza: crie pela tela Configurações → Usuários estando
-- como admin master, escolhendo "LOCALIZA PESADOS" em Empresa Vinculada.
-- ------------------------------------------------------------
