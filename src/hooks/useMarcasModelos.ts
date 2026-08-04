import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Marca, Modelo } from '@/lib/types'

export function useMarcas() {
  const [marcas, setMarcas] = useState<Marca[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('marcas').select('*').order('nome')
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
    const { data } = await supabase.from('modelos').select('*').eq('marca_id', marcaId).order('nome')
    setModelos(data ?? [])
    setLoading(false)
  }, [marcaId])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { modelos, loading, refetch }
}

export async function criarMarca(nome: string) {
  const { data, error } = await supabase.from('marcas').insert({ nome }).select().single()
  if (error) throw error
  return data as Marca
}

export async function criarModelo(marcaId: string, nome: string) {
  const { data, error } = await supabase
    .from('modelos')
    .insert({ marca_id: marcaId, nome })
    .select()
    .single()
  if (error) throw error
  return data as Modelo
}
