-- Habilita o Realtime do Supabase para a tabela movimentacoes
-- Isso permite que o cliente web receba eventos de INSERT / UPDATE / DELETE
-- em tempo real, mantendo a lista de veículos no pátio sempre atualizada
-- sem precisar recarregar a página manualmente.

-- Adiciona a tabela na publicação padrão do Supabase Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE movimentacoes;

-- Garante que o REPLICA IDENTITY está configurado para enviar a linha completa
-- no payload do evento (necessário para UPDATE e DELETE funcionarem corretamente)
ALTER TABLE movimentacoes REPLICA IDENTITY FULL;
