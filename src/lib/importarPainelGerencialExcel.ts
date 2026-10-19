import * as XLSX from 'xlsx'
import { mapearDivisao, type DivisaoEmpresaData } from '@/hooks/usePainelGerencialDivisoes'

export interface ResultadoImportacaoPainel {
  /** Divisões agrupadas por mês — uma planilha pode trazer vários meses de uma vez. */
  porMes: Record<string, DivisaoEmpresaData[]>
  avisos: string[]
}

const MESES_VALIDOS = [
  'janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

function normalizarTexto(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
}

function normalizarCabecalho(s: string): string {
  return normalizarTexto(s).toUpperCase()
}

function parseMes(v: unknown): string | null {
  if (!v) return null
  const n = normalizarTexto(String(v))
  return MESES_VALIDOS.find((m) => m === n) ?? null
}

function parseValorMonetario(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0
  if (typeof v === 'number') return v
  let s = String(v).replace(/R\$/gi, '').trim()
  if (!s) return 0
  const temVirgula = s.includes(',')
  const temPonto = s.includes('.')
  if (temVirgula && temPonto) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.')
    } else {
      s = s.replace(/,/g, '')
    }
  } else if (temVirgula) {
    s = s.replace(',', '.')
  }
  const n = parseFloat(s)
  return isNaN(n) ? 0 : n
}

/**
 * Planilha exportada do próprio dashboard ("Painel Gerencial"): o mês fica abaixo do rótulo
 * "MÊS DE APURAÇÃO" e a tabela "Empresa | Faturamento | Receitas | Despesas" fica no meio da folha.
 * Converte para o formato de linhas do layout simples. Retorna null se não for esse layout.
 */
function extrairLayoutDashboard(sheet: XLSX.WorkSheet): Record<string, unknown>[] | null {
  const matriz = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null })
  const celula = (r: number, c: number) => normalizarCabecalho(String(matriz[r]?.[c] ?? ''))

  let mes: unknown = null
  for (let r = 0; r < matriz.length && mes === null; r++) {
    const c = (matriz[r] ?? []).findIndex((_, c) => celula(r, c).includes('MES DE APURACAO'))
    if (c >= 0) mes = matriz[r + 1]?.[c] ?? null
  }

  for (let r = 0; r < matriz.length; r++) {
    const cab = (matriz[r] ?? []).map((_, c) => celula(r, c))
    const col = (nome: string) => cab.indexOf(nome)
    if (col('EMPRESA') < 0 || col('FATURAMENTO') < 0 || col('RECEITAS') < 0 || col('DESPESAS') < 0) continue

    const linhas: Record<string, unknown>[] = []
    for (let i = r + 1; i < matriz.length; i++) {
      const empresa = String(matriz[i]?.[col('EMPRESA')] ?? '').trim()
      if (!empresa) break
      if (normalizarCabecalho(empresa) === 'TOTAL') continue
      linhas.push({
        MES: mes,
        EMPRESA: empresa,
        FATURAMENTO: matriz[i][col('FATURAMENTO')],
        RECEITAS: matriz[i][col('RECEITAS')],
        DESPESAS: matriz[i][col('DESPESAS')],
      })
    }
    return linhas
  }
  return null
}

/** Lê um Excel com colunas MÊS, EMPRESA, FATURAMENTO, RECEITAS, DESPESAS — uma linha por divisão da GVEL, podendo ter vários meses na mesma planilha. Também aceita a planilha exportada do dashboard. */
export async function importarPainelGerencialExcel(file: File): Promise<ResultadoImportacaoPainel> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { cellDates: true })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const simples = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null })
  const temCabecalhoSimples = simples.length > 0 && Object.keys(simples[0]).some((k) => normalizarCabecalho(k) === 'EMPRESA')
  const rows = temCabecalhoSimples ? simples : (extrairLayoutDashboard(sheet) ?? simples)

  const porMes: Record<string, DivisaoEmpresaData[]> = {}
  const avisos: string[] = []

  rows.forEach((row, i) => {
    const linhaNum = i + 2
    const porCabecalho: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(row)) {
      porCabecalho[normalizarCabecalho(k)] = v
    }

    const empresaRaw = String(porCabecalho['EMPRESA'] ?? '').trim()
    if (!empresaRaw) {
      avisos.push(`Linha ${linhaNum}: sem nome de empresa, pulada.`)
      return
    }

    const mes = parseMes(porCabecalho['MÊS'] ?? porCabecalho['MES'])
    if (!mes) {
      avisos.push(`Linha ${linhaNum} ("${empresaRaw}"): coluna MÊS vazia ou não reconhecida, pulada.`)
      return
    }

    const divisao = mapearDivisao(empresaRaw)
    const tudoZerado = ['FATURAMENTO', 'RECEITAS', 'DESPESAS'].every((k) => parseValorMonetario(porCabecalho[k]) === 0)
    if (!divisao && tudoZerado) return // ex.: "Margem de Risco/Erro" zerada no dashboard
    if (!divisao) {
      avisos.push(
        `Linha ${linhaNum}: "${empresaRaw}" não é reconhecido (esperado: GVel Diesel, GVel Leves, GV Distribuidora, GV Transportes ou Investimento) — pulada.`,
      )
      return
    }

    if (!porMes[mes]) porMes[mes] = []
    const idx = porMes[mes].findIndex((d) => d.id === divisao.id)
    if (idx >= 0) {
      avisos.push(`Linha ${linhaNum}: "${empresaRaw}" já apareceu antes para ${mes} — usando a última ocorrência.`)
    }

    const faturamento = parseValorMonetario(porCabecalho['FATURAMENTO'])
    const receitas = parseValorMonetario(porCabecalho['RECEITAS'])
    const despesas = parseValorMonetario(porCabecalho['DESPESAS'])
    const registro = { id: divisao.id, nome: divisao.nome, faturamento, receitas, despesas }

    if (idx >= 0) porMes[mes][idx] = registro
    else porMes[mes].push(registro)
  })

  return { porMes, avisos }
}
