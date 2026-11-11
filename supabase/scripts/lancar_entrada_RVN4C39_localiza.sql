-- ============================================================
-- Lança a entrada do caminhão RVN4C39 (VW Constellation 26.280)
-- no Inventário de Caminhões da LOCALIZA, pátio CENTRAL, agora (hoje).
--
-- Reaproveita marca/modelo/pátio que já existirem; só cria marca/modelo se faltar.
-- Se a placa já estiver no pátio, PARA sem gravar nada.
-- As fotos são anexadas depois pela tela (Movimentações → editar).
-- ============================================================
do $$
declare
  v_company uuid := '81775591-b128-476e-b630-bc88f068c6ae'; -- LOCALIZA
  v_marca   uuid;
  v_modelo  uuid;
  v_patio   uuid;
  v_veiculo uuid;
  v_usuario uuid;
  v_mov     uuid;
begin
  -- Marca Volkswagen
  select id into v_marca from marcas
   where upper(nome) in ('VOLKSWAGEN', 'VW', 'VOLKSWAGEN CAMINHÕES', 'VW CAMINHÕES')
   order by (upper(nome) = 'VOLKSWAGEN') desc
   limit 1;
  if v_marca is null then
    insert into marcas (nome) values ('VOLKSWAGEN') returning id into v_marca;
    raise notice 'Marca VOLKSWAGEN criada.';
  end if;

  -- Modelo Constellation 26.280
  select id into v_modelo from modelos
   where marca_id = v_marca
     and replace(replace(upper(nome), ' ', ''), '.', '') like '%26280%'
   order by (upper(nome) like '%CONSTELLATION%') desc
   limit 1;
  if v_modelo is null then
    insert into modelos (marca_id, nome) values (v_marca, 'CONSTELLATION 26.280') returning id into v_modelo;
    raise notice 'Modelo CONSTELLATION 26.280 criado.';
  end if;

  -- Pátio CENTRAL (tem que existir)
  select id into v_patio from patios
   where company_id = v_company and upper(nome) like '%CENTRAL%'
   order by length(nome)
   limit 1;
  if v_patio is null then
    raise exception 'Pátio CENTRAL não encontrado na LOCALIZA. Nada foi gravado.';
  end if;

  -- Veículo (Localiza não usa cliente)
  select id into v_veiculo from veiculos where company_id = v_company and placa = 'RVN4C39';
  if v_veiculo is null then
    insert into veiculos (company_id, placa, marca_id, modelo_id, cliente_id, tipo, cor, operante)
    values (v_company, 'RVN4C39', v_marca, v_modelo, null, 'pesado', 'BRANCO', true)
    returning id into v_veiculo;
  elsif exists (select 1 from movimentacoes where veiculo_id = v_veiculo and status = 'no_patio') then
    raise exception 'RVN4C39 já está no pátio. Nada foi gravado.';
  end if;

  -- Quem registrou (Ricardo)
  select id into v_usuario from usuarios where lower(email) = 'ricardo_h.16@hotmail.com' limit 1;

  -- Entrada (agora)
  insert into movimentacoes (company_id, veiculo_id, patio_id, data_hora_entrada, km_entrada, status, usuario_entrada_id)
  values (v_company, v_veiculo, v_patio, now(), 71035, 'no_patio', v_usuario)
  returning id into v_mov;

  raise notice 'Entrada RVN4C39 lançada (movimentação %).', v_mov;
end $$;

-- Conferir:
select m.id, v.placa, p.nome as patio, m.data_hora_entrada, m.km_entrada, m.status
  from movimentacoes m
  join veiculos v on v.id = m.veiculo_id
  join patios p on p.id = m.patio_id
 where v.placa = 'RVN4C39';
