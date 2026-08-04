import { useCallback, useEffect, useState } from 'react'
import { apiGet, apiPost } from '@/lib/api'
import type { StatusManutencao } from '@/lib/types'

export function useStatusManutencao() {
  const [statusManutencao, setStatusManutencao] = useState<StatusManutencao[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    setLoading(true)
    const { data } = await apiGet<StatusManutencao[]>('/status-manutencao')
    setStatusManutencao(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { statusManutencao, loading, refetch }
}

export async function criarStatusManutencao(nome: string) {
  const { data, error } = await apiPost<StatusManutencao>('/status-manutencao', { nome })
  if (error) throw new Error(error.message)
  return data as StatusManutencao
}
