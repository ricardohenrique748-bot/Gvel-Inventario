import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { withTimeout } from '@/lib/withTimeout'
import type { Usuario } from '@/lib/types'

const NETWORK_TIMEOUT_MS = 15000

interface AuthContextValue {
  session: Session | null
  user: User | null
  perfil: Usuario | null
  loading: boolean
  perfilLoading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refetchPerfil: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

// Login local temporário, usado enquanto não há projeto Supabase configurado.
// Assim que o .env for preenchido, isSupabaseConfigured passa a ser true e
// esse modo local deixa de ser usado automaticamente.
const LOCAL_STORAGE_KEY = 'gvel_local_session'
const LOCAL_EMAIL = 'admin@gvel.com'
const LOCAL_PASSWORD = 'admin'
const LOCAL_USER = { id: 'local-admin', email: LOCAL_EMAIL } as User
const LOCAL_SESSION = { user: LOCAL_USER } as Session

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [perfil, setPerfil] = useState<Usuario | null>(null)
  const [loading, setLoading] = useState(true)
  const [perfilLoading, setPerfilLoading] = useState(true)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setSession(localStorage.getItem(LOCAL_STORAGE_KEY) === '1' ? LOCAL_SESSION : null)
      setLoading(false)
      return
    }

    withTimeout(supabase.auth.getSession(), NETWORK_TIMEOUT_MS)
      .then(({ data }) => {
        setSession(data.session)
      })
      .catch(() => {
        setSession(null)
      })
      .finally(() => {
        setLoading(false)
      })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => subscription.subscription.unsubscribe()
  }, [])

  const fetchPerfil = useCallback(async () => {
    const userId = session?.user?.id
    if (!isSupabaseConfigured || !userId) {
      setPerfil(null)
      setPerfilLoading(false)
      return
    }
    setPerfilLoading(true)
    try {
      const { data } = await withTimeout(
        supabase.from('usuarios').select('*').eq('id', userId).single(),
        NETWORK_TIMEOUT_MS,
      )
      setPerfil(data ?? null)
    } catch {
      setPerfil(null)
    } finally {
      setPerfilLoading(false)
    }
  }, [session?.user?.id])

  useEffect(() => {
    fetchPerfil()
  }, [fetchPerfil])

  async function signIn(email: string, password: string) {
    if (!isSupabaseConfigured) {
      if (email === LOCAL_EMAIL && password === LOCAL_PASSWORD) {
        localStorage.setItem(LOCAL_STORAGE_KEY, '1')
        setSession(LOCAL_SESSION)
        return { error: null }
      }
      return { error: 'E-mail ou senha inválidos.' }
    }
    try {
      const { error } = await withTimeout(
        supabase.auth.signInWithPassword({ email, password }),
        NETWORK_TIMEOUT_MS,
      )
      return { error: error?.message ?? null }
    } catch {
      return { error: 'Falha de conexão. Verifique sua internet e tente novamente.' }
    }
  }

  async function signOut() {
    if (!isSupabaseConfigured) {
      localStorage.removeItem(LOCAL_STORAGE_KEY)
      setSession(null)
      return
    }
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        perfil,
        loading,
        perfilLoading,
        signIn,
        signOut,
        refetchPerfil: fetchPerfil,
      }}
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
