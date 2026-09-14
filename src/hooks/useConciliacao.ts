import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { parseOFXFile } from '@/lib/ofxParser'
import type { LoteImportacaoExtrato, TransacaoExtrato, StatusTransacaoExtrato } from '@/lib/types'

function mapRowParaLote(row: any): LoteImportacaoExtrato {
  return {
    id: row.id,
    nomeArquivo: row.nome_arquivo,
    banco: row.banco || undefined,
    contaBancariaId: row.conta_bancaria_id || undefined,
    contaBancariaNome: row.conta_bancaria_nome || undefined,
    dataInicio: row.data_inicio || undefined,
    dataFim: row.data_fim || undefined,
    totalTransacoes: row.total_transacoes || 0,
    createdAt: row.created_at,
  }
}

function mapRowParaTransacao(row: any): TransacaoExtrato {
  return {
    id: row.id,
    loteId: row.lote_id,
    fitid: row.fitid,
    data: row.data,
    descricao: row.descricao,
    valor: Number(row.valor) || 0,
    tipo: row.tipo || undefined,
    status: row.status,
    contaPagarReceberId: row.conta_pagar_receber_id || undefined,
    contaPagarReceberDescricao: row.conta_pagar_receber_descricao || undefined,
    createdAt: row.created_at,
  }
}

export function useLotesImportacao() {
  const [lotes, setLotes] = useState<LoteImportacaoExtrato[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('lotes_importacao_extrato').select('*').order('created_at', { ascending: false })
    setLotes((data || []).map(mapRowParaLote))
    setLoading(false)
  }, [])

  useEffect(() => {
    refetch()
    const handleUpdate = () => refetch()
    window.addEventListener('conciliacao_updated', handleUpdate)
    return () => window.removeEventListener('conciliacao_updated', handleUpdate)
  }, [refetch])

  return { lotes, loading, refetch }
}

export function useTransacoesExtrato() {
  const [transacoes, setTransacoes] = useState<TransacaoExtrato[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('transacoes_extrato').select('*').order('data', { ascending: false }).limit(5000)
    setTransacoes((data || []).map(mapRowParaTransacao))
    setLoading(false)
  }, [])

  useEffect(() => {
    refetch()
    const handleUpdate = () => refetch()
    window.addEventListener('conciliacao_updated', handleUpdate)
    return () => window.removeEventListener('conciliacao_updated', handleUpdate)
  }, [refetch])

  return { transacoes, loading, refetch }
}

export interface ResultadoImportacao {
  lote: LoteImportacaoExtrato
  novas: number
  duplicadas: number
}

export async function importarExtratoOFX(
  file: File,
  contaBancariaId?: string,
  contaBancariaNome?: string,
): Promise<ResultadoImportacao> {
  const resultado = await parseOFXFile(file)
  if (resultado.transactions.length === 0) {
    throw new Error(resultado.errors[0] || 'Nenhuma transação encontrada no arquivo.')
  }

  const { data: loteRow, error: erroLote } = await supabase
    .from('lotes_importacao_extrato')
    .insert({
      nome_arquivo: file.name,
      banco: resultado.banco || null,
      conta_bancaria_id: contaBancariaId || null,
      conta_bancaria_nome: contaBancariaNome || null,
      data_inicio: resultado.dataInicio || null,
      data_fim: resultado.dataFim || null,
      total_transacoes: resultado.transactions.length,
    })
    .select()
    .single()
  if (erroLote) throw erroLote
  const lote = mapRowParaLote(loteRow)

  // fitid é único no banco (índice UNIQUE) — reimportar o mesmo extrato só
  // insere o que ainda não existe, sem duplicar nem dar erro no restante.
  let novas = 0
  let duplicadas = 0
  for (const t of resultado.transactions) {
    const { error } = await supabase.from('transacoes_extrato').insert({
      lote_id: lote.id,
      fitid: t.fitid,
      data: t.data,
      descricao: t.descricao,
      valor: t.valor,
      tipo: t.tipo,
    })
    if (error) {
      duplicadas++
    } else {
      novas++
    }
  }

  if (typeof window !== 'undefined') window.dispatchEvent(new Event('conciliacao_updated'))
  return { lote, novas, duplicadas }
}

export async function vincularTransacao(
  transacaoId: string,
  contaPagarReceberId: string,
  contaPagarReceberDescricao: string,
): Promise<void> {
  const { error } = await supabase
    .from('transacoes_extrato')
    .update({
      status: 'conciliada',
      conta_pagar_receber_id: contaPagarReceberId,
      conta_pagar_receber_descricao: contaPagarReceberDescricao,
    })
    .eq('id', transacaoId)
  if (error) throw error

  // Vincular ao extrato é a confirmação de que o lançamento realmente foi
  // pago/recebido — reflete isso no status da conta a pagar/receber.
  await supabase.from('contas_pagar_receber').update({ status: 'pago' }).eq('id', contaPagarReceberId)

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('conciliacao_updated'))
    window.dispatchEvent(new Event('conta_pagar_receber_updated'))
  }
}

export async function desvincularTransacao(transacaoId: string): Promise<void> {
  const { error } = await supabase
    .from('transacoes_extrato')
    .update({ status: 'pendente', conta_pagar_receber_id: null, conta_pagar_receber_descricao: null })
    .eq('id', transacaoId)
  if (error) throw error
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('conciliacao_updated'))
}

export async function marcarStatusTransacao(transacaoId: string, status: StatusTransacaoExtrato): Promise<void> {
  const { error } = await supabase.from('transacoes_extrato').update({ status }).eq('id', transacaoId)
  if (error) throw error
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('conciliacao_updated'))
}

export async function excluirLoteImportacao(loteId: string): Promise<void> {
  const { error } = await supabase.from('lotes_importacao_extrato').delete().eq('id', loteId)
  if (error) throw error
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('conciliacao_updated'))
}
