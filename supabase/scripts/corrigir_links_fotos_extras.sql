-- ============================================================
-- Conserta os links das FOTOS EXTRAS das entradas.
--
-- O sistema gravava as observações inteiras em MAIÚSCULAS, inclusive os links
-- das fotos extras (botões "Galeria" / "Adicionar foto"). Os links quebravam e
-- as fotos não apareciam. Os arquivos estão no armazenamento com nome em
-- minúsculas, então basta voltar o trecho das fotos para minúsculas.
-- O texto digitado nas observações (antes das fotos) continua igual.
--
-- Em 12/11/2026: 15 entradas, 37 fotos — todas conferidas no armazenamento.
-- ============================================================

-- 1) Cópia de segurança do que vai mudar
create table if not exists backup_observacoes_fotos_extras_20261112 as
select id, observacoes, now() as copiado_em
  from movimentacoes
 where observacoes like '%[FOTOS_EXTRAS:%HTTPS://%';

-- 2) Correção
update movimentacoes
   set observacoes = left(observacoes, strpos(observacoes, '[FOTOS_EXTRAS:') + 13)
                  || lower(substr(observacoes, strpos(observacoes, '[FOTOS_EXTRAS:') + 14))
 where observacoes like '%[FOTOS_EXTRAS:%HTTPS://%';

-- 3) Conferir: tem que dar 0
select count(*) as ainda_quebrados
  from movimentacoes
 where observacoes like '%[FOTOS_EXTRAS:%HTTPS://%';
