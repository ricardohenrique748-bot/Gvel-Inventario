import { getErrorMessage } from '@/lib/erros'

/**
 * Mensagem legível para os erros do módulo de Consumo. Erro do Supabase é
 * objeto simples (não `Error`), por isso o getErrorMessage. Coluna/tabela
 * inexistente = banco sem a migration 0090: diz isso em vez do texto técnico.
 */
export function erroConsumo(err: unknown, fallback: string): string {
  const msg = getErrorMessage(err, fallback)
  if (/does not exist|schema cache|could not find the (table|column)/i.test(msg)) {
    return `O banco ainda não tem a estrutura do módulo de Consumo — aplique a migration 0090 no Supabase. (${msg})`
  }
  return msg
}
