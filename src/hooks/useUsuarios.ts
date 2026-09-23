import { useCallback, useEffect, useState } from 'react'
import { supabase, FOTOS_BUCKET } from '@/lib/supabase'
import { up } from '@/lib/text'
import { salvarPermissoesUsuario, getModulosUsuario } from '@/lib/permissoes'
import { comPrefixoEmpresa } from '@/lib/tenant'
import { useAuth } from '@/contexts/AuthContext'
import type { NivelUsuario, Usuario } from '@/lib/types'

export function useUsuarios() {
  const { perfil } = useAuth()
  const companyId = perfil?.company_id
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    if (!companyId) return
    setLoading(true)
    // Sempre a empresa ativa no momento, mais qualquer admin master (que
    // administra todas as empresas, então aparece em todas as listas) — o
    // RLS quem decide de verdade o que cada um enxerga: pra um usuário
    // comum, essa segunda condição não devolve nada de outra empresa mesmo
    // assim, só quem é master admin de fato consegue ver além da própria.
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .or(`company_id.eq.${companyId},is_master_admin.eq.true`)
      .order('nome')
    if (error) {
      setError(error.message)
    } else {
      // Injeta os módulos recuperados (ver src/lib/permissoes.ts)
      const listaTratada = (data ?? []).map((u) => ({
        ...u,
        modulos: getModulosUsuario(u),
      }))
      setUsuarios(listaTratada)
    }
    setLoading(false)
  }, [companyId])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { usuarios, loading, error, refetch }
}

export async function uploadFotoUsuario(file: File, userId: string): Promise<string> {
  try {
    const ext = file.name.split('.').pop() || 'jpg'
    const path = comPrefixoEmpresa(`usuarios/${userId}-${Date.now()}.${ext}`)
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
  company_id?: string
  modulos?: string[]
  is_master_admin?: boolean
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
  company_id?: string
  modulos?: string[]
  email?: string
  foto_url?: string | null
  is_master_admin?: boolean
}

const ROTULOS_CAMPOS_USUARIO: Record<string, string> = {
  modulos: 'permissões de acesso',
  company_id: 'empresa vinculada',
  foto_url: 'foto de perfil',
  is_master_admin: 'permissão de admin master',
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
  // Salva permissões localmente de forma imediata e garantida
  if (input.modulos) {
    salvarPermissoesUsuario(id, input.modulos)
    if (input.email) {
      salvarPermissoesUsuario(input.email, input.modulos)
    }
  }

  // Tenta atualizar no Supabase com modulos e company_id. O RLS garante que
  // ninguém consegue mover um usuário pra outra empresa a não ser o master
  // admin (ver policy "usuarios_isolamento_empresa").
  let updatePayload: Record<string, any> = {
    nome: up(input.nome),
    telefone: input.telefone || null,
    nivel: input.nivel,
  }
  if (input.company_id) {
    updatePayload.company_id = input.company_id
  }
  if (input.modulos) {
    updatePayload.modulos = input.modulos
  }
  if (input.foto_url !== undefined) {
    updatePayload.foto_url = input.foto_url
  }
  if (input.is_master_admin !== undefined) {
    updatePayload.is_master_admin = input.is_master_admin
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
