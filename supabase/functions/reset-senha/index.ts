// @ts-nocheck — esta função roda em Deno (Supabase Edge Functions), não em Node.js.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ResetSenhaBody {
  id: string
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function gerarSenhaTemporaria(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let senha = ''
  for (let i = 0; i < 10; i++) {
    senha += chars[Math.floor(Math.random() * chars.length)]
  }
  return senha
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

  // Verifica quem está chamando
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: callerData, error: callerError } = await callerClient.auth.getUser()
  if (callerError || !callerData.user) {
    return jsonResponse({ error: 'Não autenticado.' }, 401)
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey)

  // Apenas admins podem resetar senhas
  const { data: callerPerfil, error: perfilError } = await adminClient
    .from('usuarios')
    .select('nivel')
    .eq('id', callerData.user.id)
    .single()

  if (perfilError || callerPerfil?.nivel !== 'admin') {
    return jsonResponse({ error: 'Apenas administradores podem fazer isso.' }, 403)
  }

  let body: ResetSenhaBody
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Corpo da requisição inválido.' }, 400)
  }

  const { id } = body
  if (!id) {
    return jsonResponse({ error: 'ID do usuário é obrigatório.' }, 400)
  }
  if (id === callerData.user.id) {
    return jsonResponse({ error: 'Use a página de perfil para alterar sua própria senha.' }, 400)
  }

  const senhaTemporaria = gerarSenhaTemporaria()

  // Atualiza a senha no Auth
  const { error: updateAuthError } = await adminClient.auth.admin.updateUserById(id, {
    password: senhaTemporaria,
  })
  if (updateAuthError) {
    return jsonResponse({ error: updateAuthError.message }, 400)
  }

  // Marca que o usuário deve trocar a senha no próximo login
  const { error: updatePerfilError } = await adminClient
    .from('usuarios')
    .update({ deve_trocar_senha: true })
    .eq('id', id)

  if (updatePerfilError) {
    return jsonResponse({ error: updatePerfilError.message }, 400)
  }

  return jsonResponse({ senhaTemporaria }, 200)
})
