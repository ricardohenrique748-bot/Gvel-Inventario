-- ============================================================
-- Remove a 1ª foto (a primeira miniatura do histórico) da movimentação
-- do veículo RTO9B86 com entrada em 17/11/2026, mantendo as outras duas.
--
-- A tela mostra as fotos nesta ordem: frente, lado esquerdo, lado direito,
-- traseira, painel. O script apaga a primeira que estiver preenchida.
-- Se achar 0 ou mais de 1 movimentação, PARA sem alterar nada.
-- ============================================================
do $$
declare
  v_mov   uuid;
  v_qtd   int;
  v_campo text;
  m       movimentacoes%rowtype;
begin
  select count(*) into v_qtd
    from movimentacoes mv
    join veiculos v on v.id = mv.veiculo_id
   where replace(upper(v.placa), '-', '') = 'RTO9B86'
     and (mv.data_hora_entrada at time zone 'America/Sao_Paulo')::date = date '2026-11-17';

  if v_qtd <> 1 then
    raise exception 'Esperava 1 movimentação de RTO9B86 em 17/11/2026, achei %. Nada foi alterado.', v_qtd;
  end if;

  select mv.* into m
    from movimentacoes mv
    join veiculos v on v.id = mv.veiculo_id
   where replace(upper(v.placa), '-', '') = 'RTO9B86'
     and (mv.data_hora_entrada at time zone 'America/Sao_Paulo')::date = date '2026-11-17';

  v_campo := case
    when m.foto_frente_url        is not null then 'foto_frente_url'
    when m.foto_lado_esquerdo_url is not null then 'foto_lado_esquerdo_url'
    when m.foto_lado_direito_url  is not null then 'foto_lado_direito_url'
    when m.foto_traseira_url      is not null then 'foto_traseira_url'
    when m.foto_painel_url        is not null then 'foto_painel_url'
  end;

  if v_campo is null then
    raise exception 'A movimentação não tem fotos principais. Nada foi alterado.';
  end if;

  execute format('update movimentacoes set %I = null where id = $1', v_campo) using m.id;
  raise notice 'Foto removida do campo % (movimentação %).', v_campo, m.id;
end $$;
