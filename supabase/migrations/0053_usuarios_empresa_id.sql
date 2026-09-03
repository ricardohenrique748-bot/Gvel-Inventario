-- A migration 0052 criou a coluna "modulos", mas o UPDATE em atualizarUsuario
-- (src/hooks/useUsuarios.ts) também grava "empresa_id" no mesmo payload, e essa
-- coluna nunca chegou a ser criada no banco. O PostgREST rejeitava o UPDATE
-- inteiro (schema cache sem "empresa_id"), então nem os módulos eram salvos de
-- verdade no servidor — só localmente no navegador de quem editou. As empresas
-- em si são um cadastro local (ver EmpresaContext), então aqui basta guardar o
-- id como texto solto, sem FK.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS empresa_id text;
