import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { col } from '../db'
import { requireAuth } from '../middleware/auth'
import { mapMovimentacao, movimentacaoComVeiculoPipeline } from '../lib/relations'
import { upsertVeiculo } from '../lib/veiculos'

export const movimentacoesRouter = Router()
movimentacoesRouter.use(requireAuth)

movimentacoesRouter.get('/', async (req, res) => {
  const { status, clienteId, marcaId, modeloId, patioId, dataInicio, dataFim, search } = req.query as Record<
    string,
    string | undefined
  >

  const match: Record<string, any> = {}
  if (status) match.status = status
  if (patioId) match.patio_id = patioId
  if (dataInicio || dataFim) {
    match.data_hora_entrada = {}
    if (dataInicio) match.data_hora_entrada.$gte = dataInicio
    if (dataFim) match.data_hora_entrada.$lte = dataFim
  }

  const postMatch: Record<string, any> = {}
  if (clienteId) postMatch['veiculo.cliente_id'] = clienteId
  if (marcaId) postMatch['veiculo.marca_id'] = marcaId
  if (modeloId) postMatch['veiculo.modelo_id'] = modeloId
  if (search) postMatch['veiculo.placa'] = { $regex: search.trim().toUpperCase() }

  const pipeline: Record<string, any>[] = [
    { $match: match },
    { $sort: { data_hora_entrada: -1 } },
    ...movimentacaoComVeiculoPipeline(),
  ]
  if (Object.keys(postMatch).length) pipeline.push({ $match: postMatch })

  const movimentacoes = await col('movimentacoes').aggregate(pipeline).toArray()
  res.json(movimentacoes.map(mapMovimentacao))
})

movimentacoesRouter.post('/entrada', async (req, res) => {
  const input = req.body ?? {}

  let veiculoId = input.veiculoId as string | undefined
  if (!veiculoId) {
    const veiculo = await upsertVeiculo({
      placa: input.placa,
      marcaId: input.marcaId,
      modeloId: input.modeloId,
      clienteId: input.clienteId,
      tipo: input.tipo,
      cor: input.cor,
      ano: input.ano,
    })
    veiculoId = veiculo._id
  }

  const movimentacao = {
    _id: randomUUID(),
    veiculo_id: veiculoId,
    patio_id: input.patioId,
    status_id: input.statusId || null,
    motorista: input.motorista || null,
    data_hora_entrada: input.dataHoraEntrada,
    data_hora_saida: null,
    observacoes: input.observacoes || null,
    status: 'no_patio',
    created_at: new Date().toISOString(),
  }
  await col('movimentacoes').insertOne(movimentacao)
  res.status(201).json({ ...movimentacao, id: movimentacao._id })
})

movimentacoesRouter.patch('/:id/saida', async (req, res) => {
  const result = await col('movimentacoes').findOneAndUpdate(
    { _id: req.params.id },
    { $set: { data_hora_saida: new Date().toISOString(), status: 'saiu' } },
    { returnDocument: 'after' },
  )
  if (!result) {
    res.status(404).json({ error: 'Movimentação não encontrada.' })
    return
  }
  res.json({ ...result, id: result._id })
})
