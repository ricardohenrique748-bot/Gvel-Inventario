-- Adiciona coluna status_os na tabela checklist_os
ALTER TABLE checklist_os ADD COLUMN IF NOT EXISTS status_os text DEFAULT 'EM ANDAMENTO';
