import { createContext, useContext, useMemo } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from './AuthContext'

// Fase 1 do multi-empresa: a "empresa ativa" deixou de ser uma lista local
// (localStorage) que qualquer usuário podia trocar livremente — ela agora
// vem sempre do banco, resolvida a partir do usuário autenticado
// (AuthContext → tabela `companies` via `usuarios.company_id`). Um usuário
// só enxerga a própria empresa; não existe mais troca manual de empresa.
//
// A interface pública do hook (`empresas`, `empresaAtiva`, `setEmpresaAtiva`)
// foi mantida por compatibilidade com o Sidebar/Header/Logo existentes, que
// exibem a marca (logo/cor/nome) da empresa atual — só que agora a lista
// sempre tem no máximo 1 item (a própria empresa) e `setEmpresaAtiva` é um
// no-op, já que não há mais nada para trocar.
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
  setEmpresaAtiva: (id: string) => void
}

const EmpresaContext = createContext<EmpresaContextValue | null>(null)

export function EmpresaProvider({ children }: { children: ReactNode }) {
  const { empresa } = useAuth()

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

  function setEmpresaAtiva() {
    // Não há mais troca manual de empresa — a empresa do usuário vem do
    // banco (usuarios.company_id), nunca de uma escolha no frontend.
  }

  return (
    <EmpresaContext.Provider value={{ empresas, empresaAtiva, setEmpresaAtiva }}>
      {children}
    </EmpresaContext.Provider>
  )
}

export function useEmpresa() {
  const ctx = useContext(EmpresaContext)
  if (!ctx) throw new Error('useEmpresa deve ser usado dentro de EmpresaProvider')
  return ctx
}
