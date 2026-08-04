import type { Document } from 'mongodb'

type Doc = Record<string, any> // eslint-disable-line

export function veiculoComRelacoesPipeline(): Document[] {
  return [
    { $lookup: { from: 'marcas', localField: 'marca_id', foreignField: '_id', as: 'marca' } },
    { $unwind: { path: '$marca', preserveNullAndEmptyArrays: true } },
    { $lookup: { from: 'modelos', localField: 'modelo_id', foreignField: '_id', as: 'modelo' } },
    { $unwind: { path: '$modelo', preserveNullAndEmptyArrays: true } },
    { $lookup: { from: 'clientes', localField: 'cliente_id', foreignField: '_id', as: 'cliente' } },
    { $unwind: { path: '$cliente', preserveNullAndEmptyArrays: true } },
  ]
}

export function movimentacaoComVeiculoPipeline(): Document[] {
  return [
    {
      $lookup: {
        from: 'veiculos',
        localField: 'veiculo_id',
        foreignField: '_id',
        as: 'veiculo',
        pipeline: veiculoComRelacoesPipeline(),
      },
    },
    { $unwind: '$veiculo' },
    { $lookup: { from: 'patios', localField: 'patio_id', foreignField: '_id', as: 'patio' } },
    { $unwind: { path: '$patio', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'status_manutencao',
        localField: 'status_id',
        foreignField: '_id',
        as: 'status_manutencao',
      },
    },
    { $unwind: { path: '$status_manutencao', preserveNullAndEmptyArrays: true } },
  ]
}

export function mapUsuario(u: Doc) {
  return {
    id: u._id,
    nome: u.nome,
    email: u.email,
    telefone: u.telefone ?? null,
    nivel: u.nivel === 'admin' ? 'admin' : 'usuario',
    created_at: u.created_at,
  }
}

export function mapMarca(m: Doc | null | undefined) {
  return m ? { id: m._id, nome: m.nome } : undefined
}

export function mapModelo(m: Doc | null | undefined) {
  return m ? { id: m._id, marca_id: m.marca_id, nome: m.nome } : undefined
}

export function mapCliente(c: Doc | null | undefined) {
  return c
    ? {
        id: c._id,
        nome: c.nome,
        telefone: c.telefone ?? null,
        cnpj: c.cnpj ?? null,
        endereco: c.endereco ?? null,
        created_at: c.created_at,
      }
    : undefined
}

export function mapPatio(p: Doc | null | undefined) {
  return p ? { id: p._id, nome: p.nome, created_at: p.created_at } : undefined
}

export function mapStatusManutencao(s: Doc | null | undefined) {
  return s ? { id: s._id, nome: s.nome, created_at: s.created_at } : undefined
}

export function mapVeiculo(v: Doc) {
  return {
    id: v._id,
    placa: v.placa,
    marca_id: v.marca_id,
    modelo_id: v.modelo_id,
    cliente_id: v.cliente_id,
    tipo: v.tipo,
    cor: v.cor ?? null,
    ano: v.ano ?? null,
    created_at: v.created_at,
    marca: mapMarca(v.marca),
    modelo: mapModelo(v.modelo),
    cliente: mapCliente(v.cliente),
  }
}

export function mapMovimentacao(m: Doc) {
  return {
    id: m._id,
    veiculo_id: m.veiculo_id,
    patio_id: m.patio_id ?? null,
    status_id: m.status_id ?? null,
    motorista: m.motorista ?? null,
    data_hora_entrada: m.data_hora_entrada,
    data_hora_saida: m.data_hora_saida ?? null,
    observacoes: m.observacoes ?? null,
    status: m.status,
    created_at: m.created_at,
    veiculo: mapVeiculo(m.veiculo),
    patio: mapPatio(m.patio),
    status_manutencao: mapStatusManutencao(m.status_manutencao),
  }
}
