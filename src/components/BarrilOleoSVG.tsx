import { useId } from 'react'

interface BarrilOleoSVGProps {
  /** Percentual de líquido restante (0-100). */
  percentual: number
  className?: string
}

/**
 * Barril de óleo desenhado em SVG (vetor puro) — nível de líquido contínuo
 * e preciso, sempre nítido em qualquer tamanho/fundo, sem os artefatos de
 * recorte de fundo que uma imagem rasterizada tem.
 */
export function BarrilOleoSVG({ percentual, className }: BarrilOleoSVGProps) {
  const pct = Math.max(0, Math.min(100, percentual))
  const uid = useId()
  const clipId = `barril-clip-${uid}`
  const liquidGradId = `barril-liquido-${uid}`
  const wallGradId = `barril-parede-${uid}`

  // Geometria do corpo (área útil onde o líquido é desenhado)
  const bodyTop = 44
  const bodyBottom = 244
  const bodyHeight = bodyBottom - bodyTop
  const liquidTopY = bodyBottom - (pct / 100) * bodyHeight

  return (
    <svg
      viewBox="0 0 200 260"
      className={className}
      role="img"
      aria-label={`Barril de óleo, ${Math.round(pct)}% cheio`}
    >
      <defs>
        <clipPath id={clipId}>
          <rect x="26" y={bodyTop} width="148" height={bodyHeight} />
        </clipPath>
        <linearGradient id={liquidGradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F5A02A" />
          <stop offset="100%" stopColor="#C25A00" />
        </linearGradient>
        <linearGradient id={wallGradId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#7A0F0F" />
          <stop offset="42%" stopColor="#C22626" />
          <stop offset="100%" stopColor="#6E0D0D" />
        </linearGradient>
      </defs>

      {/* Fundo do barril */}
      <ellipse cx="100" cy="244" rx="76" ry="18" fill="#6E0D0D" />

      {/* Parede (corpo reto) */}
      <rect x="24" y="38" width="152" height="206" fill={`url(#${wallGradId})`} />

      {/* Líquido, recortado pela área interna do corpo */}
      <g clipPath={`url(#${clipId})`}>
        <rect
          x="24"
          y={liquidTopY}
          width="152"
          height={Math.max(0, bodyBottom - liquidTopY + 20)}
          fill={`url(#${liquidGradId})`}
          style={{ transition: 'y 0.5s ease-out, height 0.5s ease-out' }}
        />
        {pct > 0 && pct < 100 && (
          <g style={{ transform: `translateY(${liquidTopY}px)`, transition: 'transform 0.5s ease-out' }}>
            <g className="animate-liquid-rock" style={{ transformOrigin: '100px 0px' }}>
              <rect x="-90" y="-2" width="380" height="24" fill={`url(#${liquidGradId})`} />
              <rect x="-90" y="-2" width="380" height="3" fill="#FFDDA0" opacity="0.85" />
            </g>
          </g>
        )}
      </g>

      {/* Parede frontal translúcida por cima do líquido — o vermelho fica bem escuro
          onde está vazio e ganha um brilho quente onde o líquido aparece por trás */}
      <rect x="24" y="38" width="152" height="206" fill={`url(#${wallGradId})`} opacity="0.45" />

      {/* Faixas metálicas finas */}
      {[104, 172].map((y) => (
        <g key={y}>
          <rect x="22" y={y} width="156" height="7" fill="#8C1010" />
          <rect x="22" y={y} width="156" height="2" fill="#B33333" opacity="0.7" />
          <rect x="22" y={y + 5} width="156" height="2" fill="#4A0808" opacity="0.8" />
        </g>
      ))}

      {/* Tampa (topo) */}
      <ellipse cx="100" cy="38" rx="76" ry="19" fill="#C22626" stroke="#6E0D0D" strokeWidth="2" />
      <ellipse cx="100" cy="33" rx="56" ry="10" fill="#E0524A" opacity="0.6" />

      {/* Parafusos */}
      <circle cx="72" cy="32" r="4" fill="#5A5A5A" stroke="#2E2E2E" strokeWidth="1" />
      <circle cx="128" cy="32" r="4" fill="#5A5A5A" stroke="#2E2E2E" strokeWidth="1" />

      {/* Contorno externo do corpo */}
      <path d="M24,38 L24,244" stroke="#4A0808" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M176,38 L176,244" stroke="#4A0808" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M24,244 A76,18 0 0 0 176,244" stroke="#4A0808" strokeWidth="2" fill="none" />
    </svg>
  )
}
