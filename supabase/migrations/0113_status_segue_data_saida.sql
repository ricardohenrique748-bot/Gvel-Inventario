-- ============================================================
-- 0113: Status da movimentação segue a data de saída (Gvel e Localiza)
--
-- Problema relatado: usuários davam saída no veículo e, depois de um tempo,
-- ele "voltava" para o pátio sozinho.
--
-- Causa: o reenvio automático de um rascunho de entrada (internet fraca —
-- o servidor gravou, mas o app achou que falhou) fazia um upsert da mesma
-- movimentação com status = 'no_patio' por cima da linha. Se a saída já tinha
-- sido registrada nesse meio-tempo, o status voltava para 'no_patio' (a data
-- de saída continuava lá). O app novo não faz mais isso, mas aparelhos com o
-- APK antigo continuam fazendo até atualizar — por isso a trava fica no banco.
--
-- Regra: quem manda é data_hora_saida.
--   * tem data de saída  -> status = 'saiu'
--   * sem data de saída  -> status = 'no_patio'
-- Vale para app, navegador e SQL manual.
-- ============================================================

create or replace function public.status_segue_data_saida()
returns trigger
language plpgsql
as $$
begin
  if new.data_hora_saida is not null then
    new.status := 'saiu';
  else
    new.status := 'no_patio';
  end if;
  return new;
end;
$$;

drop trigger if exists status_segue_data_saida on movimentacoes;
create trigger status_segue_data_saida
  before insert or update on movimentacoes
  for each row
  execute function public.status_segue_data_saida();

-- Corrige os veículos que já foram afetados: têm saída registrada mas
-- estão aparecendo como "no pátio".
--
-- Para conferir ANTES de rodar a migration:
--   select v.placa, m.data_hora_entrada, m.data_hora_saida
--     from movimentacoes m join veiculos v on v.id = m.veiculo_id
--    where m.status = 'no_patio' and m.data_hora_saida is not null
--    order by m.data_hora_saida desc;
update movimentacoes
   set status = 'saiu'
 where status = 'no_patio'
   and data_hora_saida is not null;
