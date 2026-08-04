import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { MOVIMENTACAO_COM_VEICULO } from '@/lib/queries'
import { up } from '@/lib/text'
import type { MovimentacaoComVeiculo, StatusMovimentacao, TipoVeiculo } from '@/lib/types'
import { upsertVeiculo } from './useVeiculos'

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
    let query = supabase
      .from('movimentacoes')
      .select(MOVIMENTACAO_COM_VEICULO)
      .order('data_hora_entrada', { ascending: false })

    if (filters.status) query = query.eq('status', filters.status)
    if (filters.clienteId) query = query.eq('veiculo.cliente_id', filters.clienteId)
    if (filters.marcaId) query = query.eq('veiculo.marca_id', filters.marcaId)
    if (filters.modeloId) query = query.eq('veiculo.modelo_id', filters.modeloId)
    if (filters.patioId) query = query.eq('patio_id', filters.patioId)
    if (filters.dataInicio) query = query.gte('data_hora_entrada', filters.dataInicio)
    if (filters.dataFim) query = query.lte('data_hora_entrada', filters.dataFim)

    const { data, error } = await query
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    let result = (data as unknown as MovimentacaoComVeiculo[]) ?? []

    // Filtro de placa e por cliente/marca/modelo via join precisam de checagem
    // client-side extra pois o PostgREST não filtra por FK aninhada de forma confiável
    // em todas as versões — mantemos como camada de segurança.
    if (filters.search) {
      const term = filters.search.trim().toUpperCase()
      result = result.filter((m) => m.veiculo?.placa?.toUpperCase().includes(term))
    }
    if (filters.clienteId) {
      result = result.filter((m) => m.veiculo?.cliente_id === filters.clienteId)
    }
    if (filters.marcaId) {
      result = result.filter((m) => m.veiculo?.marca_id === filters.marcaId)
    }
    if (filters.modeloId) {
      result = result.filter((m) => m.veiculo?.modelo_id === filters.modeloId)
    }

    setMovimentacoes(result)
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
  const veiculoId =
    'veiculoId' in input
      ? input.veiculoId
      : (
          await upsertVeiculo({
            placa: input.placa,
            marcaId: input.marcaId,
            modeloId: input.modeloId,
            clienteId: input.clienteId,
            tipo: input.tipo,
            cor: input.cor,
            ano: input.ano,
          })
        ).id

  const { data, error } = await supabase
    .from('movimentacoes')
    .insert({
      veiculo_id: veiculoId,
      patio_id: input.patioId,
      status_id: input.statusId || null,
      motorista: up(input.motorista),
      data_hora_entrada: input.dataHoraEntrada,
      observacoes: up(input.observacoes),
      status: 'no_patio',
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function registrarSaida(movimentacaoId: string) {
  const { data, error } = await supabase
    .from('movimentacoes')
    .update({ data_hora_saida: new Date().toISOString(), status: 'saiu' })
    .eq('id', movimentacaoId)
    .select()
    .single()
  if (error) throw error
  return data
}
