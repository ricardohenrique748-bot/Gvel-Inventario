/**
 * useChecklistOS
 * Gerencia os dados de O.S e itens do checklist no Supabase,
 * com Realtime para sincronização APK ↔ Web.
 *
 * Na primeira carga, se o banco estiver vazio para a movimentação,
 * importa automaticamente os dados do localStorage (migração transparente).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { SECOES_PADRAO } from '@/components/ChecklistManutencaoCard'
import type { ItemChecklistData } from '@/components/ChecklistManutencaoCard'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface OSData {
  mecanico: string
  funcao: string
  setor: string
  statusOS: string
  dataHoraAbertura: string   // datetime-local string (ex: "2026-08-18T10:00")
  dataHoraFechamento: string
}

export interface ItemRow {
  item_id: string
  secao_id: string
  label: string
  is_custom: boolean
  checked: boolean
  data?: string
  data_inicio?: string
  data_fim?: string
  hora_inicio: string
  hora_fim: string
  mecanico: string
}

export type ItemsMap = Record<string, ItemRow>

// ─── Helpers de conversão ─────────────────────────────────────────────────────

function toLocalString(iso?: string | null): string {
  if (!iso) return ''
  try {
    // Converte ISO → "YYYY-MM-DDTHH:mm" (formato do input datetime-local)
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch {
    return ''
  }
}

function toISO(local: string): string | null {
  if (!local) return null
  try {
    return new Date(local).toISOString()
  } catch {
    return null
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useChecklistOS(movimentacaoId: string) {
  const [osData, setOsData] = useState<OSData>({
    mecanico: '',
    funcao: '',
    setor: '',
    statusOS: 'EM ANDAMENTO',
    dataHoraAbertura: '',
    dataHoraFechamento: '',
  })
  const [items, setItems] = useState<ItemsMap>({})
  const [loading, setLoading] = useState(true)
  const migrated = useRef(false)

  // ── Carrega dados do Supabase ──────────────────────────────────────────────
  const fetchFromDB = useCallback(async () => {
    const [osRes, itensRes] = await Promise.all([
      supabase
        .from('checklist_os')
        .select('*')
        .eq('movimentacao_id', movimentacaoId)
        .maybeSingle(),
      supabase
        .from('checklist_itens')
        .select('*')
        .eq('movimentacao_id', movimentacaoId),
    ])

    return { os: osRes.data, itens: itensRes.data ?? [] }
  }, [movimentacaoId])

  // ── Migração: localStorage → Supabase (roda só uma vez por movimentação) ──
  const migrateFromLocalStorage = useCallback(async () => {
    if (migrated.current) return
    migrated.current = true

    const infoKey  = `checklist_info_${movimentacaoId}`
    const itemsKey = `checklist_items_data_${movimentacaoId}`
    const secoesKey = `checklist_custom_secoes_${movimentacaoId}`

    const infoRaw  = localStorage.getItem(infoKey)
    const itemsRaw = localStorage.getItem(itemsKey)

    if (!infoRaw && !itemsRaw) return   // Nada para migrar

    // Salva O.S
    if (infoRaw) {
      try {
        const info = JSON.parse(infoRaw)
        await supabase.from('checklist_os').upsert({
          movimentacao_id: movimentacaoId,
          mecanico: info.mecanico || null,
          funcao: info.funcao || null,
          setor: info.setor || null,
          status_os: info.statusOS || 'EM ANDAMENTO',
          data_hora_abertura: toISO(info.dataHoraAbertura),
          data_hora_fechamento: toISO(info.dataHoraFechamento),
        }, { onConflict: 'movimentacao_id' })
      } catch {}
    }

    // Salva itens
    if (itemsRaw) {
      try {
        const legacyItems = JSON.parse(itemsRaw) as Record<string, ItemChecklistData>

        // Recupera seções customizadas se houver
        let secoesCustom: Record<string, { id: string; label: string }[]> = {}
        const secoesRaw = localStorage.getItem(secoesKey)
        if (secoesRaw) secoesCustom = JSON.parse(secoesRaw)

        // Monta mapa item_id → { secao_id, label, is_custom }
        const itemMeta: Record<string, { secao_id: string; label: string; is_custom: boolean }> = {}
        for (const sec of SECOES_PADRAO) {
          for (const it of sec.itens) {
            itemMeta[it.id] = { secao_id: sec.id, label: it.label, is_custom: false }
          }
          for (const it of secoesCustom[sec.id] ?? []) {
            itemMeta[it.id] = { secao_id: sec.id, label: it.label, is_custom: true }
          }
        }

        const rows = Object.entries(legacyItems).map(([item_id, d]) => ({
          movimentacao_id: movimentacaoId,
          item_id,
          secao_id: itemMeta[item_id]?.secao_id ?? 'outro',
          label: itemMeta[item_id]?.label ?? item_id,
          is_custom: itemMeta[item_id]?.is_custom ?? false,
          checked: d.checked,
          hora_inicio: d.horaInicio ?? null,
          hora_fim: d.horaFim ?? null,
          mecanico: d.mecanico ?? null,
        }))

        if (rows.length > 0) {
          await supabase.from('checklist_itens').upsert(rows, { onConflict: 'movimentacao_id,item_id' })
        }
      } catch {}
    }
  }, [movimentacaoId])

  // ── Carregamento inicial ───────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    const { os, itens } = await fetchFromDB()

    // Se não existe nada no banco, migra do localStorage
    if (!os && itens.length === 0) {
      await migrateFromLocalStorage()
      const migrated2 = await fetchFromDB()
      applyData(migrated2.os, migrated2.itens)
    } else {
      applyData(os, itens)
    }

    setLoading(false)
  }, [fetchFromDB, migrateFromLocalStorage])

  function applyData(
    os: Record<string, unknown> | null,
    itens: Record<string, unknown>[],
  ) {
    if (os) {
      setOsData({
        mecanico: (os.mecanico as string) || '',
        funcao: (os.funcao as string) || '',
        setor: (os.setor as string) || '',
        statusOS: (os.status_os as string) || 'EM ANDAMENTO',
        dataHoraAbertura: toLocalString(os.data_hora_abertura as string),
        dataHoraFechamento: toLocalString(os.data_hora_fechamento as string),
      })
    } else {
      setOsData({ mecanico: '', funcao: '', setor: '', statusOS: 'EM ANDAMENTO', dataHoraAbertura: '', dataHoraFechamento: '' })
    }

    const map: ItemsMap = {}
    for (const row of itens) {
      const r = row as Record<string, unknown>
      map[r.item_id as string] = {
        item_id: r.item_id as string,
        secao_id: r.secao_id as string,
        label: r.label as string,
        is_custom: Boolean(r.is_custom),
        checked: Boolean(r.checked),
        data: (r.data as string) || (r.data_inicio as string) || '',
        data_inicio: (r.data_inicio as string) || (r.data as string) || '',
        data_fim: (r.data_fim as string) || '',
        hora_inicio: (r.hora_inicio as string) || '',
        hora_fim: (r.hora_fim as string) || '',
        mecanico: (r.mecanico as string) || '',
      }
    }
    setItems(map)
  }

  useEffect(() => {
    load()
  }, [load])

  // ── Realtime ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel(`checklist_${movimentacaoId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'checklist_os', filter: `movimentacao_id=eq.${movimentacaoId}` },
        () => load(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'checklist_itens', filter: `movimentacao_id=eq.${movimentacaoId}` },
        () => load(),
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [movimentacaoId, load])

  // ── Mutations ──────────────────────────────────────────────────────────────

  const salvarOS = useCallback(async (data: Partial<OSData>) => {
    const next = { ...osData, ...data }
    setOsData(next)   // optimistic update
    await supabase.from('checklist_os').upsert({
      movimentacao_id: movimentacaoId,
      mecanico: next.mecanico || null,
      funcao: next.funcao || null,
      setor: next.setor || null,
      status_os: next.statusOS || 'EM ANDAMENTO',
      data_hora_abertura: toISO(next.dataHoraAbertura),
      data_hora_fechamento: toISO(next.dataHoraFechamento),
    }, { onConflict: 'movimentacao_id' })

    // Mantém compatibilidade com o evento usado em Manutencao.tsx
    window.dispatchEvent(new CustomEvent('checklist_updated', { detail: { movId: movimentacaoId } }))
  }, [movimentacaoId, osData])

  const salvarItem = useCallback(async (row: ItemRow) => {
    setItems((prev) => ({ ...prev, [row.item_id]: row }))   // optimistic
    try {
      const payload: Record<string, unknown> = {
        movimentacao_id: movimentacaoId,
        item_id: row.item_id,
        secao_id: row.secao_id,
        label: row.label,
        is_custom: row.is_custom,
        checked: row.checked,
        data: row.data || row.data_inicio || null,
        data_inicio: row.data_inicio || row.data || null,
        data_fim: row.data_fim || null,
        hora_inicio: row.hora_inicio || null,
        hora_fim: row.hora_fim || null,
        mecanico: row.mecanico || null,
      }

      const { error } = await supabase.from('checklist_itens').upsert(payload, { onConflict: 'movimentacao_id,item_id' })
      if (error) {
        console.error('[salvarItem] Erro ao salvar no Supabase:', error)
        if (error.message?.includes('column') || error.code === '42703') {
          delete payload.data_inicio
          delete payload.data_fim
          await supabase.from('checklist_itens').upsert(payload, { onConflict: 'movimentacao_id,item_id' })
        }
      }

      // Sincroniza localStorage
      try {
        const itemsKey = `checklist_items_data_${movimentacaoId}`
        const current = JSON.parse(localStorage.getItem(itemsKey) || '{}')
        current[row.item_id] = {
          checked: row.checked,
          horaInicio: row.hora_inicio || undefined,
          horaFim: row.hora_fim || undefined,
          mecanico: row.mecanico || undefined,
          dataInicio: row.data_inicio || undefined,
          dataFim: row.data_fim || undefined,
        }
        localStorage.setItem(itemsKey, JSON.stringify(current))
      } catch {}

      window.dispatchEvent(new CustomEvent('checklist_updated', { detail: { movId: movimentacaoId } }))
    } catch (e) {
      console.error('[salvarItem] Exception:', e)
    }
  }, [movimentacaoId])

  const removerItem = useCallback(async (itemId: string) => {
    setItems((prev) => {
      const next = { ...prev }
      delete next[itemId]
      return next
    })
    await supabase
      .from('checklist_itens')
      .delete()
      .eq('movimentacao_id', movimentacaoId)
      .eq('item_id', itemId)
  }, [movimentacaoId])

  const limparTodos = useCallback(async () => {
    // Desmarca todos os itens (mantém os registros, só reseta checked)
    const rows = Object.values(items).map((r) => ({
      movimentacao_id: movimentacaoId,
      item_id: r.item_id,
      secao_id: r.secao_id,
      label: r.label,
      is_custom: r.is_custom,
      checked: false,
      hora_inicio: null as string | null,
      hora_fim: null as string | null,
      mecanico: null as string | null,
    }))
    setItems((prev) => {
      const next = { ...prev }
      for (const k of Object.keys(next)) {
        next[k] = { ...next[k], checked: false, hora_inicio: '', hora_fim: '', mecanico: '' }
      }
      return next
    })
    if (rows.length > 0) {
      await supabase.from('checklist_itens').upsert(rows, { onConflict: 'movimentacao_id,item_id' })
    }
  }, [movimentacaoId, items])

  return {
    osData,
    items,
    loading,
    salvarOS,
    salvarItem,
    removerItem,
    limparTodos,
  }
}
