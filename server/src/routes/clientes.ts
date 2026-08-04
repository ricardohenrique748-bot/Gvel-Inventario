import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { col } from '../db'
import { requireAuth } from '../middleware/auth'
import { mapCliente } from '../lib/relations'

export const clientesRouter = Router()
clientesRouter.use(requireAuth)

clientesRouter.get('/', async (_req, res) => {
  const clientes = await col('clientes').find().sort({ nome: 1 }).toArray()
  res.json(clientes.map(mapCliente))
})

clientesRouter.get('/:id', async (req, res) => {
  const cliente = await col('clientes').findOne({ _id: req.params.id })
  if (!cliente) {
    res.status(404).json({ error: 'Cliente não encontrado.' })
    return
  }
  res.json(mapCliente(cliente))
})

clientesRouter.post('/', async (req, res) => {
  const { nome, telefone, cnpj, endereco } = req.body ?? {}
  if (!nome?.trim()) {
    res.status(400).json({ error: 'Nome é obrigatório.' })
    return
  }
  const cliente = {
    _id: randomUUID(),
    nome: nome.trim(),
    telefone: telefone || null,
    cnpj: cnpj || null,
    endereco: endereco || null,
    created_at: new Date().toISOString(),
  }
  await col('clientes').insertOne(cliente)
  res.status(201).json(mapCliente(cliente))
})
