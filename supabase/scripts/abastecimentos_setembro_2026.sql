-- Lançamento dos abastecimentos de SETEMBRO/2026 (planilha), empresa GVEL.
-- Rode no SQL Editor do Supabase. Pode rodar de novo sem duplicar.
--
-- - Diesel S10, posto NÃO INFORMADO, horário 12:00 (dois no mesmo dia e
--   placa: 10:00 e 15:00, na ordem do odômetro).
-- - PARCIAIS (25): abastecimentos de até 300 L ou que, como tanque cheio,
--   dariam mais de 3 km/L. Todos os demais = tanque cheio.
--   CUL2E24 05/set 200 L, CUL2E24 26/set 368.83 L, EDJ8C00 03/set 294.03 L, EDJ8C00 04/set 150 L
--   EDJ8C00 09/set 200 L, EDJ8C00 10/set 200 L, EDJ8C00 12/set 240.14 L, EDJ8C00 24/set 300 L
--   EDJ8C00 29/set 212.48 L, ERA9G01 03/set 207 L, ERA9G01 10/set 200 L, ERA9G01 12/set 270 L
--   ERA9G01 28/set 400 L, FXM9D74 18/set 400 L, FXM9D74 29/set 616.01 L, GDT0I01 06/set 280 L
--   GDT0I01 08/set 100 L, GDT0I01 10/set 294.78 L, GDT0I01 12/set 100 L, GDT0I01 14/set 270.01 L
--   GDT0I01 16/set 50 L, GDT0I01 22/set 110 L, GDT0I02 09/set 249.03 L, GDT0I02 28/set 200 L
--   GDT0I03 12/set 100 L
-- - Valor/litro = valor total ÷ litros.

begin;

with planilha (placa, data_hora, odometro, litros, valor_total, tanque_cheio, motorista) as (
  values
  ('CUL2E24', '2026-09-03 12:00:00-03', 217299, 690.97, 4222.94, true, 'MARCIO'),
  ('CUL2E24', '2026-09-05 12:00:00-03', 218871, 200, 1238.06, false, 'MARCIO'),
  ('CUL2E24', '2026-09-08 12:00:00-03', 219515, 755.01, 4824.53, true, 'MARCIO'),
  ('CUL2E24', '2026-09-10 12:00:00-03', 220599, 700, 4473.05, true, 'MARCIO'),
  ('CUL2E24', '2026-09-11 12:00:00-03', 221314, 331.77, 2083.57, true, 'MARCIO'),
  ('CUL2E24', '2026-09-13 12:00:00-03', 222473, 516.14, 3241.36, true, 'MARCIO'),
  ('CUL2E24', '2026-09-15 12:00:00-03', 223529, 631.23, 4115.64, true, 'MARCIO'),
  ('CUL2E24', '2026-09-17 12:00:00-03', 224795, 613, 3959.98, true, 'MARCIO'),
  ('CUL2E24', '2026-09-19 12:00:00-03', 226391, 719.11, 4925.90, true, 'MARCIO'),
  ('CUL2E24', '2026-09-22 12:00:00-03', 227807, 764, 5111.16, true, 'MARCIO'),
  ('CUL2E24', '2026-09-26 12:00:00-03', 230360, 368.83, 2467.47, false, 'MARCIO'),
  ('CUL2E24', '2026-09-28 12:00:00-03', 231553, 622, 4161.24, true, 'MARCIO'),
  ('EDJ8C00', '2026-09-02 12:00:00-03', 531032, 701.86, 4344.51, true, 'TIAGO'),
  ('EDJ8C00', '2026-09-03 12:00:00-03', 531906, 294.03, 1837.82, false, 'TIAGO'),
  ('EDJ8C00', '2026-09-04 12:00:00-03', 533129, 150, 958.50, false, 'TIAGO'),
  ('EDJ8C00', '2026-09-07 12:00:00-03', 533426, 632.43, 4041.23, true, 'TIAGO'),
  ('EDJ8C00', '2026-09-09 12:00:00-03', 534267, 200, 1278.00, false, 'TIAGO'),
  ('EDJ8C00', '2026-09-10 12:00:00-03', 534752, 200.00, 1288.00, false, 'TIAGO'),
  ('EDJ8C00', '2026-09-11 12:00:00-03', 534993, 539.36, 3608.57, true, 'TIAGO'),
  ('EDJ8C00', '2026-09-12 12:00:00-03', 535529, 240.14, 1508.08, false, 'TIAGO'),
  ('EDJ8C00', '2026-09-14 12:00:00-03', 536719, 564.13, 3542.74, true, 'TIAGO'),
  ('EDJ8C00', '2026-09-17 12:00:00-03', 537415, 406.42, 2678.30, true, 'TIAGO'),
  ('EDJ8C00', '2026-09-19 12:00:00-03', 538335, 400.26, 2685.76, true, 'TIAGO'),
  ('EDJ8C00', '2026-09-20 12:00:00-03', 538870, 477.62, 3290.80, true, 'TIAGO'),
  ('EDJ8C00', '2026-09-21 12:00:00-03', 539821, 552.32, 3782.53, true, 'TIAGO'),
  ('EDJ8C00', '2026-09-23 12:00:00-03', 540655, 453.40, 3033.25, true, 'TIAGO'),
  ('EDJ8C00', '2026-09-24 12:00:00-03', 541571, 300, 2037.00, false, 'TIAGO'),
  ('EDJ8C00', '2026-09-26 12:00:00-03', 542533, 580, 3857.00, true, 'TIAGO'),
  ('EDJ8C00', '2026-09-27 12:00:00-03', 543234, 336.78, 2421.45, true, 'TIAGO'),
  ('EDJ8C00', '2026-09-28 12:00:00-03', 544179, 565.94, 3786.13, true, 'TIAGO'),
  ('EDJ8C00', '2026-09-29 12:00:00-03', 544585, 212.48, 1427.74, false, 'TIAGO'),
  ('ERA9G01', '2026-09-02 12:00:00-03', 979837, 828, 5092.21, true, 'HUANDERSON'),
  ('ERA9G01', '2026-09-03 12:00:00-03', 980430, 207, 1304.15, false, 'HUANDERSON'),
  ('ERA9G01', '2026-09-07 12:00:00-03', 981910, 849.33, 5427.22, true, 'HUANDERSON'),
  ('ERA9G01', '2026-09-10 12:00:00-03', 983202, 200.00, 1288.00, false, 'HUANDERSON'),
  ('ERA9G01', '2026-09-11 12:00:00-03', 983438, 790.88, 5290.99, true, 'HUANDERSON'),
  ('ERA9G01', '2026-09-12 12:00:00-03', 983960, 270, 1695.60, false, 'HUANDERSON'),
  ('ERA9G01', '2026-09-14 12:00:00-03', 985119, 616, 3868.48, true, 'HUANDERSON'),
  ('ERA9G01', '2026-09-17 12:00:00-03', 985818, 422, 2780.99, true, 'HUANDERSON'),
  ('ERA9G01', '2026-09-25 12:00:00-03', 986865, 603.57, 4098.29, true, 'HUANDERSON'),
  ('ERA9G01', '2026-09-28 12:00:00-03', 988309, 400, 2780.00, false, 'HUANDERSON'),
  ('FXM9D74', '2026-09-04 12:00:00-03', 337574, 806, 5069.73, true, 'MATEUS'),
  ('FXM9D74', '2026-09-07 12:00:00-03', 339005, 758.69, 4911.93, true, 'MATEUS'),
  ('FXM9D74', '2026-09-10 12:00:00-03', 340479, 807, 5197.86, true, 'MATEUS'),
  ('FXM9D74', '2026-09-16 12:00:00-03', 341953, 828.29, 5413.33, true, 'MATEUS'),
  ('FXM9D74', '2026-09-18 12:00:00-03', 343584, 400, 2772.00, false, 'MATEUS'),
  ('FXM9D74', '2026-09-19 12:00:00-03', 344230, 703.15, 4844.75, true, 'MATEUS'),
  ('FXM9D74', '2026-09-22 12:00:00-03', 345503, 765, 5117.85, true, 'MATEUS'),
  ('FXM9D74', '2026-09-29 12:00:00-03', 348165, 616.01, 4121.10, false, 'MATEUS'),
  ('GDT0I01', '2026-09-02 12:00:00-03', 99424, 380.01, 2319.50, true, 'FABIO'),
  ('GDT0I01', '2026-09-04 12:00:00-03', 101008, 644.13, 3987.17, true, 'FABIO'),
  ('GDT0I01', '2026-09-06 12:00:00-03', 101476, 280, 1783.61, false, 'FABIO'),
  ('GDT0I01', '2026-09-08 12:00:00-03', 102581, 100, 639.00, false, 'FABIO'),
  ('GDT0I01', '2026-09-09 12:00:00-03', 102658, 630, 4025.70, true, 'FABIO'),
  ('GDT0I01', '2026-09-10 12:00:00-03', 103715, 294.78, 1910.70, false, 'FABIO'),
  ('GDT0I01', '2026-09-12 10:00:00-03', 104589, 100, 655.00, false, 'FABIO'),
  ('GDT0I01', '2026-09-12 15:00:00-03', 104740, 645, 4050.60, true, 'FABIO'),
  ('GDT0I01', '2026-09-14 12:00:00-03', 105231, 270.01, 1757.37, false, 'FABIO'),
  ('GDT0I01', '2026-09-16 10:00:00-03', 106371, 50, 332.50, false, 'FABIO'),
  ('GDT0I01', '2026-09-16 15:00:00-03', 106448, 701.43, 4622.44, true, 'FABIO'),
  ('GDT0I01', '2026-09-18 12:00:00-03', 107484, 350.00, 2266.50, true, 'FABIO'),
  ('GDT0I01', '2026-09-19 12:00:00-03', 108325, 350, 2359.00, true, 'FABIO'),
  ('GDT0I01', '2026-09-21 12:00:00-03', 108951, 565, 3892.85, true, 'FABIO'),
  ('GDT0I01', '2026-09-22 10:00:00-03', 110192, 110, 779.90, false, 'FABIO'),
  ('GDT0I01', '2026-09-22 15:00:00-03', 110356, 703, 4703.07, true, 'FABIO'),
  ('GDT0I01', '2026-09-24 12:00:00-03', 111274, 400, 2696.00, true, 'FABIO'),
  ('GDT0I01', '2026-09-25 12:00:00-03', 112259, 463, 3078.95, true, 'FABIO'),
  ('GDT0I01', '2026-09-28 12:00:00-03', 112937, 412, 2756.28, true, 'FABIO'),
  ('GDT0I01', '2026-09-30 12:00:00-03', 114150, 645, 4315.05, true, 'FABIO'),
  ('GDT0I02', '2026-09-02 12:00:00-03', 68111, 670.68, 4151.51, true, 'ANDRE'),
  ('GDT0I02', '2026-09-03 12:00:00-03', 69356, 550, 3405.50, true, 'ANDRE'),
  ('GDT0I02', '2026-09-08 12:00:00-03', 70990, 710.01, 4519.55, true, 'ANDRE'),
  ('GDT0I02', '2026-09-09 12:00:00-03', 71497, 249.03, 1641.11, false, 'ANDRE'),
  ('GDT0I02', '2026-09-11 12:00:00-03', 72764, 713, 4556.15, true, 'ANDRE'),
  ('GDT0I02', '2026-09-12 12:00:00-03', 73933, 570, 3579.60, true, 'ANDRE'),
  ('GDT0I02', '2026-09-14 10:00:00-03', 75070, 551, 3504.36, true, 'ANDRE'),
  ('GDT0I02', '2026-09-14 15:00:00-03', 75697, 343.30, 2262.37, true, 'ANDRE'),
  ('GDT0I02', '2026-09-17 12:00:00-03', 76784, 626.44, 4190.88, true, 'ANDRE'),
  ('GDT0I02', '2026-09-19 12:00:00-03', 78037, 682, 4698.98, true, 'ANDRE'),
  ('GDT0I02', '2026-09-22 12:00:00-03', 78825, 435, 2980.07, true, 'ANDRE'),
  ('GDT0I02', '2026-09-24 12:00:00-03', 80340, 740, 4921.00, true, 'ANDRE'),
  ('GDT0I02', '2026-09-25 12:00:00-03', 80999, 368.43, 2464.79, true, 'ANDRE'),
  ('GDT0I02', '2026-09-27 12:00:00-03', 82178, 664.03, 4442.36, true, 'ANDRE'),
  ('GDT0I02', '2026-09-28 12:00:00-03', 83143, 200, 1358.00, false, 'ANDRE'),
  ('GDT0I02', '2026-09-29 12:00:00-03', 84051, 698.04, 5060.79, true, 'ANDRE'),
  ('GDT0I03', '2026-09-03 12:00:00-03', 48808, 641.05, 3930.58, true, 'MARCOS'),
  ('GDT0I03', '2026-09-06 12:00:00-03', 50219, 677.01, 4299.01, true, 'MARCOS'),
  ('GDT0I03', '2026-09-09 12:00:00-03', 51401, 602.02, 3799.92, true, 'MARCOS'),
  ('GDT0I03', '2026-09-12 10:00:00-03', 52895, 100, 655.00, false, 'MARCOS'),
  ('GDT0I03', '2026-09-12 15:00:00-03', 53044, 628, 3943.84, true, 'MARCOS'),
  ('GDT0I03', '2026-09-15 12:00:00-03', 53680, 339.01, 2234.07, true, 'MARCOS'),
  ('GDT0I03', '2026-09-17 12:00:00-03', 54761, 610.06, 4081.30, true, 'MARCOS'),
  ('GDT0I03', '2026-09-19 12:00:00-03', 55864, 400, 2707.50, true, 'MARCOS'),
  ('GDT0I03', '2026-09-20 12:00:00-03', 56701, 505.56, 3408.81, true, 'MARCOS'),
  ('GDT0I03', '2026-09-21 12:00:00-03', 57476, 400, 2756.02, true, 'MARCOS'),
  ('GDT0I03', '2026-09-23 12:00:00-03', 58432, 595, 3980.55, true, 'MARCOS'),
  ('GDT0I03', '2026-09-25 12:00:00-03', 59607, 400, 2716.00, true, 'MARCOS'),
  ('GDT0I03', '2026-09-26 12:00:00-03', 60512, 589.66, 3921.24, true, 'MARCOS'),
  ('GDT0I03', '2026-09-28 12:00:00-03', 61222, 446.24, 2985.35, true, 'MARCOS')
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
    p.motorista, 'valido', true, 'importacao', 'IMPORTAÇÃO PLANILHA SET/2026'
  from planilha p
  where not exists (
    select 1 from abastecimentos a
     where a.company_id = '0923c894-85ca-45c1-ba1b-3124d19b4d65'
       and a.placa = p.placa
       and a.data_hora = p.data_hora::timestamptz
       and a.odometro = p.odometro
  )
  order by p.placa, p.data_hora
  returning veiculo_id, placa, data_hora, odometro
)
-- Leitura de odômetro, como o lançamento pela tela já faz.
insert into leituras_odometro (company_id, veiculo_id, placa, data_leitura, quilometragem, origem)
select '0923c894-85ca-45c1-ba1b-3124d19b4d65', veiculo_id, placa, data_hora, odometro, 'abastecimento'
from novos;

-- Conferência: deve listar 7 placas somando 99 registros no total.
select placa, count(*) as registros, sum(volume) as litros, sum(valor_total) as valor
  from abastecimentos
 where company_id = '0923c894-85ca-45c1-ba1b-3124d19b4d65'
   and created_by_nome = 'IMPORTAÇÃO PLANILHA SET/2026'
 group by placa
 order by placa;

commit;
