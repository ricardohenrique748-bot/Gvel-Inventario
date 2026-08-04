import { Router } from 'express'
import { col } from '../db'
import { requireAuth } from '../middleware/auth'
import {
  mapMovimentacao,
  mapVeiculo,
  movimentacaoComVeiculoPipeline,
  veiculoComRelacoesPipeline,
} from '../lib/relations'
import { upsertVeiculo } from '../lib/veiculos'

export const veiculosRouter = Router()
veiculosRouter.use(requireAuth)

veiculosRouter.get('/', async (req, res) => {
  const clienteId = req.query.clienteId as string | undefined
  if (!clienteId) {
    res.json([])
    return
  }
  const veiculos = await col('veiculos')
    .aggregate([{ $match: { cliente_id: clienteId } }, ...veiculoComRelacoesPipeline(), { $sort: { placa: 1 } }])
    .toArray()
  res.json(veiculos.map(mapVeiculo))
})

veiculosRouter.get('/por-placa/:placa', async (req, res) => {
  const placa = req.params.placa.trim().toUpperCase()
  const [veiculo] = await col('veiculos')
    .aggregate([{ $match: { placa } }, ...veiculoComRelacoesPipeline()])
    .toArray()
  res.json(veiculo ? mapVeiculo(veiculo) : null)
})

veiculosRouter.post('/upsert', async (req, res) => {
  const veiculo = await upsertVeiculo(req.body ?? {})
  res.json(mapVeiculo(veiculo))
})

veiculosRouter.get('/:id/historico', async (req, res) => {
  const historico = await col('movimentacoes')
    .aggregate([
      { $match: { veiculo_id: req.params.id } },
      { $sort: { data_hora_entrada: -1 } },
      ...movimentacaoComVeiculoPipeline(),
    ])
    .toArray()
  res.json(historico.map(mapMovimentacao))
})

veiculosRouter.get('/:id', async (req, res) => {
  const [veiculo] = await col('veiculos')
    .aggregate([{ $match: { _id: req.params.id } }, ...veiculoComRelacoesPipeline()])
    .toArray()
  if (!veiculo) {
    res.status(404).json({ error: 'Veículo não encontrado.' })
    return
  }
  res.json(mapVeiculo(veiculo))
})
