-- Gvel Diesel — link público de acompanhamento de frota por cliente.
-- Rode este arquivo no SQL Editor do seu projeto Supabase (ou via `supabase db push`)
-- depois de já ter aplicado as migrations anteriores.

alter table clientes add column if not exists share_token uuid unique;

-- Retorna a situação atual da frota (última movimentação de cada veículo)
-- de um único cliente, identificado pelo token público. SECURITY DEFINER
-- para permitir leitura pelo papel anon sem abrir RLS das tabelas internas —
-- a função só devolve dados do cliente dono do token informado.
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
