import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { VEICULO_COM_RELACOES, MOVIMENTACAO_COM_VEICULO } from '@/lib/queries'
import { up } from '@/lib/text'
import type { VeiculoComRelacoes, MovimentacaoComVeiculo, TipoVeiculo } from '@/lib/types'

export function useVeiculoDetalhe(id: string | undefined) {
  const [veiculo, setVeiculo] = useState<VeiculoComRelacoes | null>(null)
  const [historico, setHistorico] = useState<MovimentacaoComVeiculo[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    if (!id) return
    setLoading(true)
    const [{ data: veiculoData }, { data: historicoData }] = await Promise.all([
      supabase.from('veiculos').select(VEICULO_COM_RELACOES).eq('id', id).single(),
      supabase
        .from('movimentacoes')
        .select(MOVIMENTACAO_COM_VEICULO)
        .eq('veiculo_id', id)
        .order('data_hora_entrada', { ascending: false }),
    ])
    setVeiculo((veiculoData as unknown as VeiculoComRelacoes) ?? null)
    setHistorico((historicoData as unknown as MovimentacaoComVeiculo[]) ?? [])
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
    const { data } = await supabase
      .from('veiculos')
      .select(VEICULO_COM_RELACOES)
      .eq('cliente_id', clienteId)
      .order('placa')
    setVeiculos((data as unknown as VeiculoComRelacoes[]) ?? [])
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
  const placa = input.placa.trim().toUpperCase()

  const { data: existente } = await supabase
    .from('veiculos')
    .select('id')
    .eq('placa', placa)
    .maybeSingle()

  if (existente) {
    const updatePayload: Record<string, unknown> = {
      marca_id: input.marcaId,
      modelo_id: input.modeloId,
      cliente_id: input.clienteId,
      tipo: input.tipo,
    }
    // Só sobrescreve cor/ano quando informados, para não apagar esses dados
    // ao atualizar o veículo por outros fluxos (ex.: Registrar entrada).
    if (input.cor !== undefined) updatePayload.cor = up(input.cor) || null
    if (input.ano !== undefined) updatePayload.ano = input.ano ?? null

    const { data, error } = await supabase
      .from('veiculos')
      .update(updatePayload)
      .eq('id', existente.id)
      .select()
      .single()
    if (error) throw error
    return data
  }

  const { data, error } = await supabase
    .from('veiculos')
    .insert({
      placa,
      marca_id: input.marcaId,
      modelo_id: input.modeloId,
      cliente_id: input.clienteId,
      tipo: input.tipo,
      cor: up(input.cor) || null,
      ano: input.ano ?? null,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function buscarVeiculoPorPlaca(placa: string) {
  const { data } = await supabase
    .from('veiculos')
    .select(VEICULO_COM_RELACOES)
    .eq('placa', placa.trim().toUpperCase())
    .maybeSingle()
  return (data as unknown as VeiculoComRelacoes) ?? null
}
