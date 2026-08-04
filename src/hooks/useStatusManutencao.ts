import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { up } from '@/lib/text'
import type { StatusManutencao } from '@/lib/types'

export function useStatusManutencao() {
  const [statusManutencao, setStatusManutencao] = useState<StatusManutencao[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('status_manutencao').select('*').order('nome')
    setStatusManutencao(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { statusManutencao, loading, refetch }
}

export async function criarStatusManutencao(nome: string) {
  const { data, error } = await supabase.from('status_manutencao').insert({ nome: up(nome) }).select().single()
  if (error) throw error
  return data as StatusManutencao
}
