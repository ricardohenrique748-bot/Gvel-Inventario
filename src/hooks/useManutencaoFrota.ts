import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type {
  OrdemServico,
  TipoOrdemServico,
  StatusOrdemServico,
  PrioridadeOrdemServico,
  Abastecimento,
  OrigemAbastecimento,
  LeituraOdometro,
} from '@/lib/types'

// ----------------------------------------------------
// Ordens de Serviço
// ----------------------------------------------------
function mapRowParaOS(row: any): OrdemServico {
  return {
    id: row.id,
    veiculoId: row.veiculo_id,
    placa: row.placa,
    veiculoNome: row.veiculo_nome || undefined,
    centroCustoId: row.centro_custo_id,
    centroCustoNome: row.centro_custo_nome || undefined,
    tipo: row.tipo,
    status: row.status,
    prioridade: row.prioridade,
    dataEntrada: row.data_entrada || undefined,
    dataConclusao: row.data_conclusao || undefined,
    descricaoServico: row.descricao_servico,
    oficina: row.oficina,
    kmEntrada: row.km_entrada != null ? Number(row.km_entrada) : undefined,
    valor: Number(row.valor) || 0,
    fornecedorId: row.fornecedor_id || undefined,
    fornecedorNome: row.fornecedor_nome || undefined,
    observacoes: row.observacoes || undefined,
    createdAt: row.created_at,
  }
}

export interface SalvarOSInput {
  veiculoId: string
  placa: string
  veiculoNome?: string
  centroCustoId: string
  centroCustoNome?: string
  tipo: TipoOrdemServico
  status: StatusOrdemServico
  prioridade: PrioridadeOrdemServico
  dataEntrada?: string | null
  dataConclusao?: string | null
  descricaoServico: string
  oficina: string
  kmEntrada?: number | null
  valor: number
  fornecedorId?: string
  fornecedorNome?: string
  observacoes?: string
}

function payloadDaOS(input: SalvarOSInput) {
  return {
    veiculo_id: input.veiculoId,
    placa: input.placa,
    veiculo_nome: input.veiculoNome || null,
    centro_custo_id: input.centroCustoId,
    centro_custo_nome: input.centroCustoNome || null,
    tipo: input.tipo,
    status: input.status,
    prioridade: input.prioridade,
    data_entrada: input.dataEntrada || null,
    data_conclusao: input.dataConclusao || null,
    descricao_servico: input.descricaoServico,
    oficina: input.oficina,
    km_entrada: input.kmEntrada ?? null,
    valor: input.valor,
    fornecedor_id: input.fornecedorId || null,
    fornecedor_nome: input.fornecedorNome || null,
    observacoes: input.observacoes || null,
  }
}

export async function fetchOrdensServicoSupabase(limit = 1000): Promise<OrdemServico[]> {
  const { data, error } = await supabase.from('ordens_servico').select('*').order('created_at', { ascending: false }).limit(limit)
  if (error) {
    console.warn('Erro ao buscar ordens de serviço no Supabase:', error)
    return []
  }
  return (data || []).map(mapRowParaOS)
}

export async function criarOS(input: SalvarOSInput): Promise<OrdemServico> {
  const { data, error } = await supabase.from('ordens_servico').insert(payloadDaOS(input)).select().single()
  if (error) throw error
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('manutencao_os_updated'))
  return mapRowParaOS(data)
}

export async function atualizarOS(id: string, input: SalvarOSInput): Promise<OrdemServico> {
  const { data, error } = await supabase.from('ordens_servico').update(payloadDaOS(input)).eq('id', id).select().single()
  if (error) throw error
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('manutencao_os_updated'))
  return mapRowParaOS(data)
}

export async function excluirOS(id: string): Promise<void> {
  const { error } = await supabase.from('ordens_servico').delete().eq('id', id)
  if (error) throw error
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('manutencao_os_updated'))
}

export function useOrdensServico() {
  const [ordens, setOrdens] = useState<OrdemServico[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    setLoading(true)
    setOrdens(await fetchOrdensServicoSupabase())
    setLoading(false)
  }, [])

  useEffect(() => {
    refetch()
    const handleUpdate = () => refetch()
    window.addEventListener('manutencao_os_updated', handleUpdate)
    return () => window.removeEventListener('manutencao_os_updated', handleUpdate)
  }, [refetch])

  return { ordens, loading, refetch }
}

// ----------------------------------------------------
// Leituras de Odômetro
// ----------------------------------------------------
function mapRowParaLeitura(row: any): LeituraOdometro {
  return {
    id: row.id,
    veiculoId: row.veiculo_id,
    placa: row.placa,
    dataLeitura: row.data_leitura,
    quilometragem: Number(row.quilometragem) || 0,
    horasMotor: row.horas_motor != null ? Number(row.horas_motor) : undefined,
    origem: row.origem,
    validada: row.validada,
    justificativa: row.justificativa || undefined,
    createdAt: row.created_at,
  }
}

export interface SalvarLeituraInput {
  veiculoId: string
  placa: string
  dataLeitura: string
  quilometragem: number
  horasMotor?: number | null
  origem: 'manual' | 'abastecimento'
  justificativa?: string
}

export async function fetchLeiturasOdometroSupabase(limit = 1000): Promise<LeituraOdometro[]> {
  const { data, error } = await supabase.from('leituras_odometro').select('*').order('data_leitura', { ascending: false }).limit(limit)
  if (error) {
    console.warn('Erro ao buscar leituras de odômetro no Supabase:', error)
    return []
  }
  return (data || []).map(mapRowParaLeitura)
}

export async function criarLeituraOdometro(input: SalvarLeituraInput): Promise<LeituraOdometro> {
  const { data, error } = await supabase
    .from('leituras_odometro')
    .insert({
      veiculo_id: input.veiculoId,
      placa: input.placa,
      data_leitura: input.dataLeitura,
      quilometragem: input.quilometragem,
      horas_motor: input.horasMotor ?? null,
      origem: input.origem,
      justificativa: input.justificativa || null,
    })
    .select()
    .single()
  if (error) throw error
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('manutencao_odometro_updated'))
  return mapRowParaLeitura(data)
}

export async function excluirLeituraOdometro(id: string): Promise<void> {
  const { error } = await supabase.from('leituras_odometro').delete().eq('id', id)
  if (error) throw error
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('manutencao_odometro_updated'))
}

export function useLeiturasOdometro() {
  const [leituras, setLeituras] = useState<LeituraOdometro[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    setLoading(true)
    setLeituras(await fetchLeiturasOdometroSupabase())
    setLoading(false)
  }, [])

  useEffect(() => {
    refetch()
    const handleUpdate = () => refetch()
    window.addEventListener('manutencao_odometro_updated', handleUpdate)
    return () => window.removeEventListener('manutencao_odometro_updated', handleUpdate)
  }, [refetch])

  return { leituras, loading, refetch }
}

// ----------------------------------------------------
// Abastecimentos
// ----------------------------------------------------
function mapRowParaAbastecimento(row: any): Abastecimento {
  return {
    id: row.id,
    veiculoId: row.veiculo_id,
    placa: row.placa,
    veiculoNome: row.veiculo_nome || undefined,
    centroCustoId: row.centro_custo_id,
    centroCustoNome: row.centro_custo_nome || undefined,
    combustivel: row.combustivel,
    dataHora: row.data_hora,
    odometro: row.odometro != null ? Number(row.odometro) : undefined,
    horasMotor: row.horas_motor != null ? Number(row.horas_motor) : undefined,
    postoFornecedor: row.posto_fornecedor,
    volume: Number(row.volume) || 0,
    valorUnitario: row.valor_unitario != null ? Number(row.valor_unitario) : undefined,
    valorTotal: Number(row.valor_total) || 0,
    origem: row.origem,
    aprovado: row.aprovado,
    observacoes: row.observacoes || undefined,
    createdAt: row.created_at,
  }
}

export interface SalvarAbastecimentoInput {
  veiculoId: string
  placa: string
  veiculoNome?: string
  centroCustoId: string
  centroCustoNome?: string
  combustivel: string
  dataHora: string
  odometro?: number | null
  horasMotor?: number | null
  postoFornecedor: string
  volume: number
  valorUnitario?: number | null
  valorTotal: number
  origem: OrigemAbastecimento
  observacoes?: string
}

export async function fetchAbastecimentosSupabase(limit = 1000): Promise<Abastecimento[]> {
  const { data, error } = await supabase.from('abastecimentos').select('*').order('data_hora', { ascending: false }).limit(limit)
  if (error) {
    console.warn('Erro ao buscar abastecimentos no Supabase:', error)
    return []
  }
  return (data || []).map(mapRowParaAbastecimento)
}

export async function criarAbastecimento(input: SalvarAbastecimentoInput): Promise<Abastecimento> {
  const { data, error } = await supabase
    .from('abastecimentos')
    .insert({
      veiculo_id: input.veiculoId,
      placa: input.placa,
      veiculo_nome: input.veiculoNome || null,
      centro_custo_id: input.centroCustoId,
      centro_custo_nome: input.centroCustoNome || null,
      combustivel: input.combustivel,
      data_hora: input.dataHora,
      odometro: input.odometro ?? null,
      horas_motor: input.horasMotor ?? null,
      posto_fornecedor: input.postoFornecedor,
      volume: input.volume,
      valor_unitario: input.valorUnitario ?? null,
      valor_total: input.valorTotal,
      origem: input.origem,
      aprovado: true,
      observacoes: input.observacoes || null,
    })
    .select()
    .single()
  if (error) throw error

  // Todo abastecimento com KM informado também vira uma leitura de
  // odômetro — evita ter que registrar a mesma leitura duas vezes.
  if (input.odometro) {
    try {
      await criarLeituraOdometro({
        veiculoId: input.veiculoId,
        placa: input.placa,
        dataLeitura: input.dataHora,
        quilometragem: input.odometro,
        origem: 'abastecimento',
      })
    } catch (err) {
      console.warn('Falha ao gerar leitura de odômetro a partir do abastecimento:', err)
    }
  }

  if (typeof window !== 'undefined') window.dispatchEvent(new Event('manutencao_abastecimento_updated'))
  return mapRowParaAbastecimento(data)
}

export async function excluirAbastecimento(id: string): Promise<void> {
  const { error } = await supabase.from('abastecimentos').delete().eq('id', id)
  if (error) throw error
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('manutencao_abastecimento_updated'))
}

export function useAbastecimentos() {
  const [abastecimentos, setAbastecimentos] = useState<Abastecimento[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    setLoading(true)
    setAbastecimentos(await fetchAbastecimentosSupabase())
    setLoading(false)
  }, [])

  useEffect(() => {
    refetch()
    const handleUpdate = () => refetch()
    window.addEventListener('manutencao_abastecimento_updated', handleUpdate)
    return () => window.removeEventListener('manutencao_abastecimento_updated', handleUpdate)
  }, [refetch])

  return { abastecimentos, loading, refetch }
}
