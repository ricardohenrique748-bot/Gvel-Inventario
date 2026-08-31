import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { obterNomeCompletoMembro, buscarFuncaoPorNome, normalizarFuncao } from '@/constants/equipe'

export interface ControleHorasItem {
  id: string
  descricao: string
  mecanico_executor: string | null
  funcao: string | null
  setor: string | null
  data_hora: string
  data_hora_abertura: string | null
  data_hora_fechamento: string | null
  minutos_atividade?: number | null
  movimentacao: {
    veiculo: { placa: string } | null
    status_manutencao: { nome: string } | null
  } | null
}

/**
 * Soma os minutos entre duas datas descontando qualquer trecho que caia num
 * domingo (a oficina não trabalha domingo, então esse tempo não deve contar
 * como horas de atividade, mesmo que a atividade tenha ficado em aberto
 * atravessando o fim de semana).
 */
function minutosExcluindoDomingo(inicio: Date, fim: Date): number {
  if (fim <= inicio) return 0
  let totalMs = fim.getTime() - inicio.getTime()

  let cursor = new Date(inicio)
  cursor.setHours(0, 0, 0, 0)
  while (cursor < fim) {
    const proximoDia = new Date(cursor)
    proximoDia.setDate(proximoDia.getDate() + 1)

    if (cursor.getDay() === 0) {
      const inicioSobreposicao = cursor > inicio ? cursor : inicio
      const fimSobreposicao = proximoDia < fim ? proximoDia : fim
      if (fimSobreposicao > inicioSobreposicao) {
        totalMs -= fimSobreposicao.getTime() - inicioSobreposicao.getTime()
      }
    }

    cursor = proximoDia
  }

  return Math.max(0, Math.round(totalMs / 60000))
}

function calcularMinutosComDatas(
  horaInicio?: string | null,
  horaFim?: string | null,
  dataInicio?: string | null,
  dataFim?: string | null,
  createdAt?: string | null,
): number {
  if (!horaInicio) return 0
  const dInicioStr = dataInicio || (createdAt ? new Date(createdAt).toISOString().slice(0, 10) : '')

  // Se tem início apontado mas ainda não tem fim, calcula a permanência / tempo em andamento
  if (!horaFim) {
    if (dInicioStr) {
      const dt1 = new Date(`${dInicioStr}T${horaInicio}:00`)
      if (!isNaN(dt1.getTime())) {
        return minutosExcluindoDomingo(dt1, new Date())
      }
    }
    return 1 // ao menos 1 minuto apontado para refletir atividade em andamento
  }

  // Se tem início e fim com datas completas:
  if (dInicioStr && dataFim) {
    const dt1 = new Date(`${dInicioStr}T${horaInicio}:00`)
    const dt2 = new Date(`${dataFim}T${horaFim}:00`)
    if (!isNaN(dt1.getTime()) && !isNaN(dt2.getTime()) && dt2 >= dt1) {
      return minutosExcluindoDomingo(dt1, dt2)
    }
  }

  // Fallback HH:mm (sem data de fim confiável). Se ao menos a data de início
  // é conhecida e cai num domingo, não conta nada.
  if (dInicioStr) {
    const dataReferencia = new Date(`${dInicioStr}T00:00:00`)
    if (!isNaN(dataReferencia.getTime()) && dataReferencia.getDay() === 0) return 0
  }

  const [h1, m1] = horaInicio.split(':').map(Number)
  const [h2, m2] = horaFim.split(':').map(Number)
  if (isNaN(h1) || isNaN(m1) || isNaN(h2) || isNaN(m2)) return 1
  let min = h2 * 60 + m2 - (h1 * 60 + m1)
  if (min < 0) min += 24 * 60
  return Math.max(1, min)
}

function normalizarSetor(secaoId?: string | null, osSetor?: string | null, patioNome?: string | null): string {
  const sec = (secaoId || '').toLowerCase()
  const st = (osSetor || '').toUpperCase()
  const pt = (patioNome || '').toUpperCase()

  // 1. Seção do checklist
  if (sec.includes('funilaria') || sec.includes('pintura')) return 'FUNILARIA'
  if (sec.includes('estetica') || sec.includes('lavagem')) return 'ESTETICA'

  // 2. Pátio ou Setor cadastrado
  if (pt.includes('PESAD') || st.includes('PESAD')) return 'OFICINA PESADA'
  if (pt.includes('FUNIL') || st.includes('FUNIL') || pt.includes('PINT') || st.includes('PINT')) return 'FUNILARIA'
  if (pt.includes('ESTET') || st.includes('ESTET') || pt.includes('LAV') || st.includes('LAV')) return 'ESTETICA'
  if (pt.includes('LEVE') || st.includes('LEVE')) return 'OFICINA LEVE'

  return 'OFICINA LEVE'
}

export function useControleHoras() {
  const [itens, setItens] = useState<ControleHorasItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    try {
      setLoading(true)

      // 1. Busca atividades individuais do checklist
      const { data: itensList, error: itensError } = await supabase
        .from('checklist_itens')
        .select(`
          id,
          movimentacao_id,
          item_id,
          secao_id,
          label,
          checked,
          data_inicio,
          data_fim,
          hora_inicio,
          hora_fim,
          mecanico,
          created_at,
          movimentacao:movimentacoes(
            veiculo:veiculos(placa),
            status_manutencao:status_manutencao(nome),
            patio:patios(nome)
          )
        `)
        .order('created_at', { ascending: false })

      if (itensError) throw itensError

      // 2. Busca dados gerais da O.S
      const { data: osList, error: osError } = await supabase
        .from('checklist_os')
        .select(`
          id,
          movimentacao_id,
          mecanico,
          funcao,
          setor,
          status_os,
          created_at,
          data_hora_abertura,
          data_hora_fechamento,
          movimentacao:movimentacoes(
            veiculo:veiculos(placa),
            status_manutencao:status_manutencao(nome),
            patio:patios(nome)
          )
        `)
        .order('created_at', { ascending: false })

      if (osError) throw osError

      const combinados: ControleHorasItem[] = []

      // Mapa auxiliar de dados de O.S por movimentação
      const osMap = new Map<string, (typeof osList)[number]>()
      for (const os of osList ?? []) {
        osMap.set(os.movimentacao_id, os)
      }

      // Processa atividades individuais apontadas no checklist
      for (const it of itensList ?? []) {
        const osGeral = osMap.get(it.movimentacao_id)
        const mecBruto = (it.mecanico || osGeral?.mecanico || '').trim().toUpperCase()

        if (!mecBruto || mecBruto === '—' || mecBruto === '-' || mecBruto === 'SEM NOME' || mecBruto === 'OPCIONAL') {
          continue
        }

        const mec = obterNomeCompletoMembro(mecBruto)
        const func = normalizarFuncao(buscarFuncaoPorNome(mec) || (it.secao_id === 'funilaria' ? 'FUNILEIRO' : osGeral?.funcao) || 'MECÂNICO')

        // Se o item tem horários apontados, está marcado ou tem mecânico próprio apontado
        const temHorarios = Boolean(it.hora_inicio || it.hora_fim)
        const isChecked = Boolean(it.checked)
        const temMecanicoProprio = Boolean(it.mecanico && it.mecanico.trim())

        if (temHorarios || isChecked || temMecanicoProprio) {
          const minutos = calcularMinutosComDatas(it.hora_inicio, it.hora_fim, it.data_inicio, it.data_fim, it.created_at)
          const movItem = it.movimentacao as unknown as { patio?: { nome?: string } }
          const osMovItem = osGeral?.movimentacao as unknown as { patio?: { nome?: string } }
          const patioNome = movItem?.patio?.nome || osMovItem?.patio?.nome
          const setor = normalizarSetor(it.secao_id, osGeral?.setor, patioNome)

          const dataAbertura = it.hora_inicio
            ? `${it.data_inicio || new Date(it.created_at).toISOString().slice(0, 10)}T${it.hora_inicio}`
            : it.created_at

          const dataFechamento = it.hora_fim
            ? `${it.data_fim || new Date(it.created_at).toISOString().slice(0, 10)}T${it.hora_fim}`
            : null

          combinados.push({
            id: it.id,
            descricao: it.label || 'ATIVIDADE CHECKLIST',
            mecanico_executor: mec,
            funcao: func,
            setor,
            data_hora: it.created_at,
            data_hora_abertura: dataAbertura,
            data_hora_fechamento: dataFechamento,
            minutos_atividade: minutos,
            movimentacao: it.movimentacao as unknown as ControleHorasItem['movimentacao'],
          })
        }
      }

      setItens(combinados)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar dados de performance')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refetch()

    // Realtime listeners
    const channel = supabase
      .channel('controle_horas_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checklist_os' }, () => refetch())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checklist_itens' }, () => refetch())
      .subscribe()

    const handleLocalUpdate = () => refetch()
    window.addEventListener('checklist_updated', handleLocalUpdate)

    return () => {
      supabase.removeChannel(channel)
      window.removeEventListener('checklist_updated', handleLocalUpdate)
    }
  }, [refetch])

  return { itens, loading, error, refetch }
}
