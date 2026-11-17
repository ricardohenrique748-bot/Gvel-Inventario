import { supabase } from '@/lib/supabase'
import type { ItemConsumo } from '@/lib/types'

// Mensagem do WhatsApp colada → Edge Function `ler-baixas-whatsapp` (Claude) →
// lista de baixas de insumo para o usuário conferir antes de lançar.

export interface BaixaLida {
  item_id: string | null
  item_texto: string
  quantidade: number | null
  placa: string | null
  responsavel: string | null
  motivo: string | null
  observacao: string | null
}

export interface ResultadoLeituraBaixas {
  baixas: BaixaLida[]
  ignorados: { trecho: string; motivo: string }[]
}

export interface ImagemLeitura {
  data: string // base64 sem o prefixo data:
  mediaType: string
}

// Ao copiar do WhatsApp, as fotos vêm no meio do texto como uma linha enorme
// de base64 (JPEG começa com "/9j/", PNG com "iVBORw0KGgo").
const RE_LINHA_IMAGEM = /^(\/9j\/|iVBORw0KGgo)[A-Za-z0-9+/=]{80,}$/

/** Separa as fotos embutidas no texto colado, trocando cada uma por [IMAGEM n]. */
export function separarImagensDoTexto(textoColado: string, primeiroNumero = 1): { texto: string; imagens: ImagemLeitura[] } {
  const imagens: ImagemLeitura[] = []
  const linhas = textoColado.split(/\r?\n/).map((linha) => {
    const limpa = linha.trim()
    if (!RE_LINHA_IMAGEM.test(limpa)) return linha
    imagens.push({ data: limpa, mediaType: limpa.startsWith('/9j/') ? 'image/jpeg' : 'image/png' })
    return `[IMAGEM ${primeiroNumero + imagens.length - 1}]`
  })
  return { texto: linhas.join('\n'), imagens }
}

export async function lerBaixasWhatsapp(params: {
  texto: string
  imagens: ImagemLeitura[]
  itens: ItemConsumo[]
  equipe: string[]
  placas: string[]
}): Promise<ResultadoLeituraBaixas> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const { data, error } = await supabase.functions.invoke('ler-baixas-whatsapp', {
    body: {
      texto: params.texto,
      imagens: params.imagens,
      itens: params.itens.map((it) => ({ id: it.id, nome: it.nome, unidade: it.unidade })),
      equipe: params.equipe,
      placas: params.placas,
    },
    headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
  })
  if (error) {
    const ctx = (error as { context?: Response }).context
    const body = ctx && typeof ctx.json === 'function' ? await ctx.json().catch(() => null) : null
    throw new Error(body?.error ?? 'Não foi possível ler a mensagem.')
  }
  const r = data as ResultadoLeituraBaixas
  const idsValidos = new Set(params.itens.map((it) => it.id))
  return {
    baixas: (r.baixas ?? []).map((b) => ({
      ...b,
      item_id: b.item_id && idsValidos.has(b.item_id) ? b.item_id : null,
      placa: b.placa ? b.placa.toUpperCase().replace(/[^A-Z0-9]/g, '') : null,
    })),
    ignorados: r.ignorados ?? [],
  }
}
