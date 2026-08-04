import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { col } from '../db'
import { requireAuth } from '../middleware/auth'
import { mapStatusManutencao } from '../lib/relations'

export const statusManutencaoRouter = Router()
statusManutencaoRouter.use(requireAuth)

statusManutencaoRouter.get('/', async (_req, res) => {
  const itens = await col('status_manutencao').find().sort({ nome: 1 }).toArray()
  res.json(itens.map(mapStatusManutencao))
})

statusManutencaoRouter.post('/', async (req, res) => {
  const { nome } = req.body ?? {}
  if (!nome?.trim()) {
    res.status(400).json({ error: 'Nome é obrigatório.' })
    return
  }
  const item = { _id: randomUUID(), nome: nome.trim(), created_at: new Date().toISOString() }
  await col('status_manutencao').insertOne(item)
  res.status(201).json(mapStatusManutencao(item))
})
