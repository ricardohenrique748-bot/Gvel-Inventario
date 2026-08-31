import type { SyntheticEvent } from 'react'

/**
 * Converte a URL pública de uma foto do Storage numa URL de miniatura
 * (usa a transformação de imagem do Supabase, que redimensiona sob demanda sem
 * precisar reprocessar/reenviar o arquivo original). Isso ajuda inclusive fotos
 * que já foram enviadas em tamanho grande antes da compressão no upload existir.
 *
 * Se o projeto não tiver a transformação de imagem habilitada, a URL de
 * miniatura falha ao carregar — quem usa essa função deve ter um `onError`
 * que volta pra URL original (ver `aoFalharMiniatura`).
 */
export function urlMiniatura(url: string, tamanho: number, qualidade = 60): string {
  if (!url.includes('/storage/v1/object/public/')) return url
  const base = url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/')
  const separador = base.includes('?') ? '&' : '?'
  return `${base}${separador}width=${tamanho}&height=${tamanho}&resize=cover&quality=${qualidade}`
}

/** Handler de `onError` pra usar em conjunto com `urlMiniatura`: volta pra URL original em caso de falha. */
export function aoFalharMiniatura(urlOriginal: string) {
  return (e: SyntheticEvent<HTMLImageElement>) => {
    if (e.currentTarget.src !== urlOriginal) e.currentTarget.src = urlOriginal
  }
}

/**
 * Escolhe uma foto pra representar a movimentação numa miniatura única (listas,
 * dashboard, etc). Antes essas telas mostravam só `foto_frente_url` e ficavam
 * sem nenhuma miniatura quando o inspetor não tirou a foto da frente mas tirou
 * as outras — agora cai pro primeiro ângulo disponível.
 */
export function primeiraFotoMovimentacao(m: {
  foto_frente_url?: string | null
  foto_lado_esquerdo_url?: string | null
  foto_lado_direito_url?: string | null
  foto_traseira_url?: string | null
  foto_painel_url?: string | null
}): string | null {
  return (
    m.foto_frente_url ||
    m.foto_lado_esquerdo_url ||
    m.foto_lado_direito_url ||
    m.foto_traseira_url ||
    m.foto_painel_url ||
    null
  )
}
