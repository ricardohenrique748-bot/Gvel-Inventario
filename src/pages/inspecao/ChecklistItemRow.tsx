import { useRef, type ChangeEvent } from 'react'
import { Camera, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { StatusChecklist } from '@/lib/types'
import type { ChecklistItemState } from './types'

interface Props {
  label: string
  value: ChecklistItemState | undefined
  onChange: (next: ChecklistItemState) => void
}

const statusOptions: { value: StatusChecklist; label: string; activeClass: string }[] = [
  { value: 'conforme', label: 'Conforme', activeClass: 'bg-status-success text-white border-status-success' },
  { value: 'nao_conforme', label: 'Não Conforme', activeClass: 'bg-status-danger text-white border-status-danger' },
  { value: 'pendente', label: 'Pendente', activeClass: 'bg-status-warning text-white border-status-warning' },
]

export function ChecklistItemRow({ label, value, onChange }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  function setStatus(status: StatusChecklist) {
    onChange({ ...value, status })
  }

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    onChange({ ...value, fotoFile: file, fotoPreviewUrl: URL.createObjectURL(file) })
    e.target.value = ''
  }

  function removeFoto() {
    onChange({ ...value, fotoFile: undefined, fotoPreviewUrl: undefined })
  }

  return (
    <div className="rounded-xl bg-background p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface text-secondary hover:text-foreground"
          aria-label="Anexar foto"
        >
          <Camera className="h-4 w-4" />
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2">
        {statusOptions.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setStatus(opt.value)}
            className={cn(
              'h-10 rounded-lg border text-xs font-medium transition-colors',
              value?.status === opt.value ? opt.activeClass : 'border-secondary/30 text-secondary hover:text-foreground',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {value?.fotoPreviewUrl && (
        <div className="relative mt-2 inline-block">
          <img src={value.fotoPreviewUrl} alt="Foto do item" className="h-16 w-16 rounded-lg object-cover" />
          <button
            type="button"
            onClick={removeFoto}
            className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-status-danger text-white"
            aria-label="Remover foto"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      <textarea
        placeholder="Observação (opcional)"
        value={value?.observacao ?? ''}
        onChange={(e) => onChange({ ...value, observacao: e.target.value })}
        className="mt-2 w-full rounded-lg bg-surface border border-secondary/20 px-3 py-2 text-xs text-foreground placeholder:text-secondary/60 focus:outline-none focus:border-primary resize-none"
        rows={2}
      />
    </div>
  )
}
