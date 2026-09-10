import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { LancamentoFluxoCaixa } from '@/lib/types'

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
  }
}

export async function fetchFluxoCaixaLancamentosSupabase(limit = 1000): Promise<LancamentoFluxoCaixa[]> {
  const { data, error } = await supabase
    .from('fluxo_caixa_lancamentos')
    .select('*')
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
}

export async function criarLancamentoFluxoCaixa(input: CriarLancamentoFluxoCaixaInput): Promise<void> {
  const { error } = await supabase.from('fluxo_caixa_lancamentos').insert({
    data: input.data,
    movimentacao: input.movimentacao,
    descricao: input.descricao,
    valor: input.valor,
    observacao: input.observacao || null,
    usuario_nome: input.usuarioNome || null,
  })
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
