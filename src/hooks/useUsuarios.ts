import { useCallback, useEffect, useState } from 'react'
import { apiDelete, apiGet, apiPost } from '@/lib/api'
import type { NivelUsuario, Usuario } from '@/lib/types'

export function useUsuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    const { data, error } = await apiGet<Usuario[]>('/usuarios')
    if (error) setError(error.message)
    else setUsuarios(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { usuarios, loading, error, refetch }
}

interface CriarUsuarioInput {
  nome: string
  email: string
  senha: string
  telefone?: string
  nivel?: NivelUsuario
}

export async function criarUsuario(input: CriarUsuarioInput) {
  const { data, error } = await apiPost<Usuario>('/usuarios', input)
  if (error) throw new Error(error.message)
  return data as Usuario
}

export async function excluirUsuario(id: string) {
  const { error } = await apiDelete<void>(`/usuarios/${id}`)
  if (error) throw new Error(error.message)
}
