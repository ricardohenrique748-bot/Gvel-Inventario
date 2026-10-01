// @ts-nocheck — esta função roda em Deno (Supabase Edge Functions), não em Node.js.
// Edge Function: lê a foto do cupom/comprovante de abastecimento com o Claude e
// devolve os campos estruturados para preencher o formulário da aba Consumo.
// A chave da Anthropic fica só aqui (secret ANTHROPIC_API_KEY), nunca no app.
//
// Deploy:  supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//          supabase functions deploy ler-cupom-abastecimento
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

const SCHEMA = {
  type: 'object',
  properties: {
    legivel: { type: 'boolean', description: 'false se a imagem não é um cupom/comprovante de abastecimento ou está ilegível' },
    placa: { type: ['string', 'null'], description: 'Placa do veículo, maiúscula e sem traço (ex.: CUL2E24)' },
    data: { type: ['string', 'null'], description: 'Data do abastecimento no formato YYYY-MM-DD' },
    hora: { type: ['string', 'null'], description: 'Hora do abastecimento no formato HH:MM (24h)' },
    litros: { type: ['number', 'null'], description: 'Quantidade abastecida em litros' },
    valor_litro: { type: ['number', 'null'], description: 'Preço por litro em reais' },
    valor_total: { type: ['number', 'null'], description: 'Valor total pago em reais' },
    combustivel: { type: ['string', 'null'], enum: ['DIESEL S10', 'DIESEL S500', 'ARLA 32', 'OUTRO', null] },
    posto_nome: { type: ['string', 'null'], description: 'Razão social ou nome do posto emitente' },
    posto_cnpj: { type: ['string', 'null'], description: 'CNPJ do posto emitente' },
    odometro: { type: ['number', 'null'], description: 'KM/hodômetro, só se estiver escrito no cupom' },
    motorista: { type: ['string', 'null'], description: 'Nome do motorista, só se estiver escrito no cupom' },
    observacao: { type: ['string', 'null'], description: 'Algo que o usuário deve conferir (campo duvidoso, rasura), em português' },
  },
  required: [
    'legivel', 'placa', 'data', 'hora', 'litros', 'valor_litro', 'valor_total',
    'combustivel', 'posto_nome', 'posto_cnpj', 'odometro', 'motorista', 'observacao',
  ],
  additionalProperties: false,
}

const INSTRUCOES = `Você lê fotos de cupons fiscais (NFC-e), notas e comprovantes de abastecimento de caminhões diesel no Brasil.
Extraia os campos pedidos exatamente como estão impressos ou escritos no documento. A foto pode estar de lado, de ponta-cabeça, amassada ou com sombra.

Regras:
- Nunca invente nem estime: campo ausente, cortado ou ilegível vai como null. Se ficar em dúvida entre dois valores, use null e explique em "observacao".
- Números em formato decimal com ponto (ex.: 812.45), sem símbolo de moeda nem separador de milhar.
- Litros e preço por litro vêm do item do combustível (quantidade × valor unitário). ARLA 32 é um item separado do diesel.
- Se houver mais de um combustível no cupom, use o diesel e cite o outro em "observacao".
- "posto_nome"/"posto_cnpj" são do emitente (o posto), não do cliente/comprador.
- Placa e KM costumam estar escritos à mão ou no campo de observações do cupom.`

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

  let body: { imagem?: string; mediaType?: string }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Corpo inválido.' }, 400)
  }
  const imagem = (body.imagem ?? '').replace(/^data:[^,]+,/, '')
  const mediaType = body.mediaType ?? 'image/jpeg'
  if (!imagem || !TIPOS_IMAGEM.includes(mediaType)) return jsonResponse({ error: 'Envie uma imagem JPEG, PNG ou WEBP.' }, 400)
  if (imagem.length > 7_000_000) return jsonResponse({ error: 'Imagem muito grande.' }, 413)

  const client = new Anthropic({ apiKey })
  try {
    const response = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 4096,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: INSTRUCOES,
      output_config: {
        effort: 'low',
        format: { type: 'json_schema', schema: SCHEMA },
      },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: imagem } },
            { type: 'text', text: 'Extraia os dados deste comprovante de abastecimento.' },
          ],
        },
      ],
    })

    if (response.stop_reason === 'refusal') {
      return jsonResponse({ error: 'Não foi possível ler esta imagem. Preencha manualmente.' }, 422)
    }
    if (response.stop_reason === 'max_tokens') {
      return jsonResponse({ error: 'Resposta incompleta da leitura. Tente de novo.' }, 502)
    }
    const texto = response.content.find((b) => b.type === 'text')?.text
    if (!texto) return jsonResponse({ error: 'Leitura sem resultado.' }, 502)
    return jsonResponse(JSON.parse(texto), 200)
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return jsonResponse({ error: 'Muitas leituras ao mesmo tempo. Tente em instantes.' }, 429)
    if (err instanceof Anthropic.AuthenticationError) return jsonResponse({ error: 'Chave da API da Anthropic inválida.' }, 503)
    if (err instanceof Anthropic.BadRequestError) return jsonResponse({ error: `Imagem recusada: ${err.message}` }, 400)
    if (err instanceof Anthropic.APIError) return jsonResponse({ error: `Falha na leitura (${err.status}).` }, 502)
    console.error('ler-cupom-abastecimento:', err)
    return jsonResponse({ error: 'Falha ao ler a imagem.' }, 500)
  }
})
