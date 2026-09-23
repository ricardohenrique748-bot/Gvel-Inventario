-- A coluna "VEÍCULOS" da planilha da Pedrão é uma quantidade (quantos
-- veículos aquela cobrança cobre), não um veículo específico da frota.
-- veiculo_id (criado na 0079) fica como estava, sem uso por enquanto — essa
-- nova coluna é o que a tela realmente usa pra Pedrão.
alter table fluxo_caixa_lancamentos add column if not exists quantidade_veiculos integer;
