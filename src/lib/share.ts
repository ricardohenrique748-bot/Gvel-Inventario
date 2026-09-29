import type { jsPDF } from 'jspdf'
import { Capacitor } from '@capacitor/core'

/**
 * Compartilha o PDF abrindo o menu nativo do celular (WhatsApp, e-mail etc.).
 * - No app (APK): grava o PDF no cache e usa o plugin Share do Capacitor —
 *   o WebView do Android não suporta Web Share API com arquivos.
 * - No navegador: Web Share API; se não suportar arquivos, baixa o PDF.
 */
export async function sharePdf(doc: jsPDF, filename: string, title: string) {
  // Só o Capacitor tem os plugins; TWA/navegador usam o caminho web.
  if (Capacitor.isNativePlatform()) {
    await sharePdfNativo(doc, filename, title)
    return
  }

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

async function sharePdfNativo(doc: jsPDF, filename: string, title: string) {
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([
    import('@capacitor/filesystem'),
    import('@capacitor/share'),
  ])

  // datauristring = "data:application/pdf;filename=...;base64,XXXX" — o plugin quer só o base64.
  const base64 = doc.output('datauristring').split(',')[1]
  const { uri } = await Filesystem.writeFile({
    path: filename,
    data: base64,
    directory: Directory.Cache,
  })

  try {
    await Share.share({ title, files: [uri], dialogTitle: 'Compartilhar PDF' })
  } catch (err) {
    // Fechar o menu sem escolher app não é erro.
    if (err instanceof Error && /cancel/i.test(err.message)) return
    throw err
  }
}
