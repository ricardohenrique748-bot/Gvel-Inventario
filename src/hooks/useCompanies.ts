import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useEmpresa, type Empresa } from '@/contexts/EmpresaContext'
import type { Company, CompanyStatus } from '@/lib/types'

// CRUD de empresas (tabela `companies`). O RLS decide o que cada chamada
// realmente enxerga/altera (ver supabase/migrations/0072_multiempresa_companies.sql):
// um usuário comum só vê a própria empresa; master admin vê e cria todas;
// admin de empresa só edita a própria. O frontend nunca decide isso sozinho.
export function useCompanies() {
  const [empresas, setEmpresas] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('companies').select('*').order('name')
    if (error) {
      setError(error.message)
    } else {
      setEmpresas(data ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { empresas, loading, error, refetch }
}

function empresaFromCompany(c: Company): Empresa {
  return {
    id: c.id,
    nome: c.name,
    sistemaLabel: c.sistema_label,
    cor: c.primary_color,
    cnpj: c.cnpj ?? undefined,
    observacoes: c.observacoes ?? undefined,
  }
}

/**
 * Lista de empresas pra exibição em seletores. Usuário comum e admin de
 * empresa só enxergam a própria (igual useEmpresa()); master admin vê todas
 * as cadastradas na plataforma — só pra referência/exibição, não muda qual
 * empresa está de fato filtrando os dados da tela (isso continua sendo
 * sempre a empresa do usuário logado, resolvida pelo banco).
 */
export function useEmpresasVisiveis(): Empresa[] {
  const { isMasterAdmin } = useAuth()
  const { empresas: minhaEmpresa } = useEmpresa()
  const { empresas: todasEmpresas } = useCompanies()
  return isMasterAdmin ? todasEmpresas.map(empresaFromCompany) : minhaEmpresa
}

export interface CriarEmpresaInput {
  name: string
  cnpj?: string
  sistema_label: string
  primary_color: string
  secondary_color?: string
  logo?: string
  observacoes?: string
}

export async function criarEmpresa(input: CriarEmpresaInput): Promise<Company> {
  const { data, error } = await supabase
    .from('companies')
    .insert({
      name: input.name,
      cnpj: input.cnpj || null,
      sistema_label: input.sistema_label,
      primary_color: input.primary_color,
      secondary_color: input.secondary_color || null,
      logo: input.logo || null,
      observacoes: input.observacoes || null,
    })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as Company
}

export interface AtualizarEmpresaInput extends Partial<CriarEmpresaInput> {
  status?: CompanyStatus
}

export async function atualizarEmpresa(id: string, input: AtualizarEmpresaInput): Promise<Company> {
  const payload: Record<string, unknown> = {}
  if (input.name !== undefined) payload.name = input.name
  if (input.cnpj !== undefined) payload.cnpj = input.cnpj || null
  if (input.sistema_label !== undefined) payload.sistema_label = input.sistema_label
  if (input.primary_color !== undefined) payload.primary_color = input.primary_color
  if (input.secondary_color !== undefined) payload.secondary_color = input.secondary_color || null
  if (input.logo !== undefined) payload.logo = input.logo || null
  if (input.observacoes !== undefined) payload.observacoes = input.observacoes || null
  if (input.status !== undefined) payload.status = input.status

  const { data, error } = await supabase.from('companies').update(payload).eq('id', id).select().single()
  if (error) throw new Error(error.message)
  return data as Company
}

export async function excluirEmpresa(id: string): Promise<void> {
  const { error } = await supabase.from('companies').delete().eq('id', id)
  if (error) {
    if (error.code === '23503') {
      throw new Error('Não é possível excluir: esta empresa já possui dados cadastrados (usuários, veículos, etc.).')
    }
    throw new Error(error.message)
  }
}
