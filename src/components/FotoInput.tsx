import { useRef, useState, type ChangeEvent } from 'react'
import { Camera, X } from 'lucide-react'
import { comprimirImagem } from '@/lib/imagem'

interface Props {
  label: string
  previewUrl: string | undefined
  onSelect: (file: File, previewUrl: string) => void
  onRemove: () => void
}

export function FotoInput({ label, previewUrl, onSelect, onRemove }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [comprimindo, setComprimindo] = useState(false)

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
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
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={comprimindo}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface text-secondary hover:text-foreground disabled:opacity-50"
          aria-label={comprimindo ? `Processando foto — ${label}` : `Anexar foto — ${label}`}
        >
          <Camera className={comprimindo ? 'h-4 w-4 animate-pulse' : 'h-4 w-4'} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
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
    </div>
  )
}
