function escapeCsvCell(value: string): string {
  if (/[";\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/**
 * Gera e baixa um CSV compatível com Excel (BOM UTF-8 + separador ";",
 * já que o Excel em locale pt-BR usa vírgula como separador decimal).
 */
export function exportRowsToCsv(filename: string, headers: string[], rows: string[][]): void {
  const linhas = [headers, ...rows].map((linha) => linha.map(escapeCsvCell).join(';')).join('\r\n')
  const blob = new Blob(['﻿' + linhas], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
