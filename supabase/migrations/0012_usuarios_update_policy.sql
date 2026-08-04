-- Gvel Diesel — restringe a edição de usuários: admins podem editar qualquer
-- um; usuários comuns só podem editar o próprio cadastro e não podem se
-- promover a admin sozinhos (fecha uma brecha de escalonamento de privilégio
-- que a policy genérica anterior deixava aberta).
-- Rode este arquivo no SQL Editor do seu projeto Supabase (ou via `supabase db push`)
-- depois de já ter aplicado as migrations anteriores.

drop policy if exists "authenticated_update_usuarios" on usuarios;

create policy "atualizar_usuarios" on usuarios for update
  using (auth.role() = 'authenticated')
  with check (
    exists (select 1 from usuarios u where u.id = auth.uid() and u.nivel = 'admin')
    or (id = auth.uid() and nivel = 'usuario')
  );
