import { supabase } from '@/lib/supabase'
import type { DadosComprovante } from './comprovante'

// Foto do cupom → Edge Function `ler-cupom-abastecimento` (Claude) → campos.
// A chave da API fica no Supabase; o app só manda a foto já comprimida.

interface RespostaLeitura {
  legivel: boolean
  placa: string | null
  data: string | null
  hora: string | null
  litros: number | null
  valor_litro: number | null
  valor_total: number | null
  combustivel: string | null
  posto_nome: string | null
  posto_cnpj: string | null
  odometro: number | null
  motorista: string | null
  observacao: string | null
}

const RE_PLACA = /^([A-Z]{3})-?(\d[A-Z0-9]\d{2})$/

export async function lerCupomPorFoto(dataUrl: string): Promise<DadosComprovante> {
  const mediaType = dataUrl.match(/^data:([^;]+);/)?.[1] ?? 'image/jpeg'
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const { data, error } = await supabase.functions.invoke('ler-cupom-abastecimento', {
    body: { imagem: dataUrl, mediaType },
    headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
  })
  if (error) {
    const ctx = (error as { context?: Response }).context
    const body = ctx && typeof ctx.json === 'function' ? await ctx.json().catch(() => null) : null
    throw new Error(body?.error ?? 'Não foi possível ler a foto do cupom.')
  }

  const r = data as RespostaLeitura
  if (!r.legivel) throw new Error(r.observacao || 'A foto não parece um cupom de abastecimento legível. Preencha manualmente.')

  const placa = r.placa?.toUpperCase().replace(/\s/g, '').match(RE_PLACA)
  let dataHora: Date | undefined
  if (r.data && /^\d{4}-\d{2}-\d{2}$/.test(r.data)) {
    const d = new Date(`${r.data}T${r.hora && /^\d{2}:\d{2}$/.test(r.hora) ? r.hora : '12:00'}:00`)
    if (!Number.isNaN(d.getTime())) dataHora = d
  }
  const positivo = (n: number | null) => (n != null && n > 0 ? n : undefined)

  return {
    tipo: 'foto',
    placa: placa ? `${placa[1]}${placa[2]}` : undefined,
    dataHora,
    litros: positivo(r.litros),
    valorLitro: positivo(r.valor_litro),
    valorTotal: positivo(r.valor_total),
    combustivel: r.combustivel && r.combustivel !== 'OUTRO' ? r.combustivel : undefined,
    postoNome: r.posto_nome ?? undefined,
    postoCnpj: r.posto_cnpj ?? undefined,
    odometro: positivo(r.odometro),
    motorista: r.motorista ?? undefined,
    observacao: r.observacao ?? undefined,
  }
}
