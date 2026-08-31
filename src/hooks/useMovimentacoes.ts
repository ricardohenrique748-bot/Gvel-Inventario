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
    // Uma movimentação "pertence" ao período se a entrada OU a saída caiu dentro dele —
    // senão um veículo que entrou antes do período e só saiu durante ele desaparecia
    // da consulta (a saída nunca era considerada, só a entrada).
    if (filters.dataInicio && filters.dataFim) {
      query = query.or(
        `and(data_hora_entrada.gte.${filters.dataInicio},data_hora_entrada.lte.${filters.dataFim}),and(data_hora_saida.gte.${filters.dataInicio},data_hora_saida.lte.${filters.dataFim})`,
      )
    } else if (filters.dataInicio) {
      query = query.or(`data_hora_entrada.gte.${filters.dataInicio},data_hora_saida.gte.${filters.dataInicio}`)
    } else if (filters.dataFim) {
      query = query.or(`data_hora_entrada.lte.${filters.dataFim},data_hora_saida.lte.${filters.dataFim}`)
    }
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

  // Realtime: escuta INSERT / UPDATE / DELETE na tabela movimentacoes e
  // dispara um refetch automático para manter a UI sempre sincronizada
  // com o que foi lançado pelo APK ou por outra sessão web.
  useEffect(() => {
    // Nome único por instância para evitar conflito entre múltiplos hooks ativos
    const channelName = `movimentacoes_realtime_${Math.random().toString(36).slice(2, 8)}`
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'movimentacoes' },
        () => {
          refetch()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
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
  kmEntrada?: number
  observacoes?: string
}

export type RegistrarEntradaInput =
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

import { embutirFotosExtras } from '@/lib/fotosExtras'

export interface FotosEntrada {
  frente?: File
  ladoEsquerdo?: File
  ladoDireito?: File
  traseira?: File
  painel?: File
  extras?: { file?: File; url?: string; label?: string }[]
}

async function getUsuarioAtualId() {
  try {
    const { data, error } = await supabase.auth.getSession()
    if (data.session?.user?.id) return data.session.user.id
    if (error) console.error('getSession falhou ao resolver usuário atual:', error)
    // Fallback: no WebView do app nativo a sessão local às vezes ainda não terminou
    // de reidratar nesse ponto — getUser() revalida direto com o servidor.
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError) console.error('getUser falhou ao resolver usuário atual:', userError)
    return userData.user?.id ?? null
  } catch (err) {
    // Com internet fraca isso pode rejeitar em vez de retornar `error` — não pode
    // derrubar o registro da movimentação por causa disso. O banco preenche via
    // trigger usando auth.uid() da própria requisição — ver migration 0032.
    console.error('Falha de rede ao resolver usuário atual:', err)
    return null
  }
}

function aguardar(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Corre uma promise contra um limite de tempo. Em sinal fraco (mas não
// totalmente offline) o pedido pode ficar "pendurado" muito mais tempo do
// que o SO levaria pra desistir sozinho — sem isso a retentativa demoraria
// demais pra perceber que precisa tentar de novo. O pedido original ainda
// pode terminar em segundo plano; como o upload usa `upsert`, se ele
// completar depois só sobrescreve o mesmo arquivo, sem problema.
function comTimeout<T>(promise: Promise<T>, ms: number, mensagem: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(mensagem)), ms)),
  ])
}

// Fotos são obrigatórias: se não conseguir subir, a movimentação não pode
// ser salva sem elas. Mas com internet fraca uma única tentativa costuma
// falhar por instabilidade passageira (não por estar realmente offline) —
// então tenta de novo automaticamente antes de desistir de vez.
const TENTATIVAS_UPLOAD_FOTO = 4
const ESPERA_BASE_MS = 1200
const TIMEOUT_POR_TENTATIVA_MS = 15000

export async function uploadFotoEntrada(movimentacaoId: string, campo: string, file: File): Promise<string> {
  const ext = file.type === 'image/png' ? 'png' : 'jpg'
  const path = `entrada/${movimentacaoId}/${campo}.${ext}`

  let ultimoErro: unknown = null
  for (let tentativa = 1; tentativa <= TENTATIVAS_UPLOAD_FOTO; tentativa++) {
    try {
      const { error } = await comTimeout(
        supabase.storage.from(FOTOS_BUCKET).upload(path, file, {
          contentType: file.type,
          upsert: true,
        }),
        TIMEOUT_POR_TENTATIVA_MS,
        `Tempo esgotado ao enviar a foto "${campo}"`,
      )
      if (!error) {
        return supabase.storage.from(FOTOS_BUCKET).getPublicUrl(path).data.publicUrl
      }
      ultimoErro = error
      console.warn(`Falha ao enviar foto "${campo}" (tentativa ${tentativa}/${TENTATIVAS_UPLOAD_FOTO}):`, error)
    } catch (err) {
      // Com internet fraca o próprio fetch pode rejeitar (ou estourar o timeout acima)
      // em vez de retornar `error`.
      ultimoErro = err
      console.warn(`Falha de rede ao enviar foto "${campo}" (tentativa ${tentativa}/${TENTATIVAS_UPLOAD_FOTO}):`, err)
    }
    if (tentativa < TENTATIVAS_UPLOAD_FOTO) {
      await aguardar(ESPERA_BASE_MS * tentativa) // 1.2s, 2.4s, 3.6s entre tentativas
    }
  }

  console.error(`Não foi possível enviar a foto "${campo}" após ${TENTATIVAS_UPLOAD_FOTO} tentativas:`, ultimoErro)
  throw new Error(`Não foi possível enviar a foto "${campo}". Verifique sua conexão e tente novamente.`)
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

  // Processa uploads das fotos padrão e extras em paralelo
  const [usuarioId, fotoFrenteUrl, fotoLadoEsquerdoUrl, fotoLadoDireitoUrl, fotoTraseiraUrl, fotoPainelUrl, fotosExtrasProcessadas] =
    await Promise.all([
      getUsuarioAtualId(),
      fotos?.frente ? uploadFotoEntrada(movimentacaoId, 'frente', fotos.frente) : null,
      fotos?.ladoEsquerdo ? uploadFotoEntrada(movimentacaoId, 'lado-esquerdo', fotos.ladoEsquerdo) : null,
      fotos?.ladoDireito ? uploadFotoEntrada(movimentacaoId, 'lado-direito', fotos.ladoDireito) : null,
      fotos?.traseira ? uploadFotoEntrada(movimentacaoId, 'traseira', fotos.traseira) : null,
      fotos?.painel ? uploadFotoEntrada(movimentacaoId, 'painel', fotos.painel) : null,
      fotos?.extras
        ? Promise.all(
            fotos.extras.map(async (extra, idx) => {
              if (extra.file) {
                const url = await uploadFotoEntrada(
                  movimentacaoId,
                  `extra-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
                  extra.file,
                )
                return url ? { url, label: extra.label } : null
              } else if (extra.url) {
                return { url: extra.url, label: extra.label }
              }
              return null
            }),
          )
        : Promise.resolve([]),
    ])

  const extrasValidas = (fotosExtrasProcessadas || []).filter((f): f is { url: string; label: string | undefined } => f !== null)
  const observacoesComExtras = embutirFotosExtras(input.observacoes, extrasValidas)

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
      observacoes: up(observacoesComExtras),
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

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('movimentacao_updated'))
  }

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
  kmEntrada?: number
  kmSaida?: number
}

export async function atualizarMovimentacao(id: string, input: AtualizarMovimentacaoInput, fotos?: FotosEntrada) {
  const fotoUpdates: Record<string, string> = {}
  let observacoesParaSalvar = input.observacoes

  if (fotos) {
    const [frente, ladoEsquerdo, ladoDireito, traseira, painel, extrasProcessadas] = await Promise.all([
      fotos.frente ? uploadFotoEntrada(id, 'frente', fotos.frente) : null,
      fotos.ladoEsquerdo ? uploadFotoEntrada(id, 'lado-esquerdo', fotos.ladoEsquerdo) : null,
      fotos.ladoDireito ? uploadFotoEntrada(id, 'lado-direito', fotos.ladoDireito) : null,
      fotos.traseira ? uploadFotoEntrada(id, 'traseira', fotos.traseira) : null,
      fotos.painel ? uploadFotoEntrada(id, 'painel', fotos.painel) : null,
      fotos.extras
        ? Promise.all(
            fotos.extras.map(async (extra, idx) => {
              if (extra.file) {
                const url = await uploadFotoEntrada(
                  id,
                  `extra-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
                  extra.file,
                )
                return url ? { url, label: extra.label } : null
              } else if (extra.url) {
                return { url: extra.url, label: extra.label }
              }
              return null
            }),
          )
        : Promise.resolve(null),
    ])

    if (frente) fotoUpdates.foto_frente_url = frente
    if (ladoEsquerdo) fotoUpdates.foto_lado_esquerdo_url = ladoEsquerdo
    if (ladoDireito) fotoUpdates.foto_lado_direito_url = ladoDireito
    if (traseira) fotoUpdates.foto_traseira_url = traseira
    if (painel) fotoUpdates.foto_painel_url = painel

    if (extrasProcessadas !== null) {
      const extrasValidas = extrasProcessadas.filter((f): f is { url: string; label: string | undefined } => f !== null)
      observacoesParaSalvar = embutirFotosExtras(input.observacoes, extrasValidas)
    }
  }

  const { data, error } = await supabase
    .from('movimentacoes')
    .update({
      patio_id: input.patioId,
      status_id: input.statusId || null,
      motorista: up(input.motorista),
      destino: up(input.destino),
      observacoes: up(observacoesParaSalvar),
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

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('movimentacao_updated'))
  }

  return data
}

export async function excluirMovimentacao(id: string) {
  const { error } = await supabase.from('movimentacoes').delete().eq('id', id)
  if (error) throw new Error(error.message)

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('movimentacao_updated'))
  }
}

export async function atualizarStatusMovimentacao(id: string, statusId: string | null) {
  const { error } = await supabase
    .from('movimentacoes')
    .update({ status_id: statusId || null })
    .eq('id', id)
  if (error) throw new Error(error.message)

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('movimentacao_updated'))
  }
}

export async function atualizarPatioMovimentacao(id: string, patioId: string) {
  const { error } = await supabase
    .from('movimentacoes')
    .update({ patio_id: patioId })
    .eq('id', id)
  if (error) throw new Error(error.message)

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('movimentacao_updated'))
  }
}

interface RegistrarSaidaInput {
  motorista?: string
  destino?: string
  dataHoraSaida: string
  kmSaida?: number
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

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('movimentacao_updated'))
  }

  return data
}
