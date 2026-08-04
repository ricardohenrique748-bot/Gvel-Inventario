import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Patio } from '@/lib/types'

export function usePatios() {
  const [patios, setPatios] = useState<Patio[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('patios').select('*').order('nome')
    setPatios(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { patios, loading, refetch }
}

export async function criarPatio(nome: string) {
  const { data, error } = await supabase.from('patios').insert({ nome }).select().single()
  if (error) throw error
  return data as Patio
}
