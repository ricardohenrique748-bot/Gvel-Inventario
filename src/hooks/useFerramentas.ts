import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { up } from '@/lib/text'
import type { Ferramenta, FerramentaRetirada, StatusRetiradaFerramenta } from '@/lib/types'

export const STORAGE_FERRAMENTAS_KEY = 'gvel_inventario_ferramentas_v1'
export const STORAGE_RETIRADAS_KEY = 'gvel_inventario_retiradas_v1'

const CATEGORIAS_ESPECIAIS_KEYWORDS = [
  'ESPECIAL',
  'SACADOR',
  'EXTRATOR',
  'GABARITO',
  'TRAVA',
  'SCANNER',
  'TORQUIMETRO',
  'TORQUÍMETRO',
  'DIAGNOSTICO',
  'DIAGNÓSTICO',
  'HIDRÁULICA PESADA',
  'HIDRAULICA PESADA',
  'ESPECIAL MOTORES',
]

export function formatarFerramentaComFoto(f: any): Ferramenta {
  if (!f) return f
  let foto_url: string | null = f.foto_url || null
  let observacoes: string | null = f.observacoes || null
  let tipo_ferramenta: 'comum' | 'especial' = f.tipo_ferramenta || 'comum'

  if (observacoes && observacoes.includes('[TIPO:')) {
    const matchTipo = observacoes.match(/\[TIPO:(.*?)\]/)
    if (matchTipo) {
      tipo_ferramenta = matchTipo[1] === 'especial' ? 'especial' : 'comum'
      observacoes = observacoes.replace(/\[TIPO:.*?\]/g, '').trim() || null
    }
  }

  if (observacoes && observacoes.includes('[FOTO:')) {
    const match = observacoes.match(/\[FOTO:(.*?)\]/)
    if (match) {
      foto_url = match[1]
      observacoes = observacoes.replace(/\[FOTO:.*?\]/g, '').trim() || null
    }
  }

  const catUpper = (f.categoria || '').toUpperCase()
  if (CATEGORIAS_ESPECIAIS_KEYWORDS.some((kw) => catUpper.includes(kw))) {
    tipo_ferramenta = 'especial'
  }

  return {
    ...f,
    tipo_ferramenta,
    observacoes,
    foto_url,
  }
}

export function formatarRetiradaComFoto(r: any): FerramentaRetirada {
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

// ----------------------------------------------------
// Helpers de LocalStorage
// ----------------------------------------------------
export function getFerramentasLocais(): Ferramenta[] {
  try {
    const raw = localStorage.getItem(STORAGE_FERRAMENTAS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(formatarFerramentaComFoto)
      }
    }
  } catch (err) {
    console.error('Erro ao ler ferramentas locais:', err)
  }
  return []
}

export function salvarFerramentasLocais(lista: Ferramenta[]): void {
  try {
    localStorage.setItem(STORAGE_FERRAMENTAS_KEY, JSON.stringify(lista))
    window.dispatchEvent(new Event('ferramentas_updated'))
  } catch (err) {
    console.error('Erro ao salvar ferramentas locais:', err)
  }
}

export function getRetiradasLocais(): FerramentaRetirada[] {
  try {
    const raw = localStorage.getItem(STORAGE_RETIRADAS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(formatarRetiradaComFoto)
      }
    }
  } catch (err) {
    console.error('Erro ao ler retiradas locais:', err)
  }
  return []
}

export function salvarRetiradasLocais(lista: FerramentaRetirada[]): void {
  try {
    localStorage.setItem(STORAGE_RETIRADAS_KEY, JSON.stringify(lista))
    window.dispatchEvent(new Event('retiradas_updated'))
  } catch (err) {
    console.error('Erro ao salvar retiradas locais:', err)
  }
}

// ----------------------------------------------------
// Hook de Listagem de Ferramentas (Supabase com Cache Local)
// ----------------------------------------------------
export function useFerramentas() {
  const [ferramentas, setFerramentas] = useState<Ferramenta[]>(() => getFerramentasLocais())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error: sbError } = await supabase
        .from('ferramentas')
        .select('*')
        .order('nome', { ascending: true })

      if (!sbError && data && data.length > 0) {
        const formatadas = data.map(formatarFerramentaComFoto)
        setFerramentas(formatadas)
        localStorage.setItem(STORAGE_FERRAMENTAS_KEY, JSON.stringify(formatadas))
        setError(null)
      } else {
        const locais = getFerramentasLocais()
        if (locais.length > 0) {
          setFerramentas(locais)
        }
      }
    } catch (err) {
      console.warn('Falha na busca remota de ferramentas, usando cache local:', err)
      const locais = getFerramentasLocais()
      if (locais.length > 0) setFerramentas(locais)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refetch()
    const handleUpdate = () => {
      const locais = getFerramentasLocais()
      if (locais.length > 0) setFerramentas(locais)
    }
    window.addEventListener('ferramentas_updated', handleUpdate)
    return () => window.removeEventListener('ferramentas_updated', handleUpdate)
  }, [refetch])

  return { ferramentas, loading, error, refetch }
}

export interface RetiradasFiltros {
  status?: StatusRetiradaFerramenta | 'todas'
  placa?: string
  responsavel?: string
}

export function useRetiradasFerramentas(filtros: RetiradasFiltros = {}) {
  const [retiradas, setRetiradas] = useState<FerramentaRetirada[]>(() => getRetiradasLocais())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    try {
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

      const { data, error: sbError } = await query

      if (!sbError && data && data.length > 0) {
        const formatadas = data.map(formatarRetiradaComFoto)
        setRetiradas(formatadas)
        localStorage.setItem(STORAGE_RETIRADAS_KEY, JSON.stringify(formatadas))
        setError(null)
      } else {
        const locais = getRetiradasLocais()
        if (locais.length > 0) setRetiradas(locais)
      }
    } catch (err) {
      console.warn('Falha na busca remota de retiradas, usando cache local:', err)
      const locais = getRetiradasLocais()
      if (locais.length > 0) setRetiradas(locais)
    } finally {
      setLoading(false)
    }
  }, [filtros.status, filtros.placa, filtros.responsavel])

  useEffect(() => {
    refetch()
    const handleUpdate = () => {
      const locais = getRetiradasLocais()
      if (locais.length > 0) setRetiradas(locais)
    }
    window.addEventListener('retiradas_updated', handleUpdate)
    return () => window.removeEventListener('retiradas_updated', handleUpdate)
  }, [refetch])

  return { retiradas, loading, error, refetch }
}

export async function uploadFotoFerramenta(file: File): Promise<string> {
  try {
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `ferramentas/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { error } = await supabase.storage.from('fotos').upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    })
    if (!error) {
      return supabase.storage.from('fotos').getPublicUrl(path).data.publicUrl
    }
  } catch (err) {
    console.warn('Falha no storage, convertendo em dataURL:', err)
  }

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
  tipo_ferramenta?: 'comum' | 'especial'
  quantidade_total: number
  localizacao?: string
  observacoes?: string
  foto_url?: string | null
}

export async function criarFerramenta(input: CriarFerramentaInput): Promise<Ferramenta> {
  const total = Number(input.quantidade_total) || 1
  
  let observacoesFinal = input.observacoes?.trim() || ''
  if (input.tipo_ferramenta === 'especial') {
    observacoesFinal = `[TIPO:especial] ${observacoesFinal}`.trim()
  }
  if (input.foto_url) {
    observacoesFinal = observacoesFinal ? `${observacoesFinal} [FOTO:${input.foto_url}]` : `[FOTO:${input.foto_url}]`
  }

  const payload: any = {
    codigo: input.codigo ? up(input.codigo) : null,
    nome: up(input.nome),
    categoria: input.categoria ? up(input.categoria) : (input.tipo_ferramenta === 'especial' ? 'SACADORES E EXTRATORES' : 'GERAL'),
    quantidade_total: total,
    quantidade_disponivel: total,
    localizacao: input.localizacao ? up(input.localizacao) : null,
    observacoes: observacoesFinal || null,
  }

  let inseridaRemota: Ferramenta | null = null

  try {
    let { data, error } = await supabase
      .from('ferramentas')
      .insert({ ...payload, tipo_ferramenta: input.tipo_ferramenta || 'comum' })
      .select()
      .single()

    if (error) {
      const res = await supabase.from('ferramentas').insert(payload).select().single()
      if (!res.error && res.data) {
        data = res.data
      }
    }

    if (data) {
      inseridaRemota = formatarFerramentaComFoto(data)
    }
  } catch (err) {
    console.warn('Falha ao inserir no banco remoto:', err)
  }

  const novaFerramenta: Ferramenta = inseridaRemota || formatarFerramentaComFoto({
    id: `ferr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    ...payload,
    tipo_ferramenta: input.tipo_ferramenta || 'comum',
    foto_url: input.foto_url || null,
    created_at: new Date().toISOString(),
  })

  const locais = getFerramentasLocais()
  salvarFerramentasLocais([novaFerramenta, ...locais])
  return novaFerramenta
}

export interface AtualizarFerramentaInput {
  codigo?: string
  nome: string
  categoria?: string
  tipo_ferramenta?: 'comum' | 'especial'
  quantidade_total: number
  localizacao?: string
  observacoes?: string
  foto_url?: string | null
}

export async function atualizarFerramenta(id: string, input: AtualizarFerramentaInput): Promise<Ferramenta> {
  const novoTotal = Number(input.quantidade_total) || 1

  let observacoesFinal = input.observacoes?.trim() || ''
  if (input.tipo_ferramenta === 'especial') {
    observacoesFinal = `[TIPO:especial] ${observacoesFinal}`.trim()
  }
  if (input.foto_url) {
    observacoesFinal = observacoesFinal ? `${observacoesFinal} [FOTO:${input.foto_url}]` : `[FOTO:${input.foto_url}]`
  }

  // 1. Tenta atualizar no Supabase
  try {
    const { data: atual } = await supabase.from('ferramentas').select('*').eq('id', id).single()
    const emUso = atual ? (atual.quantidade_total || 0) - (atual.quantidade_disponivel || 0) : 0
    const novaDisponivel = Math.max(0, novoTotal - emUso)

    const payload: any = {
      codigo: input.codigo ? up(input.codigo) : null,
      nome: up(input.nome),
      categoria: input.categoria ? up(input.categoria) : 'GERAL',
      quantidade_total: novoTotal,
      quantidade_disponivel: novaDisponivel,
      localizacao: input.localizacao ? up(input.localizacao) : null,
      observacoes: observacoesFinal || null,
    }

    let { data, error } = await supabase
      .from('ferramentas')
      .update({ ...payload, tipo_ferramenta: input.tipo_ferramenta || 'comum' })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      const res = await supabase.from('ferramentas').update(payload).eq('id', id).select().single()
      if (!res.error && res.data) {
        data = res.data
      }
    }

    if (data) {
      const formatada = formatarFerramentaComFoto(data)
      const locais = getFerramentasLocais()
      const idx = locais.findIndex((f) => f.id === id)
      if (idx >= 0) {
        locais[idx] = formatada
      } else {
        locais.push(formatada)
      }
      salvarFerramentasLocais(locais)
      return formatada
    }
  } catch (sbErr) {
    console.warn('Erro ao atualizar ferramenta no Supabase, salvando localmente:', sbErr)
  }

  // Fallback local
  const locais = getFerramentasLocais()
  const atualIndex = locais.findIndex((f) => f.id === id)
  const atualObj = atualIndex >= 0 ? locais[atualIndex] : null
  const emUso = atualObj ? (atualObj.quantidade_total || 0) - (atualObj.quantidade_disponivel || 0) : 0
  const novaDisponivel = Math.max(0, novoTotal - emUso)

  const atualizado: Ferramenta = {
    id,
    codigo: input.codigo ? up(input.codigo) : null,
    nome: up(input.nome),
    categoria: input.categoria ? up(input.categoria) : 'GERAL',
    tipo_ferramenta: input.tipo_ferramenta || 'comum',
    quantidade_total: novoTotal,
    quantidade_disponivel: novaDisponivel,
    localizacao: input.localizacao ? up(input.localizacao) : null,
    observacoes: observacoesFinal || null,
    foto_url: input.foto_url || (atualObj?.foto_url ?? null),
    created_at: atualObj?.created_at || new Date().toISOString(),
  }

  if (atualIndex >= 0) {
    locais[atualIndex] = atualizado
    salvarFerramentasLocais(locais)
  }
  return formatarFerramentaComFoto(atualizado)
}

export async function excluirFerramenta(id: string): Promise<void> {
  const retiradas = getRetiradasLocais()
  const emUso = retiradas.find((r) => r.ferramenta_id === id && r.status === 'em_uso')
  if (emUso) {
    throw new Error('Não é possível excluir uma ferramenta que possui unidades em uso no momento.')
  }

  const locais = getFerramentasLocais().filter((f) => f.id !== id)
  salvarFerramentasLocais(locais)

  try {
    await supabase.from('ferramentas').delete().eq('id', id)
  } catch (sbErr) {
    console.warn('Excluído localmente (Supabase indisponível):', sbErr)
  }
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

  let obsFinal = input.observacoes_retirada?.trim() || ''
  if (isDefinitiva) {
    const motivoTag = input.motivo_baixa ? `MOTIVO: ${input.motivo_baixa.toUpperCase()}` : 'NÃO VOLTA'
    obsFinal = `[SAÍDA DEFINITIVA · ${motivoTag}] ${obsFinal}`.trim()
  }
  if (foto) {
    obsFinal = obsFinal ? `${obsFinal} [FOTO:${foto}]` : `[FOTO:${foto}]`
  }

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

  let retiradaRemota: FerramentaRetirada | null = null

  try {
    const { data: retirada, error: insertError } = await supabase
      .from('ferramentas_retiradas')
      .insert(payload)
      .select('*, ferramenta:ferramentas(*)')
      .single()

    if (!insertError && retirada) {
      retiradaRemota = formatarRetiradaComFoto(retirada)

      if (isDefinitiva) {
        const { data: f } = await supabase.from('ferramentas').select('*').eq('id', input.ferramenta_id).single()
        if (f) {
          await supabase
            .from('ferramentas')
            .update({
              quantidade_disponivel: Math.max(0, f.quantidade_disponivel - qtd),
              quantidade_total: Math.max(0, f.quantidade_total - qtd),
            })
            .eq('id', input.ferramenta_id)
        }
      } else {
        const { data: f } = await supabase.from('ferramentas').select('*').eq('id', input.ferramenta_id).single()
        if (f) {
          await supabase
            .from('ferramentas')
            .update({
              quantidade_disponivel: Math.max(0, f.quantidade_disponivel - qtd),
            })
            .eq('id', input.ferramenta_id)
        }
      }
    }
  } catch (err) {
    console.warn('Erro ao inserir retirada no Supabase:', err)
  }

  const locais = getFerramentasLocais()
  const ferramenta = locais.find((f) => f.id === input.ferramenta_id)

  const novaRetirada: FerramentaRetirada = retiradaRemota || {
    id: `ret_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    ferramenta_id: input.ferramenta_id,
    veiculo_id: input.veiculo_id || null,
    placa: up(input.placa),
    responsavel: up(input.responsavel),
    quantidade: qtd,
    status: isDefinitiva ? 'avaria_perda' : 'em_uso',
    observacoes_retirada: obsFinal || null,
    observacoes_devolucao: null,
    data_hora_retirada: new Date().toISOString(),
    data_hora_devolucao: isDefinitiva ? new Date().toISOString() : null,
    foto_responsavel_url: foto,
    foto_url: foto,
    created_at: new Date().toISOString(),
    ferramenta,
  }

  if (ferramenta) {
    if (isDefinitiva) {
      ferramenta.quantidade_disponivel = Math.max(0, ferramenta.quantidade_disponivel - qtd)
      ferramenta.quantidade_total = Math.max(0, ferramenta.quantidade_total - qtd)
    } else {
      ferramenta.quantidade_disponivel = Math.max(0, ferramenta.quantidade_disponivel - qtd)
    }
    salvarFerramentasLocais(locais)
  }

  const retiradas = getRetiradasLocais()
  salvarRetiradasLocais([novaRetirada, ...retiradas])

  return novaRetirada
}

export interface RegistrarDevolucaoInput {
  retiradaId: string
  status?: 'devolvido' | 'avaria_perda'
  observacoes_devolucao?: string
}

export async function registrarDevolucaoFerramenta(input: RegistrarDevolucaoInput): Promise<void> {
  const statusDevolucao = input.status || 'devolvido'

  try {
    const { data: retirada } = await supabase
      .from('ferramentas_retiradas')
      .select('*, ferramenta:ferramentas(*)')
      .eq('id', input.retiradaId)
      .single()

    if (retirada) {
      await supabase
        .from('ferramentas_retiradas')
        .update({
          status: statusDevolucao,
          data_hora_devolucao: new Date().toISOString(),
          observacoes_devolucao: input.observacoes_devolucao?.trim() || null,
        })
        .eq('id', input.retiradaId)

      const f = retirada.ferramenta as Ferramenta | undefined
      if (f) {
        if (statusDevolucao === 'devolvido') {
          await supabase
            .from('ferramentas')
            .update({
              quantidade_disponivel: Math.min(f.quantidade_total, f.quantidade_disponivel + retirada.quantidade),
            })
            .eq('id', retirada.ferramenta_id)
        } else if (statusDevolucao === 'avaria_perda') {
          await supabase
            .from('ferramentas')
            .update({
              quantidade_total: Math.max(0, f.quantidade_total - retirada.quantidade),
            })
            .eq('id', retirada.ferramenta_id)
        }
      }
    }
  } catch (err) {
    console.warn('Erro ao atualizar devolução no Supabase:', err)
  }

  const retiradas = getRetiradasLocais()
  const retirada = retiradas.find((r) => r.id === input.retiradaId)
  if (retirada) {
    retirada.status = statusDevolucao
    retirada.data_hora_devolucao = new Date().toISOString()
    retirada.observacoes_devolucao = input.observacoes_devolucao?.trim() || null
    salvarRetiradasLocais(retiradas)

    const locais = getFerramentasLocais()
    const ferramenta = locais.find((f) => f.id === retirada.ferramenta_id)
    if (ferramenta) {
      if (statusDevolucao === 'devolvido') {
        ferramenta.quantidade_disponivel = Math.min(
          ferramenta.quantidade_total,
          ferramenta.quantidade_disponivel + retirada.quantidade,
        )
      } else if (statusDevolucao === 'avaria_perda') {
        ferramenta.quantidade_total = Math.max(0, ferramenta.quantidade_total - retirada.quantidade)
      }
      salvarFerramentasLocais(locais)
    }
  }
}

export async function reverterDevolucaoFerramenta(retiradaId: string): Promise<void> {
  try {
    const { data: retirada } = await supabase
      .from('ferramentas_retiradas')
      .select('*, ferramenta:ferramentas(*)')
      .eq('id', retiradaId)
      .single()

    if (retirada) {
      await supabase
        .from('ferramentas_retiradas')
        .update({
          status: 'em_uso',
          data_hora_devolucao: null,
          observacoes_devolucao: null,
        })
        .eq('id', retiradaId)

      const f = retirada.ferramenta as Ferramenta | undefined
      if (f) {
        await supabase
          .from('ferramentas')
          .update({
            quantidade_disponivel: Math.max(0, (f.quantidade_disponivel || 0) - (retirada.quantidade || 1)),
          })
          .eq('id', retirada.ferramenta_id)
      }
    }
  } catch (err) {
    console.warn('Erro ao reverter devolução no Supabase:', err)
  }

  const retiradas = getRetiradasLocais()
  const retirada = retiradas.find((r) => r.id === retiradaId)
  if (retirada) {
    retirada.status = 'em_uso'
    retirada.data_hora_devolucao = null
    retirada.observacoes_devolucao = null
    salvarRetiradasLocais(retiradas)

    const locais = getFerramentasLocais()
    const ferramenta = locais.find((f) => f.id === retirada.ferramenta_id)
    if (ferramenta) {
      ferramenta.quantidade_disponivel = Math.max(0, (ferramenta.quantidade_disponivel || 0) - (retirada.quantidade || 1))
      salvarFerramentasLocais(locais)
    }
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
  const retiradas = getRetiradasLocais()
  const retiradaIndex = retiradas.findIndex((r) => r.id === input.id)
  const atual = retiradaIndex >= 0 ? retiradas[retiradaIndex] : null

  const novaQtd = input.quantidade !== undefined ? Number(input.quantidade) || 1 : (atual?.quantidade || 1)
  const novaFerramentaId = input.ferramenta_id || (atual?.ferramenta_id || '')

  const foto = input.foto_responsavel_url !== undefined ? input.foto_responsavel_url : (atual?.foto_responsavel_url || atual?.foto_url)
  let obs = input.observacoes_retirada !== undefined ? input.observacoes_retirada : atual?.observacoes_retirada
  if (obs) {
    obs = obs.replace(/\[FOTO:.*?\]/g, '').trim()
  }
  if (foto) {
    obs = obs ? `${obs} [FOTO:${foto}]` : `[FOTO:${foto}]`
  }

  const payload: Record<string, unknown> = {
    ferramenta_id: novaFerramentaId,
    placa: input.placa ? up(input.placa) : atual?.placa,
    responsavel: input.responsavel ? up(input.responsavel) : atual?.responsavel,
    quantidade: novaQtd,
    observacoes_retirada: obs || null,
  }

  if (input.veiculo_id !== undefined) payload.veiculo_id = input.veiculo_id || null
  if (input.data_hora_retirada) payload.data_hora_retirada = input.data_hora_retirada

  try {
    await supabase.from('ferramentas_retiradas').update(payload).eq('id', input.id)
  } catch (sbErr) {
    console.warn('Erro ao atualizar retirada no Supabase:', sbErr)
  }

  const locais = getFerramentasLocais()
  const atualizada: FerramentaRetirada = {
    ...(atual || ({} as FerramentaRetirada)),
    id: input.id,
    ferramenta_id: novaFerramentaId,
    placa: input.placa ? up(input.placa) : (atual?.placa || ''),
    responsavel: input.responsavel ? up(input.responsavel) : (atual?.responsavel || ''),
    quantidade: novaQtd,
    observacoes_retirada: obs || null,
    veiculo_id: input.veiculo_id !== undefined ? input.veiculo_id || null : (atual?.veiculo_id || null),
    data_hora_retirada: input.data_hora_retirada || (atual?.data_hora_retirada || new Date().toISOString()),
    foto_responsavel_url: foto,
    foto_url: foto,
    ferramenta: locais.find((f) => f.id === novaFerramentaId) || atual?.ferramenta,
    status: atual?.status || 'em_uso',
    created_at: atual?.created_at || new Date().toISOString(),
    data_hora_devolucao: atual?.data_hora_devolucao || null,
    observacoes_devolucao: atual?.observacoes_devolucao || null,
  }

  if (retiradaIndex >= 0) {
    retiradas[retiradaIndex] = atualizada
    salvarRetiradasLocais(retiradas)
  }

  return atualizada
}

export async function excluirRetiradaFerramenta(retiradaId: string): Promise<void> {
  const retiradas = getRetiradasLocais()
  const retirada = retiradas.find((r) => r.id === retiradaId)

  if (retirada && retirada.status === 'em_uso') {
    const locais = getFerramentasLocais()
    const ferramenta = locais.find((f) => f.id === retirada.ferramenta_id)
    if (ferramenta) {
      ferramenta.quantidade_disponivel = Math.min(
        ferramenta.quantidade_total,
        (ferramenta.quantidade_disponivel || 0) + (retirada.quantidade || 1),
      )
      salvarFerramentasLocais(locais)
    }
  }

  salvarRetiradasLocais(retiradas.filter((r) => r.id !== retiradaId))

  try {
    await supabase.from('ferramentas_retiradas').delete().eq('id', retiradaId)
  } catch (sbErr) {
    console.warn('Retirada excluída localmente:', sbErr)
  }
}
