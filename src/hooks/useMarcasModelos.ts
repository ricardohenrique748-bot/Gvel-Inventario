import { useCallback, useEffect, useState } from 'react'
import { apiGet, apiPost } from '@/lib/api'
import type { Marca, Modelo } from '@/lib/types'

export function useMarcas() {
  const [marcas, setMarcas] = useState<Marca[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    setLoading(true)
    const { data } = await apiGet<Marca[]>('/marcas')
    setMarcas(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { marcas, loading, refetch }
}

export function useModelos(marcaId: string | undefined) {
  const [modelos, setModelos] = useState<Modelo[]>([])
  const [loading, setLoading] = useState(false)

  const refetch = useCallback(async () => {
    if (!marcaId) {
      setModelos([])
      return
    }
    setLoading(true)
    const { data } = await apiGet<Modelo[]>(`/modelos?marcaId=${encodeURIComponent(marcaId)}`)
    setModelos(data ?? [])
    setLoading(false)
  }, [marcaId])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { modelos, loading, refetch }
}

export async function criarMarca(nome: string) {
  const { data, error } = await apiPost<Marca>('/marcas', { nome })
  if (error) throw new Error(error.message)
  return data as Marca
}

export async function criarModelo(marcaId: string, nome: string) {
  const { data, error } = await apiPost<Modelo>('/modelos', { marcaId, nome })
  if (error) throw new Error(error.message)
  return data as Modelo
}
