import { useRef, useState, type ChangeEvent } from 'react'
import { Camera, Check, Clock, MessageSquare, Plus, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { StatusChecklist } from '@/lib/types'
import { fotosDoItem, type ChecklistItemState, type FotoAnexada } from './types'
import { comprimirImagem, imagemExibivel } from '@/lib/imagem'

interface Props {
  label: string
  /** Item só de foto (registro fotográfico): sem botões de status. */
  foto?: 'obrigatoria' | 'opcional'
  /** Marcado como Não Conforme e a regra exige foto, mas ainda não tem. */
  faltaFoto?: boolean
  multiplasFotos?: boolean
  minFotos?: number
  maxFotos?: number
  dicaFotos?: string
  value: ChecklistItemState | undefined
  onChange: (next: ChecklistItemState) => void
}

// `curto` é o texto no celular, onde "Não Conforme" não cabe no botão.
const statusOptions: { value: StatusChecklist; label: string; curto: string; icon: typeof Check; activeClass: string }[] = [
  { value: 'conforme', label: 'Conforme', curto: 'Conforme', icon: Check, activeClass: 'bg-status-success text-white' },
  { value: 'nao_conforme', label: 'Não Conforme', curto: 'Não conf.', icon: X, activeClass: 'bg-status-danger text-white' },
  { value: 'pendente', label: 'Pendente', curto: 'Pendente', icon: Clock, activeClass: 'bg-status-warning text-white' },
]

export function ChecklistItemRow({
  label,
  foto,
  faltaFoto,
  multiplasFotos,
  minFotos = 1,
  maxFotos,
  dicaFotos,
  value,
  onChange,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [comprimindo, setComprimindo] = useState(false)
  const [obsAberta, setObsAberta] = useState(false)
  const [erroFoto, setErroFoto] = useState<string | null>(null)

  function setStatus(status: StatusChecklist) {
    onChange({ ...value, status })
  }

  const fotos = fotosDoItem(value)
  // Item de foto única troca a foto ao tirar outra; item de várias fotos para de aceitar no limite.
  const limite = multiplasFotos ? (maxFotos ?? Infinity) : 1
  const noLimite = multiplasFotos && fotos.length >= limite

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
    setErroFoto(null)
    try {
      const vagas = multiplasFotos ? limite - fotos.length : 1
      const processadas = await Promise.all(
        files.slice(0, Math.max(vagas, 0)).map(async (file) => {
          const comprimida = await comprimirImagem(file)
          if (!(await imagemExibivel(comprimida))) return null
          return { file: comprimida, previewUrl: URL.createObjectURL(comprimida) }
        }),
      )
      const novas = processadas.filter((f): f is { file: File; previewUrl: string } => f !== null)
      if (novas.length < processadas.length) {
        setErroFoto(
          'Formato de foto não suportado (ex.: HEIC do iPhone). Use JPG ou PNG, ou tire a foto pela câmera do app.',
        )
      }
      if (novas.length > 0) setFotos(multiplasFotos ? [...fotos, ...novas] : novas)
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

  const faltamFotos = foto === 'obrigatoria' && fotos.length < minFotos
  const dica = !foto ? null : textoDicaFotos()

  function textoDicaFotos() {
    if (!multiplasFotos) return foto === 'obrigatoria' ? 'Foto obrigatória' : 'Foto opcional'
    const extra = dicaFotos ? ` · ${dicaFotos}` : ''
    if (foto === 'opcional') return `Foto opcional${extra} (${fotos.length})`
    if (maxFotos === minFotos) return `${minFotos} fotos obrigatórias${extra} (${fotos.length}/${minFotos})`
    if (maxFotos) return `Mínimo ${minFotos}, até ${maxFotos} fotos${extra} (${fotos.length}/${maxFotos})`
    return `Mínimo ${minFotos} fotos${extra} (${fotos.length}/${minFotos})`
  }

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
                faltamFotos ? 'text-status-danger' : foto === 'obrigatoria' ? 'text-status-success' : 'text-secondary',
              )}
            >
              {dica}
            </p>
          )}
          {faltaFoto && <p className="text-[11px] text-status-danger">Não conforme: anexe uma foto do problema</p>}
          {erroFoto && <p className="text-[11px] text-status-danger">{erroFoto}</p>}
        </div>

        {/* Tudo com a mesma altura (h-11) pra ficar alinhado; status ocupa a largura que sobrar. */}
        <div className={cn('flex items-center gap-2', !foto && 'w-full')}>
          {!foto && (
            <div className="grid h-11 flex-1 grid-cols-3 gap-1 rounded-xl border border-secondary/20 p-1">
              {statusOptions.map((opt) => {
                const Icon = opt.icon
                const ativo = value?.status === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setStatus(opt.value)}
                    title={opt.label}
                    aria-pressed={ativo}
                    className={cn(
                      'flex h-full min-w-0 items-center justify-center gap-1 rounded-lg text-xs font-semibold transition-colors',
                      ativo ? opt.activeClass : 'text-secondary hover:text-foreground',
                    )}
                  >
                    <Icon className="hidden h-3.5 w-3.5 shrink-0 sm:block" />
                    <span className="truncate sm:hidden">{opt.curto}</span>
                    <span className="hidden truncate sm:inline">{opt.label}</span>
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
                'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors',
                mostrarObs
                  ? 'border-primary/40 text-foreground'
                  : 'border-secondary/20 text-secondary hover:text-foreground',
              )}
            >
              <MessageSquare className="h-4 w-4" />
            </button>
          )}

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={comprimindo || noLimite}
            title={noLimite ? `Limite de ${limite} fotos` : 'Anexar foto'}
            aria-label="Anexar foto"
            className={cn(
              'relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors disabled:opacity-50',
              faltaFoto
                ? 'border-status-danger bg-status-danger text-white animate-pulse'
                : fotos.length > 0 && !faltamFotos
                  ? 'border-status-success/40 text-status-success'
                  : 'border-secondary/20 text-secondary hover:text-foreground',
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
          {multiplasFotos && !noLimite && (
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
