/**
 * Extrai uma mensagem legível de qualquer erro capturado. Erros do
 * Supabase (PostgrestError, StorageError) são objetos simples com
 * `.message` — não instâncias de `Error` — então um `err instanceof Error`
 * sozinho não pega a mensagem real e sempre cai no fallback genérico.
 */
export function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message
  if (err && typeof err === 'object' && 'message' in err) {
    const msg = (err as { message: unknown }).message
    if (typeof msg === 'string' && msg.trim()) return msg
  }
  if (typeof err === 'string' && err.trim()) return err
  return fallback
}
