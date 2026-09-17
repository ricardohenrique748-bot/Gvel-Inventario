import { useState, useEffect, useCallback, useRef } from 'react'

export type TipoAtestado = 'Atestado' | 'Declaração' | 'Outro'

export interface RegistroAtestado {
  id: string
  nome: string
  cargo: string
  data: string
  dataIso: string
  tipo: TipoAtestado
  horaInicio: string
  horaFim: string
  diasAfastamento: number
  horasAusencia: number
  cid: string
  descricao: string
  status: string
  documentoEntregue: boolean
}

const SHEET_PUB_ID = '2PACX-1vQZGHa__81n9zh9TO6MHR0J6vYAUmlj8knaj9YUrkp86UNxArJwFxQRFB0McxymlB-GtBCmf8sYNCrp'
const GID_ATESTADO = '2087297599'

function urlSheet(): string {
  return `https://docs.google.com/spreadsheets/d/e/${SHEET_PUB_ID}/pub?output=csv&gid=${GID_ATESTADO}&single=true`
}

const STORAGE_KEY = 'gvel_rh_atestados_v1'
const LAST_SYNC_KEY = 'gvel_rh_atestados_last_sync'
const AUTO_SYNC_INTERVAL_MS = 60000

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

function parseNumeroDecimal(raw: string | undefined): number {
  if (!raw) return 0
  const limpo = raw.replace(/h$/i, '').trim()
  if (!limpo) return 0
  const normalizado = limpo.replace(/\./g, '').replace(',', '.')
  const valor = parseFloat(normalizado)
  return isNaN(valor) ? 0 : valor
}

function parseInteiro(raw: string | undefined): number {
  if (!raw) return 0
  const valor = parseInt(raw.replace(/\D/g, ''), 10)
  return isNaN(valor) ? 0 : valor
}

// A planilha exporta a data no formato M/D/AAAA (mês primeiro) independente
// do local da aba — confirmado comparando a ordem cronológica das linhas.
function parseData(raw: string | undefined): { exibicao: string; iso: string } {
  if (!raw) return { exibicao: '', iso: '' }
  const partes = raw.trim().split('/')
  if (partes.length !== 3) return { exibicao: raw, iso: '' }
  const [mes, dia, ano] = partes.map((p) => parseInt(p, 10))
  if (!mes || !dia || !ano) return { exibicao: raw, iso: '' }
  const pad = (n: number) => String(n).padStart(2, '0')
  return { exibicao: `${pad(dia)}/${pad(mes)}/${ano}`, iso: `${ano}-${pad(mes)}-${pad(dia)}` }
}

function normalizarTipo(raw: string | undefined): TipoAtestado {
  const limpo = (raw || '').trim().toLowerCase()
  if (limpo.startsWith('atestado')) return 'Atestado'
  if (limpo.startsWith('declara')) return 'Declaração'
  return 'Outro'
}

function normalizarCabecalho(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acentos
    .trim()
    .toUpperCase()
}

// Cada campo aceita algumas variações plausíveis do rótulo da coluna na
// planilha — resolvido pelo texto do cabeçalho, não pela posição. Assim,
// inserir/reordenar uma coluna nova na planilha (ex.: "MÊS") não desalinha
// os campos seguintes, como acontecia com índices fixos.
const ALIASES_CABECALHO: Record<string, string[]> = {
  id: ['ID'],
  nome: ['NOME DO COLABORADOR', 'NOME'],
  cargo: ['CARGO', 'FUNCAO', 'FUNÇÃO'],
  data: ['DATA'],
  tipo: ['TIPO'],
  horaInicio: ['INICIO', 'INÍCIO'],
  horaFim: ['FIM'],
  diasAfastamento: ['DIAS DE AFASTAMENTO', 'DIAS'],
  horasAusencia: ['HORAS DE AUSENCIA', 'HORAS DE AUSÊNCIA', 'HORAS'],
  cid: ['CID'],
  descricao: ['DESCRICAO / OBSERVACAO', 'DESCRIÇÃO / OBSERVAÇÃO', 'DESCRICAO', 'DESCRIÇÃO', 'OBSERVACAO', 'OBSERVAÇÃO'],
  status: ['STATUS'],
  documentoEntregue: ['DOCUMENTO ENTREGUE', 'DOCUMENTO'],
}

function resolverIndicesColunas(linhaCabecalho: string[]): Record<string, number> {
  const cabecalhosNormalizados = linhaCabecalho.map(normalizarCabecalho)
  const indices: Record<string, number> = {}
  for (const [campo, aliases] of Object.entries(ALIASES_CABECALHO)) {
    const aliasesNormalizados = aliases.map(normalizarCabecalho)
    const idx = cabecalhosNormalizados.findIndex((c) => aliasesNormalizados.includes(c))
    if (idx >= 0) indices[campo] = idx
  }
  return indices
}

const RE_LINHA_CABECALHO = /^(NOME DO COLABORADOR|NOME)$/

function parseCsv(csvText: string): RegistroAtestado[] {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0)
  const items: RegistroAtestado[] = []
  let indices: Record<string, number> | null = null

  for (let i = 0; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i])

    // Linha de cabeçalho: calibra os índices de cada campo pelo texto da
    // coluna, em vez de assumir uma posição fixa (a coluna "Nome" pode estar
    // em qualquer posição, não necessariamente a segunda).
    if (!indices) {
      const temColunaNome = cols.some((c) => RE_LINHA_CABECALHO.test(normalizarCabecalho(c)))
      if (temColunaNome) {
        indices = resolverIndicesColunas(cols)
      }
      continue
    }

    const col = (campo: string) => (indices![campo] !== undefined ? cols[indices![campo]] : undefined)

    const nome = (col('nome') || '').trim()
    if (!nome) continue // linha de título da planilha (mês/ano), sem colaborador

    const { exibicao: data, iso: dataIso } = parseData(col('data'))

    items.push({
      id: `atestado-${i}-${col('id') || nome}`,
      nome: nome.toUpperCase(),
      cargo: (col('cargo') || '').trim().toUpperCase(),
      data,
      dataIso,
      tipo: normalizarTipo(col('tipo')),
      horaInicio: (col('horaInicio') || '').trim(),
      horaFim: (col('horaFim') || '').trim(),
      diasAfastamento: parseInteiro(col('diasAfastamento')),
      horasAusencia: parseNumeroDecimal(col('horasAusencia')),
      cid: (col('cid') || '').trim(),
      descricao: (col('descricao') || '').trim(),
      status: (col('status') || '').trim(),
      documentoEntregue: (col('documentoEntregue') || '').trim().toUpperCase() === 'SIM',
    })
  }

  return items
}

export function useAtestadosSheet() {
  const [items, setItems] = useState<RegistroAtestado[]>(() => {
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
    if (isFetchingRef.current) return
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
      const parsed = parseCsv(text)

      setItems(parsed)
      const now = new Date()
      const nowStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      const fullSyncStr = `${now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ÀS ${nowStr}`

      setLastSync(fullSyncStr)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed))
      localStorage.setItem(LAST_SYNC_KEY, fullSyncStr)
    } catch (err: any) {
      console.error('Erro ao sincronizar planilha de Atestados:', err)
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
    loading,
    isAutoSyncing,
    error,
    lastSync,
    fetchSheet,
  }
}
