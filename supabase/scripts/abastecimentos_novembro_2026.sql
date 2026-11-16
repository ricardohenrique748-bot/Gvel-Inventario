-- Lançamento dos abastecimentos de NOVEMBRO/2026 (planilha, 01 a 15/nov), empresa GVEL.
-- Continuação de abastecimentos_outubro_2026_parte3.sql (21 a 30/out) — rode aquele antes.
-- Rode no SQL Editor do Supabase. Pode rodar de novo sem duplicar.
--
-- - Não duplica o que já foi lançado pela tela: pula se já existir abastecimento
--   da mesma placa, no mesmo dia, com odômetro até 5 km de diferença.
-- - Diesel S10, posto NÃO INFORMADO, horário 12:00. Valor = só o diesel (sem ARLA).
-- - PARCIAIS (até 300 L): CUL2E24 06/nov 100 L, CUL2E24 10/nov 150 L, GDT0I01 06/nov 100 L, GDT0I02 06/nov 200 L, GDT0I02 12/nov 300 L, GDT0I03 04/nov 200 L. Demais = tanque cheio.
-- - CORREÇÃO: ERA9G01 09/nov veio na planilha com odômetro 100409; o certo é 1000409
--   (entre 999029 em 05/nov e 1002017 em 11/nov — faltou um zero).
-- - 40 abastecimentos.

begin;

with planilha (placa, data_hora, odometro, litros, valor_total, tanque_cheio, motorista) as (
  values
  ('CUL2E24', '2026-11-04 12:00:00-03', 245910, 576.86, 3859.24, true, 'TIAGO'),
  ('CUL2E24', '2026-11-06 12:00:00-03', 247077, 100, 679.00, false, 'TIAGO'),
  ('CUL2E24', '2026-11-09 12:00:00-03', 247567, 723.67, 4841.40, true, 'TIAGO'),
  ('CUL2E24', '2026-11-10 12:00:00-03', 248741, 150, 1018.50, false, 'TIAGO'),
  ('CUL2E24', '2026-11-11 12:00:00-03', 249228, 693.15, 4637.18, true, 'TIAGO'),
  ('EDJ8C00', '2026-11-05 12:00:00-03', 556085, 586, 3920.34, true, 'BRUNO'),
  ('EDJ8C00', '2026-11-08 12:00:00-03', 556921, 424.96, 2842.98, true, 'BRUNO'),
  ('EDJ8C00', '2026-11-10 12:00:00-03', 557619, 375, 2508.75, true, 'BRUNO'),
  ('ERA9G01', '2026-11-02 12:00:00-03', 997271, 810, 5418.91, true, 'MAURECY'),
  ('ERA9G01', '2026-11-04 12:00:00-03', 998578, 500, 3345.00, true, 'MAURECY'),
  ('ERA9G01', '2026-11-05 12:00:00-03', 999029, 550, 3679.50, true, 'MAURECY'),
  ('ERA9G01', '2026-11-09 12:00:00-03', 1000409, 822, 5499.18, true, 'MAURECY'),
  ('ERA9G01', '2026-11-11 12:00:00-03', 1002017, 886.02, 5927.50, true, 'MAURECY'),
  ('ERA9G01', '2026-11-15 12:00:00-03', 1003044, 564.33, 3775.18, true, 'MAURECY'),
  ('FXM9D74', '2026-11-02 12:00:00-03', 359646, 700.04, 4683.27, true, 'DIEGO'),
  ('FXM9D74', '2026-11-06 12:00:00-03', 361627, 765, 5165.01, true, 'DIEGO'),
  ('FXM9D74', '2026-11-13 12:00:00-03', 363051, 840, 5619.60, true, 'RODRIGO'),
  ('FXM9D74', '2026-11-15 12:00:00-03', 363848, 375.03, 2508.99, true, 'RODRIGO'),
  ('GDT0H04', '2026-11-01 12:00:00-03', 14473, 683, 4569.28, true, 'MARCIO'),
  ('GDT0H04', '2026-11-04 12:00:00-03', 15829, 640, 4281.60, true, 'MARCIO'),
  ('GDT0H04', '2026-11-09 12:00:00-03', 17458, 794, 5311.87, true, 'MARCIO'),
  ('GDT0H04', '2026-11-13 12:00:00-03', 19193, 784, 5244.96, true, 'MARCIO'),
  ('GDT0H04', '2026-11-15 12:00:00-03', 20196, 451.48, 3020.43, true, 'MARCIO'),
  ('GDT0I01', '2026-11-01 12:00:00-03', 125257, 688.13, 4603.58, true, 'MATEUS'),
  ('GDT0I01', '2026-11-04 12:00:00-03', 126578, 660, 4415.40, true, 'MATEUS'),
  ('GDT0I01', '2026-11-06 12:00:00-03', 128091, 100, 669.00, false, 'MATEUS'),
  ('GDT0I01', '2026-11-09 12:00:00-03', 128191, 700, 4683.00, true, 'MATEUS'),
  ('GDT0I01', '2026-11-13 12:00:00-03', 129522, 693, 4636.17, true, 'MATEUS'),
  ('GDT0I01', '2026-11-15 12:00:00-03', 130312, 353, 2361.58, true, 'MATEUS'),
  ('GDT0I02', '2026-11-01 12:00:00-03', 93371, 755.12, 5051.75, true, 'HUANDERSON'),
  ('GDT0I02', '2026-11-04 12:00:00-03', 95682, 590.77, 3952.29, true, 'HUANDERSON'),
  ('GDT0I02', '2026-11-06 12:00:00-03', 95871, 200, 1358.00, false, 'HUANDERSON'),
  ('GDT0I02', '2026-11-09 12:00:00-03', 96359, 688, 4602.73, true, 'HUANDERSON'),
  ('GDT0I02', '2026-11-12 12:00:00-03', 97738, 300, 2007.00, false, 'HUANDERSON'),
  ('GDT0I03', '2026-11-01 12:00:00-03', 73542, 538.48, 3602.44, true, 'ANDRE'),
  ('GDT0I03', '2026-11-04 12:00:00-03', 75107, 200, 1358.00, false, 'ANDRE'),
  ('GDT0I03', '2026-11-04 12:01:00-03', 75426, 630.12, 4242.35, true, 'ANDRE'),
  ('GDT0I03', '2026-11-06 12:00:00-03', 76458, 586.02, 3920.48, true, 'ANDRE'),
  ('GDT0I03', '2026-11-08 12:00:00-03', 77681, 567, 3793.23, true, 'ANDRE'),
  ('GDT0I03', '2026-11-12 12:00:00-03', 78949, 588.74, 3938.67, true, 'ANDRE')
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
    p.motorista, 'valido', true, 'importacao', 'IMPORTAÇÃO PLANILHA NOV/2026'
  from planilha p
  where not exists (
    select 1 from abastecimentos a
     where a.company_id = '0923c894-85ca-45c1-ba1b-3124d19b4d65'
       and a.placa = p.placa
       and (a.data_hora at time zone 'America/Sao_Paulo')::date
         = (p.data_hora::timestamptz at time zone 'America/Sao_Paulo')::date
       and abs(a.odometro - p.odometro) <= 5
  )
  order by p.placa, p.data_hora, p.odometro
  returning veiculo_id, placa, data_hora, odometro
)
-- Leitura de odômetro, como o lançamento pela tela já faz.
insert into leituras_odometro (company_id, veiculo_id, placa, data_leitura, quilometragem, origem)
select '0923c894-85ca-45c1-ba1b-3124d19b4d65', veiculo_id, placa, data_hora, odometro, 'abastecimento'
from novos;

-- Conferência: abastecimentos de 01 a 15/nov por placa. Devem somar 40.
select placa, count(*) as registros, sum(volume) as litros, sum(valor_total) as valor
  from abastecimentos
 where company_id = '0923c894-85ca-45c1-ba1b-3124d19b4d65'
   and data_hora >= '2026-11-01 00:00:00-03' and data_hora < '2026-11-16 00:00:00-03'
   and status <> 'invalidado'
   and combustivel not ilike '%arla%'
 group by placa
 order by placa;

commit;
