import { useState, useEffect, useCallback, useRef } from 'react'

export interface ColaboradorRH {
  id: string
  empresa: string
  nome: string
  funcao: string
  ganhosTotais: number
  adiantamento: number
  aPagarHolerite: number
  recebidoMes: number
  descontos: number
  gratificacao: number
  custoTotal: number
  observacao: string
}

const SHEET_PUB_ID = '2PACX-1vQZa_bvGYffYNXDleozoflStm8C22-UAfafo9o9-g6QWDMCP2Kk1AgHxczBrs5_69h7IXPW6Z22JoLW'

interface AbaRH {
  empresa: string
  gid: string
  formato: 'padrao' | 'terceiros'
  /** Mês tirado do nome da aba (ex.: "SETEMBRO"); '' quando o nome não traz mês. */
  mes: string
}

// A planilha "RELAÇÃO FUNCIONÁRIOS E PRESTADORES DE SERVIÇO - GRUPO VEL" tem uma
// aba por empresa e por mês (ex.: "GVEL DIESEL SETEMBRO") — cada uma publicada com
// seu próprio gid, descoberto pelo pubhtml. As abas não têm as mesmas colunas nem
// na mesma ordem (e mudam com o tempo), então o parser localiza cada coluna pelo
// nome no cabeçalho. A aba "TERCEIROS" só tem nome/função/salário e aceita linha
// sem função. Esta lista só é usada se o pubhtml não puder ser lido.
const ABAS_PADRAO: AbaRH[] = [
  { empresa: 'GVEL DIESEL', gid: '326329368', formato: 'padrao', mes: 'SETEMBRO' },
  { empresa: 'GV COMÉRCIO DE PEÇAS', gid: '2101974683', formato: 'padrao', mes: 'SETEMBRO' },
  { empresa: 'GVEL LEVES', gid: '659158169', formato: 'padrao', mes: 'SETEMBRO' },
  { empresa: 'MCT', gid: '958889035', formato: 'padrao', mes: 'SETEMBRO' },
  { empresa: 'GV TRANSPORTES', gid: '455424297', formato: 'padrao', mes: 'SETEMBRO' },
  { empresa: 'TERCEIROS', gid: '1244348256', formato: 'terceiros', mes: 'SETEMBRO' },
]

const URL_PUBHTML = `https://docs.google.com/spreadsheets/d/e/${SHEET_PUB_ID}/pubhtml`

function urlAba(gid: string): string {
  return `https://docs.google.com/spreadsheets/d/e/${SHEET_PUB_ID}/pub?output=csv&gid=${gid}&single=true`
}

const STORAGE_KEY = 'gvel_rh_data_v5'
const ABAS_STORAGE_KEY = 'gvel_rh_abas_v1'
const LAST_SYNC_KEY = 'gvel_rh_last_sync'
const AUTO_SYNC_INTERVAL_MS = 60000 // 60 segundos

const MESES_ANO = [
  'JANEIRO', 'FEVEREIRO', 'MARCO', 'ABRIL', 'MAIO', 'JUNHO',
  'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO',
]

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

/** "GV COMERCIO DE PEÇAS SETEMBRO" → empresa "GV COMÉRCIO DE PEÇAS", mês "SETEMBRO" (aceita ano no fim). */
function interpretarNomeAba(nomeAba: string, gid: string): AbaRH {
  const n = normalizarCabecalho(nomeAba)
  const m = n.match(new RegExp(`\\b(${MESES_ANO.join('|')})(?:\\s*(?:DE\\s*|/\\s*)?(\\d{4}))?\\s*$`))
  const mes = m ? (m[2] ? `${m[1]} ${m[2]}` : m[1]).replace('MARCO', 'MARÇO') : ''
  const empresaNorm = (m ? n.slice(0, m.index) : n).replace(/[\s\-–—]+$/, '').trim()
  // Mantém o nome com acento que a tela já usava quando a empresa é conhecida.
  const conhecida = ABAS_PADRAO.find((a) => normalizarCabecalho(a.empresa) === empresaNorm)
  const empresa = conhecida?.empresa ?? (empresaNorm || nomeAba.trim().toUpperCase())
  return { empresa, gid, formato: empresaNorm.startsWith('TERCEIRO') ? 'terceiros' : 'padrao', mes }
}

// O pubhtml lista as abas publicadas como `items.push({name: "GVEL DIESEL SETEMBRO", ..., gid: "326329368"`.
function parseAbasPublicadas(html: string): AbaRH[] {
  const abas: AbaRH[] = []
  const re = /items\.push\(\{name: "((?:[^"\\]|\\.)*)", pageUrl: "(?:[^"\\]|\\.)*", gid: "(\d+)"/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    let nome = m[1]
    try {
      nome = JSON.parse(`"${nome.replace(/\\x([0-9a-fA-F]{2})/g, '\\u00$1')}"`)
    } catch {
      // mantém o texto cru
    }
    if (/^P[ÁA]GINA\s*\d*$/i.test(nome.trim())) continue
    abas.push(interpretarNomeAba(nome, m[2]))
  }
  return abas
}

function distanciaEdicao(a: string, b: string): number {
  const linha = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    let diagonal = linha[0]
    linha[0] = i
    for (let j = 1; j <= b.length; j++) {
      const acima = linha[j]
      linha[j] = Math.min(linha[j] + 1, linha[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1))
      diagonal = acima
    }
  }
  return linha[b.length]
}

/** Valor da coluna "MÊS" → nome do mês. Tolera erro de digitação (ex.: "STEMBRO"). */
function mesDaCelula(raw: string): string {
  const v = normalizarCabecalho(raw).replace(/[^A-Z]/g, '')
  if (!v) return ''
  let melhor = ''
  let menor = 3
  for (const mes of MESES_ANO) {
    const d = distanciaEdicao(v, mes)
    if (d < menor) {
      menor = d
      melhor = mes
    }
  }
  return melhor.replace('MARCO', 'MARÇO')
}

/** Ordem cronológica do mês da aba. Sem ano no nome: mês depois do atual é do ano passado. */
function chaveMes(mes: string): number {
  const [nome, anoTxt] = mes.split(' ')
  const idx = MESES_ANO.indexOf(normalizarCabecalho(nome ?? ''))
  if (idx < 0) return -1
  const hoje = new Date()
  const ano = anoTxt ? Number(anoTxt) : idx > hoje.getMonth() ? hoje.getFullYear() - 1 : hoje.getFullYear()
  return ano * 12 + idx
}

function ordenarMeses(meses: string[]): string[] {
  return [...new Set(meses)].sort((a, b) => chaveMes(a) - chaveMes(b))
}

/** Meses disponíveis nas abas, do mais antigo ao mais recente. */
function mesesDasAbas(abas: AbaRH[]): string[] {
  return ordenarMeses(abas.map((a) => a.mes))
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

type CampoRH =
  | 'mes'
  | 'funcao'
  | 'ganhosTotais'
  | 'adiantamento'
  | 'aPagarHolerite'
  | 'recebidoMes'
  | 'descontos'
  | 'gratificacao'
  | 'custoTotal'
  | 'observacao'

function normalizarCabecalho(raw: string): string {
  return raw.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim()
}

// Reconhece as variações de nome que aparecem nas abas (ex: "ADIANT. HOLERITE",
// "ADANTAMENTO HOLERITE", "GANHO TOTAIS", "RECEBIDOS MÊS"). Na aba TERCEIROS o
// "SALÁRIO" é o próprio ganho total.
function campoDoCabecalho(raw: string): CampoRH | null {
  const h = normalizarCabecalho(raw)
  if (h === 'MES') return 'mes'
  if (h.startsWith('FUNCAO')) return 'funcao'
  if (h.startsWith('GANHO') || h.startsWith('SALARIO')) return 'ganhosTotais'
  if (h.includes('HOLERITE') && h.includes('PAGAR')) return 'aPagarHolerite'
  if (h.includes('HOLERITE') && (h.startsWith('ADIANT') || h.startsWith('ADANT'))) return 'adiantamento'
  if (h.startsWith('RECEBID')) return 'recebidoMes'
  if (h.startsWith('DESCONTO')) return 'descontos'
  if (h.startsWith('GRATIFICA')) return 'gratificacao'
  if (h.startsWith('CUSTO TOTAL')) return 'custoTotal'
  if (h.startsWith('OBSERVA')) return 'observacao'
  return null
}

/** Colaborador lido da aba; `mes` vazio quando a aba não tem a coluna "MÊS". */
type LinhaRH = { mes: string; item: ColaboradorRH }

// Desde out/2026 cada aba empilha os meses (bloco de setembro, bloco de outubro...),
// cada bloco com o próprio cabeçalho e a coluna "MÊS" em cada linha.
function parseCsv(csvText: string, empresa: string, formato: 'padrao' | 'terceiros'): LinhaRH[] {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0)
  const items: LinhaRH[] = []
  // Coluna de cada campo, definida ao achar a linha de cabeçalho (NOME, FUNÇÃO, ...).
  // Quando o nome se repete (ex: "GANHOS TOTAIS" duas vezes), vale a primeira.
  let colunas: Partial<Record<CampoRH, number>> | null = null

  for (let i = 0; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i])
    const nome = (cols[0] || '').trim()
    const funcao = (cols[colunas?.funcao ?? 1] || '').trim()

    if (!nome) continue
    const nomeUpper = nome.toUpperCase()
    if (nomeUpper === 'COLABORADOR' || nomeUpper === 'NOME') {
      colunas = {}
      cols.forEach((c, idx) => {
        const campo = campoDoCabecalho(c)
        if (campo && colunas![campo] === undefined) colunas![campo] = idx
      })
      continue
    }
    // Antes do cabeçalho só há o título da aba.
    if (!colunas) continue
    if (nomeUpper.startsWith('VALOR TOTAL')) continue

    const valor = (campo: CampoRH) => {
      const idx = colunas![campo]
      return idx === undefined ? 0 : parseValorMonetario(cols[idx])
    }
    const ganhosTotais = valor('ganhosTotais')

    if (formato === 'padrao' && !funcao) continue
    // Linha de título de seção (ex: "PRESTADORES DE SERVIÇO,,") não tem função nem valor.
    if (formato === 'terceiros' && !funcao && ganhosTotais === 0) continue

    const adiantamento = valor('adiantamento')
    const aPagarHolerite = valor('aPagarHolerite')
    const custoTotal = valor('custoTotal')
    const idxObs = colunas.observacao

    items.push({
      mes: colunas.mes !== undefined ? mesDaCelula(cols[colunas.mes] || '') : '',
      item: {
        id: `rh-${empresa}-${i}-${nome}`,
        empresa,
        nome: nomeUpper,
        funcao: (funcao || 'PRESTADOR DE SERVIÇO').toUpperCase(),
        ganhosTotais,
        adiantamento,
        aPagarHolerite,
        // Aba sem a coluna "RECEBIDO MÊS" (ex: GV TRANSPORTES): é a soma do holerite.
        recebidoMes: colunas.recebidoMes !== undefined ? valor('recebidoMes') : adiantamento + aPagarHolerite,
        descontos: valor('descontos'),
        gratificacao: valor('gratificacao'),
        // A maioria das abas não tem mais "CUSTO TOTAL" (ou vem "R$ -"): usa o ganho total.
        custoTotal: custoTotal > 0 ? custoTotal : ganhosTotais,
        observacao: idxObs !== undefined ? (cols[idxObs] || '').trim() : '',
      },
    })
  }

  return items
}

export function useRhSheet() {
  const [abas, setAbas] = useState<AbaRH[]>(() => {
    const salvas = lerJson<AbaRH[]>(ABAS_STORAGE_KEY, [])
    return salvas.length > 0 ? salvas : ABAS_PADRAO
  })
  const [cache, setCache] = useState<Record<string, ColaboradorRH[]>>(() => lerJson(STORAGE_KEY, {}))
  const mesesCache = ordenarMeses(Object.keys(cache))
  const meses = mesesCache.length > 0 ? mesesCache : mesesDasAbas(abas)
  // Começa sempre no mês mais recente.
  const [mesSelecionado, setMesSelecionado] = useState<string>(() => meses[meses.length - 1] ?? '')

  const [loading, setLoading] = useState(false)
  const [isAutoSyncing, setIsAutoSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastSync, setLastSync] = useState<string | null>(() => localStorage.getItem(LAST_SYNC_KEY))

  const isFetchingRef = useRef(false)
  const cacheRef = useRef(cache)
  cacheRef.current = cache
  const abasRef = useRef(abas)
  abasRef.current = abas
  const mesRef = useRef(mesSelecionado)
  mesRef.current = mesSelecionado
  // Enquanto o usuário não escolher um mês, acompanha o mais novo
  // (ex.: o RH cria as abas de outubro e elas já abrem sozinhas).
  const escolhaManualRef = useRef(false)

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
      let abasAtuais = abasRef.current
      try {
        const resAbas = await fetch(`${URL_PUBHTML}?t=${Date.now()}`)
        const novasAbas = resAbas.ok ? parseAbasPublicadas(await resAbas.text()) : []
        if (novasAbas.length > 0) {
          abasAtuais = novasAbas
          setAbas(novasAbas)
          salvarJson(ABAS_STORAGE_KEY, novasAbas)
        }
      } catch (err) {
        // sem a lista de abas, segue com as que já conhece
        console.error('Erro ao listar abas da planilha RH:', err)
      }

      // Lê todas as abas: o mês vem da coluna "MÊS" de cada linha, não do nome da aba.
      const resultados = await Promise.allSettled(
        abasAtuais.map(async ({ empresa, gid, formato }) => {
          const res = await fetch(`${urlAba(gid)}&t=${Date.now()}`)
          if (!res.ok) throw new Error(`${empresa}: status ${res.status}`)
          const text = await res.text()
          return parseCsv(text, empresa, formato)
        }),
      )

      const lidas: { aba: AbaRH; linhas: LinhaRH[] }[] = []
      const falhas: string[] = []
      resultados.forEach((r, i) => {
        if (r.status === 'fulfilled') lidas.push({ aba: abasAtuais[i], linhas: r.value })
        else falhas.push(abasAtuais[i].empresa)
      })

      const mesesDasLinhas = ordenarMeses(lidas.flatMap(({ linhas }) => linhas.map((l) => l.mes)).filter(Boolean))
      const porMes: Record<string, ColaboradorRH[]> = {}
      const adicionar = (mes: string, item: ColaboradorRH) => {
        ;(porMes[mes] ??= []).push(item)
      }
      for (const { aba, linhas } of lidas) {
        // Aba sem coluna "MÊS" (ex.: "TERCEIROS SETEMBRO") vale só para o mês do nome;
        // se o nome também não traz mês, vale para todos os meses da planilha.
        const mesesSemColuna = aba.mes || mesesDasLinhas.length === 0 ? [aba.mes] : mesesDasLinhas
        for (const { mes, item } of linhas) {
          if (mes) adicionar(mes, item)
          else mesesSemColuna.forEach((m) => adicionar(m, item))
        }
      }

      if (Object.keys(porMes).length === 0) {
        throw new Error('Nenhum colaborador encontrado na planilha')
      }

      // Empresa que falhou nesta leitura mantém o que já estava salvo.
      for (const [mes, itens] of Object.entries(cacheRef.current)) {
        itens.filter((it) => falhas.includes(it.empresa)).forEach((it) => adicionar(mes, it))
      }
      cacheRef.current = porMes
      setCache(porMes)
      salvarJson(STORAGE_KEY, porMes)
      const novosMeses = ordenarMeses(Object.keys(porMes))
      if (!escolhaManualRef.current || !novosMeses.includes(mesRef.current)) {
        const maisRecente = novosMeses[novosMeses.length - 1]
        mesRef.current = maisRecente
        setMesSelecionado(maisRecente)
      }
      const now = new Date()
      const nowStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      const fullSyncStr = `${now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ÀS ${nowStr}`

      setLastSync(fullSyncStr)
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
    fetchSheet(Boolean(cache[mesSelecionado]))
  }, [])

  const selecionarMes = useCallback(
    (mes: string) => {
      escolhaManualRef.current = true
      mesRef.current = mes
      setMesSelecionado(mes)
      // Todas as abas já vêm em cada leitura: só busca se o mês ainda não estiver salvo.
      if (!cache[mes]) fetchSheet()
    },
    [cache, fetchSheet],
  )

  const items = cache[mesSelecionado] ?? []

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
    meses,
    mesSelecionado,
    selecionarMes,
    loading,
    isAutoSyncing,
    error,
    lastSync,
    fetchSheet,
  }
}
