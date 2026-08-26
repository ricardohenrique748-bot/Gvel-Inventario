import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { up } from '@/lib/text'
import { salvarPermissoesUsuario, getModulosUsuario } from '@/lib/permissoes'
import type { NivelUsuario, Usuario } from '@/lib/types'

export function useUsuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('usuarios').select('*').order('nome')
    if (error) {
      setError(error.message)
    } else {
      // Injeta os módulos recuperados (do banco ou do mapeamento local)
      const listaTratada = (data ?? []).map((u) => ({
        ...u,
        modulos: getModulosUsuario(u),
      }))
      setUsuarios(listaTratada)
    }
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
  modulos?: string[]
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
  
  if (input.modulos && input.email) {
    salvarPermissoesUsuario(input.email, input.modulos)
    if (data?.id) {
      salvarPermissoesUsuario(data.id, input.modulos)
    }
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
  modulos?: string[]
  email?: string
}

export async function atualizarUsuario(id: string, input: AtualizarUsuarioInput) {
  // Salva permissões localmente de forma imediata e garantida
  if (input.modulos) {
    salvarPermissoesUsuario(id, input.modulos)
    if (input.email) {
      salvarPermissoesUsuario(input.email, input.modulos)
    }
  }

  // Tenta atualizar no Supabase com modulos, e caso a coluna não exista no Postgres, atualiza os campos básicos
  let updatePayload: Record<string, any> = {
    nome: up(input.nome),
    telefone: input.telefone || null,
    nivel: input.nivel,
  }
  if (input.modulos) {
    updatePayload.modulos = input.modulos
  }

  let { data, error } = await supabase
    .from('usuarios')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    // Fallback sem a coluna modulos se a coluna não existir no schema do Postgres
    const { data: dataFallback, error: errorFallback } = await supabase
      .from('usuarios')
      .update({ nome: up(input.nome), telefone: input.telefone || null, nivel: input.nivel })
      .eq('id', id)
      .select()
      .single()

    if (errorFallback) throw new Error(errorFallback.message)
    data = dataFallback
  }

  return {
    ...data,
    modulos: input.modulos || getModulosUsuario(data),
  } as Usuario
}

export async function resetarSenha(id: string, senha?: string): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  const { data, error } = await supabase.functions.invoke('reset-senha', {
    body: { id, senha: senha || '123456' },
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
  if (error) {
    throw new Error(await mensagemErroFuncao(error, 'Não foi possível resetar a senha.'))
  }
  const body = data as { senhaTemporaria?: string }
  if (!body?.senhaTemporaria) throw new Error('Senha temporária não retornada.')
  return body.senhaTemporaria
}
