export function percentualBarril(quantidadeAtual: number, capacidadeMaxima: number): number {
  if (!capacidadeMaxima || capacidadeMaxima <= 0) return 0
  return Math.round((quantidadeAtual / capacidadeMaxima) * 100)
}
