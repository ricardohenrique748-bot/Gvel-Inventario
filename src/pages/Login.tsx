import { useEffect, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Eye,
  EyeOff,
  Loader2,
  Truck,
  LayoutDashboard,
  ArrowLeftRight,
  ClipboardCheck,
  Users,
  FileBarChart,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Logo } from '@/components/ui/Logo'
import { Button } from '@/components/ui/Button'
import { Input, Label, FieldError } from '@/components/ui/Input'
import { isSupabaseConfigured } from '@/lib/supabase'
import { isNativeApp } from '@/lib/isNativeApp'
import { cn } from '@/lib/cn'
import { BrandSplash, BRAND_SPLASH_MS } from '@/components/BrandSplash'

const REMEMBER_KEY = 'gvel_remember_credentials'

const ORBIT_ICONS = [
  { Icon: LayoutDashboard, top: 8, left: 128 },
  { Icon: ArrowLeftRight, top: 90, left: 240 },
  { Icon: ClipboardCheck, top: 224, left: 197 },
  { Icon: Users, top: 224, left: 59 },
  { Icon: FileBarChart, top: 90, left: 16 },
]

export function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showWelcome, setShowWelcome] = useState(false)

  const from = (location.state as { from?: string } | null)?.from ?? '/'

  useEffect(() => {
    const saved = localStorage.getItem(REMEMBER_KEY)
    if (saved) {
      try {
        const { email: savedEmail, password: savedPassword } = JSON.parse(saved) as {
          email: string
          password: string
        }
        setEmail(savedEmail)
        setPassword(savedPassword)
        setRememberMe(true)
      } catch {
        localStorage.removeItem(REMEMBER_KEY)
      }
    }
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await signIn(email, password)
    setLoading(false)
    if (error) {
      setError(error)
      return
    }
    if (rememberMe) {
      localStorage.setItem(REMEMBER_KEY, JSON.stringify({ email, password }))
    } else {
      localStorage.removeItem(REMEMBER_KEY)
    }

    if (isNativeApp()) {
      setShowWelcome(true)
      setTimeout(() => navigate(from, { replace: true }), BRAND_SPLASH_MS)
    } else {
      navigate(from, { replace: true })
    }
  }

  if (showWelcome) {
    return <BrandSplash />
  }

  return (
    <div className="relative min-h-svh flex items-center justify-center bg-background px-4 py-10 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-24 h-80 w-80 rounded-full bg-primary/30 blur-3xl animate-blob" />
        <div
          className="absolute top-1/3 -right-24 h-96 w-96 rounded-full bg-primary/20 blur-3xl animate-blob"
          style={{ animationDelay: '2s' }}
        />
        <div
          className="absolute -bottom-24 left-1/3 h-80 w-80 rounded-full bg-white/10 blur-3xl animate-blob"
          style={{ animationDelay: '4s' }}
        />
      </div>

      <div className="relative w-full max-w-sm md:max-w-4xl mx-auto grid md:grid-cols-2 rounded-3xl border border-white/10 overflow-hidden animate-fade-in-up shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5),inset_0_1px_0_0_rgba(255,255,255,0.15)]">
        {/* Left: form */}
        <div className="flex flex-col p-8 sm:p-10 md:p-12 bg-surface">
          <div className="flex-1 flex flex-col justify-center w-full max-w-xs mx-auto">
            <div className="mb-8 flex justify-center animate-scale-in">
              <Logo size="lg" stacked />
            </div>

            {!isSupabaseConfigured && (
              <p className="mb-4 rounded-xl border border-status-warning/30 bg-status-warning/10 px-3 py-2 text-xs text-status-warning animate-fade-in">
                Modo local de desenvolvimento: entre com admin@gvel.com / admin.
              </p>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="!bg-white/5 !border-white/15 backdrop-blur-sm transition-all duration-200 hover:!border-white/25 focus:!ring-2 focus:!ring-primary/60 focus:shadow-[0_0_0_6px_rgba(226,59,46,0.15)]"
                />
              </div>
              <div>
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="!bg-white/5 !border-white/15 backdrop-blur-sm pr-11 transition-all duration-200 hover:!border-white/25 focus:!ring-2 focus:!ring-primary/60 focus:shadow-[0_0_0_6px_rgba(226,59,46,0.15)]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-0 top-0 h-12 w-11 flex items-center justify-center rounded-lg text-secondary hover:text-white hover:bg-white/5 active:scale-90 transition-all duration-150"
                    tabIndex={-1}
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer select-none group">
                <span
                  className={cn(
                    'relative h-[18px] w-[18px] shrink-0 rounded-md border transition-all duration-150 group-hover:scale-110 group-active:scale-95',
                    rememberMe
                      ? 'bg-primary border-primary shadow-[0_0_0_3px_rgba(226,59,46,0.2)]'
                      : 'bg-white/5 border-white/20 group-hover:border-white/40',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <svg
                    viewBox="0 0 16 16"
                    fill="none"
                    className={cn(
                      'absolute inset-0 h-full w-full p-0.5 text-white transition-all duration-150',
                      rememberMe ? 'scale-100 opacity-100' : 'scale-50 opacity-0',
                    )}
                  >
                    <path
                      d="M3.5 8.5L6.5 11.5L12.5 4.5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span className="text-sm text-secondary transition-colors duration-150 group-hover:text-white/90">
                  Lembrar e-mail e senha
                </span>
              </label>

              <div className={cn(error && 'animate-shake')}>
                <FieldError message={error ?? undefined} />
              </div>
              <Button
                type="submit"
                className="w-full !transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/40 active:translate-y-0 active:scale-[0.98]"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Entrando…
                  </>
                ) : (
                  'Entrar'
                )}
              </Button>
            </form>
          </div>
        </div>

        {/* Right: brand panel */}
        <div className="hidden md:flex relative flex-col justify-between overflow-hidden bg-gradient-to-br from-primary/85 via-primary-hover/85 to-[#1c1c1c]/85 backdrop-blur-2xl p-10 text-white">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -top-16 -right-10 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute bottom-0 -left-10 h-64 w-64 rounded-full bg-black/20 blur-3xl" />
          </div>

          <h2 className="relative z-10 text-2xl font-bold leading-snug">
            Controle total do seu <span className="text-status-warning">pátio</span>
          </h2>

          <div className="relative z-10 flex flex-1 items-center justify-center py-8">
            <div className="relative h-64 w-64">
              <div className="absolute inset-0 rounded-full border border-white/20 animate-spin-slow" />
              <div className="absolute inset-8 rounded-full border border-dashed border-white/15 animate-spin-slow-reverse" />

              <div className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white shadow-lg flex items-center justify-center">
                <span className="absolute inset-0 rounded-2xl bg-white/40 animate-ping" />
                <Truck className="relative h-8 w-8 text-primary" />
              </div>

              {ORBIT_ICONS.map(({ Icon, top, left }, i) => (
                <div
                  key={i}
                  className="absolute h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-md flex items-center justify-center animate-float"
                  style={{ top, left, animationDelay: `${i * 0.4}s` }}
                >
                  <Icon className="h-[18px] w-[18px] text-primary" />
                </div>
              ))}
            </div>
          </div>

          <div className="relative z-10 text-center">
            <p className="text-xs text-white/80">
              Do check-in ao relatório final — checklist, fotos e assinatura em um só lugar.
            </p>
            <div className="mt-4 flex items-center justify-center gap-1.5">
              <span className="h-1.5 w-6 rounded-full bg-white/80" />
              <span className="h-1.5 w-1.5 rounded-full bg-white/30" />
              <span className="h-1.5 w-1.5 rounded-full bg-white/30" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
