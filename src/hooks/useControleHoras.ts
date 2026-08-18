import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

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

function calcularMinutosHorarios(horaInicio?: string | null, horaFim?: string | null): number {
  if (!horaInicio || !horaFim) return 0
  const [h1, m1] = horaInicio.split(':').map(Number)
  const [h2, m2] = horaFim.split(':').map(Number)
  if (isNaN(h1) || isNaN(m1) || isNaN(h2) || isNaN(m2)) return 0
  let min = h2 * 60 + m2 - (h1 * 60 + m1)
  if (min < 0) min += 24 * 60
  return min
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

      // 1. Busca atividades individuais do checklist (onde estão os apontamentos reais de horas por atividade)
      const { data: itensList, error: itensError } = await supabase
        .from('checklist_itens')
        .select(`
          id,
          movimentacao_id,
          item_id,
          secao_id,
          label,
          checked,
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

      // 2. Busca dados gerais da O.S (para responsáveis gerais e contagem de veículos atendidos)
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
          movimentacao:movimentacoes(
            veiculo:veiculos(placa),
            status_manutencao:status_manutencao(nome),
            patio:patios(nome)
          )
        `)
        .order('created_at', { ascending: false })

      if (osError) throw osError

      const combinados: ControleHorasItem[] = []
      const movimentacoesComAtividades = new Set<string>()

      // Mapa auxiliar de dados de O.S por movimentação
      const osMap = new Map<string, (typeof osList)[number]>()
      for (const os of osList ?? []) {
        osMap.set(os.movimentacao_id, os)
      }

      // Processa atividades individuais apontadas no checklist
      for (const it of itensList ?? []) {
        const osGeral = osMap.get(it.movimentacao_id)
        const mec = (it.mecanico || osGeral?.mecanico || '').trim().toUpperCase()

        if (!mec || mec === '—' || mec === '-' || mec === 'SEM NOME' || mec === 'OPCIONAL') {
          continue
        }

        // Se o item tem horários apontados ou está marcado
        const temHorarios = Boolean(it.hora_inicio && it.hora_fim)
        const isChecked = Boolean(it.checked)

        if (temHorarios || isChecked) {
          const minutos = calcularMinutosHorarios(it.hora_inicio, it.hora_fim)
          const movItem = it.movimentacao as unknown as { patio?: { nome?: string } }
          const osMovItem = osGeral?.movimentacao as unknown as { patio?: { nome?: string } }
          const patioNome = movItem?.patio?.nome || osMovItem?.patio?.nome
          const setor = normalizarSetor(it.secao_id, osGeral?.setor, patioNome)

          combinados.push({
            id: it.id,
            descricao: it.label || 'ATIVIDADE CHECKLIST',
            mecanico_executor: mec,
            funcao: (osGeral?.funcao || 'MECÂNICO').trim().toUpperCase(),
            setor,
            data_hora: it.created_at,
            data_hora_abertura: it.hora_inicio ? `${new Date(it.created_at).toISOString().slice(0, 10)}T${it.hora_inicio}` : it.created_at,
            data_hora_fechamento: it.hora_fim ? `${new Date(it.created_at).toISOString().slice(0, 10)}T${it.hora_fim}` : null,
            minutos_atividade: minutos,
            movimentacao: it.movimentacao as unknown as ControleHorasItem['movimentacao'],
          })

          movimentacoesComAtividades.add(it.movimentacao_id)
        }
      }

      // Para movimentações que NÃO tiveram atividades individuais com horário, adiciona a O.S para contabilizar o veículo atendendo, com 0 minutos
      for (const os of osList ?? []) {
        if (movimentacoesComAtividades.has(os.movimentacao_id)) continue

        const mec = (os.mecanico || '').trim().toUpperCase()
        if (!mec || mec === '—' || mec === '-' || mec === 'SEM NOME' || mec === 'OPCIONAL') {
          continue
        }

        const movOS = os.movimentacao as unknown as { patio?: { nome?: string } }
        const patioNome = movOS?.patio?.nome
        const setor = normalizarSetor(null, os.setor, patioNome)

        combinados.push({
          id: os.id,
          descricao: `O.S - ${os.status_os || 'MANUTENÇÃO GERAL'}`,
          mecanico_executor: mec,
          funcao: (os.funcao || 'MECÂNICO').trim().toUpperCase(),
          setor,
          data_hora: os.created_at,
          data_hora_abertura: os.created_at,
          data_hora_fechamento: null,
          minutos_atividade: 0,
          movimentacao: os.movimentacao as unknown as ControleHorasItem['movimentacao'],
        })
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
  }, [refetch])

  // Sincronização Realtime com as tabelas
  useEffect(() => {
    const channelName = `controle_horas_realtime_${Math.random().toString(36).slice(2, 8)}`
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checklist_itens' }, () => refetch())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checklist_os' }, () => refetch())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'movimentacao_historico' }, () => refetch())
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [refetch])

  return { itens, loading, error, refetch }
}

