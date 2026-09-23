import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { isSupabaseConfigured } from '@/lib/supabase'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading, perfil, perfilLoading, empresa } = useAuth()
  const location = useLocation()

  if (loading || (session && perfilLoading)) {
    return (
      <div className="min-h-svh flex items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-secondary/30 border-t-primary" />
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  // Sessão válida mas sem empresa resolvida (perfil apagado, ou empresa
  // desativada pelo admin master) — nunca deixa renderizar a aplicação num
  // estado sem empresa, que é justamente o que abriria brecha pra dado
  // vazar sem isolamento nenhum.
  if (isSupabaseConfigured && !perfilLoading && (!perfil || (empresa && empresa.status === 'inactive'))) {
    return (
      <div className="min-h-svh flex flex-col items-center justify-center gap-3 bg-background px-4 text-center">
        <p className="text-sm font-semibold text-foreground">Acesso indisponível</p>
        <p className="max-w-sm text-xs text-secondary">
          {!perfil
            ? 'Não encontramos um cadastro de usuário vinculado a esta conta. Fale com o administrador do sistema.'
            : 'A empresa vinculada a este usuário está desativada. Fale com o administrador do sistema.'}
        </p>
      </div>
    )
  }

  if (perfil?.deve_trocar_senha && location.pathname !== '/trocar-senha') {
    return <Navigate to="/trocar-senha" replace />
  }

  return <>{children}</>
}
