-- Gvel Diesel — a função pública `get_frota_publica` só retornava a foto da
-- frente do veículo. Se o inspetor não tirou a foto da frente mas tirou as
-- outras (lado, traseira, painel), a miniatura ficava em branco no link
-- público mesmo tendo foto disponível. Agora cai pro primeiro ângulo
-- disponível (COALESCE). Precisa dropar antes pois muda o formato de retorno.

drop function if exists get_frota_publica(uuid);

create or replace function get_frota_publica(p_token uuid)
returns table (
  cliente_nome text,
  movimentacao_id uuid,
  veiculo_id uuid,
  placa text,
  marca text,
  modelo text,
  patio_nome text,
  status text,
  status_manutencao text,
  operante boolean,
  foto_frente_url text,
  data_hora_entrada timestamptz,
  data_hora_saida timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    c.nome as cliente_nome,
    latest.id as movimentacao_id,
    latest.veiculo_id,
    v.placa,
    mc.nome as marca,
    md.nome as modelo,
    p.nome as patio_nome,
    latest.status,
    sm.nome as status_manutencao,
    v.operante,
    coalesce(
      latest.foto_frente_url,
      latest.foto_lado_esquerdo_url,
      latest.foto_lado_direito_url,
      latest.foto_traseira_url,
      latest.foto_painel_url
    ) as foto_frente_url,
    latest.data_hora_entrada,
    latest.data_hora_saida
  from clientes c
  join veiculos v on v.cliente_id = c.id
  join lateral (
    select m.*
    from movimentacoes m
    where m.veiculo_id = v.id
    order by m.data_hora_entrada desc
    limit 1
  ) latest on true
  left join marcas mc on mc.id = v.marca_id
  left join modelos md on md.id = v.modelo_id
  left join patios p on p.id = latest.patio_id
  left join status_manutencao sm on sm.id = latest.status_id
  where c.share_token = p_token;
$$;

grant execute on function get_frota_publica(uuid) to anon, authenticated;
