import { useState, useEffect, useCallback, useRef } from 'react'

export interface MovimentacaoTurnover {
  id: string
  nome: string
  cargo: string
  empresa: string
  /** Data de admissão em ISO (yyyy-mm-dd), ou '' se a célula estiver vazia/inválida. */
  admissao: string
  /** Data de demissão em ISO (yyyy-mm-dd), ou '' se ainda está ativo. */
  demissao: string
  /** Linha veio da seção "RESCINDINDO" da planilha. */
  rescindindo: boolean
}

// TODO: preencher com o link publicado (Arquivo → Compartilhar → Publicar na
// Web → CSV) da aba de turnover. Enquanto estiver vazio, a aba mostra um aviso
// de "planilha não configurada" em vez de tentar sincronizar.
const SHEET_PUB_ID = ''
const GID_TURNOVER = ''

export const TURNOVER_CONFIGURADO = Boolean(SHEET_PUB_ID && GID_TURNOVER)

function urlSheet(): string {
  return `https://docs.google.com/spreadsheets/d/e/${SHEET_PUB_ID}/pub?output=csv&gid=${GID_TURNOVER}&single=true`
}

// Movimentações enviadas pelo RH (set/2026), no mesmo formato do CSV da
// planilha. Usadas enquanto o link publicado não estiver configurado.
const CSV_INICIAL = `Nome,Cargo,Data de Admissão,Data de Demissão
MARCELO JORGE SANTOS,ANALISTA DE FROTA,01/08/2026,
HELIO DE OLIVEIRA MACHADO,PINTOR AUTOMOTIVO,01/08/2026,
LEONARDO SANTOS NASCIMENTO,POLIDOR,14/08/2026,
WELLINTON DE OLIVEIRA MARQUES,MECANICO A,17/08/2026,
BEATRIZ RODRIGUES NAVARRETE,AUXILIAR DE LIMPEZA,19/08/2026,
RAUL ALEXANDRE DE LIMA,AUXILIAR ADMINISTRATIVO,21/09/2026,
CAROLINA DE CASSIA FRANCO CARDOSO,AUXILIAR ADMINISTRATIVO,23/09/2026,
RESCINDINDO,,,
MAURICIO INACIO DA SILVA,AUX.MECANICO,06/05/2026,31/08/2026
RODRIGO FRANCISCO,CORDENADOR,20/04/2026,19/09/2026
EMPRSA GVEL LEVES E TRANSPORTES,,,
Nome,Cargo,Data de Admissão,Data de Demissão
RAI MILLER LEMOS DE ASSIS,MECANICO DIESEL A,01/08/2026,
ROBERT ALVES DE FRANCA,AUX.MECANICO,13/08/2026,
EMPRESA GV TRANSPORTES E SERVICOS LTDA,,,
Nome,Cargo,Data de Admissão,Data de Demissão
MYQUEIAS RAMOS GUILHEN,ANALISTA DE FROTA,01/08/2026,
HUANDERSON DONIZETE DOS SANTOS,MOTORISTA,10/08/2026,
ANDERSON LIMA DOS SANTOS,MOTORISTA,01/09/2026,
RESCINDINDO,,,
DENYS RENE DE BOVI,MOTORISTA,11/05/2026,07/08/2026
ANGELO JOSE DE OLIVEIRA BARBOSA NUNES,MOTORISTA,19/05/2026,07/08/2026
FABIANO PEREIRA PINOTTI,MOTORISTA,01/06/2026,26/08/2026`

const STORAGE_KEY = 'gvel_rh_turnover_v1'
const LAST_SYNC_KEY = 'gvel_rh_turnover_last_sync'
const AUTO_SYNC_INTERVAL_MS = 60000
// O primeiro bloco da planilha não tem título de empresa — é a matriz.
const EMPRESA_PADRAO = 'GVEL DIESEL'

function parseCsvLine(line: string): string[] {
  const cols: string[] = []
  let current = ''
  let inQuotes = false

  for (let j = 0; j < line.length; j++) {
    const char = line[j]
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      cols.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  cols.push(current.trim())
  return cols
}

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toUpperCase()
}

/** "01/08/2026" → "2026-08-01". Aceita ano com 2 dígitos. */
function parseDataBr(raw: string | undefined): string {
  const m = (raw || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (!m) return ''
  const [, d, mes, a] = m
  const ano = a.length === 2 ? `20${a}` : a
  return `${ano}-${mes.padStart(2, '0')}-${d.padStart(2, '0')}`
}

function resolverIndicesColunas(linha: string[]): Record<string, number> {
  const norm = linha.map(normalizar)
  const achar = (pred: (c: string) => boolean) => norm.findIndex(pred)
  return {
    nome: achar((c) => c === 'NOME'),
    cargo: achar((c) => c === 'CARGO'),
    admissao: achar((c) => c.includes('ADMISS')),
    demissao: achar((c) => c.includes('DEMISS')),
  }
}

function pareceLinhaDeCabecalho(cols: string[]): boolean {
  return normalizar(cols[0] || '') === 'NOME'
}

function pareceLinhaDeSecao(cols: string[]): boolean {
  // Só a primeira célula preenchida — "RESCINDINDO" ou "EMPRESA ...".
  if (!cols[0]?.trim()) return false
  return cols.slice(1).every((c) => !c.trim())
}

function parseCsv(csvText: string): MovimentacaoTurnover[] {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0)
  const registros: MovimentacaoTurnover[] = []

  let empresaAtual = EMPRESA_PADRAO
  let rescindindo = false
  let indices: Record<string, number> = { nome: 0, cargo: 1, admissao: 2, demissao: 3 }

  for (let i = 0; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i])
    const primeira = normalizar(cols[0] || '')

    if (pareceLinhaDeCabecalho(cols)) {
      const novos = resolverIndicesColunas(cols)
      if (novos.nome >= 0) indices = novos
      continue
    }

    if (pareceLinhaDeSecao(cols)) {
      if (primeira.startsWith('RESCIND')) {
        rescindindo = true
      } else {
        // "EMPRESA GV TRANSPORTES ..." (e o erro de digitação "EMPRSA ...")
        empresaAtual = primeira.replace(/^EMPR[A-Z]*\s+/, '').trim() || empresaAtual
        rescindindo = false
      }
      continue
    }

    const col = (campo: string) => (indices[campo] >= 0 ? cols[indices[campo]] : undefined)
    const nome = (col('nome') || '').trim().toUpperCase()
    if (!nome) continue

    const admissao = parseDataBr(col('admissao'))
    const demissao = parseDataBr(col('demissao'))
    if (!admissao && !demissao) continue // não é linha de colaborador

    registros.push({
      id: `to-${i}-${nome}`,
      nome,
      cargo: (col('cargo') || '').trim().toUpperCase(),
      empresa: empresaAtual,
      admissao,
      demissao,
      rescindindo: rescindindo || Boolean(demissao),
    })
  }

  return registros
}

export function useTurnoverSheet() {
  const [items, setItems] = useState<MovimentacaoTurnover[]>(() => {
    if (!TURNOVER_CONFIGURADO) return parseCsv(CSV_INICIAL)
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  const [loading, setLoading] = useState(false)
  const [isAutoSyncing, setIsAutoSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastSync, setLastSync] = useState<string | null>(() => localStorage.getItem(LAST_SYNC_KEY))

  const isFetchingRef = useRef(false)

  const fetchSheet = useCallback(async (silent: boolean = false) => {
    if (!TURNOVER_CONFIGURADO || isFetchingRef.current) return
    isFetchingRef.current = true

    if (silent) {
      setIsAutoSyncing(true)
    } else {
      setLoading(true)
    }
    setError(null)

    try {
      const res = await fetch(`${urlSheet()}&t=${Date.now()}`)
      if (!res.ok) throw new Error(`Status ${res.status}`)
      const text = await res.text()
      const registros = parseCsv(text)

      setItems(registros)
      const now = new Date()
      const nowStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      const fullSyncStr = `${now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ÀS ${nowStr}`

      setLastSync(fullSyncStr)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(registros))
      localStorage.setItem(LAST_SYNC_KEY, fullSyncStr)
    } catch (err: any) {
      console.error('Erro ao sincronizar planilha de Turnover:', err)
      if (!silent) {
        setError(err?.message || 'Não foi possível conectar com o Google Sheets.')
      }
    } finally {
      setLoading(false)
      setIsAutoSyncing(false)
      isFetchingRef.current = false
    }
  }, [])

  useEffect(() => {
    fetchSheet(items.length > 0)
  }, [])

  useEffect(() => {
    if (!TURNOVER_CONFIGURADO) return
    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchSheet(true)
      }
    }, AUTO_SYNC_INTERVAL_MS)

    const onFocus = () => fetchSheet(true)

    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)

    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [fetchSheet])

  return {
    items,
    configurado: TURNOVER_CONFIGURADO,
    loading,
    isAutoSyncing,
    error,
    lastSync,
    fetchSheet,
  }
}
