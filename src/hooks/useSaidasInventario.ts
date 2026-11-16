import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

/** Data da saída (ISO) das placas cuja ÚLTIMA movimentação no inventário é "saiu". */
export type SaidasPorPlaca = Map<string, string>

const normalizar = (placa: string) => placa.replace(/\s/g, '').toUpperCase()

/**
 * Consulta no inventário de caminhões a situação mais recente de cada placa.
 * Placa que está no pátio, ou que nunca entrou, não aparece no resultado.
 */
export function useSaidasInventario(placas: string[]) {
  const [saidas, setSaidas] = useState<SaidasPorPlaca>(new Map())
  const chave = Array.from(new Set(placas.map(normalizar))).sort().join(',')

  useEffect(() => {
    if (!chave) {
      setSaidas(new Map())
      return
    }
    let cancelado = false
    ;(async () => {
      const { data, error } = await supabase
        .from('movimentacoes')
        .select('status, data_hora_entrada, data_hora_saida, veiculo:veiculos!inner(placa)')
        .in('veiculo.placa', chave.split(','))
        .order('data_hora_entrada', { ascending: false })
      if (cancelado) return
      if (error) {
        console.error('[useSaidasInventario]', error)
        return
      }
      const resultado: SaidasPorPlaca = new Map()
      const vistas = new Set<string>()
      for (const m of (data ?? []) as unknown as {
        status: string
        data_hora_saida: string | null
        veiculo: { placa: string } | null
      }[]) {
        const placa = normalizar(m.veiculo?.placa ?? '')
        if (!placa || vistas.has(placa)) continue
        vistas.add(placa) // a primeira de cada placa é a mais recente
        if (m.status === 'saiu' && m.data_hora_saida) resultado.set(placa, m.data_hora_saida)
      }
      setSaidas(resultado)
    })()
    return () => {
      cancelado = true
    }
  }, [chave])

  return saidas
}

export { normalizar as normalizarPlaca }
