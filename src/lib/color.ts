/** Converte "#RRGGBB" em "R G B" (formato usado pelas CSS vars --color-*, ver src/index.css). */
export function hexParaRgbString(hex: string): string | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!match) return null
  const int = parseInt(match[1], 16)
  const r = (int >> 16) & 255
  const g = (int >> 8) & 255
  const b = int & 255
  return `${r} ${g} ${b}`
}

/** Mesma ideia, mas escurecida (usada pra gerar o tom de hover a partir da cor principal). */
export function hexEscurecidoParaRgbString(hex: string, fator = 0.85): string | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!match) return null
  const int = parseInt(match[1], 16)
  const r = Math.round(((int >> 16) & 255) * fator)
  const g = Math.round(((int >> 8) & 255) * fator)
  const b = Math.round((int & 255) * fator)
  return `${r} ${g} ${b}`
}
