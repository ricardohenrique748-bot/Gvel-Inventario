import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { apiGet, apiPost, clearToken, getToken, setToken } from '@/lib/api'
import type { Usuario } from '@/lib/types'

interface AuthContextValue {
  session: { usuario: Usuario } | null
  user: Usuario | null
  loading: boolean
  signIn: (email: string, senha: string) => Promise<{ error: string | null }>
  signOut: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!getToken()) {
      setLoading(false)
      return
    }
    apiGet<Usuario>('/auth/me').then(({ data, error }) => {
      if (error || !data) {
        clearToken()
        setUsuario(null)
      } else {
        setUsuario(data)
      }
      setLoading(false)
    })
  }, [])

  async function signIn(email: string, senha: string) {
    const { data, error } = await apiPost<{ token: string; usuario: Usuario }>('/auth/login', {
      email,
      senha,
    })
    if (error || !data) return { error: error?.message ?? 'Erro ao entrar.' }
    setToken(data.token)
    setUsuario(data.usuario)
    return { error: null }
  }

  function signOut() {
    clearToken()
    setUsuario(null)
  }

  return (
    <AuthContext.Provider
      value={{ session: usuario ? { usuario } : null, user: usuario, loading, signIn, signOut }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}
