import { useState, useEffect, useCallback, useRef } from 'react'

export interface ColaboradorRH {
  id: string
  empresa: string
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

const SHEET_PUB_ID = '2PACX-1vQZa_bvGYffYNXDleozoflStm8C22-UAfafo9o9-g6QWDMCP2Kk1AgHxczBrs5_69h7IXPW6Z22JoLW'

// A planilha "RELAÇÃO FUNCIONÁRIOS E PRESTADORES DE SERVIÇO - GRUPO VEL" tem uma
// aba por empresa do grupo — cada uma publicada com seu próprio gid. A aba
// "TERCEIROS" tem um layout mais simples (só nome/função/salário), por isso
// usa um parser separado.
const ABAS_RH: { empresa: string; gid: string; formato: 'padrao' | 'terceiros' }[] = [
  { empresa: 'GVEL DIESEL', gid: '326329368', formato: 'padrao' },
  { empresa: 'GV COMÉRCIO DE PEÇAS', gid: '2101974683', formato: 'padrao' },
  { empresa: 'GVEL LEVES', gid: '659158169', formato: 'padrao' },
  { empresa: 'MCT', gid: '958889035', formato: 'padrao' },
  { empresa: 'GV TRANSPORTES', gid: '455424297', formato: 'padrao' },
  { empresa: 'TERCEIROS', gid: '1244348256', formato: 'terceiros' },
]

function urlAba(gid: string): string {
  return `https://docs.google.com/spreadsheets/d/e/${SHEET_PUB_ID}/pub?output=csv&gid=${gid}&single=true`
}

const STORAGE_KEY = 'gvel_rh_data_v2'
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

function parseCsv(csvText: string, empresa: string, formato: 'padrao' | 'terceiros'): ColaboradorRH[] {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0)
  const items: ColaboradorRH[] = []

  for (let i = 0; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i])
    const nome = (cols[0] || '').trim()
    const funcao = (cols[1] || '').trim()

    if (!nome) continue
    if (formato === 'padrao' && !funcao) continue
    if (nome.toUpperCase().startsWith('VALOR TOTAL')) continue
    if (nome.toUpperCase() === 'COLABORADOR' || nome.toUpperCase() === 'NOME') continue

    if (formato === 'terceiros') {
      // Aba "TERCEIROS": só NOME, FUNÇÃO e SALÁRIO — sem a quebra em
      // carteira/registro/ajuda de custo/gratificação das demais abas.
      // Linha de título da seção (ex: "PRESTADORES DE SERVIÇO,,") não tem
      // função nem salário — não é um colaborador de verdade, pula.
      if (!funcao && !cols[2]?.trim()) continue

      const salario = parseValorMonetario(cols[2])
      items.push({
        id: `rh-${empresa}-${i}-${nome}`,
        empresa,
        nome: nome.toUpperCase(),
        funcao: (funcao || 'PRESTADOR DE SERVIÇO').toUpperCase(),
        valorCarteira: 0,
        custoRegistro: 0,
        ajudaCusto: 0,
        gratificacao: 0,
        ganhosTotais: salario,
        custoTotal: salario,
        observacao: '',
      })
      continue
    }

    items.push({
      id: `rh-${empresa}-${i}-${nome}`,
      empresa,
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
      const resultados = await Promise.allSettled(
        ABAS_RH.map(async ({ empresa, gid, formato }) => {
          const res = await fetch(`${urlAba(gid)}&t=${Date.now()}`)
          if (!res.ok) throw new Error(`${empresa}: status ${res.status}`)
          const text = await res.text()
          return parseCsv(text, empresa, formato)
        }),
      )

      const parsed: ColaboradorRH[] = []
      const falhas: string[] = []
      resultados.forEach((r, i) => {
        if (r.status === 'fulfilled') parsed.push(...r.value)
        else falhas.push(ABAS_RH[i].empresa)
      })

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

      if (falhas.length > 0 && !silent) {
        setError(`Não foi possível sincronizar: ${falhas.join(', ')}. As demais empresas foram atualizadas normalmente.`)
      }
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
