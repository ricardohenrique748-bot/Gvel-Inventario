-- Exceção à trava da 0109: a conta inventario@gveldiesel.com também pode
-- excluir veículos e movimentações (a pedido do Ricardo). Mudar a situação
-- operante/inoperante continua só para administrador.

create or replace function public.usuario_pode_excluir()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.usuario_eh_admin()
    or lower(coalesce(auth.jwt() ->> 'email', '')) = 'inventario@gveldiesel.com';
$$;

drop policy if exists veiculos_delete_somente_admin on veiculos;
create policy veiculos_delete_somente_admin on veiculos
  as restrictive
  for delete
  using (public.usuario_pode_excluir());

drop policy if exists movimentacoes_delete_somente_admin on movimentacoes;
create policy movimentacoes_delete_somente_admin on movimentacoes
  as restrictive
  for delete
  using (public.usuario_pode_excluir());
