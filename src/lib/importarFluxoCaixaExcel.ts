import * as XLSX from 'xlsx'
import type { CriarLancamentoFluxoCaixaInput } from '@/hooks/useFluxoCaixaLancamentos'

export interface ResultadoImportacaoExcel {
  lancamentos: CriarLancamentoFluxoCaixaInput[]
  avisos: string[]
}

/** Aceita variações comuns de grafia/acentuação no cabeçalho. */
function normalizarCabecalho(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toUpperCase()
}

/** "R$ 1.234,56" / "R$ 1,234.56" / "289.99" / "289,99" → 1234.56 (heurística tolerante aos dois formatos). */
function parseValorMonetario(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0
  if (typeof v === 'number') return v
  let s = String(v).replace(/R\$/gi, '').trim()
  if (!s) return 0
  const temVirgula = s.includes(',')
  const temPonto = s.includes('.')
  if (temVirgula && temPonto) {
    // O separador que aparece por último é o decimal; o outro é milhar.
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

/** Datas em Excel podem vir como texto "7/3/26", "03/07/2026" ou já como Date (cellDates:true). */
function parseData(v: unknown): string | null {
  if (!v) return null
  if (v instanceof Date) {
    const ano = v.getFullYear()
    const mes = String(v.getMonth() + 1).padStart(2, '0')
    const dia = String(v.getDate()).padStart(2, '0')
    return `${ano}-${mes}-${dia}`
  }
  const s = String(v).trim()
  const partes = s.split(/[\/\-]/).map((p) => p.trim())
  if (partes.length !== 3) return null
  let [a, b, c] = partes
  // Ano de 4 dígitos já identifica a posição; senão assume DD/MM/AA (padrão BR).
  let dia: string, mes: string, ano: string
  if (a.length === 4) {
    ;[ano, mes, dia] = [a, b, c]
  } else if (c.length === 4 || c.length === 2) {
    ;[dia, mes, ano] = [a, b, c]
  } else {
    return null
  }
  if (ano.length === 2) ano = `20${ano}`
  const diaN = dia.padStart(2, '0')
  const mesN = mes.padStart(2, '0')
  if (Number(mesN) < 1 || Number(mesN) > 12) return null
  return `${ano}-${mesN}-${diaN}`
}

export async function importarFluxoCaixaExcel(file: File): Promise<ResultadoImportacaoExcel> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { cellDates: true })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null })

  const lancamentos: CriarLancamentoFluxoCaixaInput[] = []
  const avisos: string[] = []

  rows.forEach((row, i) => {
    const linhaNum = i + 2 // +1 cabeçalho, +1 para ficar na base 1
    const porCabecalho: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(row)) {
      porCabecalho[normalizarCabecalho(k)] = v
    }

    const descricao = String(porCabecalho['DESCRIÇÃO'] ?? porCabecalho['DESCRICAO'] ?? '').trim()
    const vencimentoRaw = porCabecalho['VENCIMENTO']
    const entradasRaw = porCabecalho['ENTRADAS']
    const saidasRaw = porCabecalho['SAÍDAS'] ?? porCabecalho['SAIDAS']
    const statusRaw = porCabecalho['STATUS']

    if (!descricao) {
      avisos.push(`Linha ${linhaNum}: sem descrição, pulada.`)
      return
    }

    const data = parseData(vencimentoRaw)
    if (!data) {
      avisos.push(`Linha ${linhaNum} ("${descricao}"): vencimento inválido ou vazio, pulada.`)
      return
    }

    const valorEntrada = parseValorMonetario(entradasRaw)
    const valorSaida = parseValorMonetario(saidasRaw)
    const temEntrada = valorEntrada > 0
    const temSaida = valorSaida > 0

    if (temEntrada && temSaida) {
      avisos.push(`Linha ${linhaNum} ("${descricao}"): tem valor em ENTRADAS e SAÍDAS ao mesmo tempo, pulada.`)
      return
    }
    if (!temEntrada && !temSaida) {
      avisos.push(`Linha ${linhaNum} ("${descricao}"): sem valor em ENTRADAS ou SAÍDAS, pulada.`)
      return
    }

    lancamentos.push({
      data,
      dataVencimento: data,
      movimentacao: temEntrada ? 'entrada' : 'saida',
      descricao: descricao.toUpperCase(),
      valor: temEntrada ? valorEntrada : valorSaida,
      statusPagamento: statusRaw ? String(statusRaw).trim().toUpperCase() : undefined,
    })
  })

  return { lancamentos, avisos }
}
