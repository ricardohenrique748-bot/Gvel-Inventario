import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface DivisaoEmpresaData {
  id: string
  nome: string
  faturamento: number
  receitas: number
  despesas: number
}

/** As 5 divisões que o painel "Visão Geral" da GVEL já conhece — a importação
 * só reconhece essas (mesmo id/nome usados hoje em DADOS_MESES). */
export const DIVISOES_CONHECIDAS: { id: string; nomes: string[] }[] = [
  { id: 'gvel', nomes: ['gvel diesel', 'gvel'] },
  { id: 'leves', nomes: ['gvel leves', 'leves'] },
  { id: 'distribuidora', nomes: ['gv distribuidora', 'distribuidora'] },
  { id: 'transportes', nomes: ['gv transportes', 'transportes'] },
  { id: 'investimento', nomes: ['investimento'] },
]

function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
}

export function mapearDivisao(nomeExcel: string): { id: string; nome: string } | null {
  const n = normalizar(nomeExcel)
  for (const d of DIVISOES_CONHECIDAS) {
    if (d.nomes.some((alt) => normalizar(alt) === n)) {
      // Mantém o nome "bonito" já usado na tela hoje.
      const nomesBonitos: Record<string, string> = {
        gvel: 'GVel Diesel',
        leves: 'GVel Leves',
        distribuidora: 'GV Distribuidora',
        transportes: 'GV Transportes',
        investimento: 'Investimento',
      }
      return { id: d.id, nome: nomesBonitos[d.id] }
    }
  }
  return null
}

/** Busca as divisões salvas no banco, organizadas por mês — só as empresas que já foram importadas. */
export function useEmpresasDivisoesOverrides() {
  const [overrides, setOverrides] = useState<Record<string, DivisaoEmpresaData[]>>({})
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('painel_gerencial_divisoes').select('*')
    if (!error && data) {
      const porMes: Record<string, DivisaoEmpresaData[]> = {}
      for (const row of data) {
        if (!porMes[row.mes]) porMes[row.mes] = []
        porMes[row.mes].push({
          id: row.divisao_id,
          nome: row.divisao_nome,
          faturamento: Number(row.faturamento) || 0,
          receitas: Number(row.receitas) || 0,
          despesas: Number(row.despesas) || 0,
        })
      }
      setOverrides(porMes)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { overrides, loading, refetch }
}

/** Importa (substitui) os dados de um mês inteiro de uma vez — apaga o que já existia daquele mês e grava de novo. */
export async function importarDivisoesDoMes(mes: string, divisoes: DivisaoEmpresaData[]): Promise<void> {
  const { error: deleteError } = await supabase.from('painel_gerencial_divisoes').delete().eq('mes', mes)
  if (deleteError) throw deleteError

  if (divisoes.length === 0) return

  const { error: insertError } = await supabase.from('painel_gerencial_divisoes').insert(
    divisoes.map((d) => ({
      mes,
      divisao_id: d.id,
      divisao_nome: d.nome,
      faturamento: d.faturamento,
      receitas: d.receitas,
      despesas: d.despesas,
    })),
  )
  if (insertError) throw insertError
}

/** Mesma coisa, mas pra uma planilha que já traz vários meses juntos. */
export async function importarDivisoesVariosMeses(porMes: Record<string, DivisaoEmpresaData[]>): Promise<void> {
  for (const [mes, divisoes] of Object.entries(porMes)) {
    await importarDivisoesDoMes(mes, divisoes)
  }
}
