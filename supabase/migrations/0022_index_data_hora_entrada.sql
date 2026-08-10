-- Gvel Diesel — índice em data_hora_entrada, a coluna mais usada nas consultas de
-- movimentações (ORDER BY em toda listagem, e filtro de período no Dashboard). Sem
-- índice o Postgres varre a tabela inteira pra ordenar/filtrar, e isso piora
-- conforme o histórico de movimentações cresce.
-- Rode este arquivo no SQL Editor do seu projeto Supabase (ou via `supabase db push`)
-- depois de já ter aplicado as migrations anteriores.

create index if not exists idx_movimentacoes_data_hora_entrada
  on movimentacoes (data_hora_entrada desc);

-- Composto: acelera a consulta mais comum do Dashboard (status = 'no_patio',
-- ordenada por data de entrada).
create index if not exists idx_movimentacoes_status_data
  on movimentacoes (status, data_hora_entrada desc);
