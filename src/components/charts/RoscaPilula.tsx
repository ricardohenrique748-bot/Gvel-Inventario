import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

// Gráfico de rosca no mesmo estilo das barras (BarraPilula): fatias com pontas
// totalmente arredondadas e listras diagonais sutis. As fatias "desenham" o
// círculo em sequência quando a rosca aparece na tela. Ao passar o mouse
// (na fatia ou na legenda, via `ativo`/`onAtivo`), a fatia engrossa, as outras
// apagam e o centro mostra nome, valor e %.
//
// SVG puro (sem Recharts): cada fatia é um <circle> com stroke-dasharray.

export type FatiaRosca = { name: string; value: number; cor: string }

type Props = {
  dados: FatiaRosca[]
  centroValor: ReactNode
  centroLegenda: ReactNode
  formatarValor?: (v: number) => string
  tamanho?: number
  espessura?: number
  /** Índice destacado (controlado). Se omitido, a rosca controla sozinha. */
  ativo?: number | null
  onAtivo?: (i: number | null) => void
  className?: string
}

const GAP = 6 // espaço entre fatias, em px ao longo do arco
const EXTRA_HOVER = 8 // quanto a fatia engrossa no hover

export function RoscaPilula({
  dados,
  centroValor,
  centroLegenda,
  formatarValor = (v) => String(v),
  tamanho = 208,
  espessura = 24,
  ativo: ativoControlado,
  onAtivo,
  className,
}: Props) {
  const id = useId().replace(/:/g, '')
  const ref = useRef<HTMLDivElement>(null)
  const [visivel, setVisivel] = useState(false)
  const [ativoInterno, setAtivoInterno] = useState<number | null>(null)
  const ativo = ativoControlado !== undefined ? ativoControlado : ativoInterno
  const setAtivo = (i: number | null) => {
    setAtivoInterno(i)
    onAtivo?.(i)
  }

  // Só anima quando a rosca entra na tela
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVisivel(true)
      return
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setVisivel(true)
          io.disconnect()
        }
      },
      { threshold: 0.25 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const total = dados.reduce((acc, d) => acc + d.value, 0)
  const r = (tamanho - espessura - EXTRA_HOVER) / 2
  const c = tamanho / 2
  const C = 2 * Math.PI * r
  const unica = dados.filter((d) => d.value > 0).length === 1

  let acumulado = 0
  const fatias = dados.map((d, i) => {
    const arco = total > 0 ? (d.value / total) * C : 0
    const inicio = acumulado
    acumulado += arco
    // As pontas redondas avançam espessura/2 de cada lado: desconta do traço
    const len = unica ? C : Math.max(0.01, arco - GAP - espessura)
    const offset = unica ? 0 : -(inicio + GAP / 2 + espessura / 2)
    return { ...d, i, arco, len, offset }
  })

  const destaque = ativo != null ? dados[ativo] : null

  return (
    <div ref={ref} className={`relative shrink-0 ${className ?? ''}`} style={{ width: tamanho, height: tamanho }}>
      <svg
        viewBox={`0 0 ${tamanho} ${tamanho}`}
        width={tamanho}
        height={tamanho}
        className="-rotate-90 overflow-visible"
        onMouseLeave={() => setAtivo(null)}
      >
        <defs>
          <pattern id={`rosca-listras-${id}`} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="3" height="8" fill="#fff" fillOpacity="0.14" />
          </pattern>
        </defs>

        {/* Trilha de fundo */}
        <circle cx={c} cy={c} r={r} fill="none" stroke="currentColor" strokeOpacity={0.06} strokeWidth={espessura} className="text-foreground" />

        {fatias.map((f) => {
          if (f.value <= 0) return null
          const eAtivo = ativo === f.i
          const apagado = ativo != null && !eAtivo
          const sw = eAtivo ? espessura + EXTRA_HOVER : espessura
          const comum = {
            cx: c,
            cy: c,
            r,
            fill: 'none',
            strokeWidth: sw,
            strokeLinecap: (unica ? 'butt' : 'round') as 'butt' | 'round',
            strokeDasharray: `${visivel ? f.len : 0} ${C}`,
            strokeDashoffset: f.offset,
            style: {
              transition: `stroke-dasharray 0.9s cubic-bezier(0.16, 1, 0.3, 1) ${f.i * 90}ms, stroke-width 0.25s ease, opacity 0.25s ease`,
              opacity: apagado ? 0.35 : 1,
            },
          }
          return (
            <g key={f.name}>
              <circle
                {...comum}
                stroke={f.cor}
                pointerEvents="stroke"
                className="cursor-pointer"
                onMouseEnter={() => setAtivo(f.i)}
              />
              <circle {...comum} stroke={`url(#rosca-listras-${id})`} pointerEvents="none" />
            </g>
          )
        })}
      </svg>

      {/* Centro: total ou a fatia em destaque */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
        {destaque ? (
          <div key={destaque.name} className="animate-fade-in flex w-full flex-col items-center">
            <span className="w-full truncate text-[10px] font-bold uppercase tracking-wider" style={{ color: destaque.cor }}>
              {destaque.name}
            </span>
            <span className="text-2xl font-black tabular-nums leading-tight text-foreground">{formatarValor(destaque.value)}</span>
            <span className="text-[11px] font-bold tabular-nums text-secondary">
              {total > 0 ? Math.round((destaque.value / total) * 100) : 0}%
            </span>
          </div>
        ) : (
          <div className="flex w-full flex-col items-center">
            <span className="w-full truncate text-3xl font-black tabular-nums leading-none text-foreground">{centroValor}</span>
            <span className="mt-1 w-full text-[10px] font-bold uppercase tracking-wider text-secondary">{centroLegenda}</span>
          </div>
        )}
      </div>
    </div>
  )
}
