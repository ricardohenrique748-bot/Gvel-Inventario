import { createContext, useContext, useState, useCallback } from 'react'
import type { ReactNode } from 'react'

export interface Empresa {
  id: string
  nome: string
  sistemaLabel: string
  cor: string
  cnpj?: string
  observacoes?: string
}

const STORAGE_EMPRESAS_KEY = 'gvel_empresas'
const STORAGE_EMPRESA_ATIVA_KEY = 'gvel_empresa_ativa_id'

const EMPRESAS_PADRAO: Empresa[] = [
  {
    id: 'gvel_diesel',
    nome: 'GVel Diesel',
    sistemaLabel: 'CENTER TRUCK',
    cor: '#E23B2E',
    cnpj: '',
    observacoes: 'Empresa principal do Grupo GVEL',
  },
]

function loadEmpresas(): Empresa[] {
  try {
    const saved = localStorage.getItem(STORAGE_EMPRESAS_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch {}
  return EMPRESAS_PADRAO
}

function loadEmpresaAtivaId(empresas: Empresa[]): string {
  try {
    const saved = localStorage.getItem(STORAGE_EMPRESA_ATIVA_KEY)
    if (saved && empresas.some((e) => e.id === saved)) return saved
  } catch {}
  return empresas[0]?.id ?? ''
}

interface EmpresaContextValue {
  empresas: Empresa[]
  empresaAtiva: Empresa | undefined
  setEmpresaAtiva: (id: string) => void
  adicionarEmpresa: (empresa: Omit<Empresa, 'id'>) => void
  atualizarEmpresa: (id: string, dados: Partial<Omit<Empresa, 'id'>>) => void
  excluirEmpresa: (id: string) => void
}

const EmpresaContext = createContext<EmpresaContextValue | null>(null)

export function EmpresaProvider({ children }: { children: ReactNode }) {
  const [empresas, setEmpresas] = useState<Empresa[]>(() => loadEmpresas())
  const [empresaAtivaId, setEmpresaAtivaId] = useState<string>(() =>
    loadEmpresaAtivaId(loadEmpresas()),
  )

  const empresaAtiva = empresas.find((e) => e.id === empresaAtivaId) ?? empresas[0]

  const persistEmpresas = useCallback((novas: Empresa[]) => {
    setEmpresas(novas)
    try {
      localStorage.setItem(STORAGE_EMPRESAS_KEY, JSON.stringify(novas))
    } catch {}
  }, [])

  const setEmpresaAtiva = useCallback((id: string) => {
    setEmpresaAtivaId(id)
    try {
      localStorage.setItem(STORAGE_EMPRESA_ATIVA_KEY, id)
    } catch {}
  }, [])

  const adicionarEmpresa = useCallback(
    (dados: Omit<Empresa, 'id'>) => {
      const id = `empresa_${Date.now()}`
      const nova: Empresa = { id, ...dados }
      persistEmpresas([...empresas, nova])
    },
    [empresas, persistEmpresas],
  )

  const atualizarEmpresa = useCallback(
    (id: string, dados: Partial<Omit<Empresa, 'id'>>) => {
      persistEmpresas(empresas.map((e) => (e.id === id ? { ...e, ...dados } : e)))
    },
    [empresas, persistEmpresas],
  )

  const excluirEmpresa = useCallback(
    (id: string) => {
      if (empresas.length <= 1) return
      const novas = empresas.filter((e) => e.id !== id)
      persistEmpresas(novas)
      if (empresaAtivaId === id) {
        setEmpresaAtiva(novas[0].id)
      }
    },
    [empresas, empresaAtivaId, persistEmpresas, setEmpresaAtiva],
  )

  return (
    <EmpresaContext.Provider
      value={{
        empresas,
        empresaAtiva,
        setEmpresaAtiva,
        adicionarEmpresa,
        atualizarEmpresa,
        excluirEmpresa,
      }}
    >
      {children}
    </EmpresaContext.Provider>
  )
}

export function useEmpresa() {
  const ctx = useContext(EmpresaContext)
  if (!ctx) throw new Error('useEmpresa deve ser usado dentro de EmpresaProvider')
  return ctx
}
