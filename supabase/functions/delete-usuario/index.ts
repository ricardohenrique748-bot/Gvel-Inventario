// Edge Function: exclui um usuário (conta de login + registro em public.usuarios).
// Roda no servidor do Supabase, nunca no navegador — é o único lugar seguro para
// usar a service role key (injetada automaticamente pelo runtime da função).
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DeleteUsuarioBody {
  id: string
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

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: callerData, error: callerError } = await callerClient.auth.getUser()
  if (callerError || !callerData.user) {
    return jsonResponse({ error: 'Não autenticado.' }, 401)
  }

  let body: DeleteUsuarioBody
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Corpo da requisição inválido.' }, 400)
  }

  const id = body.id
  if (!id) {
    return jsonResponse({ error: 'ID do usuário é obrigatório.' }, 400)
  }
  if (id === callerData.user.id) {
    return jsonResponse({ error: 'Você não pode excluir seu próprio usuário.' }, 400)
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

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(id)
  if (deleteError) {
    return jsonResponse({ error: deleteError.message }, 400)
  }

  return jsonResponse({ ok: true }, 200)
})
