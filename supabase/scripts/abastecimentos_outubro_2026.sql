-- Lançamento dos abastecimentos de OUTUBRO/2026 (planilha, até 07/out), empresa GVEL.
-- Rode no SQL Editor do Supabase. Pode rodar de novo sem duplicar.
--
-- - Não duplica o que já foi lançado pela tela: pula se já existir abastecimento
--   da mesma placa, no mesmo dia, com odômetro até 5 km de diferença.
-- - Diesel S10, posto NÃO INFORMADO. Horário: o dos lançamentos que já tinham
--   sido feitos pela tela quando conhecido; senão 12:00 (dois no dia: 10:00/15:00).
-- - PARCIAIS (até 300 L ou > 3 km/L): ERA9G01 01/out 300 L, ERA9G01 07/out 300 L,
--   FXM9D74 04/out 250 L, GDT0I03 05/out 200 L. Demais = tanque cheio.
-- - CUL2E24 02/out (R$ 0,00, sem litros) NÃO lançado: não é abastecimento.

begin;

with planilha (placa, data_hora, odometro, litros, valor_total, tanque_cheio, motorista) as (
  values
  ('CUL2E24', '2026-10-01 12:00:00-03', 232945, 718.77, 4865.44, true, 'MARCIO/TIAGO'),
  ('CUL2E24', '2026-10-07 12:00:00-03', 234296, 623.22, 4169.34, true, 'TIAGO'),
  ('ERA9G01', '2026-10-01 10:00:00-03', 988858, 300, 2037.00, false, 'HUANDERSON'),
  ('ERA9G01', '2026-10-01 20:27:00-03', 989158, 520.01, 3634.86, true, 'HUANDERSON'),
  ('ERA9G01', '2026-10-07 10:00:00-03', 990362, 300, 2007.00, false, 'HUANDERSON'),
  ('ERA9G01', '2026-10-07 15:00:00-03', 990546, 492, 3291.48, true, 'HUANDERSON'),
  ('FXM9D74', '2026-10-04 09:53:00-03', 349564, 250, 1747.50, false, 'MATEUS'),
  ('FXM9D74', '2026-10-04 17:43:00-03', 349813, 751, 5099.29, true, 'MATEUS'),
  ('GDT0H04', '2026-10-02 10:58:00-03', 3922, 640, 4345.60, true, 'MARCIO'),
  ('GDT0H04', '2026-10-05 12:00:00-03', 5110, 527.01, 3515.16, true, 'MARCIO'),
  ('GDT0I01', '2026-10-02 12:05:00-03', 115329, 647.07, 4522.86, true, 'FABIO'),
  ('GDT0I01', '2026-10-05 12:00:00-03', 116363, 562.82, 3754.00, true, 'FABIO'),
  ('GDT0I02', '2026-10-01 15:25:00-03', 84732, 400, 2676.00, true, 'ANDRE'),
  ('GDT0I02', '2026-10-03 16:22:00-03', 86010, 717, 5011.82, true, 'ANDRE'),
  ('GDT0I02', '2026-10-06 12:00:00-03', 86770, 425, 2826.73, true, 'ANDRE'),
  ('GDT0I03', '2026-10-01 12:00:00-03', 62410, 655.89, 4387.90, true, 'MARCOS'),
  ('GDT0I03', '2026-10-05 10:18:00-03', 63542, 200, 1451.85, false, 'MARCOS')
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

-- Conferência: TODOS os abastecimentos de 01 a 07/out por placa (os da tela + os
-- deste script). Devem existir 17 da planilha, um por linha.
select placa, count(*) as registros, sum(volume) as litros, sum(valor_total) as valor,
       count(*) filter (where created_by_nome = 'IMPORTAÇÃO PLANILHA OUT/2026') as deste_script
  from abastecimentos
 where company_id = '0923c894-85ca-45c1-ba1b-3124d19b4d65'
   and data_hora >= '2026-10-01 00:00:00-03' and data_hora < '2026-10-08 00:00:00-03'
   and status <> 'invalidado'
   and combustivel not ilike '%arla%'
 group by placa
 order by placa;

commit;
