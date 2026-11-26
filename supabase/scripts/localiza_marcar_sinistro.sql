-- Marca 20 veículos da LOCALIZA como SINISTRO (lista enviada em 26/11/2026).
-- Só mexe na Localiza. O trigger da 0114 já põe operante = false e grava o histórico.
-- Pode rodar mais de uma vez.

with lista (placa) as (
  values ('GFZ6D51'),('GES4J01'),('EGX6B34'),('GDL9A64'),('FXI4H81'),
         ('RVT4F18'),('RVT2J98'),('RVT2J97'),('SIQ2J71'),('RTO9B41'),
         ('RUP4H84'),('RUP4H87'),('RTL7A83'),('RUH8I19'),('TEU9D78'),
         ('RNZ3H53'),('SIQ2J44'),('RUP4H88'),('RTO9B86'),('RTV7A01')
),
alterados as (
  update veiculos v
     set sinistro = true, operante = false
    from lista l
   where v.company_id = '81775591-b128-476e-b630-bc88f068c6ae'
     and upper(replace(v.placa, '-', '')) = l.placa
  returning v.placa
)
select l.placa,
       case when a.placa is not null then 'MARCADO SINISTRO'
            else 'NÃO ENCONTRADA NA LOCALIZA' end as resultado
  from lista l
  left join alterados a on upper(replace(a.placa, '-', '')) = l.placa
 order by resultado desc, l.placa;
