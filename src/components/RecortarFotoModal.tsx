import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, X, ZoomIn } from 'lucide-react'

const TAMANHO_CIRCULO = 260
const TAMANHO_SAIDA = 480
const ZOOM_MIN = 1
const ZOOM_MAX = 3

interface Props {
  arquivo: File
  onCancelar: () => void
  onConfirmar: (arquivoRecortado: File) => void
}

/** Modal simples de recorte circular (pan + zoom) para fotos de perfil — sem
 * depender de biblioteca externa. Devolve um JPEG quadrado (a máscara circular
 * é só visual, aplicada via CSS onde o avatar é exibido). */
export function RecortarFotoModal({ arquivo, onCancelar, onConfirmar }: Props) {
  const [imagem, setImagem] = useState<HTMLImageElement | null>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [processando, setProcessando] = useState(false)
  const arrastoRef = useRef<{ ativo: boolean; inicioX: number; inicioY: number; offsetInicial: { x: number; y: number } }>({
    ativo: false,
    inicioX: 0,
    inicioY: 0,
    offsetInicial: { x: 0, y: 0 },
  })

  useEffect(() => {
    const url = URL.createObjectURL(arquivo)
    const img = new Image()
    img.onload = () => setImagem(img)
    img.src = url
    return () => URL.revokeObjectURL(url)
  }, [arquivo])

  const escalaBase = useMemo(() => {
    if (!imagem) return 1
    return TAMANHO_CIRCULO / Math.min(imagem.naturalWidth, imagem.naturalHeight)
  }, [imagem])

  const escalaEfetiva = escalaBase * zoom
  const larguraEscalada = (imagem?.naturalWidth ?? 0) * escalaEfetiva
  const alturaEscalada = (imagem?.naturalHeight ?? 0) * escalaEfetiva

  function limitarOffset(x: number, y: number) {
    const maxX = Math.max(0, (larguraEscalada - TAMANHO_CIRCULO) / 2)
    const maxY = Math.max(0, (alturaEscalada - TAMANHO_CIRCULO) / 2)
    return { x: Math.min(maxX, Math.max(-maxX, x)), y: Math.min(maxY, Math.max(-maxY, y)) }
  }

  function iniciarArrasto(clientX: number, clientY: number) {
    arrastoRef.current = { ativo: true, inicioX: clientX, inicioY: clientY, offsetInicial: offset }
  }

  function moverArrasto(clientX: number, clientY: number) {
    if (!arrastoRef.current.ativo) return
    const dx = clientX - arrastoRef.current.inicioX
    const dy = clientY - arrastoRef.current.inicioY
    setOffset(limitarOffset(arrastoRef.current.offsetInicial.x + dx, arrastoRef.current.offsetInicial.y + dy))
  }

  function finalizarArrasto() {
    arrastoRef.current.ativo = false
  }

  useEffect(() => {
    setOffset((o) => limitarOffset(o.x, o.y))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, imagem])

  async function confirmar() {
    if (!imagem) return
    setProcessando(true)
    try {
      const sx = (larguraEscalada / 2 - TAMANHO_CIRCULO / 2 - offset.x) / escalaEfetiva
      const sy = (alturaEscalada / 2 - TAMANHO_CIRCULO / 2 - offset.y) / escalaEfetiva
      const sSize = TAMANHO_CIRCULO / escalaEfetiva

      const canvas = document.createElement('canvas')
      canvas.width = TAMANHO_SAIDA
      canvas.height = TAMANHO_SAIDA
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.drawImage(imagem, sx, sy, sSize, sSize, 0, 0, TAMANHO_SAIDA, TAMANHO_SAIDA)

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
      if (!blob) return
      onConfirmar(new File([blob], arquivo.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' }))
    } finally {
      setProcessando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-sm rounded-3xl border border-border/25 bg-surface p-5 shadow-2xl animate-scale-in">
        <div className="flex items-center justify-between pb-3">
          <h3 className="text-sm font-black uppercase text-foreground">Ajustar Foto</h3>
          <button
            type="button"
            onClick={onCancelar}
            className="rounded-xl p-1.5 text-secondary hover:bg-overlay/10 hover:text-foreground transition-colors"
            aria-label="Cancelar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div
          className="relative mx-auto overflow-hidden rounded-full border border-border/20 bg-background shadow-inner select-none touch-none"
          style={{ width: TAMANHO_CIRCULO, height: TAMANHO_CIRCULO, cursor: imagem ? 'grab' : 'default' }}
          onMouseDown={(e) => iniciarArrasto(e.clientX, e.clientY)}
          onMouseMove={(e) => moverArrasto(e.clientX, e.clientY)}
          onMouseUp={finalizarArrasto}
          onMouseLeave={finalizarArrasto}
          onTouchStart={(e) => iniciarArrasto(e.touches[0].clientX, e.touches[0].clientY)}
          onTouchMove={(e) => moverArrasto(e.touches[0].clientX, e.touches[0].clientY)}
          onTouchEnd={finalizarArrasto}
        >
          {imagem && (
            <img
              src={imagem.src}
              alt=""
              draggable={false}
              className="pointer-events-none absolute"
              style={{
                width: larguraEscalada,
                height: alturaEscalada,
                left: TAMANHO_CIRCULO / 2 - larguraEscalada / 2 + offset.x,
                top: TAMANHO_CIRCULO / 2 - alturaEscalada / 2 + offset.y,
              }}
            />
          )}
          {/* Anel guia para reforçar o corte circular */}
          <div className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-white/20" />
        </div>

        <div className="mt-4 flex items-center gap-3">
          <ZoomIn className="h-4 w-4 shrink-0 text-secondary" />
          <input
            type="range"
            min={ZOOM_MIN}
            max={ZOOM_MAX}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            disabled={!imagem}
            className="w-full accent-primary"
          />
        </div>
        <p className="mt-1 text-center text-[11px] text-secondary">Arraste para posicionar e use o zoom para ajustar</p>

        <div className="mt-4 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancelar}
            className="rounded-xl px-4 py-2 text-xs font-bold uppercase text-secondary hover:bg-overlay/10 hover:text-foreground transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirmar}
            disabled={!imagem || processando}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-black uppercase text-primary-foreground shadow-md shadow-primary/20 disabled:opacity-50"
          >
            <Check className="h-3.5 w-3.5" />
            {processando ? 'Salvando…' : 'Usar Foto'}
          </button>
        </div>
      </div>
    </div>
  )
}
