import type { SyntheticEvent } from 'react'
import { extrairFotosExtras } from './fotosExtras'

const USAR_TRANSFORMACAO_SUPABASE = false

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
  // Desligado: a transformação de imagem do Supabase passou muito da cota do
  // plano Pro (2.557 de 100 imagens no ciclo de nov/2026) e, com o spend cap
  // ligado, o Supabase passou a restringir — as miniaturas falhavam no app.
  // As fotos já são comprimidas no upload e o egress tem folga, então servir
  // o original direto é mais barato. Para religar, troque para `true`.
  if (!USAR_TRANSFORMACAO_SUPABASE) return url
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
  foto_saida_frente_url?: string | null
  foto_saida_lado_esquerdo_url?: string | null
  foto_saida_lado_direito_url?: string | null
  foto_saida_traseira_url?: string | null
  foto_saida_painel_url?: string | null
  observacoes?: string | null
}): string | null {
  return (
    m.foto_frente_url ||
    m.foto_lado_esquerdo_url ||
    m.foto_lado_direito_url ||
    m.foto_traseira_url ||
    m.foto_painel_url ||
    // Entradas feitas só pela Galeria/"Adicionar foto" têm apenas fotos extras,
    // que ficam embutidas nas observações.
    fotoFrenteDasExtras(extrairFotosExtras(m.observacoes).fotosExtras) ||
    // Último recurso: qualquer foto tirada na saída.
    m.foto_saida_frente_url ||
    m.foto_saida_lado_esquerdo_url ||
    m.foto_saida_lado_direito_url ||
    m.foto_saida_traseira_url ||
    m.foto_saida_painel_url ||
    null
  )
}

/**
 * Pela Galeria a equipe fotografa na ordem painel → frente → laterais → traseira,
 * então a frente é a 2ª extra. Com uma só foto, usa ela mesma.
 */
function fotoFrenteDasExtras(extras: { url: string }[]): string | undefined {
  return (extras.length >= 2 ? extras[1] : extras[0])?.url
}
