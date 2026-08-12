-- Gvel Diesel — marca e modelo são opcionais para trator/carreta (a tela de
-- Registrar entrada já trata esses campos como "(opcional)" para esses tipos,
-- mas a coluna ainda exigia NOT NULL, o que quebrava o cadastro de carreta/
-- trator sem marca/modelo selecionados com "invalid input syntax for type uuid").

alter table veiculos alter column marca_id drop not null;
alter table veiculos alter column modelo_id drop not null;
