import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { col } from '../db'
import { requireAuth } from '../middleware/auth'
import { mapPatio } from '../lib/relations'

export const patiosRouter = Router()
patiosRouter.use(requireAuth)

patiosRouter.get('/', async (_req, res) => {
  const patios = await col('patios').find().sort({ nome: 1 }).toArray()
  res.json(patios.map(mapPatio))
})

patiosRouter.post('/', async (req, res) => {
  const { nome } = req.body ?? {}
  if (!nome?.trim()) {
    res.status(400).json({ error: 'Nome é obrigatório.' })
    return
  }
  const patio = { _id: randomUUID(), nome: nome.trim(), created_at: new Date().toISOString() }
  await col('patios').insertOne(patio)
  res.status(201).json(mapPatio(patio))
})
