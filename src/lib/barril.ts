import barril100 from '@/assets/barril/barril-100.png'
import barril50 from '@/assets/barril/barril-50.png'
import barril35 from '@/assets/barril/barril-35.png'
import barril12 from '@/assets/barril/barril-12.png'
import barril05 from '@/assets/barril/barril-05.png'
import barril00 from '@/assets/barril/barril-00.png'

/**
 * Escolhe a ilustração de barril mais próxima do nível de líquido restante,
 * usada no indicador visual de "Uso e Consumo" (ex: barril de óleo).
 */
export function frameBarrilPorPercentual(percentual: number): string {
  const pct = Math.max(0, Math.min(100, percentual))
  if (pct >= 85) return barril100
  if (pct >= 45) return barril50
  if (pct >= 25) return barril35
  if (pct >= 8) return barril12
  if (pct > 0) return barril05
  return barril00
}

export function percentualBarril(quantidadeAtual: number, capacidadeMaxima: number): number {
  if (!capacidadeMaxima || capacidadeMaxima <= 0) return 0
  return Math.round((quantidadeAtual / capacidadeMaxima) * 100)
}
