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
