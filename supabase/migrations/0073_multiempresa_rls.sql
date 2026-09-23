-- Multi-empresa (Fase 1) — aplica `company_id` + isolamento por RLS em todas
-- as tabelas de negócio da GVEL. Não apaga nenhuma tabela nem nenhuma linha.
--
-- `marcas` e `modelos` ficam de fora de propósito: são um catálogo genérico
-- de fabricante/modelo de caminhão (Volvo, Scania...), compartilhado entre
-- empresas, sem dado sensível por empresa.
--
-- Como hoje só existe a GVEL, o backfill de `company_id` é sempre "tudo que
-- já existe é da GVEL" — não há ambiguidade nem risco de associar um
-- registro à empresa errada.

create or replace function stamp_company_id()
returns trigger
language plpgsql
as $$
begin
  if new.company_id is null then
    new.company_id := current_company_id();
  end if;
  return new;
end;
$$;

do $$
declare
  v_gvel_id uuid := '0923c894-85ca-45c1-ba1b-3124d19b4d65';
  v_tabela text;
  v_policy record;
  v_tabelas text[] := array[
    'clientes', 'veiculos', 'movimentacoes', 'inspecoes', 'inspecao_itens',
    'patios', 'status_manutencao', 'movimentacao_historico',
    'ferramentas', 'ferramentas_retiradas',
    'checklist_os', 'checklist_itens', 'checklists_frota', 'checklist_frota_itens',
    'itens_consumo', 'consumo_baixas',
    'fluxo_caixa_lancamentos', 'viagens_frota',
    'centros_custo', 'transportadoras', 'tipos_carga', 'enderecos_frequentes',
    'pessoas', 'formas_pagamento', 'tipos_lancamento', 'contas_bancarias',
    'fornecedores', 'contas_pagar_receber',
    'veiculos_clientes', 'patio_estadias',
    'lotes_importacao_extrato', 'transacoes_extrato',
    'lotes_importacao_faltas', 'faltas_colaboradores',
    'ordens_servico', 'abastecimentos', 'leituras_odometro',
    'veiculos_frota'
  ];
begin
  foreach v_tabela in array v_tabelas loop
    -- Coluna + backfill + not null + índice
    execute format('alter table %I add column if not exists company_id uuid references companies(id)', v_tabela);
    execute format('update %I set company_id = %L where company_id is null', v_tabela, v_gvel_id);
    execute format('alter table %I alter column company_id set not null', v_tabela);
    execute format('create index if not exists %I on %I (company_id)', 'idx_' || v_tabela || '_company', v_tabela);

    -- RLS: liga (se ainda não estava) e remove QUALQUER policy antiga antes
    -- de criar a nova — RLS combina policies permissivas com OR, então uma
    -- policy antiga aberta (ex.: "TO public USING (true)") continuaria
    -- valendo por baixo da nova se não for removida.
    execute format('alter table %I enable row level security', v_tabela);

    for v_policy in select policyname from pg_policies where schemaname = 'public' and tablename = v_tabela
    loop
      execute format('drop policy %I on %I', v_policy.policyname, v_tabela);
    end loop;

    execute format(
      'create policy %I on %I for all using (company_id = current_company_id() or is_master_admin_user()) with check (company_id = current_company_id() or is_master_admin_user())',
      'isolamento_empresa_' || v_tabela, v_tabela
    );

    -- Auto-preenche company_id em inserts que não o informam (cobre os
    -- hooks do frontend sem precisar alterá-los um a um nesta fase).
    execute format('drop trigger if exists %I on %I', 'stamp_company_id_' || v_tabela, v_tabela);
    execute format(
      'create trigger %I before insert on %I for each row execute function stamp_company_id()',
      'stamp_company_id_' || v_tabela, v_tabela
    );
  end loop;
end $$;
