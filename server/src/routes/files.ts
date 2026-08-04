import { Router } from 'express'
import { getBucket, type BucketName } from '../db'

export const filesRouter = Router()

filesRouter.get('/:bucket/:filename', async (req, res) => {
  const { bucket, filename } = req.params
  if (bucket !== 'fotos-inspecao' && bucket !== 'assinaturas') {
    res.status(404).json({ error: 'Bucket inválido.' })
    return
  }

  const gridBucket = getBucket(bucket as BucketName)
  const [file] = await gridBucket.find({ filename }).toArray()
  if (!file) {
    res.status(404).json({ error: 'Arquivo não encontrado.' })
    return
  }

  res.setHeader('Content-Type', file.metadata?.contentType ?? 'application/octet-stream')
  gridBucket.openDownloadStreamByName(filename).on('error', () => res.status(404).end()).pipe(res)
})
