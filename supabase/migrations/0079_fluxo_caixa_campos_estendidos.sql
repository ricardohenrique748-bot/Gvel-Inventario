-- Campos extras no lançamento do Fluxo de Caixa (Cliente, Vencimento,
-- Veículo, Forma de Pagamento, Status de Pagamento) — pedido específico da
-- Pedrão. Ficam disponíveis na tabela pra qualquer empresa (colunas
-- opcionais, não quebram nada existente), mas só aparecem no formulário das
-- empresas com `companies.financeiro_campos_estendidos = true` (ver
-- Financeiro.tsx). Por padrão todas as empresas ficam com `false`, ou seja,
-- a GVEL continua com a tela exatamente como está hoje.

alter table fluxo_caixa_lancamentos add column if not exists cliente_id uuid references clientes(id);
alter table fluxo_caixa_lancamentos add column if not exists veiculo_id uuid references veiculos(id);
alter table fluxo_caixa_lancamentos add column if not exists data_vencimento date;
alter table fluxo_caixa_lancamentos add column if not exists forma_pagamento text;
alter table fluxo_caixa_lancamentos add column if not exists status_pagamento text not null default 'pendente' check (status_pagamento in ('pago', 'pendente'));

alter table companies add column if not exists financeiro_campos_estendidos boolean not null default false;
