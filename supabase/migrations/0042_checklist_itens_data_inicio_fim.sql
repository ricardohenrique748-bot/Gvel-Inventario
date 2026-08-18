-- Adiciona colunas data_inicio e data_fim na tabela checklist_itens
ALTER TABLE checklist_itens ADD COLUMN IF NOT EXISTS data_inicio text;
ALTER TABLE checklist_itens ADD COLUMN IF NOT EXISTS data_fim text;
