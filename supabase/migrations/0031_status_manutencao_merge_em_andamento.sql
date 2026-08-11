-- Gvel Diesel — funde o status de manutenção "EM ANDAMENTO" em "PREPARAÇÃO SN".
-- Rode este arquivo no SQL Editor do seu projeto Supabase (ou via `supabase db push`)
-- depois de já ter aplicado as migrations anteriores.

-- Garante que "PREPARAÇÃO SN" existe antes de reatribuir as movimentações.
insert into status_manutencao (nome)
select 'PREPARAÇÃO SN'
where not exists (select 1 from status_manutencao where nome = 'PREPARAÇÃO SN');

-- Reatribui movimentações que estavam com "EM ANDAMENTO" para "PREPARAÇÃO SN".
update movimentacoes
set status_id = (select id from status_manutencao where nome = 'PREPARAÇÃO SN')
where status_id = (select id from status_manutencao where nome = 'EM ANDAMENTO');

-- Remove o status "EM ANDAMENTO".
delete from status_manutencao where nome = 'EM ANDAMENTO';
