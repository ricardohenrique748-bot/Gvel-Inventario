import { Link } from 'react-router-dom'
import { ShieldAlert, Home } from 'lucide-react'
import { Dashboard } from '@/pages/Dashboard'
import { useAuth } from '@/contexts/AuthContext'
import { isInventarioCaminhoesAuthorized } from '@/components/layout/nav'

export function InventarioCaminhoes() {
  const { user, perfil, perfilLoading } = useAuth()
  const autorizado = isInventarioCaminhoesAuthorized(perfil || { email: user?.email })

  if (!perfilLoading && !autorizado) {
    return (
      <div className="flex min-h-[65vh] flex-col items-center justify-center p-6 text-center animate-fade-in uppercase">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-red-500/15 border border-red-500/30 text-red-400 mb-4 shadow-2xl shadow-red-500/10">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h2 className="text-lg font-black text-foreground mb-1">ACESSO RESTRITO AO INVENTÁRIO DE CAMINHÕES</h2>
        <p className="text-xs text-secondary font-medium max-w-md mb-6 lowercase">
          Esta área é exclusiva para usuários autorizados.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-2xl bg-surface border border-border/30 px-5 py-2.5 text-xs font-bold text-foreground hover:bg-surface-hover transition-colors shadow-lg"
        >
          <Home className="h-4 w-4 text-primary" />
          VOLTAR PARA A HOME
        </Link>
      </div>
    )
  }

  return <Dashboard />
}
