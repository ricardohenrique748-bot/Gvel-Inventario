-- Gvel Diesel — backfill: garante que todos os usuários do Auth que fizeram
-- movimentações (usuario_entrada_id / usuario_saida_id) mas não têm perfil
-- na tabela `usuarios` passem a ter uma linha correspondente.
-- Isso faz o JOIN `usuarios!usuario_entrada_id(nome)` retornar o nome corretamente
-- em vez de mostrar "—" na coluna "Registrado por".

-- 1. Insere perfil para qualquer conta em auth.users sem linha em usuarios
insert into public.usuarios (id, nome, email)
select u.id,
       coalesce(u.raw_user_meta_data->>'nome', split_part(u.email, '@', 1)),
       u.email
from auth.users u
left join public.usuarios p on p.id = u.id
where p.id is null
on conflict (id) do nothing;
