import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { OFXTransaction } from '@/lib/ofxParser'

export interface ExtratoItem {
  id: string
  conta_id: string
  data: string
  descricao: string
  valor: number
  id_banco: string
  conciliado: boolean
  lancamento_id?: string | null
  created_at: string
}

const LS_KEY = 'gvel_extrato_bancario'
function loadFromLS(): ExtratoItem[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]') } catch { return [] }
}
function saveToLS(list: ExtratoItem[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(list))
}

export function useExtratoBancario(contaId?: string) {
  const [extrato, setExtrato] = useState<ExtratoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [useDB, setUseDB] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      let q = supabase.from('extrato_bancario').select('*').order('data', { ascending: false })
      if (contaId) q = q.eq('conta_id', contaId)
      const { data, error } = await q
      if (error || !data) throw error
      setUseDB(true)
      setExtrato(data as ExtratoItem[])
      saveToLS(data as ExtratoItem[])
    } catch {
      setUseDB(false)
      const all = loadFromLS()
      setExtrato(contaId ? all.filter(e => e.conta_id === contaId) : all)
    } finally {
      setLoading(false)
    }
  }, [contaId])

  useEffect(() => { load() }, [load])

  const importarTransacoes = useCallback(async (transactions: OFXTransaction[], cId: string): Promise<{ importados: number, duplicatas: number }> => {
    const existing = loadFromLS().map(e => e.id_banco)
    let importados = 0
    let duplicatas = 0

    const novos: ExtratoItem[] = []

    for (const t of transactions) {
      if (existing.includes(t.fitid)) { duplicatas++; continue }
      const item: ExtratoItem = {
        id: crypto.randomUUID(),
        conta_id: cId,
        data: t.data,
        descricao: t.descricao,
        valor: t.valor,
        id_banco: t.fitid,
        conciliado: false,
        lancamento_id: null,
        created_at: new Date().toISOString(),
      }
      novos.push(item)
      importados++
    }

    if (novos.length === 0) return { importados, duplicatas }

    if (useDB) {
      const payload = novos.map(n => ({
        conta_id: n.conta_id, data: n.data, descricao: n.descricao,
        valor: n.valor, id_banco: n.id_banco, conciliado: false,
      }))
      const { data } = await supabase.from('extrato_bancario')
        .upsert(payload, { onConflict: 'conta_id,id_banco' }).select()
      if (data) {
        setExtrato(p => [...(data as ExtratoItem[]), ...p.filter(e => !(data as ExtratoItem[]).some(d => d.id === e.id))])
        const allLS = [...loadFromLS(), ...novos]
        saveToLS(allLS)
        return { importados, duplicatas }
      }
    }

    const allLS = [...loadFromLS(), ...novos]
    saveToLS(allLS)
    setExtrato(contaId ? allLS.filter(e => e.conta_id === contaId) : allLS)
    return { importados, duplicatas }
  }, [useDB, contaId])

  const conciliarExtrato = useCallback(async (extratoId: string, lancId: string) => {
    if (useDB) {
      await supabase.from('extrato_bancario').update({ conciliado: true, lancamento_id: lancId }).eq('id', extratoId)
    }
    const next = loadFromLS().map(e => e.id === extratoId ? { ...e, conciliado: true, lancamento_id: lancId } : e)
    saveToLS(next)
    setExtrato(contaId ? next.filter(e => e.conta_id === contaId) : next)
  }, [useDB, contaId])

  const desconciliarExtrato = useCallback(async (extratoId: string) => {
    if (useDB) {
      await supabase.from('extrato_bancario').update({ conciliado: false, lancamento_id: null }).eq('id', extratoId)
    }
    const next = loadFromLS().map(e => e.id === extratoId ? { ...e, conciliado: false, lancamento_id: null } : e)
    saveToLS(next)
    setExtrato(contaId ? next.filter(e => e.conta_id === contaId) : next)
  }, [useDB, contaId])

  return { extrato, loading, importarTransacoes, conciliarExtrato, desconciliarExtrato, reload: load }
}
