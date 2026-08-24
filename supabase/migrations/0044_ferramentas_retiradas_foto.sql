-- Migration 0044: Adiciona colunas de foto para ferramentas_retiradas
alter table ferramentas_retiradas add column if not exists foto_responsavel_url text;
alter table ferramentas_retiradas add column if not exists foto_url text;
