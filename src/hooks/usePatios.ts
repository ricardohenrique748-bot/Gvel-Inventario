import { useCallback, useEffect, useState } from 'react'
import { apiGet, apiPost } from '@/lib/api'
import type { Patio } from '@/lib/types'

export function usePatios() {
  const [patios, setPatios] = useState<Patio[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    setLoading(true)
    const { data } = await apiGet<Patio[]>('/patios')
    setPatios(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { patios, loading, refetch }
}

export async function criarPatio(nome: string) {
  const { data, error } = await apiPost<Patio>('/patios', { nome })
  if (error) throw new Error(error.message)
  return data as Patio
}
