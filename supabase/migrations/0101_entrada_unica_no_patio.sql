-- ============================================================
-- 0101: Uma entrada aberta por placa no pátio (Gvel e Localiza)
--
-- Enquanto o veículo está no pátio (movimentação com status 'no_patio'),
-- não pode ter outra entrada da mesma placa. Depois que registram a saída
-- (status 'saiu'), a placa pode entrar de novo.
--
-- O app já checa isso antes de gravar (registrarEntrada em useMovimentacoes.ts);
-- o índice abaixo garante a regra mesmo com dois aparelhos registrando a
-- mesma placa ao mesmo tempo. Como veiculos é único por (company_id, placa),
-- travar por veiculo_id já separa por empresa.
--
-- Se já existir placa com duas entradas abertas, a migration PARA e lista as
-- placas — registre a saída (ou exclua a entrada repetida) e rode de novo.
-- Pode rodar de novo sem problema.
-- ============================================================

do $$
declare
  duplicadas text;
begin
  select string_agg(format('%s (%s entradas abertas)', v.placa, d.qtd), ', ' order by v.placa)
    into duplicadas
    from (
      select veiculo_id, count(*) as qtd
        from movimentacoes
       where status = 'no_patio'
       group by veiculo_id
      having count(*) > 1
    ) d
    join veiculos v on v.id = d.veiculo_id;

  if duplicadas is not null then
    raise exception 'Placas com mais de uma entrada aberta no pátio: %. Registre a saída/exclua a entrada repetida e rode esta migration de novo.', duplicadas;
  end if;
end $$;

create unique index if not exists uq_movimentacoes_veiculo_no_patio
  on movimentacoes (veiculo_id)
  where status = 'no_patio';
