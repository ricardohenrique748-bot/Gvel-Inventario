-- Consumo de combustível — exclusão de abastecimento restrita a uma conta.
-- A tela só mostra o botão de excluir para ricardo_h.16@hotmail.com
-- (podeExcluirAbastecimento em src/lib/permissoes.ts); esta policy garante a
-- mesma regra para quem chamar a API do Supabase direto.
--
-- RESTRICTIVE: soma (AND) com as policies permissivas já existentes
-- (isolamento por empresa), então o DELETE continua limitado à empresa ativa
-- e passa a exigir também essa conta. SELECT/INSERT/UPDATE não mudam.
-- A service role (Edge Functions) ignora RLS e não é afetada.

drop policy if exists abastecimentos_delete_restrito on abastecimentos;
create policy abastecimentos_delete_restrito on abastecimentos
  as restrictive
  for delete
  using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'ricardo_h.16@hotmail.com');
