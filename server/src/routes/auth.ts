import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { col } from '../db'
import { signToken, requireAuth, type AuthedRequest } from '../middleware/auth'
import { mapUsuario } from '../lib/relations'

export const authRouter = Router()

authRouter.post('/login', async (req, res) => {
  const { email, senha } = req.body ?? {}
  if (!email || !senha) {
    res.status(400).json({ error: 'E-mail e senha são obrigatórios.' })
    return
  }

  const usuario = await col('usuarios').findOne({ email: String(email).trim().toLowerCase() })
  if (!usuario) {
    res.status(401).json({ error: 'E-mail ou senha inválidos.' })
    return
  }

  const ok = await bcrypt.compare(senha, usuario.senhaHash)
  if (!ok) {
    res.status(401).json({ error: 'E-mail ou senha inválidos.' })
    return
  }

  const token = signToken(usuario._id)
  res.json({ token, usuario: mapUsuario(usuario) })
})

authRouter.get('/me', requireAuth, async (req: AuthedRequest, res) => {
  const usuario = await col('usuarios').findOne({ _id: req.usuarioId })
  if (!usuario) {
    res.status(401).json({ error: 'Usuário não encontrado.' })
    return
  }
  res.json(mapUsuario(usuario))
})
