import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface ControleHorasItem {
  id: string
  descricao: string
  mecanico_executor: string | null
  funcao: string | null
  setor: string | null
  data_hora: string
  data_hora_abertura: string | null
  data_hora_fechamento: string | null
  movimentacao: {
    veiculo: { placa: string } | null
    status_manutencao: { nome: string } | null
  } | null
}

export function useControleHoras() {
  const [itens, setItens] = useState<ControleHorasItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('movimentacao_historico')
      .select(
        '*, movimentacao:movimentacoes(veiculo:veiculos(placa), status_manutencao:status_manutencao(nome))',
      )
      .or('os_criada.eq.true,data_hora_fechamento.not.is.null')
      .order('data_hora', { ascending: false })

    if (error) {
      setError(error.message)
    } else {
      setItens((data as unknown as ControleHorasItem[]) ?? [])
      setError(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { itens, loading, error, refetch }
}
