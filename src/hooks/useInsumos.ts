import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { ItemConsumo, RegistroBaixaConsumo } from '@/lib/types'

export const STORAGE_CONSUMO_KEY = 'gvel_inventario_consumo_v1'
export const STORAGE_BAIXAS_CONSUMO_KEY = 'gvel_inventario_baixas_consumo_v1'
const STORAGE_EXCLUIDOS_CONSUMO_KEY = 'gvel_inventario_consumo_excluidos_v1'

const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ----------------------------------------------------
// Helpers de LocalStorage (cache/offline, não é mais a fonte da verdade)
// ----------------------------------------------------
function getIdsExcluidosConsumo(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_EXCLUIDOS_CONSUMO_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return []
}

function adicionarIdExcluidoConsumo(id: string) {
  try {
    const excluidos = getIdsExcluidosConsumo()
    if (!excluidos.includes(id)) {
      excluidos.push(id)
      localStorage.setItem(STORAGE_EXCLUIDOS_CONSUMO_KEY, JSON.stringify(excluidos))
    }
  } catch {}
}

// Mesmo motivo do reconciliarExcluidosComRemotas em useFerramentas.ts: uma
// exclusão só é gravada aqui depois que o Supabase confirma. Se o id sumiu
// da busca remota e ainda está marcado como excluído, libera sozinho.
function reconciliarExcluidosComRemotas(remotos: ItemConsumo[]): void {
  try {
    const excluidos = getIdsExcluidosConsumo()
    if (excluidos.length === 0) return
    const idsRemotos = new Set(remotos.map((r) => r.id))
    const aindaValidos = excluidos.filter((id) => !idsRemotos.has(id))
    if (aindaValidos.length !== excluidos.length) {
      localStorage.setItem(STORAGE_EXCLUIDOS_CONSUMO_KEY, JSON.stringify(aindaValidos))
    }
  } catch {}
}

export function getInsumosLocais(): ItemConsumo[] {
  const excluidos = getIdsExcluidosConsumo()
  try {
    const raw = localStorage.getItem(STORAGE_CONSUMO_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        return parsed.filter((item) => !excluidos.includes(item.id))
      }
    }
  } catch (err) {
    console.error('Erro ao ler insumos locais:', err)
  }
  return []
}

export function salvarInsumosLocais(lista: ItemConsumo[]): void {
  try {
    localStorage.setItem(STORAGE_CONSUMO_KEY, JSON.stringify(lista))
    window.dispatchEvent(new Event('insumos_updated'))
  } catch (err) {
    console.error('Erro ao salvar insumos locais:', err)
  }
}

export function getBaixasConsumoLocais(): RegistroBaixaConsumo[] {
  try {
    const raw = localStorage.getItem(STORAGE_BAIXAS_CONSUMO_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed
    }
  } catch (err) {
    console.error('Erro ao ler baixas de consumo locais:', err)
  }
  return []
}

export function salvarBaixasConsumoLocais(lista: RegistroBaixaConsumo[]): void {
  try {
    localStorage.setItem(STORAGE_BAIXAS_CONSUMO_KEY, JSON.stringify(lista))
    window.dispatchEvent(new Event('baixas_consumo_updated'))
  } catch (err) {
    console.error('Erro ao salvar baixas de consumo locais:', err)
  }
}

// ----------------------------------------------------
// Busca no Supabase (paginação completa) + mesclagem com cache local
// ----------------------------------------------------
export async function fetchTodosInsumosSupabase(): Promise<ItemConsumo[]> {
  const todos: ItemConsumo[] = []
  let page = 0
  const pageSize = 1000
  let temMais = true

  while (temMais) {
    const from = page * pageSize
    const to = from + pageSize - 1
    const { data, error } = await supabase
      .from('itens_consumo')
      .select('*')
      .order('nome', { ascending: true })
      .range(from, to)

    if (error) {
      console.warn('Erro ao buscar página de insumos do Supabase:', error)
      break
    }

    if (data && data.length > 0) {
      todos.push(...(data as ItemConsumo[]))
      temMais = data.length >= pageSize
      page++
    } else {
      temMais = false
    }
  }

  return todos
}

export async function fetchTodasBaixasConsumoSupabase(): Promise<RegistroBaixaConsumo[]> {
  const todas: RegistroBaixaConsumo[] = []
  let page = 0
  const pageSize = 1000
  let temMais = true

  while (temMais) {
    const from = page * pageSize
    const to = from + pageSize - 1
    const { data, error } = await supabase
      .from('consumo_baixas')
      .select('*')
      .order('data_hora', { ascending: false })
      .range(from, to)

    if (error) {
      console.warn('Erro ao buscar página de baixas de consumo do Supabase:', error)
      break
    }

    if (data && data.length > 0) {
      todas.push(...(data as RegistroBaixaConsumo[]))
      temMais = data.length >= pageSize
      page++
    } else {
      temMais = false
    }
  }

  return todas
}

// Casa itens locais (criados offline, id tipo "insumo_...") com a linha
// remota correspondente por código/nome, igual à lógica já usada para
// ferramentas — evita duplicar o mesmo insumo na tela.
function mesclarInsumosRemotosComLocais(remotos: ItemConsumo[], locais: ItemConsumo[]): ItemConsumo[] {
  const excluidos = getIdsExcluidosConsumo()
  const mapa = new Map<string, ItemConsumo>()

  locais.forEach((loc) => {
    if (!excluidos.includes(loc.id)) mapa.set(loc.id, loc)
  })

  remotos.forEach((rem) => {
    if (excluidos.includes(rem.id)) return

    let chaveAlvo = rem.id
    if (!mapa.has(rem.id)) {
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
    mapa.set(chaveAlvo, rem)
  })

  return Array.from(mapa.values())
}

export function useInsumos() {
  const [itensConsumo, setItensConsumo] = useState<ItemConsumo[]>(() => getInsumosLocais())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    try {
      const remotos = await fetchTodosInsumosSupabase()

      if (remotos && remotos.length > 0) {
        reconciliarExcluidosComRemotas(remotos)
      }

      const locais = getInsumosLocais()

      if (remotos && remotos.length > 0) {
        const mesclados = mesclarInsumosRemotosComLocais(remotos, locais)
        setItensConsumo(mesclados)
        localStorage.setItem(STORAGE_CONSUMO_KEY, JSON.stringify(mesclados))
        setError(null)
      } else if (locais.length > 0) {
        setItensConsumo(locais)
      }
    } catch (err) {
      console.warn('Falha na busca remota de insumos, usando cache local:', err)
      const locais = getInsumosLocais()
      if (locais.length > 0) setItensConsumo(locais)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refetch()
    const handleUpdate = () => setItensConsumo(getInsumosLocais())
    const handleOnline = () => refetch()
    window.addEventListener('insumos_updated', handleUpdate)
    window.addEventListener('online', handleOnline)
    return () => {
      window.removeEventListener('insumos_updated', handleUpdate)
      window.removeEventListener('online', handleOnline)
    }
  }, [refetch])

  return { itensConsumo, loading, error, refetch }
}

export function useBaixasConsumo() {
  const [baixasConsumo, setBaixasConsumo] = useState<RegistroBaixaConsumo[]>(() => getBaixasConsumoLocais())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    try {
      const remotas = await fetchTodasBaixasConsumoSupabase()

      if (remotas && remotas.length > 0) {
        const idsRemotos = new Set(remotas.map((r) => r.id))
        const locaisSoOffline = getBaixasConsumoLocais().filter((b) => !idsRemotos.has(b.id))
        const mescladas = [...locaisSoOffline, ...remotas]
        setBaixasConsumo(mescladas)
        localStorage.setItem(STORAGE_BAIXAS_CONSUMO_KEY, JSON.stringify(mescladas))
        setError(null)
      } else {
        const locais = getBaixasConsumoLocais()
        if (locais.length > 0) setBaixasConsumo(locais)
      }
    } catch (err) {
      console.warn('Falha na busca remota de baixas de consumo, usando cache local:', err)
      const locais = getBaixasConsumoLocais()
      if (locais.length > 0) setBaixasConsumo(locais)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refetch()
    const handleUpdate = () => setBaixasConsumo(getBaixasConsumoLocais())
    window.addEventListener('baixas_consumo_updated', handleUpdate)
    return () => window.removeEventListener('baixas_consumo_updated', handleUpdate)
  }, [refetch])

  return { baixasConsumo, loading, error, refetch }
}

// ----------------------------------------------------
// CRUD (grava no Supabase; localStorage vira só cache/fallback)
// ----------------------------------------------------
export async function criarInsumo(dados: ItemConsumo): Promise<ItemConsumo> {
  const { id: _id, created_at: _createdAt, ...payload } = dados

  try {
    const { data, error } = await supabase.from('itens_consumo').insert(payload).select().single()
    if (!error && data) {
      const novo = data as ItemConsumo
      salvarInsumosLocais([novo, ...getInsumosLocais()])
      return novo
    }
  } catch (err) {
    console.warn('Falha ao inserir insumo no Supabase:', err)
  }

  const novoLocal: ItemConsumo = { ...dados, id: `insumo_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` }
  salvarInsumosLocais([novoLocal, ...getInsumosLocais()])
  return novoLocal
}

export async function atualizarInsumo(id: string, dados: ItemConsumo): Promise<ItemConsumo> {
  const { id: _id, created_at: _createdAt, ...payload } = dados
  const isUUID = REGEX_UUID.test(id)

  try {
    if (isUUID) {
      const { data, error } = await supabase.from('itens_consumo').update(payload).eq('id', id).select().single()
      if (!error && data) {
        const atualizado = data as ItemConsumo
        const locais = getInsumosLocais()
        const idx = locais.findIndex((it) => it.id === id)
        if (idx >= 0) locais[idx] = atualizado
        else locais.unshift(atualizado)
        salvarInsumosLocais(locais)
        return atualizado
      }
    } else {
      // Item nunca foi sincronizado (id local de uma versão antiga do app) —
      // ao editar, aproveita e migra ele para uma linha de verdade no banco.
      const { data, error } = await supabase.from('itens_consumo').insert(payload).select().single()
      if (!error && data) {
        const atualizado = data as ItemConsumo
        const locais = getInsumosLocais().filter((it) => it.id !== id)
        salvarInsumosLocais([atualizado, ...locais])
        return atualizado
      }
    }
  } catch (err) {
    console.warn('Erro ao atualizar insumo no Supabase, salvando localmente:', err)
  }

  const atualizadoLocal: ItemConsumo = { ...dados, id }
  const locais = getInsumosLocais()
  const idx = locais.findIndex((it) => it.id === id)
  if (idx >= 0) locais[idx] = atualizadoLocal
  else locais.unshift(atualizadoLocal)
  salvarInsumosLocais(locais)
  return atualizadoLocal
}

export async function excluirInsumo(id: string): Promise<void> {
  if (REGEX_UUID.test(id)) {
    try {
      const { error } = await supabase.from('itens_consumo').delete().eq('id', id)
      if (error) throw error
    } catch (err) {
      console.error('Erro ao excluir insumo no Supabase:', err)
      throw new Error('Não foi possível excluir agora. Verifique sua conexão e tente novamente.')
    }
  }

  adicionarIdExcluidoConsumo(id)
  salvarInsumosLocais(getInsumosLocais().filter((it) => it.id !== id))
}

/**
 * Dá baixa de consumo: decrementa o estoque e, se zerou e existe tambor de
 * reserva, abre o próximo sozinho (soma a numeração, desconta a reserva).
 * `baixa` traz os dados já preenchidos pelo formulário (id/data_hora são
 * ignorados — o banco gera os definitivos).
 */
export async function registrarBaixaConsumo(
  item: ItemConsumo,
  baixa: RegistroBaixaConsumo,
): Promise<{ item: ItemConsumo; baixa: RegistroBaixaConsumo }> {
  const restante = Math.max(0, item.quantidade_atual - baixa.quantidade)
  const temReserva = restante <= 0 && Boolean(item.capacidade_maxima) && (item.quantidade_tambores || 0) > 0

  const camposItem = temReserva
    ? {
        quantidade_atual: item.capacidade_maxima!,
        numero_tambor_atual: (item.numero_tambor_atual || 1) + 1,
        quantidade_tambores: Math.max(0, (item.quantidade_tambores || 0) - 1),
      }
    : { quantidade_atual: restante }

  const baixaPayload = {
    item_id: REGEX_UUID.test(item.id) ? item.id : null,
    item_nome: item.nome,
    unidade: item.unidade,
    quantidade: baixa.quantidade,
    responsavel: baixa.responsavel,
    foto_responsavel_url: baixa.foto_responsavel_url || null,
    placa: baixa.placa || null,
    motivo: baixa.motivo || null,
    numero_tambor: item.capacidade_maxima ? camposItem.numero_tambor_atual ?? item.numero_tambor_atual ?? 1 : null,
    quantidade_restante: item.capacidade_maxima ? camposItem.quantidade_atual : null,
    data_hora: new Date().toISOString(),
  }

  let itemAtualizado: ItemConsumo = { ...item, ...camposItem }
  let baixaGravada: RegistroBaixaConsumo = {
    ...baixa,
    id: `baixa_${Date.now()}`,
    numero_tambor: baixaPayload.numero_tambor,
    quantidade_restante: baixaPayload.quantidade_restante,
  }

  try {
    if (REGEX_UUID.test(item.id)) {
      const { data, error } = await supabase.from('itens_consumo').update(camposItem).eq('id', item.id).select().single()
      if (!error && data) itemAtualizado = data as ItemConsumo
    }
  } catch (err) {
    console.warn('Erro ao atualizar estoque do insumo no Supabase:', err)
  }

  try {
    const { data, error } = await supabase.from('consumo_baixas').insert(baixaPayload).select().single()
    if (!error && data) baixaGravada = data as RegistroBaixaConsumo
  } catch (err) {
    console.warn('Erro ao registrar baixa de consumo no Supabase:', err)
  }

  const itensLocais = getInsumosLocais()
  const idx = itensLocais.findIndex((it) => it.id === item.id)
  if (idx >= 0) itensLocais[idx] = itemAtualizado
  else itensLocais.unshift(itemAtualizado)
  salvarInsumosLocais(itensLocais)
  salvarBaixasConsumoLocais([baixaGravada, ...getBaixasConsumoLocais()])

  return { item: itemAtualizado, baixa: baixaGravada }
}

/**
 * Repõe estoque de um insumo. Se o tambor atual zerou e o item tem
 * capacidade máxima definida, o novo tambor entra cheio e a numeração sobe
 * sozinha; caso contrário só soma a quantidade adicionada.
 */
export async function registrarEntradaConsumo(item: ItemConsumo, quantidadeAdicionar: number): Promise<ItemConsumo> {
  const abriuTamborNovo = item.quantidade_atual <= 0 && Boolean(item.capacidade_maxima)
  const camposItem = abriuTamborNovo
    ? {
        quantidade_atual: item.capacidade_maxima!,
        numero_tambor_atual: (item.numero_tambor_atual || 1) + 1,
        quantidade_tambores: Math.max(0, (item.quantidade_tambores || 0) - 1),
      }
    : { quantidade_atual: item.quantidade_atual + quantidadeAdicionar }

  let itemAtualizado: ItemConsumo = { ...item, ...camposItem }

  try {
    if (REGEX_UUID.test(item.id)) {
      const { data, error } = await supabase.from('itens_consumo').update(camposItem).eq('id', item.id).select().single()
      if (!error && data) itemAtualizado = data as ItemConsumo
    }
  } catch (err) {
    console.warn('Erro ao repor estoque do insumo no Supabase:', err)
  }

  const locais = getInsumosLocais()
  const idx = locais.findIndex((it) => it.id === item.id)
  if (idx >= 0) locais[idx] = itemAtualizado
  else locais.unshift(itemAtualizado)
  salvarInsumosLocais(locais)

  return itemAtualizado
}
