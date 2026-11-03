import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

export interface FotoGaleria {
  url: string
  label: string
}

interface Props {
  fotos: FotoGaleria[]
  indiceInicial: number
  onClose: () => void
}

/**
 * Foto ampliada com navegação entre as fotos do mesmo registro: setas na tela,
 * setas do teclado, deslizar o dedo no celular e Esc para fechar.
 */
export function GaleriaFotosModal({ fotos, indiceInicial, onClose }: Props) {
  const [indice, setIndice] = useState(indiceInicial)
  const toqueInicioX = useRef<number | null>(null)
  const total = fotos.length
  const foto = fotos[indice]

  const anterior = () => setIndice((i) => (i - 1 + total) % total)
  const proxima = () => setIndice((i) => (i + 1) % total)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') setIndice((i) => (i - 1 + total) % total)
      else if (e.key === 'ArrowRight') setIndice((i) => (i + 1) % total)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, total])

  // Carrega antes as vizinhas para a troca ser instantânea.
  useEffect(() => {
    if (total < 2) return
    for (const i of [(indice + 1) % total, (indice - 1 + total) % total]) {
      const img = new Image()
      img.src = fotos[i].url
    }
  }, [indice, fotos, total])

  if (!foto) return null

  const botaoSeta =
    'absolute top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full glass-btn text-foreground'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
      onTouchStart={(e) => {
        toqueInicioX.current = e.touches[0].clientX
      }}
      onTouchEnd={(e) => {
        if (toqueInicioX.current === null || total < 2) return
        const dx = e.changedTouches[0].clientX - toqueInicioX.current
        toqueInicioX.current = null
        if (Math.abs(dx) > 50) (dx < 0 ? proxima : anterior)()
      }}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full glass-btn text-foreground"
        aria-label="Fechar"
      >
        <X className="h-5 w-5" />
      </button>

      {total > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              anterior()
            }}
            className={`${botaoSeta} left-2 sm:left-6 z-10`}
            aria-label="Foto anterior"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              proxima()
            }}
            className={`${botaoSeta} right-2 sm:right-6 z-10`}
            aria-label="Próxima foto"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}

      <div className="flex max-h-full max-w-full flex-col items-center gap-2">
        <img
          key={foto.url}
          src={foto.url}
          alt={foto.label}
          className="max-h-[80vh] max-w-full rounded-xl object-contain"
          onClick={(e) => e.stopPropagation()}
        />
        <p className="text-sm text-secondary">
          {foto.label}
          {total > 1 && <span className="ml-2 opacity-70">{indice + 1} / {total}</span>}
        </p>
      </div>
    </div>
  )
}
