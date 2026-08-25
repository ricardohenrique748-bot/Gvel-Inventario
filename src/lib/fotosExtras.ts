export interface FotoExtraItem {
  id: string
  file?: File
  previewUrl: string
  label: string
}

export function extrairFotosExtras(observacoes?: string | null): {
  textoLimpo: string
  fotosExtras: { url: string; label?: string }[]
} {
  if (!observacoes) return { textoLimpo: '', fotosExtras: [] }

  const fotosExtras: { url: string; label?: string }[] = []

  // Formato 1: [FOTOS_EXTRAS:[{"url":"...","label":"..."}]]
  const matchJson = observacoes.match(/\[FOTOS_EXTRAS:(.*?)\]/)
  if (matchJson) {
    try {
      const parsed = JSON.parse(matchJson[1])
      if (Array.isArray(parsed)) {
        parsed.forEach((f) => {
          if (typeof f === 'string' && f.trim()) {
            fotosExtras.push({ url: f.trim() })
          } else if (f && typeof f.url === 'string' && f.url.trim()) {
            fotosExtras.push({ url: f.url.trim(), label: f.label })
          }
        })
      }
    } catch (e) {
      console.warn('Erro ao decodificar FOTOS_EXTRAS:', e)
    }
  }

  // Formato 2: [FOTO_EXTRA:url] ou [FOTO_EXTRA:label:url]
  const regexIndividual = /\[FOTO_EXTRA:(?:([^:\]]+):)?(https?:\/\/[^\]]+)\]/g
  let match: RegExpExecArray | null
  while ((match = regexIndividual.exec(observacoes)) !== null) {
    const url = match[2]?.trim()
    if (url && !fotosExtras.some((f) => f.url === url)) {
      fotosExtras.push({
        label: match[1]?.trim() || undefined,
        url,
      })
    }
  }

  const textoLimpo = observacoes
    .replace(/\[FOTOS_EXTRAS:.*?\]/g, '')
    .replace(/\[FOTO_EXTRA:.*?\]/g, '')
    .trim()

  return { textoLimpo, fotosExtras }
}

export function embutirFotosExtras(
  observacoesTexto: string | undefined | null,
  fotosExtras: { url: string; label?: string }[],
): string {
  const texto = (observacoesTexto || '')
    .replace(/\[FOTOS_EXTRAS:.*?\]/g, '')
    .replace(/\[FOTO_EXTRA:.*?\]/g, '')
    .trim()

  if (fotosExtras.length === 0) return texto

  const json = JSON.stringify(
    fotosExtras.map((f) => ({
      url: f.url,
      label: f.label || undefined,
    })),
  )

  return texto ? `${texto}\n[FOTOS_EXTRAS:${json}]` : `[FOTOS_EXTRAS:${json}]`
}
