import { useCallback, useEffect, useState } from 'react'
import { apiGet, apiPost } from '@/lib/api'
import type { Cliente } from '@/lib/types'

export function useClientes() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    const { data, error } = await apiGet<Cliente[]>('/clientes')
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
  const { data, error } = await apiPost<Cliente>('/clientes', { nome, telefone, cnpj, endereco })
  if (error) throw new Error(error.message)
  return data as Cliente
}
