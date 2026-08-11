-- Gvel Diesel — corrige o nível do usuário admin principal.
-- Execute no SQL Editor do Supabase: https://supabase.com/dashboard/project/njuncnhzkiajtcnemblx/sql
--
-- PASSO 1: Veja quem está cadastrado na tabela e seus níveis atuais
SELECT id, nome, email, nivel FROM public.usuarios ORDER BY created_at;

-- PASSO 2: Promova seu usuário principal a admin (substitua pelo e-mail correto)
-- UPDATE public.usuarios SET nivel = 'admin' WHERE email = 'SEU_EMAIL@AQUI.COM';
