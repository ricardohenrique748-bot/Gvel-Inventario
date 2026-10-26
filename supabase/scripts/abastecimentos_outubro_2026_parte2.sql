-- Lançamento dos abastecimentos de OUTUBRO/2026, parte 2 (planilha, 08/out a 22/out),
-- empresa GVEL. Continuação de abastecimentos_outubro_2026.sql (01 a 07/out).
-- Rode no SQL Editor do Supabase. Pode rodar de novo sem duplicar.
--
-- - Não duplica o que já foi lançado pela tela: pula se já existir abastecimento
--   da mesma placa, no mesmo dia, com odômetro até 5 km de diferença.
-- - Diesel S10, posto NÃO INFORMADO, horário 12:00.
-- - PARCIAL (até 300 L ou > 3 km/L): CUL2E24 19/out 262,71 L. Demais = tanque cheio.
-- - GDT0I01 "20/jan" (odômetro 120592) lançado como 20/out: erro de digitação na planilha.
-- - NÃO lançados (sem valor/litros, não são abastecimento):
--   ERA9G01 10/out (odôm. 991471), ERA9G01 14/out (odôm. 993197),
--   GDT0I02 21/out (odôm. 88870).

begin;

with planilha (placa, data_hora, odometro, litros, valor_total, tanque_cheio, motorista) as (
  values
  ('CUL2E24', '2026-10-09 12:00:00-03', 235682, 628.01, 4264.24, true, 'TIAGO'),
  ('CUL2E24', '2026-10-12 12:00:00-03', 236862, 597.8, 3469.28, true, 'TIAGO'),
  ('CUL2E24', '2026-10-15 12:00:00-03', 238384, 691, 4691.89, true, 'TIAGO'),
  ('CUL2E24', '2026-10-19 12:00:00-03', 238950, 262.71, 1783.79, false, 'TIAGO'),
  ('EDJ8C00', '2026-10-09 12:00:00-03', 546773, 535, 3632.65, true, 'BRUNO'),
  ('EDJ8C00', '2026-10-12 12:00:00-03', 547943, 567, 3849.93, true, 'BRUNO'),
  ('EDJ8C00', '2026-10-13 12:00:00-03', 548954, 479.75, 3257.50, true, 'BRUNO'),
  ('EDJ8C00', '2026-10-15 12:00:00-03', 549726, 369.30, 2507.57, true, 'BRUNO'),
  ('EDJ8C00', '2026-10-19 12:00:00-03', 550267, 323.01, 2193.23, true, 'BRUNO'),
  ('EDJ8C00', '2026-10-21 12:00:00-03', 551349, 505.66, 3736.83, true, 'BRUNO'),
  ('ERA9G01', '2026-10-12 12:00:00-03', 992162, 820.1, 5568.48, true, 'HUANDERSON'),
  ('ERA9G01', '2026-10-15 12:00:00-03', 993705, 780.6, 5300.27, true, 'HUANDERSON'),
  ('FXM9D74', '2026-10-08 12:00:00-03', 351356, 750, 5092.50, true, 'MATEUS'),
  ('FXM9D74', '2026-10-14 12:00:00-03', 352862, 793, 5384.48, true, 'MATEUS'),
  ('FXM9D74', '2026-10-20 12:00:00-03', 354849, 961, 6429.09, true, 'DIEGO'),
  ('GDT0H04', '2026-10-09 12:00:00-03', 6934, 794, 5391.27, true, 'MARCIO'),
  ('GDT0H04', '2026-10-17 12:00:00-03', 8360, 679.01, 4542.55, true, 'MARCIO'),
  ('GDT0H04', '2026-10-22 12:00:00-03', 10083, 774.01, 5178.14, true, 'MARCIO'),
  ('GDT0I01', '2026-10-14 12:00:00-03', 117925, 635.04, 4311.92, true, 'MATEUS'),
  ('GDT0I01', '2026-10-18 12:00:00-03', 119371, 710.02, 4750.03, true, 'MATEUS'),
  ('GDT0I01', '2026-10-20 12:00:00-03', 120592, 514.05, 3850.24, true, 'MATEUS'),
  ('GDT0I02', '2026-10-19 12:00:00-03', 87816, 556.01, 3775.30, true, 'HUANDERSON'),
  ('GDT0I03', '2026-10-09 12:00:00-03', 63963, 607, 4121.53, true, 'ANDRE'),
  ('GDT0I03', '2026-10-12 12:00:00-03', 65612, 745, 5282.05, true, 'ANDRE'),
  ('GDT0I03', '2026-10-15 12:00:00-03', 67109, 640, 4345.60, true, 'ANDRE'),
  ('GDT0I03', '2026-10-17 12:00:00-03', 68297, 535, 3632.67, true, 'ANDRE'),
  ('GDT0I03', '2026-10-20 12:00:00-03', 69312, 460, 3445.60, true, 'ANDRE')
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

-- Conferência: TODOS os abastecimentos de 08 a 22/out por placa (os da tela + os
-- deste script). Devem existir 27 da planilha, um por linha.
select placa, count(*) as registros, sum(volume) as litros, sum(valor_total) as valor
  from abastecimentos
 where company_id = '0923c894-85ca-45c1-ba1b-3124d19b4d65'
   and data_hora >= '2026-10-08 00:00:00-03' and data_hora < '2026-10-23 00:00:00-03'
   and status <> 'invalidado'
   and combustivel not ilike '%arla%'
 group by placa
 order by placa;

commit;
