import { useState, useEffect, useCallback, useRef } from 'react'

export interface ColaboradorRH {
  id: string
  nome: string
  funcao: string
  valorCarteira: number
  custoRegistro: number
  ajudaCusto: number
  gratificacao: number
  ganhosTotais: number
  custoTotal: number
  observacao: string
}

const SHEET_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vQZa_bvGYffYNXDleozoflStm8C22-UAfafo9o9-g6QWDMCP2Kk1AgHxczBrs5_69h7IXPW6Z22JoLW/pub?output=csv'

const STORAGE_KEY = 'gvel_rh_data'
const LAST_SYNC_KEY = 'gvel_rh_last_sync'
const AUTO_SYNC_INTERVAL_MS = 60000 // 60 segundos

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

function parseValorMonetario(raw: string | undefined): number {
  if (!raw) return 0
  const limpo = raw.replace(/R\$/g, '').replace(/\s/g, '').trim()
  if (!limpo || limpo === '-') return 0
  const normalizado = limpo.replace(/\./g, '').replace(',', '.')
  const valor = parseFloat(normalizado)
  return isNaN(valor) ? 0 : valor
}

function parseCsv(csvText: string): ColaboradorRH[] {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0)
  const items: ColaboradorRH[] = []

  for (let i = 0; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i])
    const nome = (cols[0] || '').trim()
    const funcao = (cols[1] || '').trim()

    if (!nome || !funcao) continue
    if (nome.toUpperCase().startsWith('VALOR TOTAL')) continue
    if (nome.toUpperCase() === 'COLABORADOR') continue

    items.push({
      id: `rh-${i}-${nome}`,
      nome: nome.toUpperCase(),
      funcao: funcao.toUpperCase(),
      valorCarteira: parseValorMonetario(cols[2]),
      custoRegistro: parseValorMonetario(cols[3]),
      ajudaCusto: parseValorMonetario(cols[4]),
      gratificacao: parseValorMonetario(cols[5]),
      ganhosTotais: parseValorMonetario(cols[6]),
      custoTotal: parseValorMonetario(cols[7]),
      observacao: (cols[8] || '').trim(),
    })
  }

  return items
}

export function useRhSheet() {
  const [items, setItems] = useState<ColaboradorRH[]>(() => {
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
      const res = await fetch(`${SHEET_CSV_URL}&t=${Date.now()}`)
      if (!res.ok) {
        throw new Error(`Falha ao carregar planilha (status ${res.status})`)
      }
      const text = await res.text()
      const parsed = parseCsv(text)
      if (parsed.length === 0) {
        throw new Error('Nenhum colaborador encontrado na planilha')
      }

      setItems(parsed)
      const now = new Date()
      const nowStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      const fullSyncStr = `${now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ÀS ${nowStr}`

      setLastSync(fullSyncStr)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed))
      localStorage.setItem(LAST_SYNC_KEY, fullSyncStr)
    } catch (err: any) {
      console.error('Erro ao sincronizar planilha RH:', err)
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
