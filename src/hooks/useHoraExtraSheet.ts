import { useState, useEffect, useCallback, useRef } from 'react'

export interface RegistroHoraExtra {
  id: string
  colaborador: string
  empresa: string
  salario: number
  valorHoraNormal: number
  valorHoraExtra: number
  horasExtrasMes: number
  valorTotalHE: number
  observacao: string
}

const SHEET_PUB_ID = '2PACX-1vR2zNIx68rFZbmLJtM_UtXuvACZ47uk7XPPVpm7dxxlswtVKt-CJaTrkXBnpn5CqnBVmvjCzvnVkhqw'
const GID_HORA_EXTRA = '1601597038' // aba do mês corrente — atualizada manualmente pelo usuário

function urlSheet(): string {
  return `https://docs.google.com/spreadsheets/d/e/${SHEET_PUB_ID}/pub?output=csv&gid=${GID_HORA_EXTRA}&single=true`
}

const STORAGE_KEY = 'gvel_rh_hora_extra_v1'
const LAST_SYNC_KEY = 'gvel_rh_hora_extra_last_sync'
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

function parseValorMonetario(raw: string | undefined): number {
  if (!raw) return 0
  const limpo = raw.replace(/R\$/g, '').replace(/\s/g, '').trim()
  if (!limpo || limpo === '-') return 0
  const normalizado = limpo.replace(/\./g, '').replace(',', '.')
  const valor = parseFloat(normalizado)
  return isNaN(valor) ? 0 : valor
}

function parseNumeroDecimal(raw: string | undefined): number {
  if (!raw) return 0
  const limpo = raw.trim()
  if (!limpo) return 0
  const normalizado = limpo.replace(/\./g, '').replace(',', '.')
  const valor = parseFloat(normalizado)
  return isNaN(valor) ? 0 : valor
}

function normalizarCabecalho(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toUpperCase()
}

const ALIASES_CABECALHO: Record<string, string[]> = {
  colaborador: ['COLABORADOR'],
  salario: ['SALARIO'],
  valorHoraNormal: ['H.T', 'HT'],
  valorHoraExtra: ['H.E', 'HE'],
  horasExtrasMes: ['HORAS MES'],
  valorTotalHE: ['TOTAL DE H.E', 'TOTAL DE HE'],
  observacao: ['OBSERVACAO', 'DESCONTO'],
}

function resolverIndicesColunas(linha: string[]): Record<string, number> {
  const norm = linha.map((c) => normalizarCabecalho(c.replace(/\s*\([^)]*\)\s*/g, ''))) // tira "(DISTRIBUIDORA)" etc. antes de comparar
  const indices: Record<string, number> = {}
  for (const [campo, aliases] of Object.entries(ALIASES_CABECALHO)) {
    const idx = norm.findIndex((c) => aliases.includes(c))
    if (idx >= 0) indices[campo] = idx
  }
  return indices
}

// Extrai o nome da empresa de dentro de parênteses num cabeçalho tipo
// "COLABORADOR (DISTRIBUIDORA)" — usado quando a planilha muda de seção.
function extrairEmpresaDoCabecalho(primeiraCelula: string): string | null {
  const m = primeiraCelula.match(/\(([^)]+)\)/)
  return m ? m[1].trim().toUpperCase() : null
}

function pareceLinhaDeCabecalho(cols: string[]): boolean {
  return normalizarCabecalho(cols[0] || '').startsWith('COLABORADOR')
}

function pareceLinhaDeEmpresa(cols: string[]): boolean {
  // Só a primeira célula preenchida, todo o resto vazio — divisor de seção
  // (ex.: "GVEL DIESEL ,,,,,,").
  if (!cols[0]?.trim()) return false
  return cols.slice(1).every((c) => !c.trim())
}

function parseCsv(csvText: string): { registros: RegistroHoraExtra[]; mesReferencia: string | null } {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0)
  const registros: RegistroHoraExtra[] = []

  let mesReferencia: string | null = null
  let empresaAtual = ''
  let indices: Record<string, number> | null = null

  for (let i = 0; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i])
    const primeiraCelula = cols[0] || ''

    if (i === 0) {
      const m = primeiraCelula.match(/M[ÊE]S\s+REFER[ÊE]NCIA\s*:\s*(.+)/i)
      if (m) mesReferencia = m[1].trim()
      continue
    }

    if (pareceLinhaDeCabecalho(cols)) {
      indices = resolverIndicesColunas(cols)
      const empresaDoCabecalho = extrairEmpresaDoCabecalho(primeiraCelula)
      if (empresaDoCabecalho) empresaAtual = empresaDoCabecalho
      continue
    }

    if (pareceLinhaDeEmpresa(cols)) {
      const nomeUpper = primeiraCelula.trim().toUpperCase()
      if (!nomeUpper.startsWith('VALOR TOTAL')) empresaAtual = nomeUpper
      continue
    }

    if (!indices || !primeiraCelula.trim()) continue
    if (primeiraCelula.trim().toUpperCase().startsWith('VALOR TOTAL')) continue

    const col = (campo: string) => (indices![campo] !== undefined ? cols[indices![campo]] : undefined)
    const salarioTexto = col('salario') || ''
    if (!salarioTexto.trim().startsWith('R$')) continue // não é uma linha de colaborador de verdade

    registros.push({
      id: `he-${i}-${primeiraCelula}`,
      colaborador: primeiraCelula.trim().toUpperCase(),
      empresa: empresaAtual || 'GVEL DIESEL',
      salario: parseValorMonetario(salarioTexto),
      valorHoraNormal: parseValorMonetario(col('valorHoraNormal')),
      valorHoraExtra: parseValorMonetario(col('valorHoraExtra')),
      horasExtrasMes: parseNumeroDecimal(col('horasExtrasMes')),
      valorTotalHE: parseValorMonetario(col('valorTotalHE')),
      observacao: (col('observacao') || '').trim(),
    })
  }

  return { registros, mesReferencia }
}

export function useHoraExtraSheet() {
  const [items, setItems] = useState<RegistroHoraExtra[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  const [mesReferencia, setMesReferencia] = useState<string | null>(null)
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
      const { registros, mesReferencia: mes } = parseCsv(text)

      setItems(registros)
      setMesReferencia(mes)
      const now = new Date()
      const nowStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      const fullSyncStr = `${now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ÀS ${nowStr}`

      setLastSync(fullSyncStr)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(registros))
      localStorage.setItem(LAST_SYNC_KEY, fullSyncStr)
    } catch (err: any) {
      console.error('Erro ao sincronizar planilha de Hora Extra:', err)
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
    mesReferencia,
    loading,
    isAutoSyncing,
    error,
    lastSync,
    fetchSheet,
  }
}
