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
      setError(error.message)
    } else {
      const formatadas = ((data as unknown as FerramentaRetirada[]) ?? []).map((r) => ({
        ...r,
        ferramenta: r.ferramenta ? formatarFerramentaComFoto(r.ferramenta) : r.ferramenta,
      }))
      setRetiradas(formatadas)
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
  observacoes_retirada?: string
}

export async function registrarRetiradaFerramenta(input: RegistrarRetiradaInput): Promise<FerramentaRetirada> {
  const qtd = Number(input.quantidade) || 1

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

  // 2. Insere a retirada
  const { data: retirada, error: insertError } = await supabase
    .from('ferramentas_retiradas')
    .insert({
      ferramenta_id: input.ferramenta_id,
      veiculo_id: input.veiculo_id || null,
      placa: up(input.placa),
      responsavel: up(input.responsavel),
      quantidade: qtd,
      status: 'em_uso',
      observacoes_retirada: input.observacoes_retirada?.trim() || null,
      data_hora_retirada: new Date().toISOString(),
    })
    .select('*, ferramenta:ferramentas(*)')
    .single()

  if (insertError) throw new Error(insertError.message)

  // 3. Atualiza o estoque disponível
  const { error: updateError } = await supabase
    .from('ferramentas')
    .update({
      quantidade_disponivel: ferramenta.quantidade_disponivel - qtd,
    })
    .eq('id', input.ferramenta_id)

  if (updateError) {
    console.error('Erro ao atualizar estoque da ferramenta:', updateError)
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
