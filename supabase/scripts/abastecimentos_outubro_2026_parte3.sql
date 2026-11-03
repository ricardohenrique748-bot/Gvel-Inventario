-- Lançamento dos abastecimentos de OUTUBRO/2026, parte 3 (planilha, 21/out a 30/out),
-- empresa GVEL. Continuação de abastecimentos_outubro_2026_parte2.sql (08 a 22/out).
-- Rode no SQL Editor do Supabase. Pode rodar de novo sem duplicar.
--
-- - Não duplica o que já foi lançado pela tela: pula se já existir abastecimento
--   da mesma placa, no mesmo dia, com odômetro até 5 km de diferença.
-- - Diesel S10, posto NÃO INFORMADO, horário 12:00.
-- - PARCIAIS (até 300 L): GDT0I01 22/out 276,01 L, CUL2E24 23/out 252 L,
--   EDJ8C00 24/out 160,2 L, GDT0I02 26/out 200 L, EDJ8C00 26/out 300 L,
--   CUL2E24 26/out 150 L, EDJ8C00 30/out 250 L. Demais = tanque cheio.
-- - GDT0I02 21/out (odôm. 88870): na parte 2 estava sem valor; a planilha agora
--   traz 476 L / R$ 3.184,45, então entra aqui.
-- - CORREÇÃO: CUL2E24 12/out (odôm. 236862) foi lançado na parte 2 com 597,8 L;
--   a planilha atual traz 510,94 L (R$ 3.469,28 → R$ 6,79/L, coerente com os demais).
-- - Continuam NÃO lançados (sem valor/litros): ERA9G01 10/out e 14/out.

begin;

with planilha (placa, data_hora, odometro, litros, valor_total, tanque_cheio, motorista) as (
  values
  ('CUL2E24', '2026-10-22 12:00:00-03', 240488, 670.01, 4482.36, true, 'TIAGO'),
  ('CUL2E24', '2026-10-23 12:00:00-03', 241009, 252, 1685.88, false, 'MARCIO'),
  ('CUL2E24', '2026-10-26 12:00:00-03', 242586, 150, 1018.50, false, 'TIAGO'),
  ('CUL2E24', '2026-10-27 12:00:00-03', 243054, 749.63, 5015.03, true, 'TIAGO'),
  ('CUL2E24', '2026-10-30 12:00:00-03', 244530, 747.59, 5001.37, true, 'TIAGO'),
  ('EDJ8C00', '2026-10-23 12:00:00-03', 552413, 471.44, 3153.93, true, 'BRUNO'),
  ('EDJ8C00', '2026-10-24 12:00:00-03', 552865, 160.2, 1087.82, false, 'BRUNO'),
  ('EDJ8C00', '2026-10-26 12:00:00-03', 554058, 300, 2037.00, false, 'BRUNO'),
  ('EDJ8C00', '2026-10-27 12:00:00-03', 554551, 555.01, 3713.01, true, 'BRUNO'),
  ('EDJ8C00', '2026-10-30 12:00:00-03', 555497, 250, 1722.50, false, 'BRUNO'),
  ('ERA9G01', '2026-10-26 12:00:00-03', 994299, 306, 2047.15, true, 'MAURECY'),
  ('ERA9G01', '2026-10-28 12:00:00-03', 995641, 647.01, 4328.49, true, 'MAURECY'),
  ('FXM9D74', '2026-10-23 12:00:00-03', 356081, 517.47, 3461.28, true, 'DIEGO'),
  ('FXM9D74', '2026-10-27 12:00:00-03', 358180, 911.06, 6095.12, true, 'DIEGO'),
  ('GDT0H04', '2026-10-26 12:00:00-03', 11518, 576, 3853.44, true, 'MARCIO'),
  ('GDT0H04', '2026-10-28 12:00:00-03', 12863, 525.01, 3512.31, true, 'MARCIO'),
  ('GDT0I01', '2026-10-22 12:00:00-03', 121140, 276.01, 2039.71, false, 'MATEUS'),
  ('GDT0I01', '2026-10-26 12:00:00-03', 122331, 504.9, 3377.78, true, 'MATEUS'),
  ('GDT0I01', '2026-10-28 12:00:00-03', 123666, 574.02, 3840.20, true, 'MATEUS'),
  ('GDT0I02', '2026-10-21 12:00:00-03', 88870, 476, 3184.45, true, 'HUANDERSON'),
  ('GDT0I02', '2026-10-23 12:00:00-03', 89863, 469.79, 3471.75, true, 'HUANDERSON'),
  ('GDT0I02', '2026-10-26 12:00:00-03', 91451, 200, 1358.00, false, 'HUANDERSON'),
  ('GDT0I02', '2026-10-27 12:00:00-03', 91915, 745.01, 4984.11, true, 'HUANDERSON'),
  ('GDT0I03', '2026-10-24 12:00:00-03', 70847, 670, 4482.30, true, 'ANDRE'),
  ('GDT0I03', '2026-10-27 12:00:00-03', 72423, 751.01, 5046.80, true, 'ANDRE')
),
novos as (
  insert into abastecimentos (
    company_id, veiculo_id, placa, combustivel, data_hora, odometro,
    posto_fornecedor, volume, valor_unitario, valor_total, tanque_cheio,
    motorista_nome, status, aprovado, origem, created_by_nome
  )
  select
    '0923c894-85ca-45c1-ba1b-3124d19b4d65', 'pesado_' || p.placa, p.placa, 'DIESEL S10',
    p.data_hora::timestamptz, p.odometro, 'NÃO INFORMADO', p.litros,
    round(p.valor_total / p.litros, 3), p.valor_total, p.tanque_cheio,
    p.motorista, 'valido', true, 'importacao', 'IMPORTAÇÃO PLANILHA OUT/2026'
  from planilha p
  where not exists (
    select 1 from abastecimentos a
     where a.company_id = '0923c894-85ca-45c1-ba1b-3124d19b4d65'
       and a.placa = p.placa
       and (a.data_hora at time zone 'America/Sao_Paulo')::date
         = (p.data_hora::timestamptz at time zone 'America/Sao_Paulo')::date
       and abs(a.odometro - p.odometro) <= 5
  )
  order by p.placa, p.data_hora
  returning veiculo_id, placa, data_hora, odometro
)
-- Leitura de odômetro, como o lançamento pela tela já faz.
insert into leituras_odometro (company_id, veiculo_id, placa, data_leitura, quilometragem, origem)
select '0923c894-85ca-45c1-ba1b-3124d19b4d65', veiculo_id, placa, data_hora, odometro, 'abastecimento'
from novos;

-- Correção da litragem do CUL2E24 12/out conforme a planilha atual.
update abastecimentos
   set volume = 510.94,
       valor_unitario = round(3469.28 / 510.94, 3),
       valor_total = 3469.28,
       motivo_alteracao = 'Correção de litragem conforme planilha OUT/2026 (597,8 → 510,94 L)'
 where company_id = '0923c894-85ca-45c1-ba1b-3124d19b4d65'
   and placa = 'CUL2E24'
   and (data_hora at time zone 'America/Sao_Paulo')::date = '2026-10-12'
   and abs(odometro - 236862) <= 5
   and volume <> 510.94;

-- Conferência: TODOS os abastecimentos de 21 a 30/out por placa. Devem existir 27:
-- os 25 deste script + EDJ8C00 21/out e GDT0H04 22/out (lançados na parte 2).
select placa, count(*) as registros, sum(volume) as litros, sum(valor_total) as valor
  from abastecimentos
 where company_id = '0923c894-85ca-45c1-ba1b-3124d19b4d65'
   and data_hora >= '2026-10-21 00:00:00-03' and data_hora < '2026-10-31 00:00:00-03'
   and status <> 'invalidado'
   and combustivel not ilike '%arla%'
 group by placa
 order by placa;

commit;
