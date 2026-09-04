import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { obterNomeCompletoMembro } from '@/constants/equipe'

/**
 * Nomes completos de quem já apontou horas em alguma O.S/checklist — a mesma
 * fonte real usada pelo Indicador de Performance (useControleHoras), só que
 * puxando apenas a coluna `mecanico` (sem os joins pesados) pra servir de
 * sugestão em outras telas (ex: retirada de ferramentas/insumos).
 */
export function useEquipeConhecida() {
  const [nomes, setNomes] = useState<string[]>([])

  useEffect(() => {
    let ativo = true

    async function carregar() {
      const [itensRes, osRes] = await Promise.all([
        supabase.from('checklist_itens').select('mecanico').not('mecanico', 'is', null),
        supabase.from('checklist_os').select('mecanico').not('mecanico', 'is', null),
      ])
      if (!ativo) return

      const set = new Set<string>()
      for (const row of [...(itensRes.data ?? []), ...(osRes.data ?? [])]) {
        const bruto = (row.mecanico || '').trim().toUpperCase()
        if (!bruto || bruto === '—' || bruto === '-' || bruto === 'SEM NOME' || bruto === 'OPCIONAL') continue
        set.add(obterNomeCompletoMembro(bruto))
      }
      setNomes([...set].sort((a, b) => a.localeCompare(b)))
    }

    carregar()
    return () => {
      ativo = false
    }
  }, [])

  return nomes
}
