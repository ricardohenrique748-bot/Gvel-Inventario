import 'dotenv/config'
import { randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { col, connectDb } from '../db'

const MARCAS_COMUNS = [
  'Volvo',
  'Scania',
  'Mercedes-Benz',
  'Volkswagen',
  'Iveco',
  'DAF',
  'Ford',
  'Fiat',
  'Chevrolet',
  'Hyundai',
]

const ADMIN_EMAIL = 'admin@gvel.com'
const ADMIN_SENHA = 'admin123'

async function main() {
  await connectDb()

  await col('veiculos').createIndex({ placa: 1 }, { unique: true })
  await col('usuarios').createIndex({ email: 1 }, { unique: true })
  await col('marcas').createIndex({ nome: 1 }, { unique: true })
  await col('modelos').createIndex({ marca_id: 1 })
  await col('modelos').createIndex({ marca_id: 1, nome: 1 }, { unique: true })
  await col('movimentacoes').createIndex({ veiculo_id: 1 })
  await col('movimentacoes').createIndex({ status: 1 })
  await col('inspecoes').createIndex({ veiculo_id: 1 })
  console.log('Índices criados.')

  for (const nome of MARCAS_COMUNS) {
    await col('marcas').updateOne({ nome }, { $setOnInsert: { _id: randomUUID(), nome } }, { upsert: true })
  }
  console.log('Marcas comuns semeadas.')

  const existente = await col('usuarios').findOne({ email: ADMIN_EMAIL })
  if (!existente) {
    const senhaHash = await bcrypt.hash(ADMIN_SENHA, 10)
    await col('usuarios').insertOne({
      _id: randomUUID(),
      nome: 'Administrador',
      email: ADMIN_EMAIL,
      telefone: null,
      nivel: 'admin',
      senhaHash,
      created_at: new Date().toISOString(),
    })
    console.log(`Usuário admin criado: ${ADMIN_EMAIL} / ${ADMIN_SENHA}`)
  } else {
    // Garante nivel 'admin' mesmo em bancos semeados antes do campo existir.
    await col('usuarios').updateOne({ email: ADMIN_EMAIL }, { $set: { nivel: 'admin' } })
    console.log('Usuário admin já existe, nível garantido.')
  }

  console.log('Seed concluído.')
  process.exit(0)
}

main().catch((err) => {
  console.error('Erro no seed:', err)
  process.exit(1)
})
