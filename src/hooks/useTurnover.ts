import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface MovimentacaoTurnover {
  id: string
  nome: string
  cargo: string
  empresa: string
  /** Data de admissão em ISO (yyyy-mm-dd). */
  admissao: string
  /** Data de demissão em ISO (yyyy-mm-dd), ou '' se ainda está ativo. */
  demissao: string
  /** Já tem data de demissão — conta como desligamento. */
  rescindindo: boolean
}

export interface DadosMovimentacaoTurnover {
  nome: string
  cargo: string
  empresa: string
  admissao: string
  demissao: string
}

/** Mesmos nomes curtos das abas da folha — é por eles que o quadro ativo é casado. */
export const EMPRESAS_TURNOVER = ['GVEL DIESEL', 'GV COMÉRCIO DE PEÇAS', 'GVEL LEVES', 'MCT', 'GV TRANSPORTES']

const EVENTO_ATUALIZACAO = 'turnover_updated'

function mapRow(row: any): MovimentacaoTurnover {
  return {
    id: row.id,
    nome: row.nome,
    cargo: row.cargo || '',
    empresa: row.empresa,
    admissao: row.data_admissao || '',
    demissao: row.data_demissao || '',
    rescindindo: Boolean(row.data_demissao),
  }
}

function paraRow(dados: DadosMovimentacaoTurnover) {
  return {
    nome: dados.nome.trim().toUpperCase(),
    cargo: dados.cargo.trim().toUpperCase(),
    empresa: dados.empresa,
    data_admissao: dados.admissao,
    data_demissao: dados.demissao || null,
    updated_at: new Date().toISOString(),
  }
}

function avisarAtualizacao() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENTO_ATUALIZACAO))
}

export function useTurnover() {
  const [items, setItems] = useState<MovimentacaoTurnover[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('rh_turnover')
      .select('*')
      .order('data_admissao', { ascending: false })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    setError(null)
    setItems((data || []).map(mapRow))
    setLoading(false)
  }, [])

  useEffect(() => {
    refetch()
    const handleUpdate = () => refetch()
    window.addEventListener(EVENTO_ATUALIZACAO, handleUpdate)
    return () => window.removeEventListener(EVENTO_ATUALIZACAO, handleUpdate)
  }, [refetch])

  return { items, loading, error, refetch }
}

export async function salvarMovimentacaoTurnover(dados: DadosMovimentacaoTurnover, id?: string): Promise<void> {
  const { error } = id
    ? await supabase.from('rh_turnover').update(paraRow(dados)).eq('id', id)
    : await supabase.from('rh_turnover').insert(paraRow(dados))
  if (error) throw error
  avisarAtualizacao()
}

export async function excluirMovimentacaoTurnover(id: string): Promise<void> {
  const { error } = await supabase.from('rh_turnover').delete().eq('id', id)
  if (error) throw error
  avisarAtualizacao()
}
