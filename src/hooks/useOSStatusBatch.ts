/**
 * useOSStatusBatch
 * Busca o status de O.S e TODOS os mecânicos apontados (tanto o principal quanto os das atividades),
 * direto do Supabase com Realtime.
 */
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatarNomeSobrenome, obterNomeCompletoMembro } from '@/constants/equipe'

export interface OSStatusItem {
  iniciada: boolean
  mecanico: string | null
  mecanicos: string[]
  statusOS: string | null
  dataHoraAbertura: string | null
  fechada: boolean
}

const VAZIO: OSStatusItem = {
  iniciada: false,
  mecanico: null,
  mecanicos: [],
  statusOS: null,
  dataHoraAbertura: null,
  fechada: false,
}

export function useOSStatusBatch(movimentacaoIds: string[]) {
  const [statusMap, setStatusMap] = useState<Record<string, OSStatusItem>>({})

  const fetch = useCallback(async () => {
    if (movimentacaoIds.length === 0) {
      setStatusMap({})
      return
    }

    try {
      const [resOS, resItens] = await Promise.all([
        supabase
          .from('checklist_os')
          .select('movimentacao_id, mecanico, status_os, data_hora_abertura, data_hora_fechamento')
          .in('movimentacao_id', movimentacaoIds),
        supabase
          .from('checklist_itens')
          .select('movimentacao_id, mecanico')
          .in('movimentacao_id', movimentacaoIds),
      ])

      const dataOS = resOS.data
      const dataItens = resItens.data

      const next: Record<string, OSStatusItem> = {}

      for (const id of movimentacaoIds) {
        const row = dataOS?.find((r) => r.movimentacao_id === id)
        const itensDaMov = dataItens?.filter((it) => it.movimentacao_id === id) || []

        const setMecanicos = new Set<string>()
        const INVALIDOS = ['', '—', '-', 'SEM NOME', 'OPCIONAL']

        if (row?.mecanico) {
          const mecPrincipal = row.mecanico.trim().toUpperCase()
          if (!INVALIDOS.includes(mecPrincipal)) {
            setMecanicos.add(obterNomeCompletoMembro(mecPrincipal))
          }
        }

        itensDaMov.forEach((it) => {
          if (it.mecanico) {
            const mecItem = it.mecanico.trim().toUpperCase()
            if (!INVALIDOS.includes(mecItem)) {
              setMecanicos.add(obterNomeCompletoMembro(mecItem))
            }
          }
        })

        // Fallback localStorage caso o banco ainda não tenha sincronizado
        try {
          const infoRaw = localStorage.getItem(`checklist_info_${id}`)
          if (infoRaw) {
            const parsed = JSON.parse(infoRaw)
            if (parsed.mecanico) {
              const mec = parsed.mecanico.trim().toUpperCase()
              if (!INVALIDOS.includes(mec)) {
                setMecanicos.add(obterNomeCompletoMembro(mec))
              }
            }
          }

          const itensRaw = localStorage.getItem(`checklist_${id}`)
          if (itensRaw) {
            const parsedItens = JSON.parse(itensRaw)
            if (typeof parsedItens === 'object') {
              Object.values(parsedItens).forEach((it: any) => {
                if (it?.mecanico) {
                  const mec = String(it.mecanico).trim().toUpperCase()
                  if (!INVALIDOS.includes(mec)) {
                    setMecanicos.add(obterNomeCompletoMembro(mec))
                  }
                }
              })
            }
          }
        } catch {
          // ignore
        }

        const listaMecanicos = Array.from(setMecanicos)
        const iniciada = listaMecanicos.length > 0 || Boolean(row?.data_hora_abertura)

        // Formata os nomes para exibição compacta e legível
        const textoMecanicos = listaMecanicos
          .map((nome) => formatarNomeSobrenome(nome).toUpperCase())
          .join(' · ')

        if (row || listaMecanicos.length > 0) {
          next[id] = {
            iniciada,
            mecanico: textoMecanicos || (row?.mecanico?.trim().toUpperCase() ?? null),
            mecanicos: listaMecanicos,
            statusOS: row?.status_os || 'EM ANDAMENTO',
            dataHoraAbertura: row?.data_hora_abertura ?? null,
            fechada: Boolean(row?.data_hora_fechamento),
          }
        } else {
          next[id] = VAZIO
        }
      }

      setStatusMap(next)
    } catch (err) {
      console.error('Erro no useOSStatusBatch:', err)
    }
  }, [movimentacaoIds.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetch()
  }, [fetch])

  // Realtime: qualquer mudança em checklist_os ou checklist_itens dispara refetch
  useEffect(() => {
    if (movimentacaoIds.length === 0) return
    const channel = supabase
      .channel('os_status_batch_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checklist_os' }, () => fetch())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checklist_itens' }, () => fetch())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetch, movimentacaoIds.length])

  function getStatus(movId: string): OSStatusItem {
    return statusMap[movId] ?? VAZIO
  }

  return { statusMap, getStatus }
}
