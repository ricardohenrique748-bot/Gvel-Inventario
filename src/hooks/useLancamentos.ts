import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export interface LancamentoFinanceiro {
  id: string
  conta_id: string
  data: string
  descricao: string
  valor: number
  tipo: 'receita' | 'despesa' | 'transferencia'
  categoria: string
  conciliado: boolean
  extrato_id?: string | null
  observacao?: string
  created_at: string
}

const LS_KEY = 'gvel_lancamentos_financeiros'
function loadFromLS(): LancamentoFinanceiro[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]') } catch { return [] }
}
function saveToLS(list: LancamentoFinanceiro[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(list))
}

export function useLancamentos(contaId?: string) {
  const [lancamentos, setLancamentos] = useState<LancamentoFinanceiro[]>([])
  const [loading, setLoading] = useState(true)
  const [useDB, setUseDB] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      let q = supabase.from('lancamentos_financeiros').select('*').order('data', { ascending: false })
      if (contaId) q = q.eq('conta_id', contaId)
      const { data, error } = await q
      if (error || !data) throw error
      setUseDB(true)
      setLancamentos(data as LancamentoFinanceiro[])
      saveToLS(data as LancamentoFinanceiro[])
    } catch {
      setUseDB(false)
      const all = loadFromLS()
      setLancamentos(contaId ? all.filter(l => l.conta_id === contaId) : all)
    } finally {
      setLoading(false)
    }
  }, [contaId])

  useEffect(() => { load() }, [load])

  const addLancamento = useCallback(async (form: Omit<LancamentoFinanceiro, 'id' | 'created_at' | 'conciliado'>) => {
    const novo: LancamentoFinanceiro = {
      ...form, id: crypto.randomUUID(),
      conciliado: false, created_at: new Date().toISOString(),
    }
    if (useDB) {
      const payload = {
        conta_id: form.conta_id, data: form.data, descricao: form.descricao,
        valor: form.valor, tipo: form.tipo, categoria: form.categoria,
        observacao: form.observacao || null, conciliado: false,
      }
      const { data } = await supabase.from('lancamentos_financeiros').insert(payload).select().single()
      if (data) { setLancamentos(p => [data as LancamentoFinanceiro, ...p]); return }
    }
    const all = loadFromLS()
    const next = [novo, ...all]
    saveToLS(next)
    setLancamentos(contaId ? next.filter(l => l.conta_id === contaId) : next)
  }, [useDB, contaId])

  const removeLancamento = useCallback(async (id: string) => {
    if (useDB) await supabase.from('lancamentos_financeiros').delete().eq('id', id)
    const next = loadFromLS().filter(l => l.id !== id)
    saveToLS(next)
    setLancamentos(contaId ? next.filter(l => l.conta_id === contaId) : next)
  }, [useDB, contaId])

  const conciliarLancamento = useCallback(async (lancId: string, extratoId: string) => {
    if (useDB) {
      await supabase.from('lancamentos_financeiros').update({ conciliado: true, extrato_id: extratoId }).eq('id', lancId)
      await supabase.from('extrato_bancario').update({ conciliado: true, lancamento_id: lancId }).eq('id', extratoId)
    }
    const next = loadFromLS().map(l => l.id === lancId ? { ...l, conciliado: true, extrato_id: extratoId } : l)
    saveToLS(next)
    setLancamentos(contaId ? next.filter(l => l.conta_id === contaId) : next)
  }, [useDB, contaId])

  const desconciliarLancamento = useCallback(async (lancId: string, extratoId?: string) => {
    if (useDB) {
      await supabase.from('lancamentos_financeiros').update({ conciliado: false, extrato_id: null }).eq('id', lancId)
      if (extratoId) await supabase.from('extrato_bancario').update({ conciliado: false, lancamento_id: null }).eq('id', extratoId)
    }
    const next = loadFromLS().map(l => l.id === lancId ? { ...l, conciliado: false, extrato_id: null } : l)
    saveToLS(next)
    setLancamentos(contaId ? next.filter(l => l.conta_id === contaId) : next)
  }, [useDB, contaId])

  return { lancamentos, loading, addLancamento, removeLancamento, conciliarLancamento, desconciliarLancamento, reload: load }
}
