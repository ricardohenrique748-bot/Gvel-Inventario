import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { up } from '@/lib/text'

export interface HistoricoItem {
  id: string
  movimentacao_id: string
  descricao: string
  data_hora: string
  os_criada: boolean
  mecanico_executor: string | null
  funcao: string | null
  setor: string | null
  data_hora_abertura: string | null
  data_hora_fechamento: string | null
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

export interface AdicionarHistoricoInput {
  mecanicoExecutor?: string
  funcao?: string
  setor?: string
  dataHoraAbertura?: string
  osCriada?: boolean
}

export async function adicionarHistorico(
  movimentacaoId: string,
  descricao: string,
  dataHora: string,
  input?: AdicionarHistoricoInput,
): Promise<HistoricoItem> {
  const { data: sessionData } = await supabase.auth.getSession()
  const usuarioId = sessionData.session?.user?.id ?? null

  const { data, error } = await supabase
    .from('movimentacao_historico')
    .insert({
      movimentacao_id: movimentacaoId,
      descricao: descricao.trim(),
      data_hora: dataHora,
      os_criada: input?.osCriada ?? false,
      mecanico_executor: up(input?.mecanicoExecutor),
      funcao: up(input?.funcao),
      setor: up(input?.setor),
      data_hora_abertura: input?.dataHoraAbertura || null,
      usuario_id: usuarioId,
    })
    .select('*, usuario:usuarios!usuario_id(nome)')
    .single()

  if (error) throw new Error(error.message)
  return data as unknown as HistoricoItem
}

export interface AtualizarHistoricoInput {
  descricao: string
  dataHora: string
  mecanicoExecutor?: string
  funcao?: string
  setor?: string
  dataHoraAbertura?: string
  dataHoraFechamento?: string
  osCriada?: boolean
}

export async function atualizarHistorico(id: string, input: AtualizarHistoricoInput): Promise<HistoricoItem> {
  const { data, error } = await supabase
    .from('movimentacao_historico')
    .update({
      descricao: input.descricao.trim(),
      data_hora: input.dataHora,
      os_criada: input.osCriada ?? false,
      mecanico_executor: up(input.mecanicoExecutor),
      funcao: up(input.funcao),
      setor: up(input.setor),
      data_hora_abertura: input.dataHoraAbertura || null,
      data_hora_fechamento: input.dataHoraFechamento || null,
    })
    .eq('id', id)
    .select('*, usuario:usuarios!usuario_id(nome)')
    .single()

  if (error) throw new Error(error.message)
  return data as unknown as HistoricoItem
}

export async function excluirHistorico(id: string): Promise<void> {
  const { error } = await supabase.from('movimentacao_historico').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
