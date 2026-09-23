-- A Pedrão usa vários status de cobrança além de Pago/Pendente (Cancelado,
-- Isento, Abater, Cobrado, Retirar, Somando, Zerou, Trocar AP...). Em vez de
-- travar num enum fixo e perder informação da planilha original, o campo
-- passa a aceitar qualquer texto — continua obrigatório e com padrão
-- 'pendente', só sem a restrição de valores.

alter table fluxo_caixa_lancamentos drop constraint if exists fluxo_caixa_lancamentos_status_pagamento_check;
