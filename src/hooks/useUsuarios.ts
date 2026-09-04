import { useCallback, useEffect, useState } from 'react'
import { supabase, FOTOS_BUCKET } from '@/lib/supabase'
import { up } from '@/lib/text'
import { salvarPermissoesUsuario, getModulosUsuario } from '@/lib/permissoes'
import type { NivelUsuario, Usuario } from '@/lib/types'

const STORAGE_EMPRESA_USUARIO_PREFIX = 'gvel_user_empresa_'

export function salvarEmpresaUsuario(key: string, empresaId: string) {
  if (!key) return
  try {
    localStorage.setItem(`${STORAGE_EMPRESA_USUARIO_PREFIX}${key.toLowerCase().trim()}`, empresaId)
  } catch {}
}

export function getEmpresaUsuario(user: Partial<Usuario>): string {
  if (user.empresa_id) return user.empresa_id
  const email = (user.email || '').toLowerCase().trim()
  if (email) {
    try {
      const saved = localStorage.getItem(`${STORAGE_EMPRESA_USUARIO_PREFIX}${email}`)
      if (saved) return saved
    } catch {}
  }
  if (user.id) {
    try {
      const saved = localStorage.getItem(`${STORAGE_EMPRESA_USUARIO_PREFIX}${user.id}`)
      if (saved) return saved
    } catch {}
  }
  return 'gvel_diesel'
}

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
      // Injeta os módulos recuperados e a empresa vinculada
      const listaTratada = (data ?? []).map((u) => ({
        ...u,
        empresa_id: getEmpresaUsuario(u),
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

export async function uploadFotoUsuario(file: File, userId: string): Promise<string> {
  try {
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `usuarios/${userId}-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from(FOTOS_BUCKET).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    })
    if (!error) {
      return supabase.storage.from(FOTOS_BUCKET).getPublicUrl(path).data.publicUrl
    }
  } catch (err) {
    console.warn('Falha no storage, convertendo em dataURL:', err)
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

interface CriarUsuarioInput {
  nome: string
  email: string
  senha: string
  telefone?: string
  nivel?: NivelUsuario
  empresa_id?: string
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
  
  if (input.empresa_id) {
    salvarEmpresaUsuario(input.email, input.empresa_id)
    if (data?.id) {
      salvarEmpresaUsuario(data.id, input.empresa_id)
    }
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
  empresa_id?: string
  modulos?: string[]
  email?: string
  foto_url?: string | null
}

const ROTULOS_CAMPOS_USUARIO: Record<string, string> = {
  modulos: 'permissões de acesso',
  empresa_id: 'empresa vinculada',
  foto_url: 'foto de perfil',
}

/** Extrai o nome da coluna que o Postgres/PostgREST reclamou não existir,
 * a partir de mensagens como "Could not find the 'foto_url' column of
 * 'usuarios' in the schema cache" ou `column "foto_url" of relation ...`. */
function extrairColunaFaltante(mensagem: string): string | null {
  const m1 = mensagem.match(/'([\w]+)' column/i)
  if (m1) return m1[1]
  const m2 = mensagem.match(/column "([\w]+)"/i)
  if (m2) return m2[1]
  return null
}

export async function atualizarUsuario(id: string, input: AtualizarUsuarioInput) {
  // Salva empresa vinculada
  if (input.empresa_id) {
    salvarEmpresaUsuario(id, input.empresa_id)
    if (input.email) {
      salvarEmpresaUsuario(input.email, input.empresa_id)
    }
  }

  // Salva permissões localmente de forma imediata e garantida
  if (input.modulos) {
    salvarPermissoesUsuario(id, input.modulos)
    if (input.email) {
      salvarPermissoesUsuario(input.email, input.modulos)
    }
  }

  // Tenta atualizar no Supabase com modulos e empresa_id
  let updatePayload: Record<string, any> = {
    nome: up(input.nome),
    telefone: input.telefone || null,
    nivel: input.nivel,
  }
  if (input.empresa_id) {
    updatePayload.empresa_id = input.empresa_id
  }
  if (input.modulos) {
    updatePayload.modulos = input.modulos
  }
  if (input.foto_url !== undefined) {
    updatePayload.foto_url = input.foto_url
  }

  let { data, error } = await supabase.from('usuarios').update(updatePayload).eq('id', id).select().single()

  // Retenta removendo, uma a uma, só as colunas que o servidor realmente não
  // reconhece (schema desatualizado) — evita jogar fora TODAS as colunas
  // extras (e culpar a errada na mensagem) quando só uma delas está faltando.
  const camposIgnorados: string[] = []
  const mensagemOriginal = error?.message
  while (error) {
    const coluna = extrairColunaFaltante(error.message)
    if (!coluna || !(coluna in updatePayload)) break

    delete updatePayload[coluna]
    camposIgnorados.push(coluna)

    const retry = await supabase.from('usuarios').update(updatePayload).eq('id', id).select().single()
    data = retry.data
    error = retry.error
  }

  if (error) throw new Error(error.message)

  if (camposIgnorados.length > 0) {
    const rotulos = camposIgnorados.map((c) => ROTULOS_CAMPOS_USUARIO[c] || c).join(', ')
    throw new Error(
      `Nome/telefone/nível foram salvos, mas isto NÃO pôde ser salvo no servidor (${rotulos}) — colunas indisponíveis: ${mensagemOriginal}. Avise o suporte técnico — essa alteração não vai valer para o usuário em outros dispositivos.`,
    )
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
