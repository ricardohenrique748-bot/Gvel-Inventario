import type { TipoVeiculo } from './types'

export type AnguloFoto = 'frente' | 'ladoEsquerdo' | 'ladoDireito' | 'traseira' | 'painel'

export const ANGULOS_FOTO: { campo: AnguloFoto; label: string }[] = [
  { campo: 'frente', label: 'Frente' },
  { campo: 'ladoEsquerdo', label: 'Lado esquerdo' },
  { campo: 'ladoDireito', label: 'Lado direito' },
  { campo: 'traseira', label: 'Traseira' },
  { campo: 'painel', label: 'Painel' },
]

/** Fotos exigidas na saída do veículo. Carreta não tem painel. */
export function angulosObrigatoriosSaida(tipo: TipoVeiculo | null | undefined): AnguloFoto[] {
  return ANGULOS_FOTO.map((a) => a.campo).filter((campo) => !(campo === 'painel' && tipo === 'carreta'))
}
