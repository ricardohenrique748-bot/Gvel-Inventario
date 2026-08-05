import { createClient } from '@supabase/supabase-js'

const supabaseUrl =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ||
  'https://njuncnhzkiajtcnemblx.supabase.co'

const supabaseAnonKey =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qdW5jbmh6a2lhanRjbmVtYmx4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4NDI4MTQsImV4cCI6MjEwMTQxODgxNH0.tW3zSCLXlHf1UTpO-tFGUmcr4HGkVlkGlAXM6KaUk5A'

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

if (!isSupabaseConfigured) {
  console.warn(
    '[Gvel Diesel] Supabase não configurado. Preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env (veja .env.example).',
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
})

export const FOTOS_BUCKET = 'fotos-inspecao'
export const ASSINATURAS_BUCKET = 'assinaturas'

