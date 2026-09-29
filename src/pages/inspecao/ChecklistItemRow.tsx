import { useRef, useState, type ChangeEvent } from 'react'
import { Camera, Check, Clock, MessageSquare, Plus, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { StatusChecklist } from '@/lib/types'
import { fotosDoItem, type ChecklistItemState, type FotoAnexada } from './types'
import { comprimirImagem } from '@/lib/imagem'

interface Props {
  label: string
  /** Item só de foto (registro fotográfico): sem botões de status. */
  foto?: 'obrigatoria' | 'opcional'
  /** Marcado como Não Conforme e a regra exige foto, mas ainda não tem. */
  faltaFoto?: boolean
  multiplasFotos?: boolean
  value: ChecklistItemState | undefined
  onChange: (next: ChecklistItemState) => void
}

const statusOptions: { value: StatusChecklist; label: string; icon: typeof Check; activeClass: string }[] = [
  { value: 'conforme', label: 'Conforme', icon: Check, activeClass: 'bg-status-success text-white' },
  { value: 'nao_conforme', label: 'Não Conforme', icon: X, activeClass: 'bg-status-danger text-white' },
  { value: 'pendente', label: 'Pendente', icon: Clock, activeClass: 'bg-status-warning text-white' },
]

export function ChecklistItemRow({ label, foto, faltaFoto, multiplasFotos, value, onChange }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [comprimindo, setComprimindo] = useState(false)
  const [obsAberta, setObsAberta] = useState(false)

  function setStatus(status: StatusChecklist) {
    onChange({ ...value, status })
  }

  const fotos = fotosDoItem(value)

  // A primeira foto fica em fotoFile/fotoPreviewUrl (como nos itens de foto única); o resto em fotosExtras.
  function setFotos(lista: FotoAnexada[]) {
    const [primeira, ...extras] = lista
    onChange({
      ...value,
      fotoFile: primeira?.file,
      fotoPreviewUrl: primeira?.previewUrl,
      fotosExtras: multiplasFotos ? extras : undefined,
    })
  }

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return
    setComprimindo(true)
    try {
      const novas = await Promise.all(
        (multiplasFotos ? files : files.slice(0, 1)).map(async (file) => {
          const comprimida = await comprimirImagem(file)
          return { file: comprimida, previewUrl: URL.createObjectURL(comprimida) }
        }),
      )
      setFotos(multiplasFotos ? [...fotos, ...novas] : novas)
    } finally {
      setComprimindo(false)
    }
  }

  function removeFoto(index: number) {
    setFotos(fotos.filter((_, i) => i !== index))
  }

  // Observação fica recolhida; abre sozinha quando o item tem problema ou já tem texto.
  const mostrarObs =
    obsAberta || Boolean(value?.observacao) || value?.status === 'nao_conforme' || value?.status === 'pendente'

  const dica = foto
    ? `${foto === 'obrigatoria' ? 'Foto obrigatória' : 'Foto opcional'}${
        multiplasFotos ? ` · uma de cada pneu${fotos.length ? ` (${fotos.length})` : ''}` : ''
      }`
    : null

  return (
    <div className="py-3">
      {/* Item com status: botões embaixo do nome. Item só de foto: câmera ao lado. */}
      <div className={cn('flex gap-x-3 gap-y-2', foto ? 'items-center' : 'flex-col')}>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-foreground">{label}</p>
          {dica && (
            <p
              className={cn(
                'text-[11px]',
                foto === 'obrigatoria' && fotos.length === 0 ? 'text-status-danger' : 'text-secondary',
              )}
            >
              {dica}
            </p>
          )}
          {faltaFoto && <p className="text-[11px] text-status-danger">Não conforme: anexe uma foto do problema</p>}
        </div>

        <div className="flex items-center gap-1.5">
          {!foto && (
            <div className="flex rounded-lg border border-secondary/20 p-0.5">
              {statusOptions.map((opt) => {
                const Icon = opt.icon
                const ativo = value?.status === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setStatus(opt.value)}
                    title={opt.label}
                    aria-label={opt.label}
                    aria-pressed={ativo}
                    className={cn(
                      'flex h-8 items-center gap-1 rounded-md px-2.5 text-xs font-medium transition-colors',
                      ativo ? opt.activeClass : 'text-secondary hover:text-foreground',
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{opt.label}</span>
                  </button>
                )
              })}
            </div>
          )}

          {!foto && (
            <button
              type="button"
              onClick={() => setObsAberta((v) => !v)}
              title="Observação"
              aria-label="Observação"
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-lg transition-colors',
                mostrarObs ? 'text-foreground' : 'text-secondary hover:text-foreground',
              )}
            >
              <MessageSquare className="h-4 w-4" />
            </button>
          )}

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={comprimindo}
            title="Anexar foto"
            aria-label="Anexar foto"
            className={cn(
              'relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors disabled:opacity-50',
              faltaFoto
                ? 'bg-status-danger text-white animate-pulse'
                : fotos.length > 0
                  ? 'text-status-success'
                  : 'text-secondary hover:text-foreground',
            )}
          >
            <Camera className="h-4 w-4" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple={multiplasFotos}
            className="hidden"
            onChange={handleFile}
          />
        </div>
      </div>

      {(fotos.length > 0 || multiplasFotos) && (
        <div className="mt-2 flex flex-wrap gap-2">
          {fotos.map((f, i) => (
            <div key={f.previewUrl} className="relative">
              <img src={f.previewUrl} alt={`Foto ${i + 1} do item`} className="h-14 w-14 rounded-lg object-cover" />
              <button
                type="button"
                onClick={() => removeFoto(i)}
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-status-danger text-white"
                aria-label="Remover foto"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          {multiplasFotos && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={comprimindo}
              className="flex h-14 w-14 flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-secondary/40 text-secondary hover:text-foreground disabled:opacity-50"
              aria-label="Adicionar foto"
            >
              <Plus className="h-4 w-4" />
              <span className="text-[10px]">{comprimindo ? '...' : 'Foto'}</span>
            </button>
          )}
        </div>
      )}

      {!foto && mostrarObs && (
        <textarea
          placeholder={value?.status === 'nao_conforme' ? 'Descreva o problema' : 'Observação (opcional)'}
          value={value?.observacao ?? ''}
          onChange={(e) => onChange({ ...value, observacao: e.target.value })}
          className="mt-2 w-full rounded-lg bg-background border border-secondary/20 px-3 py-2 text-xs text-foreground placeholder:text-secondary/60 focus:outline-none focus:border-primary resize-none"
          rows={2}
        />
      )}
    </div>
  )
}
