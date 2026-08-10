import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface HistoricoItem {
  id: string
  movimentacao_id: string
  descricao: string
  data_hora: string
  usuario_id: string | null
  usuario?: { nome: string } | null
  created_at: string
}

export function useHistoricoMovimentacao(movimentacaoId: string | null | undefined) {
  const [historico, setHistorico] = useState<HistoricoItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    if (!movimentacaoId) {
      setHistorico([])
      return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from('movimentacao_historico')
      .select('*, usuario:usuarios!usuario_id(nome)')
      .eq('movimentacao_id', movimentacaoId)
      .order('data_hora', { ascending: true })

    if (error) {
      setError(error.message)
    } else {
      setHistorico((data as unknown as HistoricoItem[]) ?? [])
      setError(null)
    }
    setLoading(false)
  }, [movimentacaoId])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { historico, loading, error, refetch }
}

export async function adicionarHistorico(
  movimentacaoId: string,
  descricao: string,
  dataHora: string,
): Promise<HistoricoItem> {
  const { data: sessionData } = await supabase.auth.getSession()
  const usuarioId = sessionData.session?.user?.id ?? null

  const { data, error } = await supabase
    .from('movimentacao_historico')
    .insert({
      movimentacao_id: movimentacaoId,
      descricao: descricao.trim(),
      data_hora: dataHora,
      usuario_id: usuarioId,
    })
    .select('*, usuario:usuarios!usuario_id(nome)')
    .single()

  if (error) throw new Error(error.message)
  return data as unknown as HistoricoItem
}

export async function excluirHistorico(id: string): Promise<void> {
  const { error } = await supabase.from('movimentacao_historico').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
