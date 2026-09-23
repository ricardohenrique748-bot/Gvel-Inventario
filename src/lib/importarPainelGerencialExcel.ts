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

/** Lê um Excel com colunas MÊS, EMPRESA, FATURAMENTO, RECEITAS, DESPESAS — uma linha por divisão da GVEL, podendo ter vários meses na mesma planilha. */
export async function importarPainelGerencialExcel(file: File): Promise<ResultadoImportacaoPainel> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { cellDates: true })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null })

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
