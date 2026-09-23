import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from './AuthContext'

// Fase 1 do multi-empresa: a "empresa ativa" vem sempre do banco, resolvida
// a partir do usuário autenticado (AuthContext → tabela `companies` via
// `usuarios.company_id`). Um usuário comum só enxerga a própria empresa e
// não tem como trocar. A única exceção é o master admin: `setEmpresaAtiva`
// permite "entrar" em outra empresa cadastrada — o que na prática move o
// `company_id` do próprio usuário master admin, então precisa ser usado com
// cuidado (afeta o próprio login, não é uma visualização paralela). Para
// qualquer outro usuário, `setEmpresaAtiva` não faz nada — o próprio RLS do
// banco bloquearia a tentativa mesmo que o frontend não checasse.
export interface Empresa {
  id: string
  nome: string
  sistemaLabel: string
  cor: string
  cnpj?: string
  observacoes?: string
}

interface EmpresaContextValue {
  empresas: Empresa[]
  empresaAtiva: Empresa | undefined
  trocandoEmpresa: boolean
  setEmpresaAtiva: (id: string) => Promise<void>
}

const EmpresaContext = createContext<EmpresaContextValue | null>(null)

export function EmpresaProvider({ children }: { children: ReactNode }) {
  const { empresa, isMasterAdmin, user } = useAuth()
  const [trocandoEmpresa, setTrocandoEmpresa] = useState(false)

  const empresaAtiva: Empresa | undefined = useMemo(() => {
    if (!empresa) return undefined
    return {
      id: empresa.id,
      nome: empresa.name,
      sistemaLabel: empresa.sistema_label,
      cor: empresa.primary_color,
      cnpj: empresa.cnpj ?? undefined,
      observacoes: empresa.observacoes ?? undefined,
    }
  }, [empresa])

  const empresas = useMemo(() => (empresaAtiva ? [empresaAtiva] : []), [empresaAtiva])

  const setEmpresaAtiva = useCallback(
    async (id: string) => {
      if (!isMasterAdmin || !user?.id || id === empresaAtiva?.id) return
      if (!confirm('Entrar nesta empresa? Sua conta vai passar a pertencer a ela até você trocar de novo.')) {
        return
      }
      setTrocandoEmpresa(true)
      try {
        const { error } = await supabase.from('usuarios').update({ company_id: id }).eq('id', user.id)
        if (error) throw error
        // Recarrega a página inteira em vez de só atualizar o estado local:
        // garante que os ~32 hooks que buscam dados do sistema (veículos,
        // financeiro, etc.) façam a busca de novo já filtrados pela nova
        // empresa, sem precisar fazer cada um reagir a essa troca.
        window.location.href = '/'
      } catch (err) {
        setTrocandoEmpresa(false)
        alert(err instanceof Error ? err.message : 'Não foi possível trocar de empresa.')
      }
    },
    [isMasterAdmin, user?.id, empresaAtiva?.id],
  )

  return (
    <EmpresaContext.Provider value={{ empresas, empresaAtiva, trocandoEmpresa, setEmpresaAtiva }}>
      {children}
    </EmpresaContext.Provider>
  )
}

export function useEmpresa() {
  const ctx = useContext(EmpresaContext)
  if (!ctx) throw new Error('useEmpresa deve ser usado dentro de EmpresaProvider')
  return ctx
}
