import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { isModuloAuthorized } from '@/components/layout/nav'
import { temAcessoModuloEmpresa } from '@/lib/permissoes'

// A rota "/" sempre foi o Dashboard do Pátio (parte do módulo Inventário de
// Caminhões). Isso fazia sentido enquanto só existia a GVEL, mas numa
// empresa que nem usa esse módulo (ex.: Pedrão, só com Dashboard Gerencial
// + Financeiro), cair direto nessa tela vazia/irrelevante é confuso. Esta
// ordem de prioridade decide pra onde mandar o usuário ao entrar no
// sistema, dependendo do que está liberado pra empresa + usuário dele.
const ORDEM_FALLBACK: { moduloId: string; rota: string | null }[] = [
  { moduloId: 'inventario_caminhoes', rota: null }, // null = fica no próprio Dashboard do Pátio
  { moduloId: 'dashboard_gerencial', rota: '/dashboard-gerencial' },
  { moduloId: 'financeiro', rota: '/financeiro' },
  { moduloId: 'manutencao', rota: '/manutencao' },
  { moduloId: 'frotas', rota: '/frotas' },
  { moduloId: 'estoque', rota: '/inventario-ferramentas' },
  { moduloId: 'rh', rota: '/rh' },
  { moduloId: 'configuracoes', rota: '/configuracoes' },
]

function BemVindoGenerico() {
  const { perfil } = useAuth()
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-2 text-center px-4">
      <p className="text-xl font-bold text-foreground">Bem-vindo, {perfil?.nome || 'usuário'}!</p>
      <p className="max-w-sm text-sm text-secondary">
        Fale com o administrador da sua empresa para liberar o acesso aos módulos do sistema.
      </p>
    </div>
  )
}

export function HomeRedirect({ children }: { children: ReactNode }) {
  const { perfil, perfilLoading, empresa } = useAuth()

  if (perfilLoading) return null

  for (const { moduloId, rota } of ORDEM_FALLBACK) {
    if (isModuloAuthorized(perfil, moduloId) && temAcessoModuloEmpresa(empresa, moduloId)) {
      return rota ? <Navigate to={rota} replace /> : <>{children}</>
    }
  }

  return <BemVindoGenerico />
}
