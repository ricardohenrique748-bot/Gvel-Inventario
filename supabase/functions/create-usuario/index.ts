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
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
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
    .select('nivel')
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

  if (!nome || !email || !senha) {
    return jsonResponse({ error: 'Nome, e-mail e senha são obrigatórios.' }, 400)
  }
  if (senha.length < 6) {
    return jsonResponse({ error: 'A senha precisa ter no mínimo 6 caracteres.' }, 400)
  }

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
  })
  if (createError || !created.user) {
    return jsonResponse({ error: createError?.message ?? 'Não foi possível criar o usuário.' }, 400)
  }

  const { data: usuario, error: insertError } = await adminClient
    .from('usuarios')
    .insert({ id: created.user.id, nome, email, telefone, nivel, deve_trocar_senha: true })
    .select()
    .single()

  if (insertError) {
    // Reverte a conta de login se não conseguimos salvar o registro do usuário.
    await adminClient.auth.admin.deleteUser(created.user.id)
    return jsonResponse({ error: insertError.message }, 400)
  }

  return jsonResponse(usuario, 201)
})
