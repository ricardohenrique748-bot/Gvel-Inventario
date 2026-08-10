import type { TipoVeiculo } from './types'

export const TIPOS_VEICULO: { value: TipoVeiculo; label: string }[] = [
  { value: 'pesado', label: 'Pesado' },
  { value: 'leve', label: 'Leve' },
  { value: 'trator', label: 'Trator' },
  { value: 'carreta', label: 'Carreta' },
]

export function tipoVeiculoLabel(tipo: TipoVeiculo): string {
  return TIPOS_VEICULO.find((t) => t.value === tipo)?.label ?? tipo
}
