import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { NivelUsuario, Usuario } from '@/lib/types'

export function useUsuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('usuarios').select('*').order('nome')
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
  const { data, error } = await supabase.functions.invoke('create-usuario', { body: input })
  if (error) {
    const context = (error as { context?: Response }).context
    if (context) {
      const body = await context.json().catch(() => null)
      throw new Error(body?.error ?? error.message)
    }
    throw new Error(error.message)
  }
  return data as Usuario
}

export async function excluirUsuario(id: string) {
  const { error } = await supabase.functions.invoke('delete-usuario', { body: { id } })
  if (error) {
    const context = (error as { context?: Response }).context
    if (context) {
      const body = await context.json().catch(() => null)
      throw new Error(body?.error ?? error.message)
    }
    throw new Error(error.message)
  }
}
