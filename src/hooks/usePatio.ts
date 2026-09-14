import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { up } from '@/lib/text'
import type { VeiculoCliente, EstadiaPatio } from '@/lib/types'

// ----------------------------------------------------
// Veículos por Cliente (cadastro leve pro Pátio)
// ----------------------------------------------------
function mapRowParaVeiculoCliente(row: any): VeiculoCliente {
  return {
    id: row.id,
    clienteId: row.cliente_id,
    clienteNome: row.cliente_nome || undefined,
    placa: row.placa,
    modelo: row.modelo || undefined,
    marca: row.marca || undefined,
    cor: row.cor || undefined,
  }
}

export function useVeiculosClientes(clienteId: string | undefined) {
  const [veiculos, setVeiculos] = useState<VeiculoCliente[]>([])
  const [loading, setLoading] = useState(false)

  const refetch = useCallback(async () => {
    if (!clienteId) {
      setVeiculos([])
      return
    }
    setLoading(true)
    const { data } = await supabase.from('veiculos_clientes').select('*').eq('cliente_id', clienteId).order('placa')
    setVeiculos((data || []).map(mapRowParaVeiculoCliente))
    setLoading(false)
  }, [clienteId])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { veiculos, loading, refetch }
}

export async function criarVeiculoCliente(
  clienteId: string,
  input: { placa: string; modelo?: string; marca?: string; cor?: string },
): Promise<VeiculoCliente> {
  const { data, error } = await supabase
    .from('veiculos_clientes')
    .insert({
      cliente_id: clienteId,
      placa: up(input.placa) || '',
      modelo: up(input.modelo) || null,
      marca: up(input.marca) || null,
      cor: up(input.cor) || null,
    })
    .select()
    .single()
  if (error) throw error
  return mapRowParaVeiculoCliente(data)
}

// ----------------------------------------------------
// Estadias no Pátio
// ----------------------------------------------------
function mapRowParaEstadia(row: any): EstadiaPatio {
  return {
    id: row.id,
    clienteId: row.cliente_id,
    clienteNome: row.cliente_nome || undefined,
    veiculoClienteId: row.veiculo_cliente_id || undefined,
    placa: row.placa,
    modelo: row.modelo || undefined,
    marca: row.marca || undefined,
    cor: row.cor || undefined,
    dataHoraEntrada: row.data_hora_entrada,
    previsaoSaida: row.previsao_saida || undefined,
    dataHoraSaidaReal: row.data_hora_saida_real || undefined,
    valorDiaria: Number(row.valor_diaria) || 0,
    centroCustoId: row.centro_custo_id,
    centroCustoNome: row.centro_custo_nome || undefined,
    observacoes: row.observacoes || undefined,
    createdAt: row.created_at,
  }
}

export async function fetchEstadiasPatioSupabase(limit = 1000): Promise<EstadiaPatio[]> {
  const { data, error } = await supabase
    .from('patio_estadias')
    .select('*')
    .order('data_hora_entrada', { ascending: false })
    .limit(limit)

  if (error) {
    console.warn('Erro ao buscar estadias do pátio no Supabase:', error)
    return []
  }
  return (data || []).map(mapRowParaEstadia)
}

export interface SalvarEstadiaPatioInput {
  clienteId: string
  clienteNome?: string
  veiculoClienteId?: string
  placa: string
  modelo?: string
  marca?: string
  cor?: string
  dataHoraEntrada: string
  previsaoSaida?: string | null
  dataHoraSaidaReal?: string | null
  valorDiaria: number
  centroCustoId: string
  centroCustoNome?: string
  observacoes?: string
}

function payloadDaEstadia(input: SalvarEstadiaPatioInput) {
  return {
    cliente_id: input.clienteId,
    cliente_nome: input.clienteNome || null,
    veiculo_cliente_id: input.veiculoClienteId || null,
    placa: input.placa,
    modelo: input.modelo || null,
    marca: input.marca || null,
    cor: input.cor || null,
    data_hora_entrada: input.dataHoraEntrada,
    previsao_saida: input.previsaoSaida || null,
    data_hora_saida_real: input.dataHoraSaidaReal || null,
    valor_diaria: input.valorDiaria,
    centro_custo_id: input.centroCustoId,
    centro_custo_nome: input.centroCustoNome || null,
    observacoes: input.observacoes || null,
  }
}

export async function criarEstadiaPatio(input: SalvarEstadiaPatioInput): Promise<EstadiaPatio> {
  const { data, error } = await supabase.from('patio_estadias').insert(payloadDaEstadia(input)).select().single()
  if (error) throw error
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('patio_estadia_updated'))
  return mapRowParaEstadia(data)
}

export async function atualizarEstadiaPatio(id: string, input: SalvarEstadiaPatioInput): Promise<EstadiaPatio> {
  const { data, error } = await supabase.from('patio_estadias').update(payloadDaEstadia(input)).eq('id', id).select().single()
  if (error) throw error
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('patio_estadia_updated'))
  return mapRowParaEstadia(data)
}

export async function finalizarEstadiaPatio(id: string, dataHoraSaidaReal: string): Promise<EstadiaPatio> {
  const { data, error } = await supabase
    .from('patio_estadias')
    .update({ data_hora_saida_real: dataHoraSaidaReal })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('patio_estadia_updated'))
  return mapRowParaEstadia(data)
}

export async function excluirEstadiaPatio(id: string): Promise<void> {
  const { error } = await supabase.from('patio_estadias').delete().eq('id', id)
  if (error) throw error
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('patio_estadia_updated'))
}

export function usePatioEstadias() {
  const [estadias, setEstadias] = useState<EstadiaPatio[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    try {
      const dados = await fetchEstadiasPatioSupabase()
      setEstadias(dados)
      setError(null)
    } catch (err) {
      console.warn('Falha ao buscar estadias do pátio:', err)
      setError(err instanceof Error ? err.message : 'Erro ao carregar o pátio.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refetch()
    const handleUpdate = () => refetch()
    window.addEventListener('patio_estadia_updated', handleUpdate)
    return () => window.removeEventListener('patio_estadia_updated', handleUpdate)
  }, [refetch])

  return { estadias, loading, error, refetch }
}
