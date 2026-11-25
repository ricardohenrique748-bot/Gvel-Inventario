import type { BadgeTone } from '@/components/ui/Badge'

/**
 * Situação do veículo. No banco são dois campos (migration 0114):
 *   - operante (boolean)
 *   - sinistro (boolean) — veículo sinistrado; sempre conta como NÃO operante,
 *     então filtros/contagens antigas de "inoperante" continuam corretos.
 */
export type SituacaoVeiculo = 'operante' | 'inoperante' | 'sinistro'

type ComSituacao = { operante?: boolean | null; sinistro?: boolean | null } | null | undefined

export function situacaoDoVeiculo(v: ComSituacao): SituacaoVeiculo {
  if (v?.sinistro) return 'sinistro'
  return v?.operante === false ? 'inoperante' : 'operante'
}

export const ROTULO_SITUACAO: Record<SituacaoVeiculo, string> = {
  operante: 'Operante',
  inoperante: 'Inoperante',
  sinistro: 'Sinistro',
}

export const TOM_SITUACAO: Record<SituacaoVeiculo, BadgeTone> = {
  operante: 'success',
  inoperante: 'danger',
  sinistro: 'warning',
}

/** Campos a gravar no banco para a situação escolhida. */
export function camposSituacao(s: SituacaoVeiculo): { operante: boolean; sinistro: boolean } {
  return { operante: s === 'operante', sinistro: s === 'sinistro' }
}
