import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { col } from '../db'

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) throw new Error('JWT_SECRET não definido no .env')

export interface AuthedRequest extends Request {
  usuarioId?: string
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) {
    res.status(401).json({ error: 'Não autenticado.' })
    return
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET as string) as { sub: string }
    req.usuarioId = payload.sub
    next()
  } catch {
    res.status(401).json({ error: 'Token inválido ou expirado.' })
  }
}

// Deve ser usado depois de requireAuth — depende de req.usuarioId já preenchido.
export async function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  const usuario = await col('usuarios').findOne({ _id: req.usuarioId })
  if (usuario?.nivel !== 'admin') {
    res.status(403).json({ error: 'Apenas administradores podem fazer isso.' })
    return
  }
  next()
}

export function signToken(usuarioId: string) {
  return jwt.sign({ sub: usuarioId }, JWT_SECRET as string, { expiresIn: '30d' })
}
