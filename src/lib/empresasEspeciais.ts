import type { Company } from '@/lib/types'

/**
 * Empresas com comportamento próprio no sistema.
 *
 * A Localiza Pesados usa só o Inventário de Caminhões (pátio),
 * com visual próprio (verde/laranja, logo e fonte Poppins — ver `marca-localiza`
 * em index.css) e SEM clientes: a frota é dela, então o cliente é opcional na
 * entrada e o dashboard agrupa por pátio. Criada na migration 0098.
 */
export const LOCALIZA_COMPANY_ID = '81775591-b128-476e-b630-bc88f068c6ae'

type EmpresaRef = Pick<Company, 'id'> | { id: string } | null | undefined

export function isLocaliza(empresa: EmpresaRef): boolean {
  return empresa?.id === LOCALIZA_COMPANY_ID
}

/**
 * Empresas que não aparecem no seletor de empresa do app (APK).
 * VelContracker só é usada pela web, então fica fora do celular.
 */
export function ocultaNoApp(empresa: { nome?: string } | null | undefined): boolean {
  return /velcontracker/i.test(empresa?.nome ?? '')
}

/** A empresa trabalha com clientes (dono do veículo)? Na Localiza, não. */
export function empresaUsaClientes(empresa: EmpresaRef): boolean {
  return !isLocaliza(empresa)
}
