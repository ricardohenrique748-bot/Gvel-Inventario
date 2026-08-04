import { useCallback, useEffect, useState } from 'react'
import { apiGet, apiPost } from '@/lib/api'
import type { VeiculoComRelacoes, MovimentacaoComVeiculo, TipoVeiculo } from '@/lib/types'

export function useVeiculoDetalhe(id: string | undefined) {
  const [veiculo, setVeiculo] = useState<VeiculoComRelacoes | null>(null)
  const [historico, setHistorico] = useState<MovimentacaoComVeiculo[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    if (!id) return
    setLoading(true)
    const [{ data: veiculoData }, { data: historicoData }] = await Promise.all([
      apiGet<VeiculoComRelacoes>(`/veiculos/${id}`),
      apiGet<MovimentacaoComVeiculo[]>(`/veiculos/${id}/historico`),
    ])
    setVeiculo(veiculoData ?? null)
    setHistorico(historicoData ?? [])
    setLoading(false)
  }, [id])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { veiculo, historico, loading, refetch }
}

export function useVeiculosPorCliente(clienteId: string | undefined) {
  const [veiculos, setVeiculos] = useState<VeiculoComRelacoes[]>([])
  const [loading, setLoading] = useState(false)

  const refetch = useCallback(async () => {
    if (!clienteId) {
      setVeiculos([])
      return
    }
    setLoading(true)
    const { data } = await apiGet<VeiculoComRelacoes[]>(
      `/veiculos?clienteId=${encodeURIComponent(clienteId)}`,
    )
    setVeiculos(data ?? [])
    setLoading(false)
  }, [clienteId])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { veiculos, loading, refetch }
}

interface UpsertVeiculoInput {
  placa: string
  marcaId: string
  modeloId: string
  clienteId: string
  tipo: TipoVeiculo
  cor?: string
  ano?: number
}

export async function upsertVeiculo(input: UpsertVeiculoInput) {
  const { data, error } = await apiPost<VeiculoComRelacoes>('/veiculos/upsert', input)
  if (error) throw new Error(error.message)
  return data as VeiculoComRelacoes
}

export async function buscarVeiculoPorPlaca(placa: string) {
  const { data } = await apiGet<VeiculoComRelacoes | null>(
    `/veiculos/por-placa/${encodeURIComponent(placa.trim().toUpperCase())}`,
  )
  return data ?? null
}
