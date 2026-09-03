import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { up } from '@/lib/text'
import type { Ferramenta, FerramentaRetirada, StatusRetiradaFerramenta } from '@/lib/types'

export const STORAGE_FERRAMENTAS_KEY = 'gvel_inventario_ferramentas_v1'
export const STORAGE_RETIRADAS_KEY = 'gvel_inventario_retiradas_v1'
export const STORAGE_EXCLUIDAS_KEY = 'gvel_inventario_ferramentas_excluidas_v1'

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

export function getIdsExcluidos(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_EXCLUIDAS_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return []
}

export function adicionarIdExcluido(id: string) {
  try {
    const excluidos = getIdsExcluidos()
    if (!excluidos.includes(id)) {
      excluidos.push(id)
      localStorage.setItem(STORAGE_EXCLUIDAS_KEY, JSON.stringify(excluidos))
    }
  } catch {}
}

// Uma exclusão só é gravada depois que o Supabase confirma a exclusão (ver
// excluirFerramenta), então, a partir de agora, um id "excluído" nunca deveria
// aparecer numa busca nova do servidor. Se aparecer mesmo assim (ex: resquício
// de uma versão antiga do app que excluía só localmente), a exclusão estava
// errada — libera o item de volta sozinho, sem precisar de botão manual.
function reconciliarExcluidosComRemotas(remotas: Ferramenta[]): void {
  try {
    const excluidos = getIdsExcluidos()
    if (excluidos.length === 0) return
    const idsRemotos = new Set(remotas.map((r) => r.id))
    const aindaValidos = excluidos.filter((id) => !idsRemotos.has(id))
    if (aindaValidos.length !== excluidos.length) {
      localStorage.setItem(STORAGE_EXCLUIDAS_KEY, JSON.stringify(aindaValidos))
    }
  } catch {}
}

export function formatarFerramentaComFoto(f: any): Ferramenta {
  if (!f) return f
  let foto_url: string | null = f.foto_url || null
  let observacoes: string | null = f.observacoes || null
  let tipo_ferramenta: 'comum' | 'especial' | 'estoque' | undefined = f.tipo_ferramenta

  if (observacoes && observacoes.includes('[TIPO:')) {
    const matchTipo = observacoes.match(/\[TIPO:(.*?)\]/)
    if (matchTipo) {
      tipo_ferramenta = matchTipo[1] === 'especial' ? 'especial' : matchTipo[1] === 'estoque' ? 'estoque' : 'comum'
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

  // Heurística de fallback SOMENTE se tipo_ferramenta não foi explicitamente definido
  if (!tipo_ferramenta) {
    const catUpper = (f.categoria || '').toUpperCase()
    if (CATEGORIAS_ESPECIAIS_KEYWORDS.some((kw) => catUpper.includes(kw))) {
      tipo_ferramenta = 'especial'
    } else {
      tipo_ferramenta = 'comum'
    }
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
export async function zerarTodoEstoque(): Promise<void> {
  try {
    localStorage.removeItem(STORAGE_EXCLUIDAS_KEY)
    localStorage.removeItem(STORAGE_FERRAMENTAS_KEY)
    localStorage.removeItem(STORAGE_RETIRADAS_KEY)
    localStorage.removeItem('gvel_inventario_caixas_v1')
    localStorage.removeItem('gvel_inventario_consumo_v1')
    localStorage.removeItem('gvel_inventario_baixas_consumo_v1')

    localStorage.setItem(STORAGE_EXCLUIDAS_KEY, '[]')
    localStorage.setItem(STORAGE_FERRAMENTAS_KEY, '[]')
    localStorage.setItem(STORAGE_RETIRADAS_KEY, '[]')
    localStorage.setItem('gvel_inventario_caixas_v1', '[]')
    localStorage.setItem('gvel_inventario_consumo_v1', '[]')
    localStorage.setItem('gvel_inventario_baixas_consumo_v1', '[]')
  } catch (e) {
    console.warn('Erro ao limpar localStorage:', e)
  }

  try {
    // Tenta limpar dados do banco remoto se existirem
    await supabase.from('ferramentas_retiradas').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('ferramentas').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  } catch (sbErr) {
    console.warn('Erro ao zerar ferramentas no Supabase:', sbErr)
  }

  window.dispatchEvent(new Event('ferramentas_updated'))
  window.dispatchEvent(new Event('retiradas_updated'))
}

export function getFerramentasLocais(): Ferramenta[] {
  const excluidos = getIdsExcluidos()
  try {
    const raw = localStorage.getItem(STORAGE_FERRAMENTAS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        return parsed
          .filter((item) => !item.id?.startsWith('ferr_padrao_') && !excluidos.includes(item.id))
          .map(formatarFerramentaComFoto)
      }
    }
  } catch (err) {
    console.error('Erro ao ler ferramentas locais:', err)
  }
  return []
}

export function salvarFerramentasLocais(lista: Ferramenta[]): void {
  try {
    const formatadas = lista.map(formatarFerramentaComFoto)
    localStorage.setItem(STORAGE_FERRAMENTAS_KEY, JSON.stringify(formatadas))
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
// Hook de Listagem de Ferramentas (Supabase com Cache Local e Paginação Completa)
// ----------------------------------------------------
export async function fetchTodasFerramentasSupabase(): Promise<Ferramenta[]> {
  const todas: any[] = []
  let page = 0
  const pageSize = 1000
  let temMais = true

  while (temMais) {
    const from = page * pageSize
    const to = from + pageSize - 1
    const { data, error } = await supabase
      .from('ferramentas')
      .select('*')
      .order('nome', { ascending: true })
      .range(from, to)

    if (error) {
      console.warn('Erro ao buscar página de ferramentas do Supabase:', error)
      break
    }

    if (data && data.length > 0) {
      todas.push(...data)
      if (data.length < pageSize) {
        temMais = false
      } else {
        page++
      }
    } else {
      temMais = false
    }
  }

  return todas.map(formatarFerramentaComFoto)
}

const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function mesclarRemotasComLocais(remotas: Ferramenta[], locais: Ferramenta[]): Ferramenta[] {
  const excluidos = getIdsExcluidos()
  const mapa = new Map<string, Ferramenta>()

  // 1. Manter todos os itens locais válidos (incluindo os originados do catálogo base)
  locais.forEach((loc) => {
    if (!excluidos.includes(loc.id)) {
      mapa.set(loc.id, formatarFerramentaComFoto(loc))
    }
  })

  // 2. Mesclar/atualizar com dados vindos do Supabase
  remotas.forEach((rem) => {
    if (excluidos.includes(rem.id)) return
    const f = formatarFerramentaComFoto(rem)

    let chaveAlvo = rem.id
    if (!mapa.has(rem.id)) {
      // Só tenta "casar" com um item local que ainda não tem id real do
      // Supabase (criado offline, id tipo "ferr_..."). Casar por código/nome
      // contra itens que JÁ são linhas reais do banco é o que causava itens
      // diferentes com o mesmo código (ex: várias latas "TEKBOND") ou mesmo
      // nome se sobrescreverem e sumirem da lista.
      for (const [idLoc, locObj] of mapa.entries()) {
        if (REGEX_UUID.test(idLoc)) continue
        if (rem.codigo && locObj.codigo && rem.codigo === locObj.codigo) {
          chaveAlvo = idLoc
          break
        } else if (rem.nome && locObj.nome && rem.nome.toUpperCase() === locObj.nome.toUpperCase()) {
          chaveAlvo = idLoc
          break
        }
      }
    }
    mapa.set(chaveAlvo, f)
  })

  return Array.from(mapa.values())
}

export function useFerramentas() {
  const [ferramentas, setFerramentas] = useState<Ferramenta[]>(() => getFerramentasLocais())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    try {
      const remotas = await fetchTodasFerramentasSupabase()

      if (remotas && remotas.length > 0) {
        reconciliarExcluidosComRemotas(remotas)
      }

      const locais = getFerramentasLocais()

      if (remotas && remotas.length > 0) {
        const limpasRemotas = remotas.filter(r => !r.id?.startsWith('ferr_padrao_'))
        const mescladas = mesclarRemotasComLocais(limpasRemotas, locais)
        setFerramentas(mescladas)
        localStorage.setItem(STORAGE_FERRAMENTAS_KEY, JSON.stringify(mescladas))
        setError(null)
      } else {
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
    // Se a página carregou sem internet (ou o Supabase ficou fora do ar por um
    // instante), refaz a busca sozinho assim que a conexão voltar — sem precisar
    // de botão manual.
    const handleOnline = () => refetch()
    window.addEventListener('ferramentas_updated', handleUpdate)
    window.addEventListener('online', handleOnline)
    return () => {
      window.removeEventListener('ferramentas_updated', handleUpdate)
      window.removeEventListener('online', handleOnline)
    }
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
  tipo_ferramenta?: 'comum' | 'especial' | 'estoque'
  quantidade_total: number
  localizacao?: string
  observacoes?: string
  foto_url?: string | null
}

export async function criarFerramenta(input: CriarFerramentaInput): Promise<Ferramenta> {
  const total = Number(input.quantidade_total) || 1
  
  let observacoesFinal = input.observacoes?.trim() || ''
  if (observacoesFinal) {
    observacoesFinal = observacoesFinal.replace(/\[TIPO:.*?\]/g, '').replace(/\[FOTO:.*?\]/g, '').trim()
  }
  observacoesFinal = `[TIPO:${input.tipo_ferramenta || 'comum'}] ${observacoesFinal}`.trim()
  if (input.foto_url) {
    observacoesFinal = `${observacoesFinal} [FOTO:${input.foto_url}]`.trim()
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
  salvarFerramentasLocais([novaFerramenta, ...locais.filter((f) => f.id !== novaFerramenta.id)])
  return novaFerramenta
}

export interface AtualizarFerramentaInput {
  codigo?: string
  nome: string
  categoria?: string
  tipo_ferramenta?: 'comum' | 'especial' | 'estoque'
  quantidade_total: number
  localizacao?: string
  observacoes?: string
  foto_url?: string | null
}

export async function atualizarFerramenta(id: string, input: AtualizarFerramentaInput): Promise<Ferramenta> {
  const novoTotal = Number(input.quantidade_total) || 1

  let observacoesFinal = input.observacoes?.trim() || ''
  if (observacoesFinal) {
    observacoesFinal = observacoesFinal.replace(/\[TIPO:.*?\]/g, '').replace(/\[FOTO:.*?\]/g, '').trim()
  }
  observacoesFinal = `[TIPO:${input.tipo_ferramenta || 'comum'}] ${observacoesFinal}`.trim()
  if (input.foto_url) {
    observacoesFinal = `${observacoesFinal} [FOTO:${input.foto_url}]`.trim()
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
      const formatada = formatarFerramentaComFoto({ ...data, tipo_ferramenta: input.tipo_ferramenta })
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
  } else {
    locais.push(atualizado)
  }
  salvarFerramentasLocais(locais)
  return formatarFerramentaComFoto(atualizado)
}

export async function excluirFerramenta(id: string): Promise<void> {
  const retiradas = getRetiradasLocais()
  const emUso = retiradas.find((r) => r.ferramenta_id === id && r.status === 'em_uso')
  if (emUso) {
    throw new Error('Não é possível excluir uma ferramenta que possui unidades em uso no momento.')
  }

  // Só marca como excluído (escondendo da tela pra sempre) depois de confirmar
  // que a exclusão realmente aconteceu no servidor — senão, se a exclusão no
  // Supabase falhar (rede caiu, etc.), o item continua existindo lá mas fica
  // escondido só neste aparelho para sempre, sem forma de saber que sumiu.
  try {
    const { error } = await supabase.from('ferramentas').delete().eq('id', id)
    if (error) throw error
  } catch (sbErr) {
    console.error('Erro ao excluir ferramenta no Supabase:', sbErr)
    throw new Error('Não foi possível excluir agora. Verifique sua conexão e tente novamente.')
  }

  adicionarIdExcluido(id)
  const locais = getFerramentasLocais().filter((f) => f.id !== id)
  salvarFerramentasLocais(locais)
}

export interface EdicaoMassaInput {
  tipo_ferramenta?: 'comum' | 'especial' | 'estoque'
  categoria?: string
  localizacao?: string
}

export async function atualizarFerramentasEmMassa(
  ids: string[],
  alteracoes: EdicaoMassaInput
): Promise<void> {
  if (!ids || ids.length === 0) return

  const locais = getFerramentasLocais()
  const atualizadas: Ferramenta[] = []

  for (const f of locais) {
    if (ids.includes(f.id)) {
      let obs = f.observacoes || ''
      const tipoNovo = alteracoes.tipo_ferramenta !== undefined ? alteracoes.tipo_ferramenta : f.tipo_ferramenta || 'comum'

      if (alteracoes.tipo_ferramenta !== undefined) {
        obs = obs.replace(/\[TIPO:.*?\]/g, '').trim()
        obs = `[TIPO:${tipoNovo}] ${obs}`.trim()
      }

      const itemAtualizado: Ferramenta = {
        ...f,
        tipo_ferramenta: tipoNovo,
        categoria: alteracoes.categoria ? up(alteracoes.categoria) : f.categoria,
        localizacao: alteracoes.localizacao !== undefined ? (alteracoes.localizacao ? up(alteracoes.localizacao) : null) : f.localizacao,
        observacoes: obs || null,
      }
      atualizadas.push(itemAtualizado)

      // Atualiza também no Supabase de forma não bloqueante
      try {
        const payload: any = {
          categoria: itemAtualizado.categoria,
          localizacao: itemAtualizado.localizacao,
          observacoes: itemAtualizado.observacoes,
          tipo_ferramenta: itemAtualizado.tipo_ferramenta,
        }
        supabase.from('ferramentas').update(payload).eq('id', f.id).then(() => {})
      } catch {}
    } else {
      atualizadas.push(f)
    }
  }

  salvarFerramentasLocais(atualizadas)
}

export async function excluirFerramentasEmMassa(ids: string[]): Promise<void> {
  if (!ids || ids.length === 0) return

  const retiradas = getRetiradasLocais()
  const emUso = retiradas.find((r) => ids.includes(r.ferramenta_id) && r.status === 'em_uso')
  if (emUso) {
    throw new Error('Algumas ferramentas selecionadas possuem unidades em uso no momento e não podem ser excluídas.')
  }

  // Mesmo motivo do excluirFerramenta: só esconde da tela depois de confirmar
  // que a exclusão aconteceu de verdade no servidor.
  try {
    const { error } = await supabase.from('ferramentas').delete().in('id', ids)
    if (error) throw error
  } catch (sbErr) {
    console.error('Erro ao excluir ferramentas no Supabase:', sbErr)
    throw new Error('Não foi possível excluir agora. Verifique sua conexão e tente novamente.')
  }

  ids.forEach(adicionarIdExcluido)
  const locais = getFerramentasLocais().filter((f) => !ids.includes(f.id))
  salvarFerramentasLocais(locais)
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

export async function sincronizarTudoParaSupabase(): Promise<{ sucesso: boolean; mensagem: string; totalFerramentas: number; totalRetiradas: number }> {
  try {
    const locaisFerramentas = getFerramentasLocais()
    const locaisRetiradas = getRetiradasLocais()

    if (locaisFerramentas.length === 0 && locaisRetiradas.length === 0) {
      return { sucesso: false, mensagem: 'Nenhum dado encontrado para sincronizar.', totalFerramentas: 0, totalRetiradas: 0 }
    }

    let gravadasFerramentas = 0
    let gravadasRetiradas = 0

    // 1. Sincronizar ferramentas
    for (const f of locaisFerramentas) {
      let observacoesFinal = f.observacoes?.trim() || ''
      if (observacoesFinal) {
        observacoesFinal = observacoesFinal.replace(/\[TIPO:.*?\]/g, '').replace(/\[FOTO:.*?\]/g, '').trim()
      }
      observacoesFinal = `[TIPO:${f.tipo_ferramenta || 'comum'}] ${observacoesFinal}`.trim()
      if (f.foto_url) {
        observacoesFinal = `${observacoesFinal} [FOTO:${f.foto_url}]`.trim()
      }

      const payload: any = {
        codigo: f.codigo ? up(f.codigo) : null,
        nome: up(f.nome),
        categoria: f.categoria ? up(f.categoria) : 'GERAL',
        tipo_ferramenta: f.tipo_ferramenta || 'comum',
        quantidade_total: Number(f.quantidade_total) || 1,
        quantidade_disponivel: Number(f.quantidade_disponivel) ?? Number(f.quantidade_total) ?? 1,
        localizacao: f.localizacao ? up(f.localizacao) : null,
        observacoes: observacoesFinal || null,
        foto_url: f.foto_url || null,
      }

      // Se for UUID válido do Supabase, mantém o ID
      const isUUID = f.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(f.id)
      if (isUUID) {
        payload.id = f.id
      }

      const { error } = await supabase.from('ferramentas').upsert(payload)
      if (!error) {
        gravadasFerramentas++
      } else {
        console.warn('Erro ao sincronizar ferramenta:', f.nome, error)
      }
    }

    // 2. Sincronizar retiradas
    for (const r of locaisRetiradas) {
      const isUUID = r.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(r.id)
      const payload: any = {
        placa: up(r.placa),
        responsavel: up(r.responsavel),
        quantidade: Number(r.quantidade) || 1,
        data_hora_retirada: r.data_hora_retirada || new Date().toISOString(),
        data_hora_devolucao: r.data_hora_devolucao || null,
        status: r.status || 'em_uso',
        observacoes_retirada: r.observacoes_retirada || null,
        observacoes_devolucao: r.observacoes_devolucao || null,
        foto_url: r.foto_url || r.foto_responsavel_url || null,
        foto_responsavel_url: r.foto_responsavel_url || r.foto_url || null,
      }
      if (isUUID) payload.id = r.id
      if (r.ferramenta_id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(r.ferramenta_id)) {
        payload.ferramenta_id = r.ferramenta_id
      }

      if (payload.ferramenta_id) {
        const { error } = await supabase.from('ferramentas_retiradas').upsert(payload)
        if (!error) gravadasRetiradas++
      }
    }

    return {
      sucesso: true,
      mensagem: `Sincronização concluída com sucesso! ${gravadasFerramentas} ferramentas e ${gravadasRetiradas} retiradas sincronizadas no Supabase.`,
      totalFerramentas: gravadasFerramentas,
      totalRetiradas: gravadasRetiradas,
    }
  } catch (err: any) {
    return {
      sucesso: false,
      mensagem: `Falha na sincronização: ${err?.message || 'Erro desconhecido'}`,
      totalFerramentas: 0,
      totalRetiradas: 0,
    }
  }
}

