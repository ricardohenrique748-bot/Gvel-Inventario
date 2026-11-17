import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { up } from '@/lib/text'
import { MOVIMENTACAO_COM_VEICULO } from '@/lib/queries'
import type { MovimentacaoComVeiculo } from '@/lib/types'
import { gerarUuid } from '@/lib/uuid'
import { uploadFotoEntrada } from '@/hooks/useMovimentacoes'

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
  fotos?: FotoEtapa[] | null
  created_at: string
}

export interface FotoEtapa {
  campo: string
  label: string
  url: string
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

export interface EtapaComMovimentacao extends HistoricoItem {
  movimentacao: MovimentacaoComVeiculo
}

/**
 * Busca as mudanças de etapa (movimentacao_historico) cuja data caiu dentro do
 * período informado — usado para mostrar, junto das entradas novas do dia,
 * quais veículos só mudaram de setor/etapa (sem ser uma entrada nova no pátio).
 */
export function useEtapasNoPeriodo(dataInicioISO?: string, dataFimISO?: string) {
  const [etapas, setEtapas] = useState<EtapaComMovimentacao[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    if (!dataInicioISO || !dataFimISO) {
      setEtapas([])
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from('movimentacao_historico')
      .select(`*, movimentacao:movimentacoes(${MOVIMENTACAO_COM_VEICULO})`)
      .gte('data_hora', dataInicioISO)
      .lte('data_hora', dataFimISO)
      .order('data_hora', { ascending: false })

    if (!error) {
      setEtapas((data as unknown as EtapaComMovimentacao[])?.filter((e) => e.movimentacao) ?? [])
    }
    setLoading(false)
  }, [dataInicioISO, dataFimISO])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { etapas, loading, refetch }
}

export interface AdicionarHistoricoInput {
  mecanicoExecutor?: string
  funcao?: string
  setor?: string
  dataHoraAbertura?: string
  osCriada?: boolean
  /** Fotos novas do veículo nesta etapa (sobem antes de gravar a etapa). */
  fotos?: { campo: string; label: string; file: File }[]
}

export async function adicionarHistorico(
  movimentacaoId: string,
  descricao: string,
  dataHora: string,
  input?: AdicionarHistoricoInput,
): Promise<HistoricoItem> {
  const { data: sessionData } = await supabase.auth.getSession()
  const usuarioId = sessionData.session?.user?.id ?? null

  // Sobe as fotos primeiro: se falhar, a etapa não é gravada sem elas.
  const id = gerarUuid()
  const fotos: FotoEtapa[] = await Promise.all(
    (input?.fotos ?? []).map(async (f) => ({
      campo: f.campo,
      label: f.label,
      url: await uploadFotoEntrada(movimentacaoId, `etapa-${id}-${f.campo}`, f.file),
    })),
  )

  const { data, error } = await supabase
    .from('movimentacao_historico')
    .insert({
      id,
      ...(fotos.length > 0 ? { fotos } : {}),
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
