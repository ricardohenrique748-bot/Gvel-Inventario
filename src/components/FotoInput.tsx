import { useRef, useState, type ChangeEvent } from 'react'
import { Camera, Image as ImageIcon, X } from 'lucide-react'
import { comprimirImagem } from '@/lib/imagem'
import { isNativeApp } from '@/lib/isNativeApp'
import { CameraWebcamModal } from '@/components/CameraWebcamModal'

// No computador o navegador ignora `capture` e o botão de câmera só abria a
// janela de arquivos; ali usamos a webcam direto. Celular/APK seguem com a
// câmera nativa.
// Detecta celular/tablet pelo navegador (não pela tela de toque: notebook com
// touch também precisa da webcam).
export function usarWebcam(): boolean {
  if (typeof window === 'undefined' || isNativeApp()) return false
  const celular = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
  return !celular && Boolean(navigator.mediaDevices?.getUserMedia)
}

interface Props {
  label: string
  previewUrl: string | undefined
  onSelect: (file: File, previewUrl: string) => void
  onRemove: () => void
}

export function FotoInput({ label, previewUrl, onSelect, onRemove }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const galeriaInputRef = useRef<HTMLInputElement>(null)
  const [comprimindo, setComprimindo] = useState(false)
  const [webcamAberta, setWebcamAberta] = useState(false)

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    await processar(file)
  }

  async function processar(file: File) {
    setComprimindo(true)
    try {
      const comprimida = await comprimirImagem(file)
      onSelect(comprimida, URL.createObjectURL(comprimida))
    } finally {
      setComprimindo(false)
    }
  }

  return (
    <div className="rounded-xl bg-background p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-foreground">{label}</p>
        {/* Dois botões: no APK, `capture` abre só a câmera e sem ele abre só a galeria. */}
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => (usarWebcam() ? setWebcamAberta(true) : fileInputRef.current?.click())}
            disabled={comprimindo}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface text-secondary hover:text-foreground disabled:opacity-50"
            aria-label={comprimindo ? `Processando foto — ${label}` : `Tirar foto — ${label}`}
            title="Câmera"
          >
            <Camera className={comprimindo ? 'h-4 w-4 animate-pulse' : 'h-4 w-4'} />
          </button>
          <button
            type="button"
            onClick={() => galeriaInputRef.current?.click()}
            disabled={comprimindo}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface text-secondary hover:text-foreground disabled:opacity-50"
            aria-label={`Escolher da galeria — ${label}`}
            title="Galeria"
          >
            <ImageIcon className="h-4 w-4" />
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFile}
        />
        <input
          ref={galeriaInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFile}
        />
      </div>

      {previewUrl && (
        <div className="relative mt-2 inline-block">
          <img
            src={previewUrl}
            alt={label}
            loading="lazy"
            decoding="async"
            className="h-16 w-16 rounded-lg object-cover"
          />
          <button
            type="button"
            onClick={onRemove}
            className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-status-danger text-white"
            aria-label={`Remover foto — ${label}`}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {webcamAberta && (
        <CameraWebcamModal
          titulo={label}
          subtitulo="Enquadre o veículo e clique em Capturar Foto"
          textoMoldura="Enquadre o veículo aqui"
          espelhar={false}
          onCapture={(file) => void processar(file)}
          onClose={() => setWebcamAberta(false)}
        />
      )}
    </div>
  )
}
