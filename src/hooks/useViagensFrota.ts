import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { RegistroViagem, StatusViagem, FormaCalculoFrete, TipoFrete, VeiculoCarregado } from '@/lib/types'

function mapRowParaViagem(row: any): RegistroViagem {
  return {
    id: row.id,
    clienteId: row.cliente_id || undefined,
    clienteNome: row.cliente_nome || undefined,
    veiculoId: row.veiculo_id || undefined,
    placa: row.placa,
    veiculoNome: row.veiculo_nome || undefined,
    motoristaNome: row.motorista_nome,
    centroCustoId: row.centro_custo_id || undefined,
    centroCustoNome: row.centro_custo_nome || undefined,
    transportadoraId: row.transportadora_id || undefined,
    transportadoraNome: row.transportadora_nome || undefined,
    origem: row.origem || '',
    destino: row.destino || '',
    enderecoOrigem: row.endereco_origem || undefined,
    cidadeOrigem: row.cidade_origem || undefined,
    ufOrigem: row.uf_origem || undefined,
    dataColetaPrevista: row.data_coleta_prevista || undefined,
    enderecoDestino: row.endereco_destino || undefined,
    cidadeDestino: row.cidade_destino || undefined,
    ufDestino: row.uf_destino || undefined,
    dataEntregaPrevista: row.data_entrega_prevista || undefined,
    distanciaEstimadaKm: row.distancia_estimada_km != null ? Number(row.distancia_estimada_km) : undefined,
    tempoEstimadoHoras: row.tempo_estimado_horas != null ? Number(row.tempo_estimado_horas) : undefined,
    tipoCargaId: row.tipo_carga_id || undefined,
    tipoCargaNome: row.tipo_carga_nome || undefined,
    veiculosCarregados: Array.isArray(row.veiculos_carregados) ? (row.veiculos_carregados as VeiculoCarregado[]) : [],
    pesoCargaToneladas: row.peso_carga_toneladas != null ? Number(row.peso_carga_toneladas) : undefined,
    volumeM3: row.volume_m3 != null ? Number(row.volume_m3) : undefined,
    formaCalculoFrete: row.forma_calculo_frete || undefined,
    freteBruto: row.frete_bruto != null ? Number(row.frete_bruto) : undefined,
    despesasAbater: row.despesas_abater != null ? Number(row.despesas_abater) : undefined,
    adiantamento: row.adiantamento != null ? Number(row.adiantamento) : undefined,
    tipoFrete: row.tipo_frete || undefined,
    percentualImposto: row.percentual_imposto != null ? Number(row.percentual_imposto) : undefined,
    pessoaImposto: row.pessoa_imposto || undefined,
    percentualComissao: row.percentual_comissao != null ? Number(row.percentual_comissao) : undefined,
    pessoaComissao: row.pessoa_comissao || undefined,
    custoOperacional: row.custo_operacional != null ? Number(row.custo_operacional) : undefined,
    dataHoraSaida: row.data_hora_saida,
    dataHoraChegada: row.data_hora_chegada || undefined,
    kmSaida: row.km_saida ?? undefined,
    kmChegada: row.km_chegada ?? undefined,
    status: (row.status || 'cotada') as StatusViagem,
    finalidade: row.finalidade || undefined,
    observacoes: row.observacoes || undefined,
    createdAt: row.created_at,
  }
}

export async function fetchViagensFrotaSupabase(limit = 1000): Promise<RegistroViagem[]> {
  const { data, error } = await supabase
    .from('viagens_frota')
    .select('*')
    .order('data_hora_saida', { ascending: false })
    .limit(limit)

  if (error) {
    console.warn('Erro ao buscar viagens da frota no Supabase:', error)
    return []
  }
  return (data || []).map(mapRowParaViagem)
}

export interface SalvarViagemInput {
  // Participantes
  clienteId?: string
  clienteNome?: string
  veiculoId?: string
  placa: string
  veiculoNome?: string
  motoristaNome: string
  centroCustoId?: string
  centroCustoNome?: string
  transportadoraId?: string
  transportadoraNome?: string
  // Rota
  origem: string
  destino: string
  enderecoOrigem?: string
  cidadeOrigem?: string
  ufOrigem?: string
  dataColetaPrevista?: string | null
  enderecoDestino?: string
  cidadeDestino?: string
  ufDestino?: string
  dataEntregaPrevista?: string | null
  distanciaEstimadaKm?: number | null
  tempoEstimadoHoras?: number | null
  // Carga
  tipoCargaId?: string
  tipoCargaNome?: string
  veiculosCarregados?: VeiculoCarregado[]
  pesoCargaToneladas?: number | null
  volumeM3?: number | null
  // Financeiro
  formaCalculoFrete?: FormaCalculoFrete
  freteBruto?: number | null
  despesasAbater?: number | null
  adiantamento?: number | null
  tipoFrete?: TipoFrete
  percentualImposto?: number | null
  pessoaImposto?: string
  percentualComissao?: number | null
  pessoaComissao?: string
  custoOperacional?: number | null
  // Legado / status
  dataHoraSaida: string
  dataHoraChegada?: string | null
  kmSaida?: number | null
  kmChegada?: number | null
  status: StatusViagem
  finalidade?: string
  observacoes?: string
}

function payloadDaViagem(input: SalvarViagemInput) {
  return {
    cliente_id: input.clienteId || null,
    cliente_nome: input.clienteNome || null,
    veiculo_id: input.veiculoId || null,
    placa: input.placa,
    veiculo_nome: input.veiculoNome || null,
    motorista_nome: input.motoristaNome,
    centro_custo_id: input.centroCustoId || null,
    centro_custo_nome: input.centroCustoNome || null,
    transportadora_id: input.transportadoraId || null,
    transportadora_nome: input.transportadoraNome || null,
    origem: input.origem,
    destino: input.destino,
    endereco_origem: input.enderecoOrigem || null,
    cidade_origem: input.cidadeOrigem || null,
    uf_origem: input.ufOrigem || null,
    data_coleta_prevista: input.dataColetaPrevista || null,
    endereco_destino: input.enderecoDestino || null,
    cidade_destino: input.cidadeDestino || null,
    uf_destino: input.ufDestino || null,
    data_entrega_prevista: input.dataEntregaPrevista || null,
    distancia_estimada_km: input.distanciaEstimadaKm ?? null,
    tempo_estimado_horas: input.tempoEstimadoHoras ?? null,
    tipo_carga_id: input.tipoCargaId || null,
    tipo_carga_nome: input.tipoCargaNome || null,
    veiculos_carregados: input.veiculosCarregados || [],
    peso_carga_toneladas: input.pesoCargaToneladas ?? null,
    volume_m3: input.volumeM3 ?? null,
    forma_calculo_frete: input.formaCalculoFrete || null,
    frete_bruto: input.freteBruto ?? null,
    despesas_abater: input.despesasAbater ?? null,
    adiantamento: input.adiantamento ?? null,
    tipo_frete: input.tipoFrete || null,
    percentual_imposto: input.percentualImposto ?? null,
    pessoa_imposto: input.pessoaImposto || null,
    percentual_comissao: input.percentualComissao ?? null,
    pessoa_comissao: input.pessoaComissao || null,
    custo_operacional: input.custoOperacional ?? null,
    data_hora_saida: input.dataHoraSaida,
    data_hora_chegada: input.dataHoraChegada || null,
    km_saida: input.kmSaida ?? null,
    km_chegada: input.kmChegada ?? null,
    status: input.status,
    finalidade: input.finalidade || null,
    observacoes: input.observacoes || null,
  }
}

export async function criarViagemFrota(input: SalvarViagemInput): Promise<RegistroViagem> {
  const { data, error } = await supabase.from('viagens_frota').insert(payloadDaViagem(input)).select().single()
  if (error) throw error

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('viagem_frota_updated'))
  }
  return mapRowParaViagem(data)
}

export async function atualizarViagemFrota(id: string, input: SalvarViagemInput): Promise<RegistroViagem> {
  const { data, error } = await supabase.from('viagens_frota').update(payloadDaViagem(input)).eq('id', id).select().single()
  if (error) throw error

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('viagem_frota_updated'))
  }
  return mapRowParaViagem(data)
}

export async function excluirViagemFrota(id: string): Promise<void> {
  const { error } = await supabase.from('viagens_frota').delete().eq('id', id)
  if (error) throw error
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('viagem_frota_updated'))
  }
}

export function useViagensFrota() {
  const [viagens, setViagens] = useState<RegistroViagem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    try {
      const dados = await fetchViagensFrotaSupabase()
      setViagens(dados)
      setError(null)
    } catch (err) {
      console.warn('Falha ao buscar viagens da frota:', err)
      setError(err instanceof Error ? err.message : 'Erro ao carregar viagens.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refetch()
    const handleUpdate = () => refetch()
    window.addEventListener('viagem_frota_updated', handleUpdate)
    return () => window.removeEventListener('viagem_frota_updated', handleUpdate)
  }, [refetch])

  return { viagens, loading, error, refetch }
}
