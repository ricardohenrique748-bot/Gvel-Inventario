// @ts-nocheck — esta função roda em Deno (Supabase Edge Functions), não em Node.js.
//
// Alerta diário no WhatsApp (API oficial da Meta — WhatsApp Cloud API) com os
// cavalos da Rodocaçamba (PLACAS_PADRAO / segredo CHECKLIST_PLACAS) que estão
// OPERANTES e ficaram sem checklist no dia. Chamada todo dia pelo pg_cron
// (supabase/scripts/agendar_alerta_checklist_rodocacamba.sql).
//
// A frota é montada igual à tela Frotas (reconciliarFrotas em Frotas.tsx):
// lista oficial do código (cópia em _shared/frotaOficial.json, gerada por
// scripts/gerar-frota-oficial-edge.mjs) + edições/cadastros de veiculos_frota.
//
// Segredos (supabase secrets set ...):
//   WHATSAPP_TOKEN            token permanente do usuário do sistema (Meta Business)
//   WHATSAPP_PHONE_NUMBER_ID  ID do número remetente (WhatsApp Manager)
//   WHATSAPP_DESTINOS         números que recebem, com DDI, separados por vírgula: 5511999999999,5519988887777
//   WHATSAPP_TEMPLATE         nome do modelo aprovado (padrão: checklist_rodocacamba_pendente)
//   WHATSAPP_TEMPLATE_IDIOMA  idioma do modelo (padrão: pt_BR)
//   ALERTA_CRON_SECRET        senha que o pg_cron manda no cabeçalho x-cron-secret
//   CHECKLIST_PLACAS          (opcional) placas que fazem checklist diário, separadas por vírgula
//
// Parâmetros opcionais (query string), úteis pra testar:
//   ?data=2026-11-10   confere outro dia (padrão: hoje, horário de Brasília)
//   ?simular=1         não manda WhatsApp, só devolve o resultado em JSON
import { createClient } from 'jsr:@supabase/supabase-js@2'
import frotaOficial from '../_shared/frotaOficial.json' with { type: 'json' }

const GVEL_COMPANY_ID = '0923c894-85ca-45c1-ba1b-3124d19b4d65'
// Veículos que fazem o checklist diário. Dá pra trocar sem republicar com o
// segredo CHECKLIST_PLACAS (placas separadas por vírgula).
const PLACAS_PADRAO = ['GDT0H04', 'CUL2E24', 'GDT0I03', 'EDJ8C00', 'FXM9D74', 'GDT0I01', 'GDT0I02', 'ERA9G01']

function placasDoChecklist(): Set<string> {
  const doSegredo = (Deno.env.get('CHECKLIST_PLACAS') || '').split(',').map(norm).filter(Boolean)
  return new Set(doSegredo.length > 0 ? doSegredo : PLACAS_PADRAO)
}
// O WhatsApp recusa variável de modelo com quebra de linha e corta o corpo em 1024 caracteres.
const LIMITE_LISTA = 700

type Veiculo = { id: string; placa: string; tipo: string; situacao: string; responsavel: string | null }

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const norm = (placa?: string | null) => (placa || '').toUpperCase().trim()

/** Mesma regra de reconciliarFrotas (Frotas.tsx), só com os campos usados aqui. */
function montarFrota(overrides: Veiculo[]): Veiculo[] {
  const mapa = new Map<string, Veiculo>()
  for (const v of frotaOficial.leve) mapa.set(norm(v.placa), v)
  for (const v of frotaOficial.pesado) mapa.set(norm(v.placa), v)
  for (const v of frotaOficial.embarcado) mapa.set(norm(v.placa), v)

  const placasEmbarcado = new Set(frotaOficial.embarcado.map((v) => norm(v.placa)))
  const placaOriginalPorId = new Map<string, string>()
  mapa.forEach((v, chave) => placaOriginalPorId.set(v.id, chave))

  for (const v of overrides) {
    const placa = v.placa ? norm(v.placa) : v.id
    const chaveOriginal = v.id ? placaOriginalPorId.get(v.id) : undefined
    const base = mapa.get(placa) ?? (chaveOriginal ? mapa.get(chaveOriginal) : undefined)
    if (base) {
      if (chaveOriginal && chaveOriginal !== placa) mapa.delete(chaveOriginal)
      mapa.set(placa, {
        ...base,
        ...v,
        placa,
        tipo: placasEmbarcado.has(placa) ? 'embarcado' : v.tipo,
        responsavel: v.responsavel || base.responsavel,
      })
    } else if (v.id && !v.id.startsWith('frota_') && !v.id.startsWith('pesado_')) {
      mapa.set(placa, { ...v, placa })
    }
  }
  return Array.from(mapa.values())
}

/** Hoje no horário de Brasília (UTC-3, sem horário de verão). */
function hojeBrasilia(): string {
  return new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10)
}

function formatarData(iso: string) {
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

function montarLista(pendentes: Veiculo[]) {
  const itens = pendentes.map((v) => (v.responsavel ? `${v.placa} (${v.responsavel.toUpperCase()})` : v.placa))
  let texto = ''
  for (let i = 0; i < itens.length; i++) {
    const proximo = texto ? `${texto} · ${itens[i]}` : itens[i]
    if (proximo.length > LIMITE_LISTA) {
      return `${texto} · e mais ${itens.length - i}`
    }
    texto = proximo
  }
  return texto
}

async function enviarWhatsApp(destino: string, parametros: string[]) {
  const token = Deno.env.get('WHATSAPP_TOKEN')
  const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')
  const resp = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: destino,
      type: 'template',
      template: {
        name: Deno.env.get('WHATSAPP_TEMPLATE') || 'checklist_rodocacamba_pendente',
        language: { code: Deno.env.get('WHATSAPP_TEMPLATE_IDIOMA') || 'pt_BR' },
        components: [
          {
            type: 'body',
            parameters: parametros.map((text) => ({ type: 'text', text })),
          },
        ],
      },
    }),
  })
  const corpo = await resp.json().catch(() => ({}))
  return { destino, ok: resp.ok, status: resp.status, resposta: corpo }
}

Deno.serve(async (req: Request) => {
  const segredo = Deno.env.get('ALERTA_CRON_SECRET')
  if (!segredo || req.headers.get('x-cron-secret') !== segredo) {
    return json({ error: 'Não autorizado.' }, 401)
  }

  const url = new URL(req.url)
  const dia = url.searchParams.get('data') || hojeBrasilia()
  const simular = url.searchParams.get('simular') === '1'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return json({ error: 'Use ?data=AAAA-MM-DD' }, 400)

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const { data: overrides, error: erroFrota } = await admin
    .from('veiculos_frota')
    .select('id, placa, tipo, situacao, responsavel')
  if (erroFrota) return json({ error: `Erro ao ler a frota: ${erroFrota.message}` }, 500)

  const placas = placasDoChecklist()
  const rodocacamba = montarFrota(overrides ?? []).filter(
    (v) => placas.has(norm(v.placa)) && (v.situacao || 'operante') === 'operante',
  )

  const { data: checklists, error: erroChk } = await admin
    .from('checklists_frota')
    .select('veiculo_id, placa')
    .eq('company_id', GVEL_COMPANY_ID)
    .gte('data_hora', `${dia}T00:00:00-03:00`)
    .lt('data_hora', `${dia}T23:59:59.999-03:00`)
  if (erroChk) return json({ error: `Erro ao ler os checklists: ${erroChk.message}` }, 500)

  const fezPorId = new Set((checklists ?? []).map((c) => c.veiculo_id).filter(Boolean))
  const fezPorPlaca = new Set((checklists ?? []).map((c) => norm(c.placa)))
  const pendentes = rodocacamba
    .filter((v) => !fezPorId.has(v.id) && !fezPorPlaca.has(norm(v.placa)))
    .sort((a, b) => a.placa.localeCompare(b.placa))

  const resumo = {
    dia,
    operantes: rodocacamba.length,
    fizeram: rodocacamba.length - pendentes.length,
    pendentes: pendentes.map((v) => ({ placa: v.placa, responsavel: v.responsavel })),
  }

  // Todo mundo fez: não manda nada.
  if (pendentes.length === 0 || simular) return json({ ...resumo, enviado: false })

  const destinos = (Deno.env.get('WHATSAPP_DESTINOS') || '')
    .split(',')
    .map((d) => d.replace(/\D/g, ''))
    .filter(Boolean)
  if (destinos.length === 0) return json({ ...resumo, error: 'WHATSAPP_DESTINOS não configurado.' }, 500)

  // Modelo: {{1}} data · {{2}} quantidade · {{3}} lista de placas
  const parametros = [formatarData(dia), String(pendentes.length), montarLista(pendentes)]
  const envios = await Promise.all(destinos.map((d) => enviarWhatsApp(d, parametros)))
  const falhou = envios.some((e) => !e.ok)

  return json({ ...resumo, enviado: !falhou, envios }, falhou ? 502 : 200)
})
