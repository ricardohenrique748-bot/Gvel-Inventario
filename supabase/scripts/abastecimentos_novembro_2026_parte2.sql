-- Lançamento dos abastecimentos de NOVEMBRO/2026 — PARTE 2 (planilha, 16 a 25/nov), empresa GVEL.
-- Continuação de abastecimentos_novembro_2026.sql (01 a 15/nov). Pode rodar os dois em
-- qualquer ordem e mais de uma vez: nenhum duplica.
--
-- - Não duplica: pula se já existir abastecimento da mesma placa, no mesmo dia,
--   com odômetro até 5 km de diferença (mesma regra da parte 1).
-- - Diesel S10, posto NÃO INFORMADO, horário 12:00. Valor = só o diesel.
-- - PARCIAIS (até 300 L): FXM9D74 05/nov 200 L, EDJ8C00 20/nov 275,25 L, EDJ8C00 24/nov 187 L.
-- - Inclui FXM9D74 05/nov (200 L, R$ 1.358,00), que faltou na parte 1.
-- - CORREÇÃO: ERA9G01 15/nov foi lançado na parte 1 com R$ 3.775,18; a planilha diz R$ 3.775,38.
-- - 23 abastecimentos.

begin;

with planilha (placa, data_hora, odometro, litros, valor_total, tanque_cheio, motorista) as (
  values
  ('FXM9D74', '2026-11-05 12:00:00-03', 361294, 200, 1358.00, false, 'DIEGO'),
  ('GDT0I02', '2026-11-16 12:00:00-03', 98473, 767.74, 5091.18, true, 'HUANDERSON'),
  ('EDJ8C00', '2026-11-16 12:00:00-03', 558990, 668, 4453.92, true, 'BRUNO'),
  ('CUL2E24', '2026-11-17 12:00:00-03', 250757, 757, 5064.33, true, 'TIAGO'),
  ('GDT0I03', '2026-11-17 12:00:00-03', 80147, 611, 4087.59, true, 'ANDRE'),
  ('EDJ8C00', '2026-11-18 12:00:00-03', 560184, 569.87, 3812.43, true, 'BRUNO'),
  ('GDT0I01', '2026-11-19 12:00:00-03', 131846, 668, 4468.94, true, 'MATEUS'),
  ('ERA9G01', '2026-11-19 12:00:00-03', 1004597, 785.7, 5256.33, true, 'MAURECY'),
  ('GDT0I02', '2026-11-19 12:00:00-03', 99826, 700, 4683.46, true, 'HUANDERSON'),
  ('FXM9D74', '2026-11-19 12:00:00-03', 365644, 825.01, 5519.31, true, 'RODRIGO'),
  ('EDJ8C00', '2026-11-19 12:01:00-03', 561048, 451.6, 3021.20, true, 'BRUNO'),
  ('GDT0H04', '2026-11-20 12:00:00-03', 21678, 607, 4060.83, true, 'MARCIO/ANDRE'),
  ('EDJ8C00', '2026-11-20 12:00:00-03', 561581, 275.25, 1841.42, false, 'BRUNO'),
  ('CUL2E24', '2026-11-20 12:00:00-03', 252070, 596.35, 3989.58, true, 'TIAGO'),
  ('GDT0I02', '2026-11-20 12:00:00-03', 100648, 420, 2809.80, true, 'HUANDERSON'),
  ('GDT0I03', '2026-11-22 12:00:00-03', 81314, 530, 3492.73, true, 'ANDRE'),
  ('EDJ8C00', '2026-11-23 12:00:00-03', 562722, 526, 3466.35, true, 'BRUNO'),
  ('EDJ8C00', '2026-11-24 12:00:00-03', 563122, 187, 1191.20, false, 'BRUNO'),
  ('FXM9D74', '2026-11-24 12:00:00-03', 366904, 579, 3688.23, true, 'RODRIGO'),
  ('CUL2E24', '2026-11-24 12:00:00-03', 253542, 651.01, 4146.96, true, 'TIAGO'),
  ('GDT0H04', '2026-11-25 12:00:00-03', 22728, 401.91, 2608.40, true, 'MARCIO'),
  ('GDT0I01', '2026-11-25 12:00:00-03', 133797, 758.01, 4919.48, true, 'MATEUS'),
  ('GDT0I02', '2026-11-25 12:00:00-03', 102127, 700, 4459.02, true, 'HUANDERSON')
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
insert into leituras_odometro (company_id, veiculo_id, placa, data_leitura, quilometragem, origem)
select '0923c894-85ca-45c1-ba1b-3124d19b4d65', veiculo_id, placa, data_hora, odometro, 'abastecimento'
from novos;

-- Correção de valor da parte 1 (só se ainda estiver com o valor errado).
update abastecimentos
   set valor_total = 3775.38,
       valor_unitario = round(3775.38 / volume, 3)
 where company_id = '0923c894-85ca-45c1-ba1b-3124d19b4d65'
   and placa = 'ERA9G01'
   and (data_hora at time zone 'America/Sao_Paulo')::date = '2026-11-15'
   and abs(odometro - 1003044) <= 5
   and valor_total = 3775.18;

-- Conferência: novembro inteiro (01 a 25/nov) por placa. Deve somar 63 (40 + 23).
select placa, count(*) as registros, sum(volume) as litros, sum(valor_total) as valor
  from abastecimentos
 where company_id = '0923c894-85ca-45c1-ba1b-3124d19b4d65'
   and data_hora >= '2026-11-01 00:00:00-03' and data_hora < '2026-11-26 00:00:00-03'
   and status <> 'invalidado'
   and combustivel not ilike '%arla%'
 group by placa
 order by placa;

commit;
