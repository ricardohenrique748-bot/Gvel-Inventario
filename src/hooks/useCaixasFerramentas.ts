import { supabase } from '@/lib/supabase'
import type { CaixaFerramenta } from '@/pages/InventarioFerramentas'

// Caixas de ferramentas no Supabase (tabela caixas_ferramentas, migration 0112).
// Antes ficavam só no localStorage do aparelho onde foram cadastradas.

export async function buscarCaixasSupabase(): Promise<CaixaFerramenta[]> {
  const { data, error } = await supabase.from('caixas_ferramentas').select('id, dados')
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({ ...(row.dados as CaixaFerramenta), id: row.id as string }))
}

export async function salvarCaixasSupabase(caixas: CaixaFerramenta[]): Promise<void> {
  if (caixas.length === 0) return
  const { error } = await supabase.from('caixas_ferramentas').upsert(
    caixas.map((c) => ({ id: c.id, dados: c, updated_at: new Date().toISOString() })),
    { onConflict: 'id' },
  )
  if (error) throw new Error(error.message)
}

export async function excluirCaixasSupabase(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const { error } = await supabase.from('caixas_ferramentas').delete().in('id', ids)
  if (error) throw new Error(error.message)
}
