-- Gvel Diesel — adiciona chassi e situação operante/inoperante no detalhe
-- público do veículo. Precisa dropar antes pois muda o formato de retorno.
-- Rode este arquivo no SQL Editor do seu projeto Supabase (ou via `supabase db push`)
-- depois de já ter aplicado as migrations anteriores.

drop function if exists get_veiculo_publico(uuid, uuid);

create or replace function get_veiculo_publico(p_token uuid, p_veiculo_id uuid)
returns table (
  placa text,
  marca text,
  modelo text,
  cor text,
  ano int,
  tipo text,
  chassi text,
  operante boolean,
  movimentacao_id uuid,
  patio_nome text,
  status text,
  status_manutencao text,
  motorista text,
  destino text,
  observacoes text,
  data_hora_entrada timestamptz,
  data_hora_saida timestamptz,
  foto_frente_url text,
  foto_lado_esquerdo_url text,
  foto_lado_direito_url text,
  foto_traseira_url text,
  foto_painel_url text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    v.placa,
    mc.nome as marca,
    md.nome as modelo,
    v.cor,
    v.ano,
    v.tipo,
    v.chassi,
    v.operante,
    m.id as movimentacao_id,
    p.nome as patio_nome,
    m.status,
    sm.nome as status_manutencao,
    m.motorista,
    m.destino,
    m.observacoes,
    m.data_hora_entrada,
    m.data_hora_saida,
    m.foto_frente_url,
    m.foto_lado_esquerdo_url,
    m.foto_lado_direito_url,
    m.foto_traseira_url,
    m.foto_painel_url
  from clientes c
  join veiculos v on v.cliente_id = c.id
  join movimentacoes m on m.veiculo_id = v.id
  left join marcas mc on mc.id = v.marca_id
  left join modelos md on md.id = v.modelo_id
  left join patios p on p.id = m.patio_id
  left join status_manutencao sm on sm.id = m.status_id
  where c.share_token = p_token
    and v.id = p_veiculo_id
  order by m.data_hora_entrada desc;
$$;

grant execute on function get_veiculo_publico(uuid, uuid) to anon, authenticated;
