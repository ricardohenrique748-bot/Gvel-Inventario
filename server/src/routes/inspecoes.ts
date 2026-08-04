import { Router } from 'express'
import multer from 'multer'
import { col, getBucket, type BucketName } from '../db'
import { requireAuth } from '../middleware/auth'
import { upsertVeiculo } from '../lib/veiculos'

export const inspecoesRouter = Router()
inspecoesRouter.use(requireAuth)

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

function uploadToGridFS(bucketName: BucketName, filename: string, buffer: Buffer, contentType: string) {
  return new Promise<void>((resolve, reject) => {
    const stream = getBucket(bucketName).openUploadStream(filename, { metadata: { contentType } })
    stream.on('error', reject)
    stream.on('finish', () => resolve())
    stream.end(buffer)
  })
}

function fileUrl(bucketName: BucketName, filename: string) {
  return `/api/files/${bucketName}/${encodeURIComponent(filename)}`
}

interface ItemInput {
  key: string
  secao: string
  item: string
  status: 'conforme' | 'nao_conforme' | 'pendente'
  observacao?: string
}

inspecoesRouter.post('/', upload.any(), async (req, res) => {
  try {
    const files = (req.files as Express.Multer.File[]) ?? []
    const fileByField = new Map(files.map((f) => [f.fieldname, f]))

    const id = req.body.id as string
    const veiculoInput = JSON.parse(req.body.veiculo)
    const itensInput = JSON.parse(req.body.itens) as ItemInput[]

    const veiculo = await upsertVeiculo(veiculoInput)

    let assinaturaUrl: string | null = null
    const assinaturaFile = fileByField.get('assinatura')
    if (assinaturaFile) {
      const filename = `${id}.png`
      await uploadToGridFS('assinaturas', filename, assinaturaFile.buffer, assinaturaFile.mimetype)
      assinaturaUrl = fileUrl('assinaturas', filename)
    }

    const itens = []
    for (const item of itensInput) {
      let fotoUrl: string | null = null
      const fotoFile = fileByField.get(`foto_${item.key}`)
      if (fotoFile) {
        const ext = fotoFile.mimetype === 'image/png' ? 'png' : 'jpg'
        const filename = `${id}__${item.key}.${ext}`
        await uploadToGridFS('fotos-inspecao', filename, fotoFile.buffer, fotoFile.mimetype)
        fotoUrl = fileUrl('fotos-inspecao', filename)
      }
      itens.push({
        secao: item.secao,
        item: item.item,
        status: item.status,
        observacao: item.observacao || null,
        foto_url: fotoUrl,
      })
    }

    const statusGeral = itens.some((i) => i.status === 'nao_conforme')
      ? 'nao_conforme'
      : itens.some((i) => i.status === 'pendente')
        ? 'pendente'
        : 'conforme'

    const inspecao = {
      _id: id,
      veiculo_id: veiculo._id,
      cliente_id: req.body.clienteId,
      inspetor: req.body.inspetor,
      km: req.body.km ? Number(req.body.km) : null,
      data_hora: req.body.dataHora,
      assinatura_url: assinaturaUrl,
      responsavel_nome: req.body.responsavelNome || null,
      responsavel_cargo: req.body.responsavelCargo || null,
      status_geral: statusGeral,
      itens,
      created_at: new Date().toISOString(),
    }
    await col('inspecoes').insertOne(inspecao)

    res.status(201).json({
      inspecaoId: id,
      veiculo: { id: veiculo._id, ...veiculo },
      statusGeral,
      itens,
    })
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Erro ao salvar inspeção.' })
  }
})
