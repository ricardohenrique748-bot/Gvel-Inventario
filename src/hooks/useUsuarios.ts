import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { up } from '@/lib/text'
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

async function mensagemErroFuncao(error: unknown, fallback: string): Promise<string> {
  const context = (error as { context?: Response }).context
  if (context && typeof context.json === 'function') {
    const body = await context.json().catch(() => null)
    if (body?.error) return body.error
  }
  return error instanceof Error ? error.message : fallback
}

export async function criarUsuario(input: CriarUsuarioInput) {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  const { data, error } = await supabase.functions.invoke('create-usuario', {
    body: { ...input, nome: up(input.nome) },
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
  if (error) {
    throw new Error(await mensagemErroFuncao(error, 'Não foi possível criar o usuário.'))
  }
  return data as Usuario
}

export async function excluirUsuario(id: string) {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  const { error } = await supabase.functions.invoke('delete-usuario', {
    body: { id },
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
  if (error) {
    throw new Error(await mensagemErroFuncao(error, 'Não foi possível excluir o usuário.'))
  }
}

interface AtualizarUsuarioInput {
  nome: string
  telefone?: string
  nivel: NivelUsuario
}

export async function atualizarUsuario(id: string, input: AtualizarUsuarioInput) {
  const { data, error } = await supabase
    .from('usuarios')
    .update({ nome: up(input.nome), telefone: input.telefone || null, nivel: input.nivel })
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as Usuario
}

export async function resetarSenha(id: string): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  const { data, error } = await supabase.functions.invoke('reset-senha', {
    body: { id },
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
  if (error) {
    throw new Error(await mensagemErroFuncao(error, 'Não foi possível resetar a senha.'))
  }
  const body = data as { senhaTemporaria?: string }
  if (!body?.senhaTemporaria) throw new Error('Senha temporária não retornada.')
  return body.senhaTemporaria
}

