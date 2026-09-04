-- ============================================================
-- 0057: Foto de Perfil do Usuário
--
-- Cada usuário poderá anexar uma foto de perfil, exibida como avatar no
-- lugar das iniciais em qualquer lugar do app que mostre o usuário logado.
-- ============================================================

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS foto_url text;
