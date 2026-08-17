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

const SETORES_MANUTENCAO = [
  'MECÂNICA',
  'ELÉTRICA',
  'FUNILARIA',
  'PINTURA',
  'ESTÉTICA',
  'MANUTENÇÃO',
  'OFICINA PESADA',
  'OFICINA LEVES',
]

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
      .eq('os_criada', true)
      .order('data_hora', { ascending: false })

    if (error) {
      setError(error.message)
    } else {
      // Conectado estritamente e exclusivamente ao módulo de Manutenção e Checklist
      const registros = (data as unknown as ControleHorasItem[]) ?? []
      const apenasManutencao = registros.filter((item) => {
        const descUpper = (item.descricao || '').toUpperCase()
        const setorUpper = (item.setor || '').toUpperCase()

        return (
          descUpper.includes('CHECKLIST') ||
          descUpper.includes('MANUTENÇÃO') ||
          descUpper.includes('INSPEÇÃO') ||
          SETORES_MANUTENCAO.includes(setorUpper) ||
          Boolean(item.movimentacao?.status_manutencao)
        )
      })

      setItens(apenasManutencao)
      setError(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { itens, loading, error, refetch }
}
