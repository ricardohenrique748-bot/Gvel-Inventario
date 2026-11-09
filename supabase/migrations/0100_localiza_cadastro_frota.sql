-- ============================================================
-- 0100: Cadastro de frota na Localiza Pesados
--
-- A 0098 liberou pra Localiza só Inventário, Pátios e Usuários, então a aba
-- Configurações → Frota (cadastro de veículos, marcas e modelos) não aparecia.
-- Aqui ela entra na lista. Na tela, a Localiza cadastra veículo sem cliente
-- (ver FrotaTab.tsx / empresaUsaClientes).
--
-- Pode rodar de novo sem duplicar nada.
-- ============================================================

update companies
   set modulos_habilitados = array_append(modulos_habilitados, 'config_frota')
 where id = '81775591-b128-476e-b630-bc88f068c6ae'
   and not ('config_frota' = any (coalesce(modulos_habilitados, array[]::text[])))
   and modulos_habilitados is not null;
