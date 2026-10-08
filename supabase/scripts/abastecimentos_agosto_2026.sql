-- Lançamento dos abastecimentos de AGOSTO/2026 (planilha), empresa GVEL.
-- Rode no SQL Editor do Supabase. Pode rodar de novo sem duplicar: registros
-- com mesma placa + data + odômetro já existentes são ignorados.
--
-- - Diesel S10, posto NÃO INFORMADO, horário 12:00 (a planilha não tem hora).
-- - Tanque cheio em todos, EXCETO 30/ago de EDJ8C00, ERA9G01 e CUL2E24
--   (150/150/300 L): como tanque cheio dariam ciclos de ~8 km/L seguidos de
--   ~0,4 km/L; como parciais os ciclos 28→31/ago ficam em ~1,8–2,2 km/L.
-- - FXM9D74 09/ago (odômetro 556650) NÃO foi lançado, a pedido.
-- - Valor/litro = valor total ÷ litros.

begin;

with planilha (placa, data_hora, odometro, litros, valor_total, tanque_cheio, motorista) as (
  values
  ('CUL2E24', '2026-08-05 12:00:00-03', 203087, 754, 4667.27, true, 'MARCIO'),
  ('CUL2E24', '2026-08-10 12:00:00-03', 204571, 739.53, 4549.77, true, 'MARCIO'),
  ('CUL2E24', '2026-08-12 12:00:00-03', 205678, 520, 3199.17, true, 'MARCIO'),
  ('CUL2E24', '2026-08-17 12:00:00-03', 207058, 630.84, 3986.90, true, 'MARCIO'),
  ('CUL2E24', '2026-08-19 12:00:00-03', 208219, 576, 3565.48, true, 'MARCIO'),
  ('CUL2E24', '2026-08-20 12:00:00-03', 209653, 690, 4271.10, true, 'MARCIO'),
  ('CUL2E24', '2026-08-23 12:00:00-03', 211230, 775, 4797.25, true, 'MARCIO'),
  ('CUL2E24', '2026-08-26 12:00:00-03', 212689, 676.06, 4252.42, true, 'MARCIO'),
  ('CUL2E24', '2026-08-28 12:00:00-03', 213786, 503, 3113.58, true, 'MARCIO'),
  ('CUL2E24', '2026-08-30 12:00:00-03', 215237, 300, 1853.00, false, 'MARCIO'),
  ('CUL2E24', '2026-08-31 12:00:00-03', 215863, 658.9, 4078.59, true, 'MARCIO'),
  ('EDJ8C00', '2026-08-01 12:00:00-03', 516960, 543, 3415.47, true, 'TIAGO'),
  ('EDJ8C00', '2026-08-03 12:00:00-03', 517738, 450.59, 2834.21, true, 'TIAGO'),
  ('EDJ8C00', '2026-08-06 12:00:00-03', 518811, 589.05, 3705.13, true, 'TIAGO'),
  ('EDJ8C00', '2026-08-07 12:00:00-03', 519550, 430.04, 2683.45, true, 'TIAGO'),
  ('EDJ8C00', '2026-08-11 12:00:00-03', 520402, 518, 3258.22, true, 'TIAGO'),
  ('EDJ8C00', '2026-08-13 12:00:00-03', 521609, 652, 3998.52, true, 'TIAGO'),
  ('EDJ8C00', '2026-08-15 12:00:00-03', 522645, 548, 3370.83, true, 'TIAGO'),
  ('EDJ8C00', '2026-08-18 12:00:00-03', 523617, 540.19, 3343.78, true, 'TIAGO'),
  ('EDJ8C00', '2026-08-20 12:00:00-03', 524862, 661.51, 4115.48, true, 'TIAGO'),
  ('EDJ8C00', '2026-08-24 12:00:00-03', 526026, 619.50, 3802.80, true, 'TIAGO'),
  ('EDJ8C00', '2026-08-26 12:00:00-03', 527152, 682.26, 4223.18, true, 'TIAGO'),
  ('EDJ8C00', '2026-08-28 12:00:00-03', 528308, 569.20, 3560.20, true, 'TIAGO'),
  ('EDJ8C00', '2026-08-30 12:00:00-03', 529531, 150, 937.50, false, 'TIAGO'),
  ('EDJ8C00', '2026-08-31 12:00:00-03', 529827, 634.99, 3930.58, true, 'TIAGO'),
  ('ERA9G01', '2026-08-11 12:00:00-03', 968981, 813, 5276.37, true, 'HUANDERSON'),
  ('ERA9G01', '2026-08-13 12:00:00-03', 970166, 683.01, 4200.51, true, 'HUANDERSON'),
  ('ERA9G01', '2026-08-15 12:00:00-03', 971330, 718, 4415.94, true, 'HUANDERSON'),
  ('ERA9G01', '2026-08-18 12:00:00-03', 972281, 587, 3633.54, true, 'HUANDERSON'),
  ('ERA9G01', '2026-08-20 12:00:00-03', 973496, 684.14, 4255.35, true, 'HUANDERSON'),
  ('ERA9G01', '2026-08-24 12:00:00-03', 974666, 700, 4333.00, true, 'HUANDERSON'),
  ('ERA9G01', '2026-08-26 12:00:00-03', 975797, 734, 4543.46, true, 'HUANDERSON'),
  ('ERA9G01', '2026-08-28 12:00:00-03', 976924, 626.64, 3947.87, true, 'HUANDERSON'),
  ('ERA9G01', '2026-08-30 12:00:00-03', 978116, 150, 937.50, false, 'HUANDERSON'),
  ('ERA9G01', '2026-08-31 12:00:00-03', 978405, 670.01, 4147.36, true, 'HUANDERSON'),
  ('FXM9D74', '2026-08-04 12:00:00-03', 327853, 674.01, 4239.52, true, 'MATEUS'),
  ('FXM9D74', '2026-08-06 12:00:00-03', 328936, 636.11, 4001.13, true, 'MATEUS'),
  ('FXM9D74', '2026-08-07 12:00:00-03', 329666, 420, 2620.80, true, 'MATEUS'),
  ('FXM9D74', '2026-08-17 12:00:00-03', 330118, 278.55, 1718.65, true, 'MATEUS'),
  ('FXM9D74', '2026-08-19 12:00:00-03', 331365, 695.01, 4275.02, true, 'MATEUS'),
  ('FXM9D74', '2026-08-21 12:00:00-03', 332407, 651, 3987.47, true, 'MATEUS'),
  ('FXM9D74', '2026-08-23 12:00:00-03', 333572, 679.02, 4179.34, true, 'MATEUS'),
  ('FXM9D74', '2026-08-26 12:00:00-03', 335068, 850, 5346.50, true, 'MATEUS'),
  ('FXM9D74', '2026-08-28 12:00:00-03', 336202, 650, 4056.77, true, 'MATEUS'),
  ('GDT0I01', '2026-08-04 12:00:00-03', 87225, 665, 4124.26, true, 'FABIO'),
  ('GDT0I01', '2026-08-06 12:00:00-03', 87852, 356, 2183.50, true, 'FABIO'),
  ('GDT0I01', '2026-08-07 12:00:00-03', 88908, 552.01, 3423.46, true, 'FABIO'),
  ('GDT0I01', '2026-08-08 12:00:00-03', 89404, 300, 1838.74, true, 'FABIO'),
  ('GDT0I01', '2026-08-11 12:00:00-03', 90397, 511, 3143.56, true, 'FABIO'),
  ('GDT0I01', '2026-08-13 12:00:00-03', 91217, 446.01, 2760.80, true, 'FABIO'),
  ('GDT0I01', '2026-08-14 12:00:00-03', 92107, 435.02, 2676.17, true, 'FABIO'),
  ('GDT0I01', '2026-08-17 12:00:00-03', 93163, 560.03, 3550.58, true, 'FABIO'),
  ('GDT0I01', '2026-08-18 12:00:00-03', 93774, 414, 2562.70, true, 'FABIO'),
  ('GDT0I01', '2026-08-23 12:00:00-03', 94848, 561, 3440.24, true, 'FABIO'),
  ('GDT0I01', '2026-08-24 12:00:00-03', 95465, 323.22, 2013.97, true, 'FABIO'),
  ('GDT0I01', '2026-08-26 12:00:00-03', 96579, 629.45, 3959.24, true, 'FABIO'),
  ('GDT0I01', '2026-08-30 12:00:00-03', 97710, 555.94, 3441.27, true, 'FABIO'),
  ('GDT0I01', '2026-08-31 12:00:00-03', 98678, 548, 3425.87, true, 'FABIO'),
  ('GDT0I02', '2026-08-02 12:00:00-03', 53441, 637, 4006.75, true, 'ANDRE'),
  ('GDT0I02', '2026-08-04 12:00:00-03', 54443, 509, 3156.36, true, 'ANDRE'),
  ('GDT0I02', '2026-08-06 12:00:00-03', 55550, 598, 3708.30, true, 'ANDRE'),
  ('GDT0I02', '2026-08-07 12:00:00-03', 56172, 343, 2103.85, true, 'ANDRE'),
  ('GDT0I02', '2026-08-12 12:00:00-03', 57181, 587.01, 3610.51, true, 'ANDRE'),
  ('GDT0I02', '2026-08-13 12:00:00-03', 57626, 217, 1343.23, true, 'ANDRE'),
  ('GDT0I02', '2026-08-15 12:00:00-03', 59047, 730, 4487.58, true, 'ANDRE'),
  ('GDT0I02', '2026-08-16 12:00:00-03', 59359, 160, 990.40, true, 'ANDRE'),
  ('GDT0I02', '2026-08-19 12:00:00-03', 60799, 750, 4622.76, true, 'ANDRE'),
  ('GDT0I02', '2026-08-20 12:00:00-03', 62241, 714, 4449.17, true, 'ANDRE'),
  ('GDT0I02', '2026-08-24 12:00:00-03', 63282, 522, 3278.17, true, 'ANDRE'),
  ('GDT0I02', '2026-08-26 12:00:00-03', 64450, 636.62, 3924.41, true, 'ANDRE'),
  ('GDT0I02', '2026-08-28 12:00:00-03', 65501, 550, 3449.05, true, 'ANDRE'),
  ('GDT0I02', '2026-08-31 12:00:00-03', 66954, 712.93, 4413.04, true, 'ANDRE'),
  ('GDT0I03', '2026-08-05 12:00:00-03', 37039, 707.01, 4384.70, true, 'ANGELO'),
  ('GDT0I03', '2026-08-08 12:00:00-03', 38209, 590, 3612.97, true, 'MARCOS'),
  ('GDT0I03', '2026-08-11 12:00:00-03', 39347, 506.47, 3135.05, true, 'MARCOS'),
  ('GDT0I03', '2026-08-13 12:00:00-03', 40654, 678.43, 4156.80, true, 'MARCOS'),
  ('GDT0I03', '2026-08-17 12:00:00-03', 41802, 530, 3260.50, true, 'MARCOS'),
  ('GDT0I03', '2026-08-19 12:00:00-03', 42709, 502.01, 3097.40, true, 'MARCOS'),
  ('GDT0I03', '2026-08-21 12:00:00-03', 44058, 665, 4074.89, true, 'MARCOS'),
  ('GDT0I03', '2026-08-23 12:00:00-03', 45003, 496, 3085.85, true, 'MARCOS'),
  ('GDT0I03', '2026-08-25 12:00:00-03', 46033, 575.01, 3559.36, true, 'MARCOS'),
  ('GDT0I03', '2026-08-28 12:00:00-03', 47241, 644, 3948.24, true, 'MARCOS')
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
    p.motorista, 'valido', true, 'importacao', 'IMPORTAÇÃO PLANILHA AGO/2026'
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

-- Conferência: deve listar 7 placas somando 82 registros no total.
select placa, count(*) as registros, sum(volume) as litros, sum(valor_total) as valor
  from abastecimentos
 where company_id = '0923c894-85ca-45c1-ba1b-3124d19b4d65'
   and origem = 'importacao'
   and created_by_nome = 'IMPORTAÇÃO PLANILHA AGO/2026'
 group by placa
 order by placa;

commit;
