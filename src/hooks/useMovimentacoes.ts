import { useCallback, useEffect, useState } from 'react'
import { supabase, FOTOS_BUCKET } from '@/lib/supabase'
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

export interface FotosEntrada {
  frente?: File
  ladoEsquerdo?: File
  ladoDireito?: File
  traseira?: File
  painel?: File
}

async function getUsuarioAtualId() {
  const { data } = await supabase.auth.getSession()
  return data.session?.user?.id ?? null
}

async function uploadFotoEntrada(movimentacaoId: string, campo: string, file: File) {
  const ext = file.type === 'image/png' ? 'png' : 'jpg'
  const path = `entrada/${movimentacaoId}/${campo}.${ext}`
  const { error } = await supabase.storage.from(FOTOS_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: true,
  })
  if (error) return null
  return supabase.storage.from(FOTOS_BUCKET).getPublicUrl(path).data.publicUrl
}

export async function registrarEntrada(input: RegistrarEntradaInput, fotos?: FotosEntrada) {
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

  const movimentacaoId = crypto.randomUUID()
  const usuarioId = await getUsuarioAtualId()

  const [fotoFrenteUrl, fotoLadoEsquerdoUrl, fotoLadoDireitoUrl, fotoTraseiraUrl, fotoPainelUrl] = await Promise.all([
    fotos?.frente ? uploadFotoEntrada(movimentacaoId, 'frente', fotos.frente) : null,
    fotos?.ladoEsquerdo ? uploadFotoEntrada(movimentacaoId, 'lado-esquerdo', fotos.ladoEsquerdo) : null,
    fotos?.ladoDireito ? uploadFotoEntrada(movimentacaoId, 'lado-direito', fotos.ladoDireito) : null,
    fotos?.traseira ? uploadFotoEntrada(movimentacaoId, 'traseira', fotos.traseira) : null,
    fotos?.painel ? uploadFotoEntrada(movimentacaoId, 'painel', fotos.painel) : null,
  ])

  const { data, error } = await supabase
    .from('movimentacoes')
    .insert({
      id: movimentacaoId,
      veiculo_id: veiculoId,
      patio_id: input.patioId,
      status_id: input.statusId || null,
      motorista: up(input.motorista),
      data_hora_entrada: input.dataHoraEntrada,
      observacoes: up(input.observacoes),
      status: 'no_patio',
      foto_frente_url: fotoFrenteUrl,
      foto_lado_esquerdo_url: fotoLadoEsquerdoUrl,
      foto_lado_direito_url: fotoLadoDireitoUrl,
      foto_traseira_url: fotoTraseiraUrl,
      foto_painel_url: fotoPainelUrl,
      usuario_entrada_id: usuarioId,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

interface AtualizarMovimentacaoInput {
  patioId: string
  statusId?: string
  motorista?: string
  observacoes?: string
  dataHoraEntrada: string
  dataHoraSaida?: string
}

export async function atualizarMovimentacao(id: string, input: AtualizarMovimentacaoInput) {
  const { data, error } = await supabase
    .from('movimentacoes')
    .update({
      patio_id: input.patioId,
      status_id: input.statusId || null,
      motorista: up(input.motorista),
      observacoes: up(input.observacoes),
      data_hora_entrada: input.dataHoraEntrada,
      data_hora_saida: input.dataHoraSaida || null,
      status: input.dataHoraSaida ? 'saiu' : 'no_patio',
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function excluirMovimentacao(id: string) {
  const { error } = await supabase.from('movimentacoes').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

interface RegistrarSaidaInput {
  motorista?: string
  destino?: string
  dataHoraSaida: string
}

export async function registrarSaida(movimentacaoId: string, input?: RegistrarSaidaInput) {
  const usuarioId = await getUsuarioAtualId()
  const { data, error } = await supabase
    .from('movimentacoes')
    .update({
      data_hora_saida: input?.dataHoraSaida ?? new Date().toISOString(),
      motorista: input?.motorista !== undefined ? up(input.motorista) : undefined,
      destino: input?.destino !== undefined ? up(input.destino) : undefined,
      status: 'saiu',
      usuario_saida_id: usuarioId,
    })
    .eq('id', movimentacaoId)
    .select()
    .single()
  if (error) throw error
  return data
}
