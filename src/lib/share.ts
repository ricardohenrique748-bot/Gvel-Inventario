import type { jsPDF } from 'jspdf'

/**
 * Compartilha o PDF via Web Share API (abre o menu nativo do celular —
 * WhatsApp, e-mail etc.). Se o navegador não suportar compartilhamento de
 * arquivos, faz fallback para download direto.
 */
export async function sharePdf(doc: jsPDF, filename: string, title: string) {
  const blob = doc.output('blob') as Blob
  const file = new File([blob], filename, { type: 'application/pdf' })

  const nav = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean
    share?: (data: ShareData) => Promise<void>
  }

  if (nav.canShare && nav.share && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], title })
      return
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      // segue para o fallback de download em caso de outros erros
    }
  }

  doc.save(filename)
}
