import { VEICULOS_FROTA_BASE } from '@/data/veiculosFrotaPadrao'

// v2: bump de versão pra forçar re-sincronização com os dados oficiais depois
// de uma correção em massa nas datas de CRLV/tacógrafo/seguro (setembro/2026)
// — sem isso, o cache antigo do navegador continuaria vencendo sobre os
// valores corrigidos (a mesclagem sempre prioriza o que já está salvo local).
export const STORAGE_FROTAS_KEY = 'gvel_frotas_cadastradas_v2'

/** Lê as placas da frota cadastrada (Gestão de Frotas) para autocomplete em
 * outras telas (ex: baixa de estoque). Usa o cache local que a página de
 * Frotas mantém; se ainda não rodou nesta sessão/dispositivo, cai para a
 * lista oficial de veículos (leve + pesado + embarcado). */
export function getPlacasFrotaCadastrada(): { id: string; placa: string }[] {
  try {
    const raw = localStorage.getItem(STORAGE_FROTAS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
          .filter((v: any) => v?.placa)
          .map((v: any) => ({ id: v.id, placa: String(v.placa).toUpperCase().trim() }))
      }
    }
  } catch {}
  return VEICULOS_FROTA_BASE.map((v) => ({ id: v.id, placa: v.placa.toUpperCase().trim() }))
}
