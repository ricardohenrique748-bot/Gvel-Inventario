// @ts-nocheck — esta função roda em Deno (Supabase Edge Functions), não em Node.js.
// Os erros de "Cannot find name 'Deno'" e "Cannot find module 'jsr:'" são falsos
// positivos do TypeScript do projeto e não afetam o funcionamento real da função.
// Edge Function: cria um usuário com login real (Supabase Auth) + registro em public.usuarios.
// Roda no servidor do Supabase, nunca no navegador — é o único lugar seguro para
// usar a service role key (injetada automaticamente pelo runtime da função).
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CreateUsuarioBody {
  nome: string
  email: string
  senha: string
  telefone?: string
  nivel?: 'admin' | 'usuario'
  modulos?: string[]
  company_id?: string
  is_master_admin?: boolean
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return jsonResponse({ error: 'Não autenticado.' }, 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // Confirma que quem está chamando já está logado no sistema.
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: callerData, error: callerError } = await callerClient.auth.getUser()
  if (callerError || !callerData.user) {
    return jsonResponse({ error: 'Não autenticado.' }, 401)
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey)

  const { data: callerPerfil, error: perfilError } = await adminClient
    .from('usuarios')
    .select('nivel, company_id, is_master_admin')
    .eq('id', callerData.user.id)
    .single()

  if (perfilError || callerPerfil?.nivel !== 'admin') {
    return jsonResponse({ error: 'Apenas administradores podem fazer isso.' }, 403)
  }

  let body: CreateUsuarioBody
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Corpo da requisição inválido.' }, 400)
  }

  const nome = body.nome?.trim()
  const email = body.email?.trim().toLowerCase()
  const senha = body.senha
  const telefone = body.telefone?.trim() || null
  const nivel = body.nivel === 'admin' ? 'admin' : 'usuario'
  const modulos = Array.isArray(body.modulos) ? body.modulos : []

  if (!nome || !email || !senha) {
    return jsonResponse({ error: 'Nome, e-mail e senha são obrigatórios.' }, 400)
  }
  if (senha.length < 6) {
    return jsonResponse({ error: 'A senha precisa ter no mínimo 6 caracteres.' }, 400)
  }

  // Um admin comum só pode criar usuários na própria empresa, mesmo que
  // tente informar outra no corpo da requisição — nunca confiamos no
  // company_id vindo do cliente. Só o master admin pode escolher a empresa.
  let companyId = callerPerfil.company_id as string
  if (callerPerfil.is_master_admin && body.company_id) {
    const { data: empresaAlvo } = await adminClient
      .from('companies')
      .select('id')
      .eq('id', body.company_id)
      .maybeSingle()
    if (!empresaAlvo) {
      return jsonResponse({ error: 'Empresa informada não existe.' }, 400)
    }
    companyId = body.company_id
  }

  // Só um admin master já existente pode alterar essa flag em outra conta —
  // nunca confiamos nesse campo vindo do cliente sozinho. Quem não é master
  // admin nem consegue enviar isso (undefined), então o valor atual do
  // usuário-alvo (se já existir) permanece intocado.
  const masterAdminPayload: { is_master_admin?: boolean } =
    callerPerfil.is_master_admin === true && body.is_master_admin !== undefined
      ? { is_master_admin: body.is_master_admin === true }
      : {}

  // Tenta criar o usuário no Auth. Se o e-mail já existir (ex.: cadastro anterior
  // que falhou no meio), buscamos o usuário existente pelo e-mail em vez de falhar.
  let authUserId: string

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: { nome, company_id: companyId },
  })

  if (createError) {
    const msg = createError.message ?? ''
    const jaExiste = msg.toLowerCase().includes('already been registered') ||
                     msg.toLowerCase().includes('already registered')

    if (!jaExiste) {
      return jsonResponse({ error: msg || 'Não foi possível criar o usuário.' }, 400)
    }

    // Usuário já existe no Auth — busca pelo e-mail e reusa o ID.
    const { data: listData, error: listError } = await adminClient.auth.admin.listUsers()
    if (listError) {
      return jsonResponse({ error: 'Não foi possível recuperar o usuário existente.' }, 500)
    }
    const existing = listData.users.find((u: { id: string; email?: string }) => u.email === email)
    if (!existing) {
      return jsonResponse({ error: 'Usuário não encontrado.' }, 404)
    }

    // Se esse e-mail já tem perfil vinculado a outra empresa, um admin comum
    // não pode "recriar" o usuário pra puxá-lo pra própria empresa — só o
    // master admin pode mover um usuário entre empresas.
    if (!callerPerfil.is_master_admin) {
      const { data: perfilExistente } = await adminClient
        .from('usuarios')
        .select('company_id')
        .eq('id', existing.id)
        .maybeSingle()
      if (perfilExistente && perfilExistente.company_id !== companyId) {
        return jsonResponse({ error: 'Este e-mail já pertence a um usuário de outra empresa.' }, 403)
      }
    }

    // Atualiza a senha para garantir que a senha padrão está correta.
    await adminClient.auth.admin.updateUserById(existing.id, {
      password: senha,
      user_metadata: { nome },
    })

    authUserId = existing.id
  } else if (!created.user) {
    return jsonResponse({ error: 'Não foi possível criar o usuário.' }, 400)
  } else {
    authUserId = created.user.id
  }

  // Salva/atualiza o perfil em public.usuarios.
  // O trigger `handle_new_auth_user` pode já ter inserido uma linha básica,
  // então tentamos UPDATE primeiro; se não houver linha, fazemos INSERT.
  const { data: updatedUsuario, error: updateError } = await adminClient
    .from('usuarios')
    .update({ nome, email, telefone, nivel, modulos, company_id: companyId, ...masterAdminPayload, deve_trocar_senha: true })
    .eq('id', authUserId)
    .select()
    .maybeSingle()

  let usuario = updatedUsuario

  if (!updateError && !usuario) {
    // Linha ainda não existe — insere normalmente.
    const { data: insertedUsuario, error: insertError } = await adminClient
      .from('usuarios')
      .insert({ id: authUserId, nome, email, telefone, nivel, modulos, company_id: companyId, ...masterAdminPayload, deve_trocar_senha: true })
      .select()
      .single()

    if (insertError) {
      // Só reverte se criamos o usuário agora (não se já existia).
      if (created?.user) await adminClient.auth.admin.deleteUser(authUserId)
      return jsonResponse({ error: insertError.message }, 400)
    }
    usuario = insertedUsuario
  } else if (updateError) {
    if (created?.user) await adminClient.auth.admin.deleteUser(authUserId)
    return jsonResponse({ error: updateError.message }, 400)
  }

  return jsonResponse(usuario, 201)
})
