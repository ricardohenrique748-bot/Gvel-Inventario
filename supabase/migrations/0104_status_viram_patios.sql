-- ============================================================
-- 0104: LOCALIZA — status de manutenção ficam só CORRETIVA e PREVENTIVA
--
-- Só mexe na Localiza (81775591-…). Gvel e outras empresas não mudam.
--
-- Os outros status da Localiza (lojas, oficinas, pátios — ex.: OFICINA
-- BELLUM, LOJA CAMPINAS, PÁTIO SINOP) dizem ONDE o veículo está, então
-- viram pátios / setores:
--   1) cria um pátio com o mesmo nome (se ainda não existir);
--   2) as movimentações que estavam com esse status passam a ficar nesse
--      pátio e ficam "SEM MANUTENÇÃO";
--   3) apaga o status.
-- "SEM MANUTENÇÃO" não é registro — é o status vazio — e continua igual.
--
-- Pode rodar de novo sem problema.
-- ============================================================

-- 1) Cria os pátios
insert into patios (company_id, nome)
select distinct s.company_id, upper(trim(s.nome))
  from status_manutencao s
 where s.company_id = '81775591-b128-476e-b630-bc88f068c6ae'
   and upper(trim(s.nome)) not in ('CORRETIVA', 'PREVENTIVA')
on conflict (company_id, nome) do nothing;

-- 2) Move as movimentações para o pátio e limpa o status
update movimentacoes m
   set patio_id = p.id,
       status_id = null
  from status_manutencao s
  join patios p
    on p.company_id = s.company_id
   and p.nome = upper(trim(s.nome))
 where m.status_id = s.id
   and s.company_id = '81775591-b128-476e-b630-bc88f068c6ae'
   and upper(trim(s.nome)) not in ('CORRETIVA', 'PREVENTIVA');

-- 3) Remove os status que viraram pátio
delete from status_manutencao s
 where s.company_id = '81775591-b128-476e-b630-bc88f068c6ae'
   and upper(trim(s.nome)) not in ('CORRETIVA', 'PREVENTIVA')
   and not exists (select 1 from movimentacoes m where m.status_id = s.id);
