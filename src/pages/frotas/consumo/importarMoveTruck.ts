import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'
import { up } from '@/lib/text'
import { normalizarPlaca, type CondicaoCarga } from './dominio'
import type { ViagemConsumo } from '@/hooks/useConsumoCombustivel'

// Importação das viagens do MoveTruck (.xlsx). Fluxo: ler → escolher aba →
// mapear colunas → validar → prévia (novos / duplicados / atualizáveis /
// com erro) → confirmar → gravar → log em `importacoes_movetruck`.
// Nada é gravado sem passar pela prévia.

export const CAMPOS_MOVETRUCK = [
  { id: 'PLACA', label: 'Placa', obrigatorio: false },
  { id: 'DATA', label: 'Data', obrigatorio: true },
  { id: 'ORIGEM', label: 'Origem', obrigatorio: false },
  { id: 'DESTINO', label: 'Destino', obrigatorio: false },
  { id: 'KM', label: 'KM', obrigatorio: false },
  { id: 'TONELADAS', label: 'Toneladas', obrigatorio: false },
  { id: 'VALOR_FRETE', label: 'Valor do frete', obrigatorio: false },
  { id: 'MOTORISTA', label: 'Motorista', obrigatorio: false },
  { id: 'CONDICAO_CARGA', label: 'Condição de carga', obrigatorio: false },
] as const

export type CampoMoveTruck = (typeof CAMPOS_MOVETRUCK)[number]['id']
export type MapeamentoMoveTruck = Partial<Record<CampoMoveTruck, string>>

const SINONIMOS: Record<CampoMoveTruck, string[]> = {
  PLACA: ['placa', 'veiculo', 'cavalo'],
  DATA: ['data', 'data viagem', 'data saida', 'dt', 'data inicio'],
  ORIGEM: ['origem', 'local origem', 'carregamento'],
  DESTINO: ['destino', 'local destino', 'descarga'],
  KM: ['km', 'km rodado', 'distancia', 'km percorrido', 'quilometragem'],
  TONELADAS: ['toneladas', 'peso', 'ton', 'peso liquido', 'tonelagem', 'peso (t)'],
  VALOR_FRETE: ['valor frete', 'frete', 'valor', 'receita', 'valor total'],
  MOTORISTA: ['motorista', 'condutor'],
  CONDICAO_CARGA: ['condicao', 'condicao carga', 'situacao', 'carregado/vazio'],
}

const RE_PLACA = /\b([A-Z]{3})-?(\d[A-Z0-9]\d{2})\b/

function normTexto(s: unknown): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9/() ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export interface PlanilhaLida {
  nome: string
  colunas: string[]
  linhas: Record<string, unknown>[]
  /** Placa vinda do agrupamento ("Placa: ABC1234") por linha, quando houver. */
  placaDoGrupo: (string | undefined)[]
}

/** Lê todas as abas. O cabeçalho é a primeira linha com 3+ textos nas 15 primeiras. */
export async function lerXlsx(file: File): Promise<PlanilhaLida[]> {
  const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true })
  return wb.SheetNames.map((nome) => {
    const matriz = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[nome], { header: 1, raw: true, defval: null })
    const idxCab = Math.max(
      0,
      matriz.slice(0, 15).findIndex((l) => (l ?? []).filter((c) => typeof c === 'string' && c.trim()).length >= 3),
    )
    const cab = (matriz[idxCab] ?? []).map((c, i) => (c == null || String(c).trim() === '' ? `Coluna ${i + 1}` : String(c).trim()))
    const linhas: Record<string, unknown>[] = []
    const placaDoGrupo: (string | undefined)[] = []
    // Placa no título da aba ou nas linhas acima do cabeçalho.
    let placaAtual = matchPlaca(nome) ?? matriz.slice(0, idxCab).map((l) => matchPlaca((l ?? []).join(' '))).find(Boolean)
    for (const l of matriz.slice(idxCab + 1)) {
      const celulas = (l ?? []).filter((c) => c != null && String(c).trim() !== '')
      if (celulas.length === 0) continue
      // Linha de agrupamento por placa (uma ou duas células, contendo uma placa).
      if (celulas.length <= 2) {
        const p = matchPlaca(celulas.join(' '))
        if (p) {
          placaAtual = p
          continue
        }
      }
      const obj: Record<string, unknown> = {}
      cab.forEach((c, i) => (obj[c] = (l ?? [])[i] ?? null))
      linhas.push(obj)
      placaDoGrupo.push(placaAtual)
    }
    return { nome, colunas: cab, linhas, placaDoGrupo }
  })
}

function matchPlaca(texto: string): string | undefined {
  const m = String(texto).toUpperCase().match(RE_PLACA)
  return m ? `${m[1]}${m[2]}` : undefined
}

/** Aba preferida: "Detalhamento de Viagens" (o "Resumo Financeiro" é só totalizador). */
export function escolherAbaViagens(planilhas: PlanilhaLida[]): number {
  const i = planilhas.findIndex((p) => normTexto(p.nome).includes('detalhamento'))
  if (i >= 0) return i
  const j = planilhas.findIndex((p) => !normTexto(p.nome).includes('resumo'))
  return j >= 0 ? j : 0
}

/** Sugere o mapeamento pelo nome das colunas, respeitando o que já foi salvo. */
export function sugerirMapeamento(colunas: string[], salvo: MapeamentoMoveTruck): MapeamentoMoveTruck {
  const mapa: MapeamentoMoveTruck = {}
  const usadas = new Set<string>()
  for (const campo of CAMPOS_MOVETRUCK) {
    const doSalvo = salvo[campo.id]
    if (doSalvo && colunas.includes(doSalvo)) {
      mapa[campo.id] = doSalvo
      usadas.add(doSalvo)
      continue
    }
    const sin = SINONIMOS[campo.id]
    const achou =
      colunas.find((c) => !usadas.has(c) && sin.includes(normTexto(c))) ??
      colunas.find((c) => !usadas.has(c) && sin.some((s) => normTexto(c).startsWith(s)))
    if (achou) {
      mapa[campo.id] = achou
      usadas.add(achou)
    }
  }
  return mapa
}

// ------------------------------------------------------------
// Conversões
// ------------------------------------------------------------
export function parseNumeroBR(v: unknown): number | undefined {
  if (v == null || v === '') return undefined
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined
  let s = String(v).replace(/[^\d,.-]/g, '')
  if (!s) return undefined
  // "1.234,56" → 1234.56 ; "1234.56" fica como está
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  const n = Number(s)
  return Number.isFinite(n) ? n : undefined
}

export function parseData(v: unknown): Date | undefined {
  if (v == null || v === '') return undefined
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? undefined : v
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v)
    return d ? new Date(d.y, d.m - 1, d.d, d.H, d.M, Math.floor(d.S)) : undefined
  }
  const m = String(v).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?/)
  if (m) {
    const ano = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])
    return new Date(ano, Number(m[2]) - 1, Number(m[1]), Number(m[4] ?? 12), Number(m[5] ?? 0))
  }
  const iso = new Date(String(v))
  return Number.isNaN(iso.getTime()) ? undefined : iso
}

function parseCondicao(v: unknown): CondicaoCarga | undefined {
  const s = normTexto(v)
  if (!s) return undefined
  if (s.startsWith('carreg') || s === 'c' || s === 'cheio') return 'carregado'
  if (s.startsWith('vaz') || s === 'v') return 'vazio'
  if (s.startsWith('mist')) return 'misto'
  return undefined
}

function dataISOdia(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Chave lógica anti-duplicidade: placa + data + origem + destino. */
export function chaveViagem(placa: string, data: Date | string, origem?: string, destino?: string): string {
  const dia = typeof data === 'string' ? dataISOdia(new Date(data)) : dataISOdia(data)
  return [normalizarPlaca(placa), dia, normTexto(origem), normTexto(destino)].join('|')
}

// ------------------------------------------------------------
// Prévia
// ------------------------------------------------------------
export type ClassificacaoLinha = 'novo' | 'duplicado' | 'atualizavel' | 'erro'

export interface LinhaPrevia {
  linha: number
  classificacao: ClassificacaoLinha
  erros: string[]
  placa?: string
  data?: Date
  origem?: string
  destino?: string
  km?: number
  toneladas?: number
  valorFrete?: number
  motorista?: string
  condicaoCarga?: CondicaoCarga
  chave?: string
  /** viagem existente que bate com a chave (atualizável/duplicado) */
  existenteId?: string
}

export function montarPrevia(
  planilha: PlanilhaLida,
  mapa: MapeamentoMoveTruck,
  existentes: ViagemConsumo[],
  placaPadrao?: string,
): LinhaPrevia[] {
  const porChave = new Map<string, ViagemConsumo>()
  for (const v of existentes) {
    const chave = v.chaveImportacao ?? chaveViagem(v.placa, v.dataHora, v.origem, v.destino)
    porChave.set(chave, v)
  }
  const vistasNoArquivo = new Set<string>()
  const col = (obj: Record<string, unknown>, campo: CampoMoveTruck) => (mapa[campo] ? obj[mapa[campo]!] : undefined)

  return planilha.linhas.map((obj, i) => {
    const erros: string[] = []
    const placaBruta = col(obj, 'PLACA')
    const placa =
      (placaBruta ? matchPlaca(String(placaBruta)) ?? normalizarPlaca(String(placaBruta)) : undefined) ??
      planilha.placaDoGrupo[i] ??
      placaPadrao
    const data = parseData(col(obj, 'DATA'))
    const km = parseNumeroBR(col(obj, 'KM'))
    const toneladas = parseNumeroBR(col(obj, 'TONELADAS'))
    const valorFrete = parseNumeroBR(col(obj, 'VALOR_FRETE'))
    const origem = col(obj, 'ORIGEM') != null ? String(col(obj, 'ORIGEM')).trim() : undefined
    const destino = col(obj, 'DESTINO') != null ? String(col(obj, 'DESTINO')).trim() : undefined
    const motorista = col(obj, 'MOTORISTA') != null ? String(col(obj, 'MOTORISTA')).trim() : undefined
    const condicaoInformada = parseCondicao(col(obj, 'CONDICAO_CARGA'))
    // Sem coluna de condição: deriva da tonelagem (peso > 0 = carregado).
    const condicaoCarga = condicaoInformada ?? (toneladas != null ? (toneladas > 0 ? 'carregado' : 'vazio') : undefined)

    if (!placa || placa.length < 7) erros.push('Placa não identificada')
    if (!data) erros.push('Data inválida')
    if (col(obj, 'KM') != null && col(obj, 'KM') !== '' && km == null) erros.push('KM inválido')
    if (km != null && km < 0) erros.push('KM negativo')
    if (col(obj, 'TONELADAS') != null && col(obj, 'TONELADAS') !== '' && toneladas == null) erros.push('Toneladas inválidas')
    if (toneladas != null && toneladas < 0) erros.push('Toneladas negativas')

    const base = { linha: i + 1, erros, placa, data, origem, destino, km, toneladas, valorFrete, motorista, condicaoCarga }
    if (erros.length > 0) return { ...base, classificacao: 'erro' as const }

    const chave = chaveViagem(placa!, data!, origem, destino)
    if (vistasNoArquivo.has(chave)) return { ...base, chave, classificacao: 'duplicado' as const, erros: ['Repetida no próprio arquivo'] }
    vistasNoArquivo.add(chave)

    const existente = porChave.get(chave)
    if (!existente) return { ...base, chave, classificacao: 'novo' as const }
    const mudou =
      (km != null && km !== existente.km) ||
      (toneladas != null && toneladas !== existente.toneladas) ||
      (valorFrete != null && valorFrete !== existente.valorFrete) ||
      (condicaoCarga != null && condicaoCarga !== existente.condicaoCarga)
    return { ...base, chave, existenteId: existente.id, classificacao: mudou ? ('atualizavel' as const) : ('duplicado' as const) }
  })
}

// ------------------------------------------------------------
// Gravação + log
// ------------------------------------------------------------
export async function gravarImportacao(
  arquivo: string,
  previa: LinhaPrevia[],
  atualizarExistentes: boolean,
  usuarioNome: string,
): Promise<{ importadas: number; atualizadas: number }> {
  const novos = previa.filter((l) => l.classificacao === 'novo')
  const atualizaveis = atualizarExistentes ? previa.filter((l) => l.classificacao === 'atualizavel') : []

  const { data: log, error: logErro } = await supabase
    .from('importacoes_movetruck')
    .insert({
      arquivo,
      usuario_nome: usuarioNome,
      quantidade_linhas: previa.length,
      quantidade_duplicada: previa.filter((l) => l.classificacao === 'duplicado').length,
      quantidade_com_erro: previa.filter((l) => l.classificacao === 'erro').length,
      status: 'parcial',
      erros: previa.filter((l) => l.classificacao === 'erro').map((l) => ({ linha: l.linha, erros: l.erros })),
    })
    .select('id')
    .single()
  if (logErro) throw logErro

  const payload = (l: LinhaPrevia) => ({
    placa: l.placa!,
    motorista_nome: up(l.motorista) || 'NÃO INFORMADO',
    origem: up(l.origem) || null,
    destino: up(l.destino) || null,
    data_hora_saida: l.data!.toISOString(),
    km_rodado: l.km ?? null,
    peso_carga_toneladas: l.toneladas ?? null,
    frete_bruto: l.valorFrete ?? null,
    condicao_carga: l.condicaoCarga ?? null,
    status: 'entregue',
    fonte: 'movetruck',
    importacao_id: log.id,
    chave_importacao: l.chave!,
  })

  let importadas = 0
  let atualizadas = 0
  let falhou: unknown = null
  try {
    for (let i = 0; i < novos.length; i += 500) {
      const lote = novos.slice(i, i + 500)
      const { error } = await supabase.from('viagens_frota').insert(lote.map(payload))
      if (error) throw error
      importadas += lote.length
    }
    for (const l of atualizaveis) {
      const p = payload(l)
      const { error } = await supabase
        .from('viagens_frota')
        .update({
          km_rodado: p.km_rodado,
          peso_carga_toneladas: p.peso_carga_toneladas,
          frete_bruto: p.frete_bruto,
          condicao_carga: p.condicao_carga,
          chave_importacao: p.chave_importacao,
          importacao_id: log.id,
        })
        .eq('id', l.existenteId!)
      if (error) throw error
      atualizadas++
    }
  } catch (err) {
    falhou = err
  }

  await supabase
    .from('importacoes_movetruck')
    .update({
      quantidade_importada: importadas,
      quantidade_atualizada: atualizadas,
      status: falhou ? (importadas + atualizadas > 0 ? 'parcial' : 'falhou') : 'concluida',
    })
    .eq('id', log.id)

  window.dispatchEvent(new Event('consumo_combustivel_updated'))
  if (falhou) throw falhou
  return { importadas, atualizadas }
}

export interface LogImportacao {
  id: string
  arquivo: string
  usuarioNome?: string
  dataHora: string
  linhas: number
  importadas: number
  atualizadas: number
  duplicadas: number
  comErro: number
  status: string
}

export async function buscarLogsImportacao(): Promise<LogImportacao[]> {
  const { data, error } = await supabase
    .from('importacoes_movetruck')
    .select('*')
    .order('data_hora', { ascending: false })
    .limit(50)
  if (error) throw error
  return (data ?? []).map((r: any) => ({
    id: r.id,
    arquivo: r.arquivo,
    usuarioNome: r.usuario_nome || undefined,
    dataHora: r.data_hora,
    linhas: r.quantidade_linhas,
    importadas: r.quantidade_importada,
    atualizadas: r.quantidade_atualizada,
    duplicadas: r.quantidade_duplicada,
    comErro: r.quantidade_com_erro,
    status: r.status,
  }))
}
