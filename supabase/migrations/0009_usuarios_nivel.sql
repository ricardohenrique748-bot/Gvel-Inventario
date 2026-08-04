-- Gvel Diesel — níveis de usuário (admin/usuario) e exclusão restrita a admins.
-- Rode este arquivo no SQL Editor do seu projeto Supabase (ou via `supabase db push`)
-- depois de já ter aplicado as migrations anteriores.

alter table usuarios add column if not exists nivel text not null default 'usuario'
  check (nivel in ('admin', 'usuario'));

-- Split da policy genérica: leitura/escrita continuam abertas a qualquer autenticado,
-- mas exclusão (delete) só para quem tem nivel = 'admin'.
drop policy if exists "authenticated_all_usuarios" on usuarios;

create policy "authenticated_read_usuarios" on usuarios for select
  using (auth.role() = 'authenticated');
create policy "authenticated_insert_usuarios" on usuarios for insert
  with check (auth.role() = 'authenticated');
create policy "authenticated_update_usuarios" on usuarios for update
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin_delete_usuarios" on usuarios for delete
  using (exists (
    select 1 from usuarios u where u.id = auth.uid() and u.nivel = 'admin'
  ));

-- Promove um usuário existente a admin (rode manualmente sempre que precisar):
-- update usuarios set nivel = 'admin' where email = 'seu-email@aqui.com';
