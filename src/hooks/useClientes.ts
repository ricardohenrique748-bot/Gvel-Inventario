import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Cliente } from '@/lib/types'

export function useClientes() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('clientes').select('*').order('nome')
    if (error) setError(error.message)
    else setClientes(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { clientes, loading, error, refetch }
}

export async function criarCliente(
  nome: string,
  telefone?: string,
  cnpj?: string,
  endereco?: string,
) {
  const { data, error } = await supabase
    .from('clientes')
    .insert({ nome, telefone: telefone || null, cnpj: cnpj || null, endereco: endereco || null })
    .select()
    .single()
  if (error) throw error
  return data as Cliente
}
