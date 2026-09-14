import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { ContaPagarReceber, StatusContaPagarReceber, TipoMovimentacaoConta } from '@/lib/types'

function mapRowParaConta(row: any): ContaPagarReceber {
  return {
    id: row.id,
    descricao: row.descricao || undefined,
    centroCustoId: row.centro_custo_id,
    centroCustoNome: row.centro_custo_nome || undefined,
    tipoMovimentacao: row.tipo_movimentacao,
    tipoLancamentoId: row.tipo_lancamento_id,
    tipoLancamentoNome: row.tipo_lancamento_nome || undefined,
    valor: Number(row.valor) || 0,
    dataLancamento: row.data_lancamento,
    dataVencimento: row.data_vencimento,
    status: row.status,
    veiculoId: row.veiculo_id || undefined,
    placa: row.placa || undefined,
    fornecedorId: row.fornecedor_id || undefined,
    fornecedorNome: row.fornecedor_nome || undefined,
    contaBancariaId: row.conta_bancaria_id || undefined,
    contaBancariaNome: row.conta_bancaria_nome || undefined,
    observacoes: row.observacoes || undefined,
    numeroParcelas: row.numero_parcelas ?? 1,
    createdAt: row.created_at,
  }
}

export async function fetchContasPagarReceberSupabase(limit = 1000): Promise<ContaPagarReceber[]> {
  const { data, error } = await supabase
    .from('contas_pagar_receber')
    .select('*')
    .order('data_vencimento', { ascending: true })
    .limit(limit)

  if (error) {
    console.warn('Erro ao buscar contas a pagar/receber no Supabase:', error)
    return []
  }
  return (data || []).map(mapRowParaConta)
}

export interface SalvarContaPagarReceberInput {
  descricao?: string
  centroCustoId: string
  centroCustoNome?: string
  tipoMovimentacao: TipoMovimentacaoConta
  tipoLancamentoId: string
  tipoLancamentoNome?: string
  valor: number
  dataLancamento: string
  dataVencimento: string
  status: StatusContaPagarReceber
  veiculoId?: string
  placa?: string
  fornecedorId?: string
  fornecedorNome?: string
  contaBancariaId?: string
  contaBancariaNome?: string
  observacoes?: string
  numeroParcelas?: number
}

function payloadDaConta(input: SalvarContaPagarReceberInput) {
  return {
    descricao: input.descricao || null,
    centro_custo_id: input.centroCustoId,
    centro_custo_nome: input.centroCustoNome || null,
    tipo_movimentacao: input.tipoMovimentacao,
    tipo_lancamento_id: input.tipoLancamentoId,
    tipo_lancamento_nome: input.tipoLancamentoNome || null,
    valor: input.valor,
    data_lancamento: input.dataLancamento,
    data_vencimento: input.dataVencimento,
    status: input.status,
    veiculo_id: input.veiculoId || null,
    placa: input.placa || null,
    fornecedor_id: input.fornecedorId || null,
    fornecedor_nome: input.fornecedorNome || null,
    conta_bancaria_id: input.contaBancariaId || null,
    conta_bancaria_nome: input.contaBancariaNome || null,
    observacoes: input.observacoes || null,
    numero_parcelas: input.numeroParcelas || 1,
  }
}

export async function criarContaPagarReceber(input: SalvarContaPagarReceberInput): Promise<ContaPagarReceber> {
  const { data, error } = await supabase.from('contas_pagar_receber').insert(payloadDaConta(input)).select().single()
  if (error) throw error
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('conta_pagar_receber_updated'))
  return mapRowParaConta(data)
}

export async function atualizarContaPagarReceber(id: string, input: SalvarContaPagarReceberInput): Promise<ContaPagarReceber> {
  const { data, error } = await supabase.from('contas_pagar_receber').update(payloadDaConta(input)).eq('id', id).select().single()
  if (error) throw error
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('conta_pagar_receber_updated'))
  return mapRowParaConta(data)
}

export async function excluirContaPagarReceber(id: string): Promise<void> {
  const { error } = await supabase.from('contas_pagar_receber').delete().eq('id', id)
  if (error) throw error
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('conta_pagar_receber_updated'))
}

export function useContasPagarReceber() {
  const [contas, setContas] = useState<ContaPagarReceber[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    try {
      const dados = await fetchContasPagarReceberSupabase()
      setContas(dados)
      setError(null)
    } catch (err) {
      console.warn('Falha ao buscar contas a pagar/receber:', err)
      setError(err instanceof Error ? err.message : 'Erro ao carregar lançamentos.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refetch()
    const handleUpdate = () => refetch()
    window.addEventListener('conta_pagar_receber_updated', handleUpdate)
    return () => window.removeEventListener('conta_pagar_receber_updated', handleUpdate)
  }, [refetch])

  return { contas, loading, error, refetch }
}
