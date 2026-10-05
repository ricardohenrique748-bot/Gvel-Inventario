import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { LancamentoFluxoCaixa } from '@/lib/types'

const SELECT_COM_RELACOES = '*, cliente:clientes(nome), veiculo:veiculos(placa)'

function mapRowParaLancamento(row: any): LancamentoFluxoCaixa {
  return {
    id: row.id,
    data: row.data,
    movimentacao: row.movimentacao,
    descricao: row.descricao,
    valor: Number(row.valor) || 0,
    observacao: row.observacao || undefined,
    usuarioNome: row.usuario_nome || undefined,
    createdAt: row.created_at,
    clienteId: row.cliente_id || undefined,
    clienteNome: row.cliente?.nome || undefined,
    veiculoId: row.veiculo_id || undefined,
    veiculoPlaca: row.veiculo?.placa || undefined,
    quantidadeVeiculos: row.quantidade_veiculos ?? undefined,
    dataVencimento: row.data_vencimento || undefined,
    formaPagamento: row.forma_pagamento || undefined,
    statusPagamento: row.status_pagamento || undefined,
  }
}

/** Status de pagamento que encerram a cobrança — o resto (PENDENTE, COBRADO, ABATER...) segue em aberto. */
export const STATUS_PAGAMENTO_QUITADOS = ['PAGO', 'CANCELADO', 'ISENTO', 'ZEROU']

/** Data de hoje em 'YYYY-MM-DD' no fuso local (toISOString usaria UTC e viraria o dia às 21h). */
export function hojeIsoLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Vencido = tem valor, vencimento anterior a hoje e o status ainda não é de quitação. */
export function isLancamentoVencido(
  l: { dataVencimento?: string; statusPagamento?: string; valor?: number },
  hojeIso = hojeIsoLocal(),
): boolean {
  if (!l.dataVencimento || l.dataVencimento >= hojeIso) return false
  if (l.valor !== undefined && !(l.valor > 0)) return false
  return !isStatusQuitado(l.statusPagamento)
}

/** Quitado = PAGO e variações digitadas no "OUTRO..." (PAGO ANUAL, PAGO PIX...), ou CANCELADO/ISENTO/ZEROU. */
export function isStatusQuitado(status?: string): boolean {
  const s = (status || 'PENDENTE').toUpperCase().trim()
  return s.startsWith('PAGO') || STATUS_PAGAMENTO_QUITADOS.includes(s)
}

/** Dias corridos entre o vencimento e hoje (ambos 'YYYY-MM-DD'). */
export function diasDeAtraso(dataVencimento: string, hojeIso = hojeIsoLocal()): number {
  const [a1, m1, d1] = dataVencimento.split('-').map(Number)
  const [a2, m2, d2] = hojeIso.split('-').map(Number)
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86_400_000)
}

export async function fetchFluxoCaixaLancamentosSupabase(limit = 1000): Promise<LancamentoFluxoCaixa[]> {
  const { data, error } = await supabase
    .from('fluxo_caixa_lancamentos')
    .select(SELECT_COM_RELACOES)
    .order('data', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.warn('Erro ao buscar lançamentos do fluxo de caixa no Supabase:', error)
    return []
  }
  return (data || []).map(mapRowParaLancamento)
}

export interface CriarLancamentoFluxoCaixaInput {
  data: string
  movimentacao: 'entrada' | 'saida'
  descricao: string
  valor: number
  observacao?: string
  usuarioNome?: string
  clienteId?: string
  veiculoId?: string
  quantidadeVeiculos?: number
  dataVencimento?: string
  formaPagamento?: string
  statusPagamento?: string
}

export async function criarLancamentoFluxoCaixa(input: CriarLancamentoFluxoCaixaInput): Promise<void> {
  const { error } = await supabase.from('fluxo_caixa_lancamentos').insert({
    data: input.data,
    movimentacao: input.movimentacao,
    descricao: input.descricao,
    valor: input.valor,
    observacao: input.observacao || null,
    usuario_nome: input.usuarioNome || null,
    cliente_id: input.clienteId || null,
    veiculo_id: input.veiculoId || null,
    quantidade_veiculos: input.quantidadeVeiculos ?? null,
    data_vencimento: input.dataVencimento || null,
    forma_pagamento: input.formaPagamento || null,
    status_pagamento: input.statusPagamento || 'pendente',
  })
  if (error) throw error

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('fluxo_caixa_lancamento_updated'))
  }
}

/** Importação em massa (botão "Importar Excel") — sempre insere como novos lançamentos, sem tentar detectar duplicado. */
export async function criarLancamentosFluxoCaixaEmLote(inputs: CriarLancamentoFluxoCaixaInput[]): Promise<void> {
  if (inputs.length === 0) return
  const { error } = await supabase.from('fluxo_caixa_lancamentos').insert(
    inputs.map((input) => ({
      data: input.data,
      movimentacao: input.movimentacao,
      descricao: input.descricao,
      valor: input.valor,
      observacao: input.observacao || null,
      usuario_nome: input.usuarioNome || null,
      cliente_id: input.clienteId || null,
      veiculo_id: input.veiculoId || null,
      quantidade_veiculos: input.quantidadeVeiculos ?? null,
      data_vencimento: input.dataVencimento || null,
      forma_pagamento: input.formaPagamento || null,
      status_pagamento: input.statusPagamento || 'pendente',
    })),
  )
  if (error) throw error

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('fluxo_caixa_lancamento_updated'))
  }
}

/** Botão PGT da tabela: marca o lançamento como PAGO ou volta pra PENDENTE. */
export async function atualizarStatusPagamentoLancamento(id: string, statusPagamento: string): Promise<void> {
  const { error } = await supabase
    .from('fluxo_caixa_lancamentos')
    .update({ status_pagamento: statusPagamento })
    .eq('id', id)
  if (error) throw error

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('fluxo_caixa_lancamento_updated'))
  }
}

export async function excluirLancamentoFluxoCaixa(id: string): Promise<void> {
  const { error } = await supabase.from('fluxo_caixa_lancamentos').delete().eq('id', id)
  if (error) throw error

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('fluxo_caixa_lancamento_updated'))
  }
}

export function useFluxoCaixaLancamentos() {
  const [lancamentos, setLancamentos] = useState<LancamentoFluxoCaixa[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    try {
      const dados = await fetchFluxoCaixaLancamentosSupabase()
      setLancamentos(dados)
      setError(null)
    } catch (err) {
      console.warn('Falha ao buscar lançamentos do fluxo de caixa:', err)
      setError(err instanceof Error ? err.message : 'Erro ao carregar lançamentos.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refetch()

    const handleUpdate = () => refetch()
    window.addEventListener('fluxo_caixa_lancamento_updated', handleUpdate)
    return () => window.removeEventListener('fluxo_caixa_lancamento_updated', handleUpdate)
  }, [refetch])

  return { lancamentos, loading, error, refetch }
}
