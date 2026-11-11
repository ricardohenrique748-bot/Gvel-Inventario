-- ============================================================
-- Lança a entrada do caminhão TCJ8J04 (FBLOG, Mercedes-Benz Actros 2651)
-- no Inventário de Caminhões da GVEL, com data de 16/10/2026 08:30.
--
-- Data no passado => não aparece como "entrada de hoje" no sininho.
-- Reaproveita cliente/marca/modelo/pátio que já existirem; só cria o que faltar.
-- Se a placa já estiver no pátio, PARA sem gravar nada.
-- As fotos são anexadas depois pela tela (Movimentações → editar).
-- ============================================================
do $$
declare
  v_company uuid := '0923c894-85ca-45c1-ba1b-3124d19b4d65'; -- GVEL
  v_cliente uuid;
  v_marca   uuid;
  v_modelo  uuid;
  v_patio   uuid;
  v_veiculo uuid;
  v_usuario uuid;
  v_mov     uuid;
begin
  -- Cliente FBLOG
  select id into v_cliente from clientes
   where company_id = v_company and replace(upper(nome), ' ', '') like '%FBLOG%'
   order by (upper(nome) = 'FBLOG') desc, created_at
   limit 1;
  if v_cliente is null then
    insert into clientes (company_id, nome) values (v_company, 'FBLOG') returning id into v_cliente;
    raise notice 'Cliente FBLOG criado.';
  end if;

  -- Marca Mercedes-Benz
  select id into v_marca from marcas
   where upper(nome) in ('MERCEDES-BENZ', 'MERCEDES BENZ', 'MERCEDES', 'MB')
   order by (upper(nome) = 'MERCEDES-BENZ') desc
   limit 1;
  if v_marca is null then
    insert into marcas (nome) values ('MERCEDES-BENZ') returning id into v_marca;
    raise notice 'Marca MERCEDES-BENZ criada.';
  end if;

  -- Modelo Actros 2651
  select id into v_modelo from modelos
   where marca_id = v_marca and replace(upper(nome), ' ', '') like '%ACTROS2651%'
   order by (upper(nome) = 'ACTROS 2651') desc
   limit 1;
  if v_modelo is null then
    insert into modelos (marca_id, nome) values (v_marca, 'ACTROS 2651') returning id into v_modelo;
    raise notice 'Modelo ACTROS 2651 criado.';
  end if;

  -- Pátio PESADA (tem que existir)
  select id into v_patio from patios
   where company_id = v_company and upper(nome) like '%PESADA%'
   order by (upper(nome) = 'PESADA') desc, length(nome)
   limit 1;
  if v_patio is null then
    raise exception 'Pátio PESADA não encontrado na GVEL. Nada foi gravado.';
  end if;

  -- Veículo
  select id into v_veiculo from veiculos where company_id = v_company and placa = 'TCJ8J04';
  if v_veiculo is null then
    insert into veiculos (company_id, placa, marca_id, modelo_id, cliente_id, tipo, cor, operante)
    values (v_company, 'TCJ8J04', v_marca, v_modelo, v_cliente, 'trator', 'AMARELO/VERDE', true)
    returning id into v_veiculo;
  elsif exists (select 1 from movimentacoes where veiculo_id = v_veiculo and status = 'no_patio') then
    raise exception 'TCJ8J04 já está no pátio. Nada foi gravado.';
  end if;

  -- Quem registrou (Ricardo)
  select id into v_usuario from usuarios where lower(email) = 'ricardo_h.16@hotmail.com' limit 1;

  -- Entrada
  insert into movimentacoes (company_id, veiculo_id, patio_id, data_hora_entrada, km_entrada, status, usuario_entrada_id)
  values (v_company, v_veiculo, v_patio, '2026-10-16 08:30:00-03', 5589, 'no_patio', v_usuario)
  returning id into v_mov;

  raise notice 'Entrada TCJ8J04 lançada (movimentação %).', v_mov;
end $$;

-- Conferir:
select m.id, v.placa, p.nome as patio, m.data_hora_entrada, m.km_entrada, m.status
  from movimentacoes m
  join veiculos v on v.id = m.veiculo_id
  join patios p on p.id = m.patio_id
 where v.placa = 'TCJ8J04';
