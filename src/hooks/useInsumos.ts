import { useCallback, useEffect, useState } from 'react'
import { supabase, FOTOS_BUCKET } from '@/lib/supabase'
import type { ItemConsumo, RegistroBaixaConsumo, RegistroEntradaConsumo } from '@/lib/types'
import { comPrefixoEmpresa } from '@/lib/tenant'

export const STORAGE_CONSUMO_KEY = 'gvel_inventario_consumo_v1'
export const STORAGE_BAIXAS_CONSUMO_KEY = 'gvel_inventario_baixas_consumo_v1'
const STORAGE_EXCLUIDOS_CONSUMO_KEY = 'gvel_inventario_consumo_excluidos_v1'

const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Colunas `numeric` do Postgres voltam como string no PostgREST (pra não
// perder precisão) — sem isso, contas tipo `quantidade_atual + qtd` viram
// concatenação de texto em vez de soma.
function normalizarItemConsumo(item: ItemConsumo): ItemConsumo {
  return {
    ...item,
    quantidade_atual: Number(item.quantidade_atual) || 0,
    quantidade_minima: Number(item.quantidade_minima) || 0,
    capacidade_maxima: item.capacidade_maxima != null ? Number(item.capacidade_maxima) : item.capacidade_maxima,
    quantidade_tambores: item.quantidade_tambores != null ? Number(item.quantidade_tambores) : item.quantidade_tambores,
    numero_tambor_atual: item.numero_tambor_atual != null ? Number(item.numero_tambor_atual) : item.numero_tambor_atual,
  }
}

// Evita sujeira de ponto flutuante (ex: 220.5 - 0.001 = 220.49900000000002)
// em contas de litros fracionados por baixas em ml.
function arredondar3(valor: number): number {
  return Math.round(valor * 1000) / 1000
}

function normalizarBaixaConsumo(baixa: RegistroBaixaConsumo): RegistroBaixaConsumo {
  return {
    ...baixa,
    quantidade: Number(baixa.quantidade) || 0,
    quantidade_restante: baixa.quantidade_restante != null ? Number(baixa.quantidade_restante) : baixa.quantidade_restante,
  }
}

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
      todos.push(...(data as ItemConsumo[]).map(normalizarItemConsumo))
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
      todas.push(...(data as RegistroBaixaConsumo[]).map(normalizarBaixaConsumo))
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
// Se uma migração recente (ex: tipo_recipiente) ainda não rodou no banco do
// usuário, o Supabase recusa o insert/update inteiro por causa de um campo
// que a coluna não conhece ainda. Em vez de derrubar o salvamento todo (e
// cair silenciosamente pro modo offline-only), tenta de novo sem esse campo
// — assim o resto do cadastro grava normalmente enquanto a migração não roda.
function removerColunaInexistente<T extends Record<string, any>>(payload: T, mensagemErro: string): T | null {
  const match = /Could not find the '([^']+)' column/i.exec(mensagemErro)
  const coluna = match?.[1]
  if (!coluna || !(coluna in payload)) return null
  const { [coluna]: _removido, ...resto } = payload
  console.warn(`Coluna "${coluna}" ainda não existe no banco (rode a migração pendente) — salvando sem ela por enquanto.`)
  return resto as T
}

export async function criarInsumo(dados: ItemConsumo): Promise<ItemConsumo> {
  const { id: _id, created_at: _createdAt, ...payload } = dados

  try {
    let { data, error } = await supabase.from('itens_consumo').insert(payload).select().single()
    if (error?.message) {
      const payloadSemColuna = removerColunaInexistente(payload, error.message)
      if (payloadSemColuna) {
        ;({ data, error } = await supabase.from('itens_consumo').insert(payloadSemColuna).select().single())
      }
    }
    if (!error && data) {
      const novo = normalizarItemConsumo(data as ItemConsumo)
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
      let { data, error } = await supabase.from('itens_consumo').update(payload).eq('id', id).select().single()
      if (error?.message) {
        const payloadSemColuna = removerColunaInexistente(payload, error.message)
        if (payloadSemColuna) {
          ;({ data, error } = await supabase.from('itens_consumo').update(payloadSemColuna).eq('id', id).select().single())
        }
      }
      if (!error && data) {
        const atualizado = normalizarItemConsumo(data as ItemConsumo)
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
      let { data, error } = await supabase.from('itens_consumo').insert(payload).select().single()
      if (error?.message) {
        const payloadSemColuna = removerColunaInexistente(payload, error.message)
        if (payloadSemColuna) {
          ;({ data, error } = await supabase.from('itens_consumo').insert(payloadSemColuna).select().single())
        }
      }
      if (!error && data) {
        const atualizado = normalizarItemConsumo(data as ItemConsumo)
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
  const restante = Math.max(0, arredondar3(item.quantidade_atual - baixa.quantidade))
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
      if (!error && data) itemAtualizado = normalizarItemConsumo(data as ItemConsumo)
    }
  } catch (err) {
    console.warn('Erro ao atualizar estoque do insumo no Supabase:', err)
  }

  try {
    const { data, error } = await supabase.from('consumo_baixas').insert(baixaPayload).select().single()
    if (!error && data) baixaGravada = normalizarBaixaConsumo(data as RegistroBaixaConsumo)
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
 * Corrige um lançamento de baixa já registrado (responsável, placa, motivo
 * e/ou quantidade). Quando a quantidade muda, a diferença é aplicada de
 * volta no estoque atual do item — por isso `podeAjustarQuantidade` deve vir
 * `false` sempre que essa baixa não for mais a mais recente do item (ou,
 * pra barril, não pertencer mais ao tambor em uso), senão a correção mexeria
 * num estoque que já teve outros lançamentos por cima.
 */
export async function atualizarBaixaConsumo(
  baixaAtual: RegistroBaixaConsumo,
  dados: { quantidade: number; responsavel: string; placa?: string; motivo?: string },
  item: ItemConsumo | null,
  podeAjustarQuantidade: boolean,
): Promise<{ baixa: RegistroBaixaConsumo; item: ItemConsumo | null }> {
  const deltaQuantidade = podeAjustarQuantidade ? dados.quantidade - baixaAtual.quantidade : 0
  let itemAtualizado: ItemConsumo | null = item

  if (item && deltaQuantidade !== 0) {
    const camposItem = { quantidade_atual: arredondar3(item.quantidade_atual - deltaQuantidade) }
    itemAtualizado = { ...item, ...camposItem }
    try {
      if (REGEX_UUID.test(item.id)) {
        const { data, error } = await supabase.from('itens_consumo').update(camposItem).eq('id', item.id).select().single()
        if (!error && data) itemAtualizado = normalizarItemConsumo(data as ItemConsumo)
      }
    } catch (err) {
      console.warn('Erro ao ajustar estoque do insumo ao editar baixa:', err)
    }
    const locais = getInsumosLocais()
    const idx = locais.findIndex((it) => it.id === item.id)
    if (idx >= 0) locais[idx] = itemAtualizado
    salvarInsumosLocais(locais)
  }

  const payload = {
    quantidade: podeAjustarQuantidade ? dados.quantidade : baixaAtual.quantidade,
    responsavel: dados.responsavel,
    placa: dados.placa || null,
    motivo: dados.motivo || null,
    quantidade_restante:
      item?.capacidade_maxima && podeAjustarQuantidade ? itemAtualizado?.quantidade_atual ?? null : baixaAtual.quantidade_restante,
  }

  let baixaAtualizada: RegistroBaixaConsumo = { ...baixaAtual, ...payload }
  try {
    if (REGEX_UUID.test(baixaAtual.id)) {
      const { data, error } = await supabase.from('consumo_baixas').update(payload).eq('id', baixaAtual.id).select().single()
      if (!error && data) baixaAtualizada = normalizarBaixaConsumo(data as RegistroBaixaConsumo)
    }
  } catch (err) {
    console.warn('Erro ao atualizar baixa de consumo no Supabase:', err)
  }

  const locaisBaixas = getBaixasConsumoLocais()
  const idxBaixa = locaisBaixas.findIndex((b) => b.id === baixaAtual.id)
  if (idxBaixa >= 0) locaisBaixas[idxBaixa] = baixaAtualizada
  salvarBaixasConsumoLocais(locaisBaixas)

  return { baixa: baixaAtualizada, item: itemAtualizado }
}

/**
 * Exclui um lançamento de baixa e devolve a quantidade pro estoque atual do
 * item. Só chame com `podeAjustarEstoque = true` pra baixa mais recente do
 * item (ou do tambor em uso, no caso de barril) — pelo mesmo motivo do
 * comentário em `atualizarBaixaConsumo`.
 */
export async function excluirBaixaConsumo(
  baixa: RegistroBaixaConsumo,
  item: ItemConsumo | null,
  podeAjustarEstoque: boolean,
): Promise<ItemConsumo | null> {
  let itemAtualizado: ItemConsumo | null = item

  if (item && podeAjustarEstoque) {
    const camposItem = { quantidade_atual: arredondar3(item.quantidade_atual + baixa.quantidade) }
    itemAtualizado = { ...item, ...camposItem }
    try {
      if (REGEX_UUID.test(item.id)) {
        const { data, error } = await supabase.from('itens_consumo').update(camposItem).eq('id', item.id).select().single()
        if (!error && data) itemAtualizado = normalizarItemConsumo(data as ItemConsumo)
      }
    } catch (err) {
      console.warn('Erro ao restaurar estoque do insumo ao excluir baixa:', err)
    }
    const locais = getInsumosLocais()
    const idx = locais.findIndex((it) => it.id === item.id)
    if (idx >= 0) locais[idx] = itemAtualizado
    salvarInsumosLocais(locais)
  }

  try {
    if (REGEX_UUID.test(baixa.id)) {
      const { error } = await supabase.from('consumo_baixas').delete().eq('id', baixa.id)
      if (error) throw error
    }
  } catch (err) {
    console.error('Erro ao excluir baixa de consumo no Supabase:', err)
    throw new Error('Não foi possível excluir agora. Verifique sua conexão e tente novamente.')
  }

  salvarBaixasConsumoLocais(getBaixasConsumoLocais().filter((b) => b.id !== baixa.id))
  return itemAtualizado
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
    : { quantidade_atual: arredondar3(item.quantidade_atual + quantidadeAdicionar) }

  let itemAtualizado: ItemConsumo = { ...item, ...camposItem }

  try {
    if (REGEX_UUID.test(item.id)) {
      const { data, error } = await supabase.from('itens_consumo').update(camposItem).eq('id', item.id).select().single()
      if (!error && data) itemAtualizado = normalizarItemConsumo(data as ItemConsumo)
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

// ----------------------------------------------------
// Entradas de estoque com nota fiscal (tabela consumo_entradas)
// ----------------------------------------------------
function normalizarEntradaConsumo(entrada: RegistroEntradaConsumo): RegistroEntradaConsumo {
  return { ...entrada, quantidade: Number(entrada.quantidade) || 0 }
}

export async function fetchEntradasConsumoSupabase(): Promise<RegistroEntradaConsumo[]> {
  const { data, error } = await supabase
    .from('consumo_entradas')
    .select('*')
    .order('data_hora', { ascending: false })
    .limit(2000)
  if (error) {
    console.warn('Erro ao buscar entradas de consumo do Supabase:', error)
    return []
  }
  return (data as RegistroEntradaConsumo[]).map(normalizarEntradaConsumo)
}

export function useEntradasConsumo() {
  const [entradasConsumo, setEntradasConsumo] = useState<RegistroEntradaConsumo[]>([])
  const [loading, setLoading] = useState(false)

  const refetch = useCallback(async () => {
    setLoading(true)
    try {
      setEntradasConsumo(await fetchEntradasConsumoSupabase())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { entradasConsumo, loading, refetch }
}

// Diferente da foto de ferramenta, a NF não cai pra dataURL se o storage
// falhar — um PDF em base64 dentro da linha do banco ficaria enorme; melhor
// avisar o erro e deixar a pessoa tentar de novo.
export async function uploadNotaFiscalInsumo(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'pdf'
  const path = comPrefixoEmpresa(`notas-fiscais/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`)
  const { error } = await supabase.storage.from(FOTOS_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || undefined,
  })
  if (error) throw new Error(`Não foi possível enviar a nota fiscal: ${error.message}`)
  return supabase.storage.from(FOTOS_BUCKET).getPublicUrl(path).data.publicUrl
}

export interface DadosEntradaConsumo {
  quantidade: number
  tipo: 'quantidade' | 'tambor'
  numeroNf?: string
  nfArquivo?: File | null
  responsavel?: string
}

/** Grava o lançamento da entrada (com a NF, se anexada). Chamar depois de já
 * ter atualizado o estoque do item. */
export async function registrarLancamentoEntradaConsumo(item: ItemConsumo, dados: DadosEntradaConsumo): Promise<void> {
  const nfUrl = dados.nfArquivo ? await uploadNotaFiscalInsumo(dados.nfArquivo) : null
  const { error } = await supabase.from('consumo_entradas').insert({
    item_id: REGEX_UUID.test(item.id) ? item.id : null,
    item_nome: item.nome,
    unidade: item.unidade,
    quantidade: dados.quantidade,
    tipo: dados.tipo,
    numero_nf: dados.numeroNf?.trim() || null,
    nf_url: nfUrl,
    nf_nome: dados.nfArquivo?.name ?? null,
    responsavel: dados.responsavel?.trim() || null,
    data_hora: new Date().toISOString(),
  })
  if (error) throw new Error(`Estoque atualizado, mas não foi possível registrar a entrada/NF: ${error.message}`)
}
