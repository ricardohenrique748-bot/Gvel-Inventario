import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type { Usuario } from '@/lib/types'

interface AuthContextValue {
  session: Session | null
  user: User | null
  perfil: Usuario | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
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

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setSession(localStorage.getItem(LOCAL_STORAGE_KEY) === '1' ? LOCAL_SESSION : null)
      setLoading(false)
      return
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => subscription.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const userId = session?.user?.id
    if (!isSupabaseConfigured || !userId) {
      setPerfil(null)
      return
    }
    supabase
      .from('usuarios')
      .select('*')
      .eq('id', userId)
      .single()
      .then(({ data }) => setPerfil(data ?? null))
  }, [session?.user?.id])

  async function signIn(email: string, password: string) {
    if (!isSupabaseConfigured) {
      if (email === LOCAL_EMAIL && password === LOCAL_PASSWORD) {
        localStorage.setItem(LOCAL_STORAGE_KEY, '1')
        setSession(LOCAL_SESSION)
        return { error: null }
      }
      return { error: 'E-mail ou senha inválidos.' }
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
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
    <AuthContext.Provider value={{ session, user: session?.user ?? null, perfil, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}
