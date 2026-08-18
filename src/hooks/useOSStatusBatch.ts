/**
 * useOSStatusBatch
 * Busca o status de O.S (aberta / finalizada / aguardando) de todas as
 * movimentações de uma vez só, direto do Supabase, com Realtime.
 *
 * Substitui a leitura de `checklist_info_${movId}` do localStorage usada
 * em Manutencao.tsx, permitindo que o status reflita dados do APK em tempo real.
 */
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface OSStatusItem {
  iniciada: boolean
  mecanico: string | null
  dataHoraAbertura: string | null
  fechada: boolean
}

const VAZIO: OSStatusItem = { iniciada: false, mecanico: null, dataHoraAbertura: null, fechada: false }

export function useOSStatusBatch(movimentacaoIds: string[]) {
  const [statusMap, setStatusMap] = useState<Record<string, OSStatusItem>>({})

  const fetch = useCallback(async () => {
    if (movimentacaoIds.length === 0) {
      setStatusMap({})
      return
    }

    const { data } = await supabase
      .from('checklist_os')
      .select('movimentacao_id, mecanico, data_hora_abertura, data_hora_fechamento')
      .in('movimentacao_id', movimentacaoIds)

    const next: Record<string, OSStatusItem> = {}

    for (const id of movimentacaoIds) {
      // Fallback: ainda lê localStorage caso o banco ainda não tenha o registro
      // (período de transição — dados antigos ainda no dispositivo)
      const row = data?.find((r) => r.movimentacao_id === id)

      if (row) {
        const mec = (row.mecanico || '').trim().toUpperCase()
        const INVALIDOS = ['', '—', '-', 'SEM NOME', 'OPCIONAL']
        const iniciada = mec.length > 0 && !INVALIDOS.includes(mec)
        next[id] = {
          iniciada,
          mecanico: iniciada ? mec : null,
          dataHoraAbertura: row.data_hora_abertura ?? null,
          fechada: Boolean(row.data_hora_fechamento),
        }
      } else {
        // Fallback localStorage durante a transição
        try {
          const info = localStorage.getItem(`checklist_info_${id}`)
          if (info) {
            const parsed = JSON.parse(info)
            const mec = (parsed.mecanico || '').trim().toUpperCase()
            const INVALIDOS = ['', '—', '-', 'SEM NOME', 'OPCIONAL']
            const iniciada = mec.length > 0 && !INVALIDOS.includes(mec)
            next[id] = {
              iniciada,
              mecanico: iniciada ? mec : null,
              dataHoraAbertura: parsed.dataHoraAbertura || null,
              fechada: Boolean(parsed.dataHoraFechamento),
            }
          } else {
            next[id] = VAZIO
          }
        } catch {
          next[id] = VAZIO
        }
      }
    }

    setStatusMap(next)
  }, [movimentacaoIds.join(',')])  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetch()
  }, [fetch])

  // Realtime: qualquer mudança em checklist_os dispara refetch
  useEffect(() => {
    if (movimentacaoIds.length === 0) return
    const channel = supabase
      .channel('os_status_batch')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checklist_os' }, () => fetch())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetch, movimentacaoIds.length])

  function getStatus(movId: string): OSStatusItem {
    return statusMap[movId] ?? VAZIO
  }

  return { statusMap, getStatus }
}
