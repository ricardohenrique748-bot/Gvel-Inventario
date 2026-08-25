import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { up } from '@/lib/text'
import type { Ferramenta, FerramentaRetirada, StatusRetiradaFerramenta } from '@/lib/types'

function formatarFerramentaComFoto(f: any): Ferramenta {
  if (!f) return f
  let foto_url: string | null = f.foto_url || null
  let observacoes: string | null = f.observacoes || null

  if (observacoes && observacoes.includes('[FOTO:')) {
    const match = observacoes.match(/\[FOTO:(.*?)\]/)
    if (match) {
      foto_url = match[1]
      observacoes = observacoes.replace(/\[FOTO:.*?\]/g, '').trim() || null
    }
  }

  return {
    ...f,
    observacoes,
    foto_url,
  }
}

function formatarRetiradaComFoto(r: any): FerramentaRetirada {
  if (!r) return r
  let foto_url: string | null = r.foto_url || r.foto_responsavel_url || null
  let observacoes: string | null = r.observacoes_retirada || null

  if (observacoes && observacoes.includes('[FOTO:')) {
    const match = observacoes.match(/\[FOTO:(.*?)\]/)
    if (match) {
      foto_url = match[1]
      observacoes = observacoes.replace(/\[FOTO:.*?\]/g, '').trim() || null
    }
  }

  return {
    ...r,
    foto_url,
    foto_responsavel_url: foto_url,
    observacoes_retirada: observacoes,
    ferramenta: r.ferramenta ? formatarFerramentaComFoto(r.ferramenta) : undefined,
  }
}

export function useFerramentas() {
  const [ferramentas, setFerramentas] = useState<Ferramenta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('ferramentas')
      .select('*')
      .order('nome', { ascending: true })

    if (error) {
      setError(error.message)
    } else {
      setFerramentas((data ?? []).map(formatarFerramentaComFoto))
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { ferramentas, loading, error, refetch }
}

export interface RetiradasFiltros {
  status?: StatusRetiradaFerramenta | 'todas'
  placa?: string
  responsavel?: string
}

export function useRetiradasFerramentas(filtros: RetiradasFiltros = {}) {
  const [retiradas, setRetiradas] = useState<FerramentaRetirada[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('ferramentas_retiradas')
      .select('*, ferramenta:ferramentas(*)')
      .order('data_hora_retirada', { ascending: false })
      .limit(200)

    if (filtros.status && filtros.status !== 'todas') {
      query = query.eq('status', filtros.status)
    }
    if (filtros.placa) {
      query = query.ilike('placa', `%${filtros.placa.trim()}%`)
    }
    if (filtros.responsavel) {
      query = query.ilike('responsavel', `%${filtros.responsavel.trim()}%`)
    }

    const { data, error } = await query

    if (error) {
      console.error('Erro ao buscar retiradas:', error)
      setError(error.message)
    } else {
      setRetiradas((data ?? []).map(formatarRetiradaComFoto))
    }
    setLoading(false)
  }, [filtros.status, filtros.placa, filtros.responsavel])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { retiradas, loading, error, refetch }
}

const FOTOS_BUCKET = 'fotos'

export async function uploadFotoFerramenta(file: File): Promise<string> {
  try {
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `ferramentas/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { error } = await supabase.storage.from(FOTOS_BUCKET).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    })
    if (!error) {
      return supabase.storage.from(FOTOS_BUCKET).getPublicUrl(path).data.publicUrl
    }
  } catch (err) {
    console.warn('Falha no storage, convertendo em dataURL:', err)
  }

  // Fallback para DataURL caso o bucket de storage esteja offline ou inacessível
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export interface CriarFerramentaInput {
  codigo?: string
  nome: string
  categoria?: string
  quantidade_total: number
  localizacao?: string
  observacoes?: string
  foto_url?: string | null
}

export async function criarFerramenta(input: CriarFerramentaInput): Promise<Ferramenta> {
  const total = Number(input.quantidade_total) || 1
  
  // Embutir foto_url no campo observacoes para garantir compatibilidade 100% caso a coluna não exista no Postgres
  let observacoesFinal = input.observacoes?.trim() || ''
  if (input.foto_url) {
    observacoesFinal = observacoesFinal ? `${observacoesFinal} [FOTO:${input.foto_url}]` : `[FOTO:${input.foto_url}]`
  }

  const payload: any = {
    codigo: input.codigo ? up(input.codigo) : null,
    nome: up(input.nome),
    categoria: input.categoria ? up(input.categoria) : 'GERAL',
    quantidade_total: total,
    quantidade_disponivel: total,
    localizacao: input.localizacao ? up(input.localizacao) : null,
    observacoes: observacoesFinal || null,
  }

  const { data, error } = await supabase
    .from('ferramentas')
    .insert(payload)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return formatarFerramentaComFoto(data)
}

export interface AtualizarFerramentaInput {
  codigo?: string
  nome: string
  categoria?: string
  quantidade_total: number
  localizacao?: string
  observacoes?: string
  foto_url?: string | null
}

export async function atualizarFerramenta(id: string, input: AtualizarFerramentaInput): Promise<Ferramenta> {
  // Busca a ferramenta atual para ajustar a quantidade disponível proporcionalmente
  const { data: atual, error: buscaError } = await supabase
    .from('ferramentas')
    .select('*')
    .eq('id', id)
    .single()

  if (buscaError) throw new Error(buscaError.message)

  const novoTotal = Number(input.quantidade_total) || 1
  const emUso = (atual.quantidade_total || 0) - (atual.quantidade_disponivel || 0)
  const novaDisponivel = Math.max(0, novoTotal - emUso)

  // Embutir foto_url no campo observacoes
  let observacoesFinal = input.observacoes?.trim() || ''
  if (input.foto_url) {
    observacoesFinal = observacoesFinal ? `${observacoesFinal} [FOTO:${input.foto_url}]` : `[FOTO:${input.foto_url}]`
  }

  const payload: any = {
    codigo: input.codigo ? up(input.codigo) : null,
    nome: up(input.nome),
    categoria: input.categoria ? up(input.categoria) : 'GERAL',
    quantidade_total: novoTotal,
    quantidade_disponivel: novaDisponivel,
    localizacao: input.localizacao ? up(input.localizacao) : null,
    observacoes: observacoesFinal || null,
  }

  const { data, error } = await supabase
    .from('ferramentas')
    .update(payload)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return formatarFerramentaComFoto(data)
}

export async function excluirFerramenta(id: string): Promise<void> {
  // Verifica se há retiradas em uso
  const { data: emUso, error: checkError } = await supabase
    .from('ferramentas_retiradas')
    .select('id')
    .eq('ferramenta_id', id)
    .eq('status', 'em_uso')
    .limit(1)

  if (checkError) throw new Error(checkError.message)
  if (emUso && emUso.length > 0) {
    throw new Error('Não é possível excluir uma ferramenta que possui unidades em uso no momento.')
  }

  const { error } = await supabase.from('ferramentas').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export interface RegistrarRetiradaInput {
  ferramenta_id: string
  veiculo_id?: string | null
  placa: string
  responsavel: string
  quantidade: number
  tipo_saida?: 'temporaria' | 'definitiva'
  motivo_baixa?: string
  observacoes_retirada?: string
  foto_responsavel_url?: string | null
  foto_url?: string | null
}

export async function registrarRetiradaFerramenta(input: RegistrarRetiradaInput): Promise<FerramentaRetirada> {
  const qtd = Number(input.quantidade) || 1
  const foto = input.foto_responsavel_url || input.foto_url || null
  const isDefinitiva = input.tipo_saida === 'definitiva'

  // 1. Busca a ferramenta e valida disponibilidade
  const { data: ferramenta, error: buscaError } = await supabase
    .from('ferramentas')
    .select('*')
    .eq('id', input.ferramenta_id)
    .single()

  if (buscaError || !ferramenta) {
    throw new Error('Ferramenta não encontrada.')
  }

  if (ferramenta.quantidade_disponivel < qtd) {
    throw new Error(
      `Quantidade insuficiente no estoque. Disponível: ${ferramenta.quantidade_disponivel} unidade(s).`,
    )
  }

  // Prepara o texto descritivo se for saída definitiva ou se tiver foto
  let obsFinal = input.observacoes_retirada?.trim() || ''
  if (isDefinitiva) {
    const motivoTag = input.motivo_baixa ? `MOTIVO: ${input.motivo_baixa.toUpperCase()}` : 'NÃO VOLTA'
    obsFinal = `[SAÍDA DEFINITIVA · ${motivoTag}] ${obsFinal}`.trim()
  }
  if (foto) {
    obsFinal = obsFinal ? `${obsFinal} [FOTO:${foto}]` : `[FOTO:${foto}]`
  }

  // 2. Insere a retirada
  // Para compatibilidade com o enum do banco, saída definitiva pode usar 'avaria_perda' com tag explícita ou 'baixa_definitiva'
  const payload: Record<string, unknown> = {
    ferramenta_id: input.ferramenta_id,
    veiculo_id: input.veiculo_id || null,
    placa: up(input.placa),
    responsavel: up(input.responsavel),
    quantidade: qtd,
    status: isDefinitiva ? 'avaria_perda' : 'em_uso',
    observacoes_retirada: obsFinal || null,
    data_hora_retirada: new Date().toISOString(),
    data_hora_devolucao: isDefinitiva ? new Date().toISOString() : null,
  }

  const { data: retirada, error: insertError } = await supabase
    .from('ferramentas_retiradas')
    .insert(payload)
    .select('*, ferramenta:ferramentas(*)')
    .single()

  if (insertError) throw new Error(insertError.message)

  // 3. Atualiza o estoque da ferramenta
  if (isDefinitiva) {
    // SAÍDA DEFINITIVA: Baixa total do estoque (diminui disponível e diminui total!)
    const { error: updateError } = await supabase
      .from('ferramentas')
      .update({
        quantidade_disponivel: Math.max(0, ferramenta.quantidade_disponivel - qtd),
        quantidade_total: Math.max(0, ferramenta.quantidade_total - qtd),
      })
      .eq('id', input.ferramenta_id)

    if (updateError) {
      console.error('Erro ao atualizar estoque total da ferramenta:', updateError)
    }
  } else {
    // SAÍDA TEMPORÁRIA: Diminui apenas o disponível (permanece no total)
    const { error: updateError } = await supabase
      .from('ferramentas')
      .update({
        quantidade_disponivel: Math.max(0, ferramenta.quantidade_disponivel - qtd),
      })
      .eq('id', input.ferramenta_id)

    if (updateError) {
      console.error('Erro ao atualizar estoque disponível da ferramenta:', updateError)
    }
  }

  return retirada as unknown as FerramentaRetirada
}

export interface RegistrarDevolucaoInput {
  retiradaId: string
  status?: 'devolvido' | 'avaria_perda'
  observacoes_devolucao?: string
}

export async function registrarDevolucaoFerramenta(input: RegistrarDevolucaoInput): Promise<void> {
  const statusDevolucao = input.status || 'devolvido'

  // 1. Busca a retirada ativa
  const { data: retirada, error: buscaError } = await supabase
    .from('ferramentas_retiradas')
    .select('*, ferramenta:ferramentas(*)')
    .eq('id', input.retiradaId)
    .single()

  if (buscaError || !retirada) {
    throw new Error('Registro de retirada não encontrado.')
  }

  if (retirada.status !== 'em_uso') {
    throw new Error('Esta retirada já foi finalizada anteriormente.')
  }

  // 2. Atualiza a retirada para devolvida
  const { error: updateRetiradaError } = await supabase
    .from('ferramentas_retiradas')
    .update({
      status: statusDevolucao,
      data_hora_devolucao: new Date().toISOString(),
      observacoes_devolucao: input.observacoes_devolucao?.trim() || null,
    })
    .eq('id', input.retiradaId)

  if (updateRetiradaError) throw new Error(updateRetiradaError.message)

  // 3. Atualiza o estoque da ferramenta
  const ferramenta = retirada.ferramenta as Ferramenta | undefined
  if (ferramenta) {
    if (statusDevolucao === 'devolvido') {
      await supabase
        .from('ferramentas')
        .update({
          quantidade_disponivel: Math.min(
            ferramenta.quantidade_total,
            ferramenta.quantidade_disponivel + retirada.quantidade,
          ),
        })
        .eq('id', retirada.ferramenta_id)
    } else if (statusDevolucao === 'avaria_perda') {
      // Baixa no total por avaria ou perda
      await supabase
        .from('ferramentas')
        .update({
          quantidade_total: Math.max(0, ferramenta.quantidade_total - retirada.quantidade),
        })
        .eq('id', retirada.ferramenta_id)
    }
  }
}

export async function reverterDevolucaoFerramenta(retiradaId: string): Promise<void> {
  const { data: retirada, error: buscaError } = await supabase
    .from('ferramentas_retiradas')
    .select('*, ferramenta:ferramentas(*)')
    .eq('id', retiradaId)
    .single()

  if (buscaError || !retirada) {
    throw new Error('Registro de retirada não encontrado.')
  }

  // Volta status para em_uso e remove data de devolução
  const { error: updateRetiradaError } = await supabase
    .from('ferramentas_retiradas')
    .update({
      status: 'em_uso',
      data_hora_devolucao: null,
      observacoes_devolucao: null,
    })
    .eq('id', retiradaId)

  if (updateRetiradaError) throw new Error(updateRetiradaError.message)

  // Ajusta quantidade disponível
  const ferramenta = retirada.ferramenta as Ferramenta | undefined
  if (ferramenta) {
    await supabase
      .from('ferramentas')
      .update({
        quantidade_disponivel: Math.max(0, (ferramenta.quantidade_disponivel || 0) - (retirada.quantidade || 1)),
      })
      .eq('id', retirada.ferramenta_id)
  }
}

export interface AtualizarRetiradaInput {
  id: string
  ferramenta_id?: string
  veiculo_id?: string | null
  placa?: string
  responsavel?: string
  quantidade?: number
  observacoes_retirada?: string | null
  data_hora_retirada?: string
  foto_responsavel_url?: string | null
  foto_url?: string | null
}

export async function atualizarRetiradaFerramenta(input: AtualizarRetiradaInput): Promise<FerramentaRetirada> {
  const { data: atual, error: buscaError } = await supabase
    .from('ferramentas_retiradas')
    .select('*, ferramenta:ferramentas(*)')
    .eq('id', input.id)
    .single()

  if (buscaError || !atual) {
    throw new Error('Registro de retirada não encontrado.')
  }

  const novaQtd = input.quantidade !== undefined ? Number(input.quantidade) || 1 : atual.quantidade
  const novaFerramentaId = input.ferramenta_id || atual.ferramenta_id
  const toolChanged = novaFerramentaId !== atual.ferramenta_id
  const qtdChanged = novaQtd !== atual.quantidade

  // Se o status for em_uso, ajusta a quantidade disponível
  if (atual.status === 'em_uso') {
    if (toolChanged) {
      // Devolve para a ferramenta antiga
      const antigaFerramenta = atual.ferramenta as Ferramenta | undefined
      if (antigaFerramenta) {
        await supabase
          .from('ferramentas')
          .update({
            quantidade_disponivel: Math.min(
              antigaFerramenta.quantidade_total,
              (antigaFerramenta.quantidade_disponivel || 0) + atual.quantidade,
            ),
          })
          .eq('id', atual.ferramenta_id)
      }

      // Baixa na nova ferramenta
      const { data: novaFerramenta, error: errNova } = await supabase
        .from('ferramentas')
        .select('*')
        .eq('id', novaFerramentaId)
        .single()

      if (errNova || !novaFerramenta) {
        throw new Error('Nova ferramenta selecionada não encontrada.')
      }

      if (novaFerramenta.quantidade_disponivel < novaQtd) {
        throw new Error(
          `Estoque insuficiente da nova ferramenta. Disponível: ${novaFerramenta.quantidade_disponivel} un.`,
        )
      }

      await supabase
        .from('ferramentas')
        .update({
          quantidade_disponivel: Math.max(0, novaFerramenta.quantidade_disponivel - novaQtd),
        })
        .eq('id', novaFerramentaId)
    } else if (qtdChanged) {
      const diff = novaQtd - atual.quantidade
      const ferramenta = atual.ferramenta as Ferramenta | undefined
      if (ferramenta) {
        if (diff > 0 && ferramenta.quantidade_disponivel < diff) {
          throw new Error(
            `Estoque insuficiente para aumentar. Disponível no estoque: ${ferramenta.quantidade_disponivel} un.`,
          )
        }
        await supabase
          .from('ferramentas')
          .update({
            quantidade_disponivel: Math.max(0, (ferramenta.quantidade_disponivel || 0) - diff),
          })
          .eq('id', atual.ferramenta_id)
      }
    }
  }

  const foto = input.foto_responsavel_url !== undefined ? input.foto_responsavel_url : (atual.foto_responsavel_url || atual.foto_url)
  
  let obs = input.observacoes_retirada !== undefined ? input.observacoes_retirada : atual.observacoes_retirada
  // Remove marcas de fotos antigas para não duplicar se foto mudou ou foi removida
  if (obs) {
    obs = obs.replace(/\[FOTO:.*?\]/g, '').trim()
  }
  if (foto) {
    obs = obs ? `${obs} [FOTO:${foto}]` : `[FOTO:${foto}]`
  }

  const payload: Record<string, unknown> = {
    ferramenta_id: novaFerramentaId,
    placa: input.placa ? up(input.placa) : atual.placa,
    responsavel: input.responsavel ? up(input.responsavel) : atual.responsavel,
    quantidade: novaQtd,
    observacoes_retirada: obs || null,
  }

  if (input.veiculo_id !== undefined) {
    payload.veiculo_id = input.veiculo_id || null
  }
  if (input.data_hora_retirada) {
    payload.data_hora_retirada = input.data_hora_retirada
  }

  const { data: atualizado, error: updateError } = await supabase
    .from('ferramentas_retiradas')
    .update(payload)
    .eq('id', input.id)
    .select('*, ferramenta:ferramentas(*)')
    .single()

  if (updateError) throw new Error(updateError.message)
  return formatarRetiradaComFoto(atualizado)
}

export async function excluirRetiradaFerramenta(retiradaId: string): Promise<void> {
  const { data: retirada, error: buscaError } = await supabase
    .from('ferramentas_retiradas')
    .select('*, ferramenta:ferramentas(*)')
    .eq('id', retiradaId)
    .single()

  if (buscaError || !retirada) {
    throw new Error('Registro de retirada não encontrado.')
  }

  if (retirada.status === 'em_uso') {
    const ferramenta = retirada.ferramenta as Ferramenta | undefined
    if (ferramenta) {
      await supabase
        .from('ferramentas')
        .update({
          quantidade_disponivel: Math.min(
            ferramenta.quantidade_total,
            (ferramenta.quantidade_disponivel || 0) + (retirada.quantidade || 1),
          ),
        })
        .eq('id', retirada.ferramenta_id)
    }
  }

  const { error } = await supabase
    .from('ferramentas_retiradas')
    .delete()
    .eq('id', retiradaId)

  if (error) throw new Error(error.message)
}

