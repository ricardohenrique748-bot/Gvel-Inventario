import { useId } from 'react'

interface CilindroGasSVGProps {
  /** Percentual de gás restante (0-100). */
  percentual: number
  className?: string
  /** Texto estampado no corpo do cilindro (ex: "GV", "GV 1", "R134a"). */
  rotulo?: string
}

/**
 * Cilindro de gás refrigerante desenhado em SVG (vetor puro) — mesmo padrão
 * de nível contínuo do BarrilOleoSVG, mas com a silhueta de um botijão de
 * gás (corpo estreito, ombro cônico, válvula no topo com alça de arame) em
 * vez de um tambor de óleo largo.
 */
export function CilindroGasSVG({ percentual, className, rotulo = 'GV' }: CilindroGasSVGProps) {
  const pct = Math.max(0, Math.min(100, percentual))
  const uid = useId()
  const clipId = `cilindro-clip-${uid}`
  const liquidGradId = `cilindro-liquido-${uid}`
  const wallGradId = `cilindro-parede-${uid}`

  // Geometria do corpo (área útil onde o gás/líquido é desenhado)
  const bodyTop = 96
  const bodyBottom = 246
  const bodyHeight = bodyBottom - bodyTop
  const liquidTopY = bodyBottom - (pct / 100) * bodyHeight

  return (
    <svg
      viewBox="0 0 200 260"
      className={className}
      role="img"
      aria-label={`Cilindro de gás refrigerante, ${Math.round(pct)}% cheio`}
    >
      <defs>
        <clipPath id={clipId}>
          <rect x="52" y={bodyTop} width="96" height={bodyHeight} />
        </clipPath>
        <linearGradient id={liquidGradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5FC9BC" />
          <stop offset="100%" stopColor="#2E8C7F" />
        </linearGradient>
        <linearGradient id={wallGradId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#7FBDB2" />
          <stop offset="42%" stopColor="#B7E4DB" />
          <stop offset="100%" stopColor="#6CA79C" />
        </linearGradient>
      </defs>

      {/* Fundo do cilindro */}
      <ellipse cx="100" cy="246" rx="48" ry="12" fill="#5E9A8F" />

      {/* Parede (corpo reto) */}
      <rect x="50" y="90" width="100" height="156" rx="14" fill={`url(#${wallGradId})`} />

      {/* Gás/líquido, recortado pela área interna do corpo */}
      <g clipPath={`url(#${clipId})`}>
        <rect
          x="50"
          y={liquidTopY}
          width="100"
          height={Math.max(0, bodyBottom - liquidTopY + 16)}
          fill={`url(#${liquidGradId})`}
          style={{ transition: 'y 0.5s ease-out, height 0.5s ease-out' }}
        />
        {pct > 0 && pct < 100 && (
          <g style={{ transform: `translateY(${liquidTopY}px)`, transition: 'transform 0.5s ease-out' }}>
            <g className="animate-liquid-rock" style={{ transformOrigin: '100px 0px' }}>
              <rect x="-40" y="-2" width="280" height="18" fill={`url(#${liquidGradId})`} />
              <rect x="-40" y="-2" width="280" height="3" fill="#D6F5EF" opacity="0.85" />
            </g>
          </g>
        )}
      </g>

      {/* Parede frontal translúcida por cima do líquido */}
      <rect x="50" y="90" width="100" height="156" rx="14" fill={`url(#${wallGradId})`} opacity="0.35" />

      {/* Ombro cônico (transição do corpo pro gargalo) */}
      <path d="M50,96 C50,68 62,52 80,50 L120,50 C138,52 150,68 150,96 Z" fill="#8FCFC3" stroke="#5E9A8F" strokeWidth="2" />

      {/* Logo estampado no corpo (ex: "GV", "R134a") */}
      <text
        x="100"
        y="178"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize={rotulo.length > 3 ? 18 : 24}
        fontWeight="900"
        fill="#1A3B35"
        fillOpacity="0.85"
      >
        {rotulo}
      </text>

      {/* Gargalo/válvula */}
      <rect x="86" y="30" width="28" height="24" rx="3" fill="#8A8F94" stroke="#5A5E62" strokeWidth="1.5" />
      <rect x="90" y="14" width="20" height="20" rx="3" fill="#C7CBCE" stroke="#5A5E62" strokeWidth="1.5" />
      <circle cx="100" cy="14" r="6" fill="#9AA0A4" stroke="#5A5E62" strokeWidth="1.5" />

      {/* Alça de arame (cage) em volta da válvula, como nos botijões reais */}
      <path
        d="M70,50 C70,26 82,12 100,12 C118,12 130,26 130,50"
        fill="none"
        stroke="#C0392B"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path d="M70,50 L70,64" stroke="#C0392B" strokeWidth="5" strokeLinecap="round" />
      <path d="M130,50 L130,64" stroke="#C0392B" strokeWidth="5" strokeLinecap="round" />

      {/* Faixa de identificação (como as faixas coloridas do 134a) */}
      <rect x="50" y="220" width="100" height="14" fill="#1A1A1A" opacity="0.12" />

      {/* Contorno externo do corpo */}
      <path d="M50,96 L50,240" stroke="#4E7D74" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M150,96 L150,240" stroke="#4E7D74" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M50,240 A50,12 0 0 0 150,240" stroke="#4E7D74" strokeWidth="2" fill="none" />
    </svg>
  )
}
