import { randomUUID } from 'node:crypto'
import { col } from '../db'

export interface UpsertVeiculoInput {
  placa: string
  marcaId: string
  modeloId: string
  clienteId: string
  tipo: 'pesado' | 'leve'
  cor?: string | null
  ano?: number | null
}

export async function upsertVeiculo(input: UpsertVeiculoInput) {
  const placa = input.placa.trim().toUpperCase()
  const veiculosCol = col('veiculos')
  const existente = await veiculosCol.findOne({ placa })

  if (existente) {
    const update: Record<string, unknown> = {
      marca_id: input.marcaId,
      modelo_id: input.modeloId,
      cliente_id: input.clienteId,
      tipo: input.tipo,
    }
    if (input.cor !== undefined) update.cor = input.cor || null
    if (input.ano !== undefined) update.ano = input.ano ?? null
    await veiculosCol.updateOne({ _id: existente._id }, { $set: update })
    return { ...existente, ...update }
  }

  const veiculo = {
    _id: randomUUID(),
    placa,
    marca_id: input.marcaId,
    modelo_id: input.modeloId,
    cliente_id: input.clienteId,
    tipo: input.tipo,
    cor: input.cor || null,
    ano: input.ano ?? null,
    created_at: new Date().toISOString(),
  }
  await veiculosCol.insertOne(veiculo)
  return veiculo
}
