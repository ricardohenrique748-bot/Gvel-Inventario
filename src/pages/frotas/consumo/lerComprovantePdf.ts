import * as pdfjsLib from 'pdfjs-dist'
import type { TextItem } from 'pdfjs-dist/types/src/display/api'
import { extrairDadosComprovante, type DadosComprovante } from './comprovante'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

/** Texto do PDF em linhas visuais (itens com o mesmo Y, da esquerda pra direita). */
async function textoDoPdf(file: File): Promise<string> {
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise
  const saida: string[] = []
  for (let p = 1; p <= Math.min(pdf.numPages, 3); p++) {
    const conteudo = await (await pdf.getPage(p)).getTextContent()
    const linhas: { y: number; itens: { x: number; s: string }[] }[] = []
    for (const item of conteudo.items as TextItem[]) {
      if (!item.str?.trim()) continue
      const [x, y] = [item.transform[4], item.transform[5]]
      let linha = linhas.find((l) => Math.abs(l.y - y) <= 2.5)
      if (!linha) linhas.push((linha = { y, itens: [] }))
      linha.itens.push({ x, s: item.str.trim() })
    }
    linhas.sort((a, b) => b.y - a.y)
    for (const l of linhas) saida.push(l.itens.sort((a, b) => a.x - b.x).map((i) => i.s).join(' '))
  }
  return saida.join('\n')
}

export async function lerComprovantePdf(file: File): Promise<DadosComprovante> {
  const texto = await textoDoPdf(file)
  if (!texto.trim()) throw new Error('O PDF não tem texto (é uma imagem escaneada). Preencha manualmente.')
  return extrairDadosComprovante(texto)
}
