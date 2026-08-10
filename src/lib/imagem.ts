const DIMENSAO_MAXIMA = 1600
const QUALIDADE_JPEG = 0.75

/**
 * Redimensiona/comprime a foto no navegador antes do upload — fotos de câmera de
 * celular costumam vir com vários MB, e isso deixa upload e telas que mostram
 * várias miniaturas ao mesmo tempo (Dashboard, detalhe do veículo) mais lentos.
 * Se algo falhar (formato não suportado etc.), devolve o arquivo original.
 */
export async function comprimirImagem(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') return file

  try {
    const bitmap = await createImageBitmap(file)
    const escala = Math.min(1, DIMENSAO_MAXIMA / Math.max(bitmap.width, bitmap.height))
    const largura = Math.round(bitmap.width * escala)
    const altura = Math.round(bitmap.height * escala)

    const canvas = document.createElement('canvas')
    canvas.width = largura
    canvas.height = altura
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, largura, altura)

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALIDADE_JPEG))
    if (!blob || blob.size >= file.size) return file

    return new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' })
  } catch {
    return file
  }
}
