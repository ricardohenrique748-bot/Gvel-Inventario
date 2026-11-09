import { useId } from 'react'

// Formato de barra "pílula" (pontas totalmente arredondadas) com listras
// diagonais sutis por cima da cor. Usar em <Bar shape={<BarraPilula />} />.
// Funciona em barras verticais e horizontais: o raio é metade do lado menor.
// A animação de entrada continua vindo do CSS (.recharts-bar-rectangle).

type Props = {
  x?: number
  y?: number
  width?: number
  height?: number
  fill?: string
}

export function BarraPilula({ x = 0, y = 0, width = 0, height = 0, fill }: Props) {
  const id = useId().replace(/:/g, '')

  // Recharts pode mandar altura/largura negativas (valores negativos)
  const w = Math.abs(width)
  const h = Math.abs(height)
  const px = width < 0 ? x + width : x
  const py = height < 0 ? y + height : y
  if (w < 0.5 || h < 0.5) return null

  const r = Math.min(w, h) / 2

  return (
    <g>
      <defs>
        <pattern
          id={`listras-${id}`}
          width="8"
          height="8"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width="3" height="8" fill="#fff" fillOpacity="0.14" />
        </pattern>
      </defs>
      <rect x={px} y={py} width={w} height={h} rx={r} ry={r} fill={fill} />
      <rect x={px} y={py} width={w} height={h} rx={r} ry={r} fill={`url(#listras-${id})`} pointerEvents="none" />
    </g>
  )
}
