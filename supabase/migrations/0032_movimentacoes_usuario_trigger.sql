-- Gvel Diesel — garante que usuario_entrada_id/usuario_saida_id sejam sempre
-- preenchidos com o usuário autenticado da própria requisição (auth.uid(),
-- lido do mesmo JWT já validado pelo RLS), em vez de depender apenas do
-- valor resolvido separadamente no cliente antes do insert/update.
--
-- No app nativo (APK) essa resolução no cliente podia falhar de forma
-- transitória (ex: usuário minimiza o app pra tirar as fotos do veículo,
-- o refresh do token é pausado nesse meio tempo) e o campo ficava nulo
-- mesmo com o registro salvo com sucesso. O trigger fecha essa corrida:
-- se o cliente não mandou o usuário, o banco usa o autor real da requisição.

create or replace function set_movimentacao_usuario()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.usuario_entrada_id := coalesce(new.usuario_entrada_id, auth.uid());
  elsif tg_op = 'UPDATE' then
    if new.data_hora_saida is not null and old.data_hora_saida is null then
      new.usuario_saida_id := coalesce(new.usuario_saida_id, auth.uid());
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_movimentacao_usuario_insert on movimentacoes;
create trigger trg_set_movimentacao_usuario_insert
  before insert on movimentacoes
  for each row execute function set_movimentacao_usuario();

drop trigger if exists trg_set_movimentacao_usuario_update on movimentacoes;
create trigger trg_set_movimentacao_usuario_update
  before update on movimentacoes
  for each row execute function set_movimentacao_usuario();
