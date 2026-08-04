import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { up } from '@/lib/text'
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
    .insert({ nome: up(nome), telefone: telefone || null, cnpj: cnpj || null, endereco: up(endereco) })
    .select()
    .single()
  if (error) throw error
  return data as Cliente
}

interface AtualizarClienteInput {
  nome: string
  telefone?: string
  cnpj?: string
  endereco?: string
}

export async function atualizarCliente(id: string, input: AtualizarClienteInput) {
  const { data, error } = await supabase
    .from('clientes')
    .update({
      nome: up(input.nome),
      telefone: input.telefone || null,
      cnpj: input.cnpj || null,
      endereco: up(input.endereco),
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as Cliente
}

export async function excluirCliente(id: string) {
  const { error } = await supabase.from('clientes').delete().eq('id', id)
  if (error) {
    if (error.code === '23503') {
      throw new Error('Não é possível excluir: existem veículos ou movimentações vinculados a este cliente.')
    }
    throw new Error(error.message)
  }
}
