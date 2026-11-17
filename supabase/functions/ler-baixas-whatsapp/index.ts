// @ts-nocheck — esta função roda em Deno (Supabase Edge Functions), não em Node.js.
// Edge Function: lê mensagens do WhatsApp pedindo baixa de insumos (texto
// colado + fotos, ex.: foto da placa) com o Claude e devolve a lista de baixas
// já casada com o cadastro de insumos, para o usuário conferir na aba Insumos.
// Nada é lançado aqui — quem confirma e grava é o app.
// A chave da Anthropic fica só aqui (secret ANTHROPIC_API_KEY), nunca no app.
//
// Deploy:  supabase functions deploy ler-baixas-whatsapp
//          (usa o mesmo secret ANTHROPIC_API_KEY do ler-cupom-abastecimento)
import { createClient } from 'jsr:@supabase/supabase-js@2'
import Anthropic from 'npm:@anthropic-ai/sdk'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

const TIPOS_IMAGEM = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_IMAGENS = 20

const SCHEMA = {
  type: 'object',
  properties: {
    baixas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          item_id: { type: ['string', 'null'], description: 'id do insumo do cadastro que corresponde ao pedido, ou null se nenhum corresponde com segurança' },
          item_texto: { type: 'string', description: 'Como o item foi escrito na mensagem' },
          quantidade: { type: ['number', 'null'], description: 'Quantidade já convertida para a unidade do cadastro do insumo escolhido' },
          placa: { type: ['string', 'null'], description: 'Placa do veículo, maiúscula e sem traço (ex.: FRI8E96)' },
          responsavel: { type: ['string', 'null'], description: 'Nome do colaborador que usou/retirou' },
          motivo: { type: ['string', 'null'], description: 'Setor ou observação curta da baixa (ex.: FUNILARIA, TERCEIRO)' },
          observacao: { type: ['string', 'null'], description: 'O que o usuário deve conferir nesta linha, em português' },
        },
        required: ['item_id', 'item_texto', 'quantidade', 'placa', 'responsavel', 'motivo', 'observacao'],
        additionalProperties: false,
      },
    },
    ignorados: {
      type: 'array',
      description: 'Trechos da conversa que não são pedido de baixa (avisos, pedidos de compra, entradas futuras)',
      items: {
        type: 'object',
        properties: {
          trecho: { type: 'string' },
          motivo: { type: 'string', description: 'Por que não virou baixa, em português' },
        },
        required: ['trecho', 'motivo'],
        additionalProperties: false,
      },
    },
  },
  required: ['baixas', 'ignorados'],
  additionalProperties: false,
}

const INSTRUCOES = `Você ajuda o almoxarifado de uma oficina de caminhões no Brasil a dar baixa de insumos (uso e consumo) no estoque.
Recebe uma conversa de WhatsApp copiada (texto) e, às vezes, fotos. No texto, cada foto aparece no lugar onde foi enviada como [IMAGEM n], e as fotos vêm na mesma ordem. Normalmente a foto é da placa do caminhão.

Para cada item pedido, gere uma linha em "baixas":
- Escolha "item_id" SOMENTE entre os insumos do cadastro informado. Considere sinônimos, abreviações, plural e erros de digitação (ex.: "lixa rokit 80" → item de lixa grão 80 do tipo rokit, se existir). Se houver dúvida real entre dois itens ou nenhum servir, use null e explique em "observacao".
- "quantidade" na unidade do cadastro do item (ex.: pediu 500 ml de um item em LT → 0.5). Números escritos por extenso viram número ("duas" → 2). "05" → 5.
- "placa": a que aparece escrita perto do pedido, ou a lida da foto [IMAGEM n] enviada junto ("essa placa", "cada placa dessa"). Se não der para ler a placa da foto com certeza, use null e diga em "observacao" qual foto conferir. Formato sem traço, maiúsculo.
- "para cada placa dessa" com várias fotos = uma linha por placa, cada uma com a quantidade pedida.
- "responsavel": o colaborador citado ("Colaborador ...", "terceiros Mateus"). Se o nome bate com alguém da equipe informada, use o nome da equipe completo. Um mesmo colaborador citado vale para os itens daquele bloco de mensagem.
- "motivo": setor ou função citada junto do colaborador (ex.: FUNILARIA) ou "TERCEIRO" quando for de terceiros; null se não houver.
- Nunca invente quantidade, item, placa ou nome.

Coloque em "ignorados" o que não é pedido de baixa: avisos ("acabou no sistema o óleo..."), compras ou entregas futuras ("eu te passo sexta..."), conversa. Na dúvida se é baixa, prefira "ignorados" e explique.`

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Método não permitido.' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return jsonResponse({ error: 'Não autenticado.' }, 401)

  // Só usuários logados no sistema (evita que qualquer um gaste a chave da API).
  const callerClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: caller, error: callerError } = await callerClient.auth.getUser()
  if (callerError || !caller?.user) return jsonResponse({ error: 'Sessão inválida.' }, 401)

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) return jsonResponse({ error: 'Leitura automática não configurada (falta ANTHROPIC_API_KEY no Supabase).' }, 503)

  let body: {
    texto?: string
    imagens?: { data: string; mediaType: string }[]
    itens?: { id: string; nome: string; unidade: string }[]
    equipe?: string[]
    placas?: string[]
  }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Corpo inválido.' }, 400)
  }

  const texto = (body.texto ?? '').trim()
  if (!texto) return jsonResponse({ error: 'Cole a mensagem do WhatsApp.' }, 400)
  if (texto.length > 30_000) return jsonResponse({ error: 'Mensagem muito grande. Cole menos mensagens por vez.' }, 413)
  const itens = Array.isArray(body.itens) ? body.itens : []
  if (itens.length === 0) return jsonResponse({ error: 'Nenhum insumo cadastrado para comparar.' }, 400)

  const imagens = (Array.isArray(body.imagens) ? body.imagens : []).slice(0, MAX_IMAGENS)
  for (const img of imagens) {
    if (!TIPOS_IMAGEM.includes(img.mediaType) || !img.data) return jsonResponse({ error: 'Imagem em formato não suportado.' }, 400)
    if (img.data.length > 7_000_000) return jsonResponse({ error: 'Imagem muito grande.' }, 413)
  }

  const cadastro = itens.map((it) => `${it.id} | ${it.nome} | ${it.unidade}`).join('\n')
  const equipe = (body.equipe ?? []).join('\n')
  const placas = (body.placas ?? []).join(', ')

  const content = [
    {
      type: 'text',
      text:
        `Cadastro de insumos (id | nome | unidade):\n${cadastro}\n\n` +
        (equipe ? `Equipe conhecida:\n${equipe}\n\n` : '') +
        (placas ? `Placas da frota (ajuda a conferir a leitura das fotos): ${placas}\n\n` : '') +
        `Conversa do WhatsApp:\n${texto}`,
    },
    ...imagens.flatMap((img, i) => [
      { type: 'text', text: `[IMAGEM ${i + 1}]` },
      { type: 'image', source: { type: 'base64', media_type: img.mediaType, data: img.data.replace(/^data:[^,]+,/, '') } },
    ]),
  ]

  const client = new Anthropic({ apiKey })
  try {
    const response = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: INSTRUCOES,
      output_config: {
        effort: 'medium',
        format: { type: 'json_schema', schema: SCHEMA },
      },
      messages: [{ role: 'user', content }],
    })

    if (response.stop_reason === 'refusal') {
      return jsonResponse({ error: 'Não foi possível ler esta mensagem. Lance manualmente.' }, 422)
    }
    if (response.stop_reason === 'max_tokens') {
      return jsonResponse({ error: 'Mensagem longa demais para ler de uma vez. Cole menos mensagens.' }, 502)
    }
    const saida = response.content.find((b) => b.type === 'text')?.text
    if (!saida) return jsonResponse({ error: 'Leitura sem resultado.' }, 502)
    return jsonResponse(JSON.parse(saida), 200)
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return jsonResponse({ error: 'Muitas leituras ao mesmo tempo. Tente em instantes.' }, 429)
    if (err instanceof Anthropic.AuthenticationError) return jsonResponse({ error: 'Chave da API da Anthropic inválida.' }, 503)
    if (err instanceof Anthropic.BadRequestError) return jsonResponse({ error: `Mensagem recusada: ${err.message}` }, 400)
    if (err instanceof Anthropic.APIError) return jsonResponse({ error: `Falha na leitura (${err.status}).` }, 502)
    console.error('ler-baixas-whatsapp:', err)
    return jsonResponse({ error: 'Falha ao ler a mensagem.' }, 500)
  }
})
