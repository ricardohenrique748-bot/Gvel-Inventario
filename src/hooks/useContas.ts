import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export interface ContaBancaria {
  id: string
  nome: string
  codigo_banco: string
  banco: string
  agencia: string
  conta: string
  tipo: 'corrente' | 'poupanca' | 'cartao' | 'outro'
  saldo_inicial: number
  ativa: boolean
  created_at: string
}

const LS_KEY = 'gvel_contas_bancarias'

function loadFromLS(): ContaBancaria[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]') } catch { return [] }
}
function saveToLS(list: ContaBancaria[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(list))
}

export function useContas() {
  const [contas, setContas] = useState<ContaBancaria[]>([])
  const [loading, setLoading] = useState(true)
  const [useDB, setUseDB] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.from('contas_bancarias').select('*').order('nome')
      if (error || !data) throw error
      setUseDB(true)
      setContas(data as ContaBancaria[])
      saveToLS(data as ContaBancaria[])
    } catch {
      setUseDB(false)
      setContas(loadFromLS())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const addConta = useCallback(async (form: Omit<ContaBancaria, 'id' | 'created_at'>) => {
    const nova: ContaBancaria = {
      ...form, id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    }
    if (useDB) {
      const { data } = await supabase.from('contas_bancarias').insert({
        nome: form.nome, codigo_banco: form.codigo_banco, banco: form.banco, agencia: form.agencia,
        conta: form.conta, tipo: form.tipo, saldo_inicial: form.saldo_inicial, ativa: form.ativa,
      }).select().single()
      if (data) { setContas(p => [...p, data as ContaBancaria]); return }
    }
    const next = [...loadFromLS(), nova]
    saveToLS(next); setContas(next)
  }, [useDB])

  const removeConta = useCallback(async (id: string) => {
    if (useDB) await supabase.from('contas_bancarias').update({ ativa: false }).eq('id', id)
    const next = loadFromLS().filter(c => c.id !== id)
    saveToLS(next); setContas(next)
  }, [useDB])

  const updateConta = useCallback(async (id: string, form: Omit<ContaBancaria, 'id' | 'created_at'>) => {
    if (useDB) {
      const { data } = await supabase.from('contas_bancarias').update({
        nome: form.nome, codigo_banco: form.codigo_banco, banco: form.banco, agencia: form.agencia,
        conta: form.conta, tipo: form.tipo, saldo_inicial: form.saldo_inicial, ativa: form.ativa,
      }).eq('id', id).select().single()
      if (data) {
        setContas((p) => p.map((c) => (c.id === id ? (data as ContaBancaria) : c)))
        return
      }
    }
    const next = loadFromLS().map((c) => (c.id === id ? { ...c, ...form } : c))
    saveToLS(next); setContas(next)
  }, [useDB])

  return { contas, loading, addConta, removeConta, updateConta, reload: load }
}
