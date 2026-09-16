import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { parseFaltasPdf } from '@/lib/faltasPdfParser'

export interface RegistroFalta {
  id: string
  loteId: string | null
  matricula: string
  nome: string
  funcao: string
  cartao: string
  departamento: string
  data: string // ISO
  observacao: string
  createdAt: string
}

export interface LoteImportacaoFaltas {
  id: string
  nomeArquivo: string
  empresa?: string
  periodoInicio?: string
  periodoFim?: string
  totalRegistros: number
  createdAt: string
}

function mapRowParaFalta(row: any): RegistroFalta {
  return {
    id: row.id,
    loteId: row.lote_id || null,
    matricula: row.matricula,
    nome: row.nome,
    funcao: row.funcao || '',
    cartao: row.cartao || '',
    departamento: row.departamento || '',
    data: row.data,
    observacao: row.observacao || 'FALTA',
    createdAt: row.created_at,
  }
}

function mapRowParaLote(row: any): LoteImportacaoFaltas {
  return {
    id: row.id,
    nomeArquivo: row.nome_arquivo,
    empresa: row.empresa || undefined,
    periodoInicio: row.periodo_inicio || undefined,
    periodoFim: row.periodo_fim || undefined,
    totalRegistros: row.total_registros || 0,
    createdAt: row.created_at,
  }
}

export function useFaltas() {
  const [registros, setRegistros] = useState<RegistroFalta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('faltas_colaboradores').select('*').order('data', { ascending: false })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    setError(null)
    setRegistros((data || []).map(mapRowParaFalta))
    setLoading(false)
  }, [])

  useEffect(() => {
    refetch()
    const handleUpdate = () => refetch()
    window.addEventListener('faltas_updated', handleUpdate)
    return () => window.removeEventListener('faltas_updated', handleUpdate)
  }, [refetch])

  return { registros, loading, error, refetch }
}

export function useLotesImportacaoFaltas() {
  const [lotes, setLotes] = useState<LoteImportacaoFaltas[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('lotes_importacao_faltas')
      .select('*')
      .order('created_at', { ascending: false })
    setLotes((data || []).map(mapRowParaLote))
    setLoading(false)
  }, [])

  useEffect(() => {
    refetch()
    const handleUpdate = () => refetch()
    window.addEventListener('faltas_updated', handleUpdate)
    return () => window.removeEventListener('faltas_updated', handleUpdate)
  }, [refetch])

  return { lotes, loading, refetch }
}

export interface ResultadoImportacaoFaltas {
  lote: LoteImportacaoFaltas
  novos: number
  atualizados: number
}

export async function importarFaltasPdf(file: File): Promise<ResultadoImportacaoFaltas> {
  const extraido = await parseFaltasPdf(file)
  if (extraido.registros.length === 0) {
    throw new Error(extraido.erros[0] || 'Nenhuma falta encontrada no PDF.')
  }

  const { data: loteRow, error: erroLote } = await supabase
    .from('lotes_importacao_faltas')
    .insert({
      nome_arquivo: file.name,
      empresa: extraido.empresa,
      periodo_inicio: extraido.periodoInicio,
      periodo_fim: extraido.periodoFim,
      total_registros: extraido.registros.length,
    })
    .select()
    .single()
  if (erroLote) throw erroLote
  const lote = mapRowParaLote(loteRow)

  // matricula+data é único no banco — reimportar o mesmo relatório (ou um
  // período que se sobrepõe) atualiza a falta já existente em vez de duplicar.
  let novos = 0
  let atualizados = 0
  for (const r of extraido.registros) {
    const { data: existente } = await supabase
      .from('faltas_colaboradores')
      .select('id')
      .eq('matricula', r.matricula)
      .eq('data', r.data)
      .maybeSingle()

    const { error } = await supabase.from('faltas_colaboradores').upsert(
      {
        lote_id: lote.id,
        matricula: r.matricula,
        nome: r.nome,
        funcao: r.funcao,
        cartao: r.cartao,
        departamento: r.departamento,
        data: r.data,
        observacao: r.observacao,
      },
      { onConflict: 'matricula,data' },
    )
    if (error) {
      console.error('Falha ao importar falta:', r, error)
      continue
    }
    if (existente) atualizados++
    else novos++
  }

  if (typeof window !== 'undefined') window.dispatchEvent(new Event('faltas_updated'))
  return { lote, novos, atualizados }
}

export async function excluirLoteImportacaoFaltas(loteId: string): Promise<void> {
  const { error } = await supabase.from('lotes_importacao_faltas').delete().eq('id', loteId)
  if (error) throw error
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('faltas_updated'))
}
