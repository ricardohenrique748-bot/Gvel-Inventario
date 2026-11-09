-- ============================================================
-- 0099: Excluir usuário sem travar no histórico
--
-- Excluir um usuário que já registrou entrada/saída no pátio ou etapa do
-- trajeto falhava com "Database error deleting user": as colunas abaixo
-- (0020 e 0026) apontam para usuarios sem regra de exclusão, então o banco
-- bloqueava a remoção.
--
-- Agora, ao excluir o usuário, o histórico continua e só o "registrado por"
-- fica vazio (a tela mostra "—").
--
-- Pode rodar de novo sem problema.
-- ============================================================
do $$
declare
  v record;
begin
  for v in
    select c.conname, t.relname, a.attname
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      join pg_attribute a on a.attrelid = t.oid and a.attnum = c.conkey[1]
     where n.nspname = 'public'
       and c.contype = 'f'
       and c.confrelid = 'public.usuarios'::regclass
       and array_length(c.conkey, 1) = 1
       and c.confdeltype <> 'n' -- ainda não é ON DELETE SET NULL
       and (t.relname, a.attname) in (
         ('movimentacoes', 'usuario_entrada_id'),
         ('movimentacoes', 'usuario_saida_id'),
         ('movimentacao_historico', 'usuario_id')
       )
  loop
    execute format('alter table %I drop constraint %I', v.relname, v.conname);
    execute format(
      'alter table %I add constraint %I foreign key (%I) references usuarios (id) on delete set null',
      v.relname, v.conname, v.attname
    );
  end loop;
end $$;

-- Conferência: deve listar as 3 colunas com "SET NULL".
select t.relname as tabela, a.attname as coluna,
       case c.confdeltype when 'n' then 'SET NULL' when 'c' then 'CASCADE' else 'BLOQUEIA' end as ao_excluir_usuario
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_attribute a on a.attrelid = t.oid and a.attnum = c.conkey[1]
 where c.contype = 'f'
   and c.confrelid = 'public.usuarios'::regclass
 order by 1, 2;
