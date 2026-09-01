import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { up } from '@/lib/text'
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
  const { data, error } = await supabase.from('patios').insert({ nome: up(nome) }).select().single()
  if (error) throw error
  return data as Patio
}

export async function renomearPatio(id: string, nome: string) {
  const { error } = await supabase.from('patios').update({ nome: up(nome) }).eq('id', id)
  if (error) throw new Error(error.message)
}

/**
 * Mescla um pátio duplicado (origem) em outro (destino): move todas as
 * movimentações que apontavam pro pátio de origem para o de destino e
 * remove o registro de origem. Usado pra corrigir pátios criados por engano
 * com nome quase igual (typo, plural, espaço extra) via "+ Criar novo setor".
 */
export async function mesclarPatios(origemId: string, destinoId: string) {
  if (origemId === destinoId) throw new Error('Selecione um pátio de destino diferente do de origem.')
  const { error: errMov } = await supabase.from('movimentacoes').update({ patio_id: destinoId }).eq('patio_id', origemId)
  if (errMov) throw new Error(errMov.message)
  const { error: errDel } = await supabase.from('patios').delete().eq('id', origemId)
  if (errDel) throw new Error(errDel.message)
}

export async function excluirPatio(id: string) {
  const { error } = await supabase.from('patios').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
