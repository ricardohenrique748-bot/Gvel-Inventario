import { useCallback, useEffect, useMemo, useState } from 'react'
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
  /** Limite de linhas buscadas no servidor (paginação simples via "carregar mais"). */
  limit?: number
}

export function useMovimentacoes(filters: MovimentacoesFilters = {}) {
  const [raw, setRaw] = useState<MovimentacaoComVeiculo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('movimentacoes')
      .select(MOVIMENTACAO_COM_VEICULO)
      .order('data_hora_entrada', { ascending: false })

    if (filters.status) query = query.eq('status', filters.status)
    if (filters.patioId) query = query.eq('patio_id', filters.patioId)
    if (filters.dataInicio) query = query.gte('data_hora_entrada', filters.dataInicio)
    if (filters.dataFim) query = query.lte('data_hora_entrada', filters.dataFim)
    if (filters.limit) query = query.limit(filters.limit)

    const { data, error } = await query
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    setError(null)
    setRaw((data as unknown as MovimentacaoComVeiculo[]) ?? [])
    setLoading(false)
  }, [filters.patioId, filters.status, filters.dataInicio, filters.dataFim, filters.limit])

  useEffect(() => {
    refetch()
  }, [refetch])

  // Filtro de placa e por cliente/marca/modelo são aplicados aqui em memória, não na
  // query — evita disparar uma nova busca no servidor a cada tecla digitada (esses
  // valores mudam bastante enquanto o usuário digita/seleciona) e também evita o
  // problema do PostgREST tratando `.eq('veiculo.coluna', ...)` como inner join,
  // que chegava a excluir da resposta uma movimentação válida quando o veículo
  // relacionado não batia com o filtro.
  const movimentacoes = useMemo(() => {
    let result = raw
    if (filters.search) {
      const term = filters.search.trim().toUpperCase()
      if (term) result = result.filter((m) => m.veiculo?.placa?.toUpperCase().includes(term))
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
    return result
  }, [raw, filters.search, filters.clienteId, filters.marcaId, filters.modeloId])

  // Sinaliza que o servidor pode ter mais linhas além do limite pedido (para mostrar
  // o botão "carregar mais"); só faz sentido quando um limite foi de fato aplicado.
  const podeTerMais = Boolean(filters.limit) && raw.length >= (filters.limit ?? 0)

  return { movimentacoes, loading, error, podeTerMais, refetch }
}

interface RegistrarEntradaComum {
  patioId: string
  statusId?: string
  motorista?: string
  dataHoraEntrada: string
  kmEntrada: number
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
      chassi?: string
      operante?: boolean
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
  if (data.session?.user?.id) return data.session.user.id
  // Fallback: no WebView do app nativo a sessão local às vezes ainda não terminou
  // de reidratar nesse ponto — getUser() revalida direto com o servidor.
  const { data: userData } = await supabase.auth.getUser()
  return userData.user?.id ?? null
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
            chassi: input.chassi,
            operante: input.operante,
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
      km_entrada: input.kmEntrada,
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
  destino?: string
  observacoes?: string
  dataHoraEntrada: string
  dataHoraSaida?: string
  kmEntrada: number
  kmSaida?: number
}

export async function atualizarMovimentacao(id: string, input: AtualizarMovimentacaoInput, fotos?: FotosEntrada) {
  const fotoUpdates: Record<string, string> = {}
  if (fotos) {
    const [frente, ladoEsquerdo, ladoDireito, traseira, painel] = await Promise.all([
      fotos.frente ? uploadFotoEntrada(id, 'frente', fotos.frente) : null,
      fotos.ladoEsquerdo ? uploadFotoEntrada(id, 'lado-esquerdo', fotos.ladoEsquerdo) : null,
      fotos.ladoDireito ? uploadFotoEntrada(id, 'lado-direito', fotos.ladoDireito) : null,
      fotos.traseira ? uploadFotoEntrada(id, 'traseira', fotos.traseira) : null,
      fotos.painel ? uploadFotoEntrada(id, 'painel', fotos.painel) : null,
    ])
    if (frente) fotoUpdates.foto_frente_url = frente
    if (ladoEsquerdo) fotoUpdates.foto_lado_esquerdo_url = ladoEsquerdo
    if (ladoDireito) fotoUpdates.foto_lado_direito_url = ladoDireito
    if (traseira) fotoUpdates.foto_traseira_url = traseira
    if (painel) fotoUpdates.foto_painel_url = painel
  }

  const { data, error } = await supabase
    .from('movimentacoes')
    .update({
      patio_id: input.patioId,
      status_id: input.statusId || null,
      motorista: up(input.motorista),
      destino: up(input.destino),
      observacoes: up(input.observacoes),
      data_hora_entrada: input.dataHoraEntrada,
      data_hora_saida: input.dataHoraSaida || null,
      km_entrada: input.kmEntrada,
      km_saida: input.dataHoraSaida ? (input.kmSaida ?? null) : null,
      status: input.dataHoraSaida ? 'saiu' : 'no_patio',
      ...fotoUpdates,
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
  kmSaida: number
}

export async function registrarSaida(movimentacaoId: string, input?: RegistrarSaidaInput) {
  const usuarioId = await getUsuarioAtualId()
  const { data, error } = await supabase
    .from('movimentacoes')
    .update({
      data_hora_saida: input?.dataHoraSaida ?? new Date().toISOString(),
      motorista: input?.motorista !== undefined ? up(input.motorista) : undefined,
      destino: input?.destino !== undefined ? up(input.destino) : undefined,
      km_saida: input?.kmSaida,
      status: 'saiu',
      usuario_saida_id: usuarioId,
    })
    .eq('id', movimentacaoId)
    .select()
    .single()
  if (error) throw error
  return data
}
