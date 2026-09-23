-- Multi-empresa (Fase 1) — corrige vazamento de dados entre empresas para
-- contas de admin master. As políticas criadas em 0073 tinham
-- "company_id = current_company_id() OR is_master_admin_user()" — como
-- is_master_admin_user() é sempre true pra essas contas, elas viam os
-- dados de TODAS as empresas ao mesmo tempo nas tabelas de negócio, mesmo
-- depois de "entrar" numa empresa específica pelo seletor "Trocar de
-- Empresa" (que só atualiza usuarios.company_id).
--
-- Correção: as tabelas de negócio passam a filtrar sempre por
-- company_id = current_company_id(), sem exceção pra master admin — quem é
-- master admin e quer ver os dados de outra empresa usa o seletor pra
-- "entrar" nela (o que muda current_company_id()), e a partir daí é
-- tratado exatamente como um usuário comum daquela empresa. As tabelas
-- `usuarios` e `companies` continuam com o bypass de master admin (ele
-- precisa disso pra administrar usuários/empresas de toda a plataforma).

do $$
declare
  v_tabela text;
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
    execute format('drop policy if exists %I on %I', 'isolamento_empresa_' || v_tabela, v_tabela);
    execute format(
      'create policy %I on %I for all using (company_id = current_company_id()) with check (company_id = current_company_id())',
      'isolamento_empresa_' || v_tabela, v_tabela
    );
  end loop;
end $$;
