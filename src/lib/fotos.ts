import type { FotosEntrada } from '@/hooks/useMovimentacoes'

export type AnguloFoto = keyof FotosEntrada

export const ANGULOS_FOTO: { campo: AnguloFoto; label: string }[] = [
  { campo: 'frente', label: 'Frente' },
  { campo: 'ladoEsquerdo', label: 'Lado esquerdo' },
  { campo: 'ladoDireito', label: 'Lado direito' },
  { campo: 'traseira', label: 'Traseira' },
  { campo: 'painel', label: 'Painel' },
]
