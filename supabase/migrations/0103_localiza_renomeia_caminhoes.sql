-- ============================================================
-- 0103: Renomeia a empresa "LOCALIZA PESADOS" para "LOCALIZA CAMINHÕES"
--
-- O nome aparece no seletor de empresa e em "Empresa Vinculada" (usuários).
-- A marca no topo do app vem de src/components/ui/Logo.tsx.
--
-- Pode rodar de novo sem problema.
-- ============================================================

update companies
   set name = 'LOCALIZA CAMINHÕES'
 where id = '81775591-b128-476e-b630-bc88f068c6ae';
