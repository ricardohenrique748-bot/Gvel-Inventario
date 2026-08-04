import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { connectDb } from './db'
import { authRouter } from './routes/auth'
import { usuariosRouter } from './routes/usuarios'
import { clientesRouter } from './routes/clientes'
import { patiosRouter } from './routes/patios'
import { statusManutencaoRouter } from './routes/statusManutencao'
import { marcasRouter, modelosRouter } from './routes/marcasModelos'
import { veiculosRouter } from './routes/veiculos'
import { movimentacoesRouter } from './routes/movimentacoes'
import { inspecoesRouter } from './routes/inspecoes'
import { filesRouter } from './routes/files'

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:5173'

// Express 4 não repassa rejeições de handlers async para o error handler sozinho —
// sem isso, uma falha passageira de rede com o Mongo (ex.: soluço de TLS) derruba
// o processo inteiro em vez de só a requisição que estava em andamento.
process.on('unhandledRejection', (reason) => {
  console.error('[Gvel Diesel] Erro não tratado (requisição falhou, servidor continua no ar):', reason)
})

async function main() {
  await connectDb()
  console.log('[Gvel Diesel] Conectado ao MongoDB Atlas.')

  const app = express()
  app.use(cors({ origin: CORS_ORIGIN }))
  app.use(express.json())

  app.use('/api/auth', authRouter)
  app.use('/api/usuarios', usuariosRouter)
  app.use('/api/clientes', clientesRouter)
  app.use('/api/patios', patiosRouter)
  app.use('/api/status-manutencao', statusManutencaoRouter)
  app.use('/api/marcas', marcasRouter)
  app.use('/api/modelos', modelosRouter)
  app.use('/api/veiculos', veiculosRouter)
  app.use('/api/movimentacoes', movimentacoesRouter)
  app.use('/api/inspecoes', inspecoesRouter)
  app.use('/api/files', filesRouter)

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[Gvel Diesel] Erro na requisição:', err)
    res.status(500).json({ error: 'Erro interno do servidor.' })
  })

  app.listen(PORT, () => {
    console.log(`[Gvel Diesel] API rodando em http://localhost:${PORT}`)
  })
}

main().catch((err) => {
  console.error('Falha ao iniciar o servidor:', err)
  process.exit(1)
})
