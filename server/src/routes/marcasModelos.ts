import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { col } from '../db'
import { requireAuth } from '../middleware/auth'
import { mapMarca, mapModelo } from '../lib/relations'

export const marcasRouter = Router()
marcasRouter.use(requireAuth)

marcasRouter.get('/', async (_req, res) => {
  const marcas = await col('marcas').find().sort({ nome: 1 }).toArray()
  res.json(marcas.map(mapMarca))
})

marcasRouter.post('/', async (req, res) => {
  const { nome } = req.body ?? {}
  if (!nome?.trim()) {
    res.status(400).json({ error: 'Nome é obrigatório.' })
    return
  }
  const existente = await col('marcas').findOne({ nome: nome.trim() })
  if (existente) {
    res.status(400).json({ error: 'Marca já existe.' })
    return
  }
  const marca = { _id: randomUUID(), nome: nome.trim() }
  await col('marcas').insertOne(marca)
  res.status(201).json(mapMarca(marca))
})

export const modelosRouter = Router()
modelosRouter.use(requireAuth)

modelosRouter.get('/', async (req, res) => {
  const marcaId = req.query.marcaId as string | undefined
  if (!marcaId) {
    res.json([])
    return
  }
  const modelos = await col('modelos').find({ marca_id: marcaId }).sort({ nome: 1 }).toArray()
  res.json(modelos.map(mapModelo))
})

modelosRouter.post('/', async (req, res) => {
  const { marcaId, nome } = req.body ?? {}
  if (!marcaId || !nome?.trim()) {
    res.status(400).json({ error: 'Marca e nome são obrigatórios.' })
    return
  }
  const modelo = { _id: randomUUID(), marca_id: marcaId, nome: nome.trim() }
  await col('modelos').insertOne(modelo)
  res.status(201).json(mapModelo(modelo))
})
