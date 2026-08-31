import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import logoIcon from '@/assets/logo-icon.png'

const A4_WIDTH_MM = 210
const A4_HEIGHT_MM = 297
const MARGIN_MM = 8

/**
 * Espera todas as imagens dentro do elemento terminarem de carregar/decodificar
 * antes do html2canvas tirar o "print" — sem isso a logo (e outras fotos
 * embutidas no relatório) podem sair em branco se ainda não tiverem carregado.
 */
async function aguardarImagens(element: HTMLElement): Promise<void> {
  const imagens = Array.from(element.querySelectorAll('img'))
  await Promise.all(
    imagens.map((img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve()
      return new Promise<void>((resolve) => {
        img.addEventListener('load', () => resolve(), { once: true })
        img.addEventListener('error', () => resolve(), { once: true })
      })
    }),
  )
}

/**
 * Renderiza um elemento HTML (fora da árvore visível) em um PDF A4,
 * fatiando o canvas em múltiplas páginas quando o conteúdo é mais alto
 * que uma página.
 */
export async function elementToPdf(element: HTMLElement): Promise<jsPDF> {
  await aguardarImagens(element)

  const canvas = await html2canvas(element, {
    scale: 2,
    backgroundColor: '#ffffff',
    useCORS: true,
    windowWidth: element.scrollWidth,
  })

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const contentWidthMm = A4_WIDTH_MM - MARGIN_MM * 2
  const contentHeightMm = A4_HEIGHT_MM - MARGIN_MM * 2

  const pxPerMm = canvas.width / contentWidthMm
  const pageHeightPx = Math.floor(contentHeightMm * pxPerMm)

  let renderedPx = 0
  let firstPage = true

  while (renderedPx < canvas.height) {
    const sliceHeightPx = Math.min(pageHeightPx, canvas.height - renderedPx)
    const pageCanvas = document.createElement('canvas')
    pageCanvas.width = canvas.width
    pageCanvas.height = sliceHeightPx
    const ctx = pageCanvas.getContext('2d')
    if (!ctx) break
    ctx.drawImage(canvas, 0, renderedPx, canvas.width, sliceHeightPx, 0, 0, canvas.width, sliceHeightPx)

    const imgData = pageCanvas.toDataURL('image/jpeg', 0.92)
    if (!firstPage) doc.addPage()
    doc.addImage(imgData, 'JPEG', MARGIN_MM, MARGIN_MM, contentWidthMm, (sliceHeightPx * contentWidthMm) / canvas.width)

    renderedPx += sliceHeightPx
    firstPage = false
  }

  return doc
}

/**
 * Monta um elemento fora da tela (não visível ao usuário) contendo o HTML
 * do relatório, aguarda o layout, gera o PDF e remove o elemento.
 */
export async function generatePdfFromHtml(html: string, widthPx = 794): Promise<jsPDF> {
  const container = document.createElement('div')
  container.style.position = 'fixed'
  container.style.top = '0'
  container.style.left = '-10000px'
  container.style.width = `${widthPx}px`
  container.style.zIndex = '-1'
  container.innerHTML = html
  document.body.appendChild(container)

  try {
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    return await elementToPdf(container)
  } finally {
    document.body.removeChild(container)
  }
}

export const REPORT_STYLES = `
  font-family: Arial, Helvetica, sans-serif;
  color: #1a1a1a;
  background: #ffffff;
`

export function reportHeaderHtml(subtitle: string, numero?: string) {
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #E23B2E;padding-bottom:12px;margin-bottom:16px;">
      <div style="display:flex;align-items:center;gap:10px;">
        <img src="${logoIcon}" alt="Center Truck" style="width:44px;height:44px;border-radius:8px;object-fit:contain;" />
        <div>
          <div style="font-weight:bold;font-size:16px;color:#2B2B2B;letter-spacing:0.5px;">CENTER TRUCK</div>
          <div style="font-size:10px;color:#777;text-transform:uppercase;letter-spacing:1px;">Gvel Diesel</div>
        </div>
      </div>
      <div style="text-align:right;">
        <div style="font-weight:bold;font-size:14px;color:#2B2B2B;">${subtitle}</div>
        ${numero ? `<div style="font-size:11px;color:#777;">Nº ${numero}</div>` : ''}
      </div>
    </div>
  `
}

export function reportFooterHtml(geradoEm: string) {
  return `
    <div style="margin-top:24px;padding-top:10px;border-top:1px solid #ddd;font-size:10px;color:#999;text-align:center;">
      Relatório gerado por Center Truck — Gvel Diesel em ${geradoEm}
    </div>
  `
}
