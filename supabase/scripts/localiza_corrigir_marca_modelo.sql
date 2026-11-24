-- ============================================================
-- LOCALIZA (Cordeirópolis): confere e corrige MARCA / MODELO das placas
-- conforme a relação impressa conferida no pátio (3 folhas).
--
-- Só mexe em veículos da LOCALIZA. Marcas/modelos que não existirem são
-- criados. Placa da lista que não existir no sistema aparece no relatório
-- como "PLACA NÃO ENCONTRADA" (nada é criado).
--
-- O resultado final é um relatório: placa, marca/modelo ANTES e DEPOIS.
-- Guarde-o: com ele dá para desfazer qualquer troca.
--
-- Fora deste script (conferir à mão):
--   * TEU9D?8  — na folha o dígito foi corrigido à caneta (6 → 7?); no sistema existe TEU9D68.
--   * RTM6B64  — anotado "não esteve no pátio / provável digitação errada" (existe RTM6B44 na lista).
--   * SIQ2J71  — anotado "saiu".
-- ============================================================

drop table if exists lista;
drop table if exists relatorio;
create temp table lista (placa text primary key, marca text not null, modelo text);

insert into lista (placa, marca, modelo) values
  -- Folha 1
  ('SIV6A70','DAF','XF'),
  ('SIQ2J58','DAF','XF'),
  ('JCN6G67','ÔNIBUS','ARROW'),
  ('GFZ6D51','FACCHINI','CARRETA'),
  ('FFI7B83','VOLKSWAGEN','CONSTELLATION'),
  ('RUP5G14','DAF','XF'),
  ('RUP5G06','DAF','XF'),
  ('RNN6A66','VOLKSWAGEN','9.170'),
  ('RUQ5B81','DAF','XF'),
  ('RNM6A66','VOLKSWAGEN','DELIVERY 9.170'),
  ('RVC0J63','MERCEDES-BENZ','ACCELO 815'),
  ('RNM5H01','VOLKSWAGEN','DELIVERY 9.170'),
  ('RNM5H03','VOLKSWAGEN','DELIVERY 9.170'),
  ('RNM3G43','VOLKSWAGEN','DELIVERY 9.170'),
  ('RVC0J64','MERCEDES-BENZ','ACCELO 815'),
  ('TDV2D61','DAF','XF'),
  ('GES4J01','IMPLEMENTO','DOLLY'),
  ('EGX6B34','IMPLEMENTO','DOLLY'),
  ('GDL9A64','IMPLEMENTO','CAÇAMBA'),
  ('OAZ4G15','IMPLEMENTO','CARROCERIA'),
  ('OAZ4G75','IMPLEMENTO','CARROCERIA'),
  ('SDV5C24','IMPLEMENTO','JULIETA'),
  ('RHZ3I28','IMPLEMENTO','JULIETA'),
  ('SDV5C41','IMPLEMENTO','JULIETA'),
  ('SDV5C34','IMPLEMENTO','JULIETA'),
  ('SDV5C42','IMPLEMENTO','JULIETA'),
  ('SDV5C35','IMPLEMENTO','JULIETA'),
  ('RUP5G18','DAF','XF'),
  ('SDV5C46','IMPLEMENTO','JULIETA'),
  ('RHZ3I31','IMPLEMENTO','JULIETA'),
  ('RHW7B56','IMPLEMENTO','JULIETA'),
  ('SDV5C28','IMPLEMENTO','JULIETA'),
  ('SDV5C29','IMPLEMENTO','JULIETA'),
  ('SDV5C39','IMPLEMENTO','JULIETA'),
  ('SDV5C47','IMPLEMENTO','JULIETA'),
  ('SDV5C27','IMPLEMENTO','JULIETA'),
  ('SDV5C45','IMPLEMENTO','JULIETA'),
  ('SDV5C37','IMPLEMENTO','JULIETA'),
  ('RHW7B54','IMPLEMENTO','JULIETA'),
  ('SDV5C40','IMPLEMENTO','JULIETA'),
  ('RHI4F25','IMPLEMENTO','TANQUE DE VINHAÇA'),
  ('RHJ5E77','IMPLEMENTO','TANQUE DE VINHAÇA'),
  ('OAZ4H65','IMPLEMENTO','CARROCERIA'),
  ('OAZ4H89','IMPLEMENTO','CARROCERIA'),
  ('FXI4H81','IMPLEMENTO','CAÇAMBA'),
  ('SEE2D83','IMPLEMENTO','CAÇAMBA'),
  -- Folha 2
  ('FOH9H31','IMPLEMENTO','DOLLY'),
  ('SEE2D88','IMPLEMENTO','CAÇAMBA'),
  ('RVT4F18','RENAULT','MASTER'),
  ('RVT2J98','RENAULT','MASTER'),
  ('RVT2J97','RENAULT','MASTER'),
  ('SIQ2J71','DAF','XF'),
  ('SHQ7J43','VOLKSWAGEN','DELIVERY'),
  ('RTO9B41','FIAT','DUCATO'),
  ('RUP4H84','RENAULT','MASTER'),
  ('RUP4H87','RENAULT','MASTER'),
  ('RTL7A83','DAF','XF'),
  ('RUH8I19','VOLKSWAGEN','CONSTELLATION'),
  ('RNZ3H53','VOLKSWAGEN','DELIVERY'),
  ('SIQ2J44','DAF','XF'),
  ('RUP4H88','RENAULT','MASTER'),
  ('RTO9B86','FIAT','DUCATO'),
  ('RTV7A01','VOLKSWAGEN','CONSTELLATION'),
  ('RUS7D18','MERCEDES-BENZ','ACTROS'),
  ('RUR3G17','DAF','XF'),
  ('RTL7A79','DAF','CF'),
  ('RTN9J09','DAF','CF'),
  ('RUS3E63','DAF','CF'),
  ('RUS3E58','DAF','CF'),
  ('RTN9I94','DAF','CF'),
  ('RNZ3H60','VOLKSWAGEN','DELIVERY EXPRESS PRIME'),
  ('RTM7G82','VOLKSWAGEN','DELIVERY EXPRESS'),
  ('RTM7G83','VOLKSWAGEN','DELIVERY EXPRESS PRIME'),
  ('RTM6B67','RENAULT','MASTER'),
  ('SYR8F80','HYUNDAI','HR'),
  ('RVF9J64','MERCEDES-BENZ','ACCELO 815'),
  ('RVU9I61','RENAULT','MASTER'),
  ('RNM3G39','VOLKSWAGEN','DELIVERY 9.170'),
  ('SID6J25','VOLKSWAGEN','CONSTELLATION'),
  ('RVC8B13','MERCEDES-BENZ','ACCELO 815'),
  ('RVC0J60','MERCEDES-BENZ','ACCELO 815'),
  ('JCN6H05','ÔNIBUS','ARROW'),
  ('JCQ5G82','ÔNIBUS','ARROW'),
  ('JCN6G76','ÔNIBUS','ARROW'),
  ('JCN6G86','ÔNIBUS','ARROW'),
  ('TCX5E11','IVECO','DAILY 35-160'),
  ('RVC0J70','MERCEDES-BENZ','ACCELO 815'),
  ('RVC0J74','MERCEDES-BENZ','ACCELO 815'),
  ('RVC0J71','MERCEDES-BENZ','ACCELO 815'),
  ('RVC0J78','MERCEDES-BENZ','ACCELO 815'),
  ('RVT4F20','RENAULT','MASTER'),
  -- Folha 3
  ('RUP5F96','DAF','XF'),
  ('RUP5F87','DAF','XF'),
  ('RMP8H97','VOLKSWAGEN','DELIVERY 13.180'),
  ('RVC0J58','MERCEDES-BENZ','ACCELO 815'),
  ('RVG0A14','VOLKSWAGEN','DELIVERY EXPRESS'),
  ('RVC0J65','MERCEDES-BENZ','ACCELO 815'),
  ('RVC0J59','MERCEDES-BENZ','ACCELO 815'),
  ('RVT4F19','RENAULT','MASTER'),
  ('RVC0J73','MERCEDES-BENZ','ACCELO 815'),
  ('RTM6B44','RENAULT','MASTER'),
  ('TYC3B21','IVECO',null),
  ('TCX5E14','IVECO',null),
  ('SHY7A27','DAF','XF530'),
  ('RTC4E58','DAF','XF'),
  ('RVA4A22','SCANIA','XT'),
  ('RUS7B36','SCANIA','XT'),
  ('RMO5F25','VOLKSWAGEN','ROBUST'),
  ('RMO7A57','VOLKSWAGEN','CONSTELLATION'),
  ('RUP8I40','MERCEDES-BENZ','AXOR'),
  ('RVC0J86','MERCEDES-BENZ','ACCELO'),
  ('RUS7B30','SCANIA','XT'),
  ('RFC1G09','RENAULT','MASTER'),
  ('RTB7E19','VOLKSWAGEN','DELIVERY EXPRESS'),
  ('RNZ3H85','VOLKSWAGEN','DELIVERY EXPRESS'),
  ('RTT1B58','VOLKSWAGEN','DELIVERY EXPRESS'),
  ('RUP4H85','RENAULT','MASTER');

-- Marcas e modelos que faltarem
insert into marcas (nome)
select distinct l.marca from lista l
 where not exists (select 1 from marcas ma where upper(ma.nome) = upper(l.marca));

insert into modelos (marca_id, nome)
select distinct ma.id, l.modelo
  from lista l
  join marcas ma on upper(ma.nome) = upper(l.marca)
 where l.modelo is not null
   and not exists (select 1 from modelos mo where mo.marca_id = ma.id and upper(mo.nome) = upper(l.modelo));

-- Relatório: como está ANTES
create temp table relatorio as
select l.placa,
       v.id as veiculo_id,
       ma_ant.nome as marca_antes,
       mo_ant.nome as modelo_antes,
       l.marca     as marca_lista,
       l.modelo    as modelo_lista
  from lista l
  left join veiculos v on v.placa = l.placa and v.company_id = '81775591-b128-476e-b630-bc88f068c6ae'
  left join marcas  ma_ant on ma_ant.id = v.marca_id
  left join modelos mo_ant on mo_ant.id = v.modelo_id;

-- Aplica (só Localiza; IVECO sem modelo na lista mantém o modelo atual)
update veiculos v
   set marca_id  = ma.id,
       modelo_id = case
                     when l.modelo is not null then mo.id
                     when v.marca_id = ma.id   then v.modelo_id  -- mesma marca: mantém o modelo atual
                     else null
                   end
  from lista l
  join marcas ma on upper(ma.nome) = upper(l.marca)
  left join modelos mo on mo.marca_id = ma.id and upper(mo.nome) = upper(l.modelo)
 where v.placa = l.placa
   and v.company_id = '81775591-b128-476e-b630-bc88f068c6ae';

-- Resultado
select r.placa,
       case
         when r.veiculo_id is null then 'PLACA NÃO ENCONTRADA'
         when coalesce(r.marca_antes,'') = r.marca_lista
          and coalesce(r.modelo_antes,'') = coalesce(r.modelo_lista, r.modelo_antes, '') then 'já estava certo'
         else 'CORRIGIDO'
       end as situacao,
       coalesce(r.marca_antes,'—') || ' / ' || coalesce(r.modelo_antes,'—') as antes,
       coalesce(ma.nome,'—') || ' / ' || coalesce(mo.nome,'—') as depois
  from relatorio r
  left join veiculos v on v.id = r.veiculo_id
  left join marcas  ma on ma.id = v.marca_id
  left join modelos mo on mo.id = v.modelo_id
 order by situacao, r.placa;
