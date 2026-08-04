import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'node:crypto'
import { col } from '../db'
import { requireAdmin, requireAuth, type AuthedRequest } from '../middleware/auth'
import { mapUsuario } from '../lib/relations'

export const usuariosRouter = Router()
usuariosRouter.use(requireAuth)

usuariosRouter.get('/', async (_req, res) => {
  const usuarios = await col('usuarios').find().sort({ nome: 1 }).toArray()
  res.json(usuarios.map(mapUsuario))
})

usuariosRouter.post('/', async (req, res) => {
  const { nome, email, senha, telefone, nivel } = req.body ?? {}
  if (!nome?.trim() || !email?.trim() || !senha) {
    res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios.' })
    return
  }
  if (senha.length < 6) {
    res.status(400).json({ error: 'A senha precisa ter no mínimo 6 caracteres.' })
    return
  }

  const emailNorm = String(email).trim().toLowerCase()
  const existente = await col('usuarios').findOne({ email: emailNorm })
  if (existente) {
    res.status(400).json({ error: 'Já existe um usuário com esse e-mail.' })
    return
  }

  const senhaHash = await bcrypt.hash(senha, 10)
  const usuario = {
    _id: randomUUID(),
    nome: nome.trim(),
    email: emailNorm,
    telefone: telefone?.trim() || null,
    nivel: nivel === 'admin' ? 'admin' : 'usuario',
    senhaHash,
    created_at: new Date().toISOString(),
  }
  await col('usuarios').insertOne(usuario)
  res.status(201).json(mapUsuario(usuario))
})

usuariosRouter.delete('/:id', requireAdmin, async (req: AuthedRequest, res) => {
  if (req.params.id === req.usuarioId) {
    res.status(400).json({ error: 'Você não pode excluir seu próprio usuário.' })
    return
  }
  const result = await col('usuarios').deleteOne({ _id: req.params.id })
  if (result.deletedCount === 0) {
    res.status(404).json({ error: 'Usuário não encontrado.' })
    return
  }
  res.status(204).end()
})
