import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { VEICULO_COM_RELACOES } from '@/lib/queries'
import type { Inspecao, InspecaoItem, VeiculoComRelacoes } from '@/lib/types'

export interface LiberacaoComVeiculo extends Inspecao {
  veiculo: VeiculoComRelacoes | null
}

/** Liberações de veículo já finalizadas (inspecoes com modelo = 'liberacao'), mais recentes primeiro. */
export function useLiberacoes() {
  const [liberacoes, setLiberacoes] = useState<LiberacaoComVeiculo[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setErro(null)
    try {
      const { data, error } = await supabase
        .from('inspecoes')
        .select(`*, veiculo:veiculos(${VEICULO_COM_RELACOES})`)
        .eq('modelo', 'liberacao')
        .order('data_hora', { ascending: false })
        .limit(200)
      if (error) {
        console.error('[useLiberacoes]', error)
        setErro(error.message)
      }
      setLiberacoes((data as unknown as LiberacaoComVeiculo[]) ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { liberacoes, loading, erro, refetch }
}

export async function carregarItensInspecao(inspecaoId: string): Promise<InspecaoItem[]> {
  const { data, error } = await supabase.from('inspecao_itens').select('*').eq('inspecao_id', inspecaoId)
  if (error) throw error
  return (data as InspecaoItem[]) ?? []
}
