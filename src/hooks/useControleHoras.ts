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

const ETAPAS_IGNORADAS = [
  'ABERTURA DE O.S',
  'ABERTURA DE OS',
  'ABERTURA O.S',
  'ABERTURA OS',
  'OFICINA PESADOS',
  'OFICINA PESADA',
  'OFICINA LEVES',
  'OFICINA LEVE',
  'ENTRADA',
  'SAÍDA',
  'NO PÁTIO',
  'PÁTIO',
  'TRAJETO',
  'LAVAGEM',
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
      // Conectado estritamente e exclusivamente às atividades reais do módulo de Manutenção e Checklist
      const registros = (data as unknown as ControleHorasItem[]) ?? []
      const apenasManutencaoReal = registros.filter((item) => {
        const descUpper = (item.descricao || '').trim().toUpperCase()
        const mecUpper = (item.mecanico_executor || '').trim().toUpperCase()

        // 1. Deve possuir um mecânico executor preenchido
        if (!mecUpper || mecUpper === '—' || mecUpper === '-' || mecUpper === 'SEM NOME') {
          return false
        }

        // 2. Não pode ser etapa genérica de movimentação, pátio ou abertura simples de OS
        if (ETAPAS_IGNORADAS.includes(descUpper)) {
          return false
        }

        return true
      })

      setItens(apenasManutencaoReal)
      setError(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { itens, loading, error, refetch }
}
