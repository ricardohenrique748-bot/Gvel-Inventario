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

export interface AbaMesHoraExtra {
  nome: string
  gid: string
}

const SHEET_PUB_ID = '2PACX-1vR2zNIx68rFZbmLJtM_UtXuvACZ47uk7XPPVpm7dxxlswtVKt-CJaTrkXBnpn5CqnBVmvjCzvnVkhqw'
const URL_PUBHTML = `https://docs.google.com/spreadsheets/d/e/${SHEET_PUB_ID}/pubhtml`

// Usada só se a lista de abas publicada não puder ser lida. Cada mês é uma aba
// da planilha; as novas são descobertas sozinhas pelo pubhtml.
const ABAS_PADRAO: AbaMesHoraExtra[] = [
  { nome: 'ABRIL', gid: '965568218' },
  { nome: 'MAIO 2026', gid: '1722735347' },
  { nome: 'JUNHO 2026', gid: '499053467' },
  { nome: 'JULHO', gid: '175403388' },
  { nome: 'AGOSTO', gid: '1601597038' },
  { nome: 'SETEMBRO', gid: '7667789' },
]

function urlSheet(gid: string): string {
  return `https://docs.google.com/spreadsheets/d/e/${SHEET_PUB_ID}/pub?output=csv&gid=${gid}&single=true`
}

const STORAGE_KEY = 'gvel_rh_hora_extra_v2'
const ABAS_STORAGE_KEY = 'gvel_rh_hora_extra_abas_v1'
const LAST_SYNC_KEY = 'gvel_rh_hora_extra_last_sync'
const AUTO_SYNC_INTERVAL_MS = 60000

interface CacheMes {
  registros: RegistroHoraExtra[]
  mesReferencia: string | null
}

function lerJson<T>(chave: string, padrao: T): T {
  try {
    const salvo = localStorage.getItem(chave)
    return salvo ? (JSON.parse(salvo) as T) : padrao
  } catch {
    return padrao
  }
}

function salvarJson(chave: string, valor: unknown) {
  try {
    localStorage.setItem(chave, JSON.stringify(valor))
  } catch {
    // cache é só conveniência
  }
}

// O pubhtml lista as abas publicadas como `items.push({name: "Setembro", ..., gid: "7667789"`,
// na ordem da planilha. A aba "Página1" que vem por padrão fica de fora.
function parseAbasPublicadas(html: string): AbaMesHoraExtra[] {
  const abas: AbaMesHoraExtra[] = []
  const re = /items\.push\(\{name: "((?:[^"\\]|\\.)*)", pageUrl: "(?:[^"\\]|\\.)*", gid: "(\d+)"/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    let nome = m[1]
    try {
      nome = JSON.parse(`"${nome.replace(/\\x([0-9a-fA-F]{2})/g, '\\u00$1')}"`)
    } catch {
      // mantém o texto cru
    }
    nome = nome.trim().toUpperCase()
    if (/^P[ÁA]GINA\s*\d*$/.test(nome)) continue
    abas.push({ nome, gid: m[2] })
  }
  return abas
}

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
  const [abas, setAbas] = useState<AbaMesHoraExtra[]>(() => {
    const salvas = lerJson<AbaMesHoraExtra[]>(ABAS_STORAGE_KEY, [])
    return salvas.length > 0 ? salvas : ABAS_PADRAO
  })
  // Começa sempre no mês mais recente (última aba da planilha).
  const [gidSelecionado, setGidSelecionado] = useState<string>(() => abas[abas.length - 1]?.gid ?? '')
  const [cache, setCache] = useState<Record<string, CacheMes>>(() => lerJson(STORAGE_KEY, {}))

  const [loading, setLoading] = useState(false)
  const [isAutoSyncing, setIsAutoSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastSync, setLastSync] = useState<string | null>(() => localStorage.getItem(LAST_SYNC_KEY))

  const isFetchingRef = useRef(false)
  const gidRef = useRef(gidSelecionado)
  gidRef.current = gidSelecionado
  // Enquanto o usuário não escolher um mês, acompanha a aba mais nova
  // (ex.: o RH cria a aba de outubro e ela já abre sozinha).
  const escolhaManualRef = useRef(false)
  const gidBuscadoRef = useRef('')
  const fetchSheetRef = useRef<(silent?: boolean) => Promise<void>>(async () => {})

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
      let gid = gidRef.current
      try {
        const resAbas = await fetch(`${URL_PUBHTML}?t=${Date.now()}`)
        const novasAbas = resAbas.ok ? parseAbasPublicadas(await resAbas.text()) : []
        if (novasAbas.length > 0) {
          setAbas(novasAbas)
          salvarJson(ABAS_STORAGE_KEY, novasAbas)
          const existe = novasAbas.some((a) => a.gid === gid)
          if (!escolhaManualRef.current || !existe) {
            gid = novasAbas[novasAbas.length - 1].gid
            gidRef.current = gid
            setGidSelecionado(gid)
          }
        }
      } catch (err) {
        // sem a lista de abas, segue com a que já conhece
        console.error('Erro ao listar abas da planilha de Hora Extra:', err)
      }
      if (!gid) throw new Error('Nenhuma aba de mês encontrada na planilha.')
      gidBuscadoRef.current = gid

      const res = await fetch(`${urlSheet(gid)}&t=${Date.now()}`)
      if (!res.ok) throw new Error(`Status ${res.status}`)
      const text = await res.text()
      const dadosMes = parseCsv(text)

      setCache((anterior) => {
        const novo = { ...anterior, [gid]: dadosMes }
        salvarJson(STORAGE_KEY, novo)
        return novo
      })
      const now = new Date()
      const nowStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      const fullSyncStr = `${now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ÀS ${nowStr}`

      setLastSync(fullSyncStr)
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
      // Trocou de mês enquanto buscava o anterior: busca o novo agora.
      if (gidRef.current && gidRef.current !== gidBuscadoRef.current) {
        setTimeout(() => fetchSheetRef.current(true), 0)
      }
    }
  }, [])
  fetchSheetRef.current = fetchSheet

  useEffect(() => {
    fetchSheet(Boolean(cache[gidSelecionado]))
  }, [])

  const selecionarMes = useCallback(
    (gid: string) => {
      escolhaManualRef.current = true
      gidRef.current = gid
      setGidSelecionado(gid)
      fetchSheet(Boolean(cache[gid]))
    },
    [cache, fetchSheet],
  )

  const mesAtual = cache[gidSelecionado]
  const items = mesAtual?.registros ?? []
  const mesReferencia = mesAtual?.mesReferencia ?? null

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
    abas,
    gidSelecionado,
    selecionarMes,
    loading,
    isAutoSyncing,
    error,
    lastSync,
    fetchSheet,
  }
}
