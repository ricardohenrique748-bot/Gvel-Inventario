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
  const matchJson = observacoes.match(RE_BLOCO_JSON)
  if (matchJson) {
    try {
      const parsed = JSON.parse(matchJson[1])
      if (Array.isArray(parsed)) {
        parsed.forEach((f) => {
          // Registros antigos foram gravados em maiúsculas (chaves e links). Os
          // caminhos das fotos são sempre minúsculos, então dá para recuperar.
          const url = typeof f === 'string' ? f : (f?.url ?? f?.URL)
          const label = typeof f === 'string' ? undefined : (f?.label ?? f?.LABEL)
          if (typeof url === 'string' && url.trim()) {
            const limpa = url.trim()
            fotosExtras.push({ url: /^HTTPS?:\/\//.test(limpa) ? limpa.toLowerCase() : limpa, label })
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

  return { textoLimpo: removerBlocos(observacoes), fotosExtras }
}

// O JSON é uma lista ("[...]"), então o bloco termina em "]]". Um ".*?\]" pararia
// no primeiro "]" e cortaria o JSON ao meio.
const RE_BLOCO_JSON = /\[FOTOS_EXTRAS:(\[.*?\])\]/
const RE_BLOCO_JSON_G = /\[FOTOS_EXTRAS:\[.*?\]\]/g
const RE_FOTO_EXTRA_G = /\[FOTO_EXTRA:.*?\]/g

function removerBlocos(texto: string): string {
  return texto.replace(RE_BLOCO_JSON_G, '').replace(RE_FOTO_EXTRA_G, '').trim()
}

/** Observações em maiúsculas sem tocar nos links das fotos extras embutidas. */
export function observacoesEmMaiusculas(observacoes: string | undefined | null): string | null {
  if (!observacoes) return observacoes ?? null
  const bloco = observacoes.match(RE_BLOCO_JSON)?.[0]
  const texto = removerBlocos(observacoes).toUpperCase()
  if (!bloco) return texto
  return texto ? `${texto}\n${bloco}` : bloco
}

export function embutirFotosExtras(
  observacoesTexto: string | undefined | null,
  fotosExtras: { url: string; label?: string }[],
): string {
  const texto = removerBlocos(observacoesTexto || '')

  if (fotosExtras.length === 0) return texto

  const json = JSON.stringify(
    fotosExtras.map((f) => ({
      url: f.url,
      label: f.label || undefined,
    })),
  )

  return texto ? `${texto}\n[FOTOS_EXTRAS:${json}]` : `[FOTOS_EXTRAS:${json}]`
}
