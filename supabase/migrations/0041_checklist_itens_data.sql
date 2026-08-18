-- Adiciona coluna data na tabela checklist_itens
ALTER TABLE checklist_itens ADD COLUMN IF NOT EXISTS data text;
