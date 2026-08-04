import { useCallback, useEffect, useState } from 'react'
import { apiGet, apiPatch, apiPost } from '@/lib/api'
import type { Movimentacao, MovimentacaoComVeiculo, StatusMovimentacao, TipoVeiculo } from '@/lib/types'

export interface MovimentacoesFilters {
  search?: string
  marcaId?: string
  modeloId?: string
  clienteId?: string
  patioId?: string
  status?: StatusMovimentacao
  dataInicio?: string
  dataFim?: string
}

export function useMovimentacoes(filters: MovimentacoesFilters = {}) {
  const [movimentacoes, setMovimentacoes] = useState<MovimentacaoComVeiculo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filters.status) params.set('status', filters.status)
    if (filters.clienteId) params.set('clienteId', filters.clienteId)
    if (filters.marcaId) params.set('marcaId', filters.marcaId)
    if (filters.modeloId) params.set('modeloId', filters.modeloId)
    if (filters.patioId) params.set('patioId', filters.patioId)
    if (filters.dataInicio) params.set('dataInicio', filters.dataInicio)
    if (filters.dataFim) params.set('dataFim', filters.dataFim)
    if (filters.search) params.set('search', filters.search.trim())

    const { data, error } = await apiGet<MovimentacaoComVeiculo[]>(`/movimentacoes?${params}`)
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    setMovimentacoes(data ?? [])
    setLoading(false)
  }, [
    filters.search,
    filters.marcaId,
    filters.modeloId,
    filters.clienteId,
    filters.patioId,
    filters.status,
    filters.dataInicio,
    filters.dataFim,
  ])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { movimentacoes, loading, error, refetch }
}

interface RegistrarEntradaComum {
  patioId: string
  statusId?: string
  motorista?: string
  dataHoraEntrada: string
  observacoes?: string
}

type RegistrarEntradaInput =
  | (RegistrarEntradaComum & { veiculoId: string })
  | (RegistrarEntradaComum & {
      placa: string
      marcaId: string
      modeloId: string
      clienteId: string
      tipo: TipoVeiculo
      cor: string
      ano: number
    })

export async function registrarEntrada(input: RegistrarEntradaInput) {
  const { data, error } = await apiPost<Movimentacao>('/movimentacoes/entrada', input)
  if (error || !data) throw new Error(error?.message ?? 'Erro ao registrar entrada.')
  return data
}

export async function registrarSaida(movimentacaoId: string) {
  const { data, error } = await apiPatch<Movimentacao>(`/movimentacoes/${movimentacaoId}/saida`)
  if (error || !data) throw new Error(error?.message ?? 'Erro ao registrar saída.')
  return data
}
