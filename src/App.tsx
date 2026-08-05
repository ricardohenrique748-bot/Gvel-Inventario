import { lazy, Suspense, useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { SplashScreen } from '@capacitor/splash-screen'
import { AuthProvider } from '@/contexts/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { AppLayout } from '@/components/layout/AppLayout'
import { Login } from '@/pages/Login'
import { OrbitSplash, ORBIT_SPLASH_MS } from '@/components/OrbitSplash'
import { isNativeApp } from '@/lib/isNativeApp'

const TrocarSenha = lazy(() => import('@/pages/TrocarSenha').then((m) => ({ default: m.TrocarSenha })))
const Dashboard = lazy(() => import('@/pages/Dashboard').then((m) => ({ default: m.Dashboard })))
const Movimentacoes = lazy(() => import('@/pages/Movimentacoes').then((m) => ({ default: m.Movimentacoes })))
const RegistrarEntrada = lazy(() =>
  import('@/pages/RegistrarEntrada').then((m) => ({ default: m.RegistrarEntrada })),
)
const VeiculoDetalhe = lazy(() => import('@/pages/VeiculoDetalhe').then((m) => ({ default: m.VeiculoDetalhe })))
const Clientes = lazy(() => import('@/pages/Clientes').then((m) => ({ default: m.Clientes })))
const ClienteDetalhe = lazy(() => import('@/pages/ClienteDetalhe').then((m) => ({ default: m.ClienteDetalhe })))
const Relatorios = lazy(() => import('@/pages/Relatorios').then((m) => ({ default: m.Relatorios })))
const NovaInspecao = lazy(() => import('@/pages/inspecao/NovaInspecao').then((m) => ({ default: m.NovaInspecao })))
const Configuracoes = lazy(() => import('@/pages/Configuracoes').then((m) => ({ default: m.Configuracoes })))

function PaginaCarregando() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-secondary/30 border-t-primary" />
    </div>
  )
}

export default function App() {
  const [booting, setBooting] = useState(() => isNativeApp())

  useEffect(() => {
    if (!isNativeApp()) return
    SplashScreen.hide()
    const timer = setTimeout(() => setBooting(false), ORBIT_SPLASH_MS)
    return () => clearTimeout(timer)
  }, [])

  if (booting) {
    return <OrbitSplash />
  }

  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<PaginaCarregando />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/trocar-senha"
              element={
                <ProtectedRoute>
                  <TrocarSenha />
                </ProtectedRoute>
              }
            />
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<Dashboard />} />
              <Route path="/movimentacoes" element={<Movimentacoes />} />
              <Route path="/movimentacoes/nova" element={<RegistrarEntrada />} />
              <Route path="/veiculos/:id" element={<VeiculoDetalhe />} />
              <Route path="/clientes" element={<Clientes />} />
              <Route path="/clientes/:id" element={<ClienteDetalhe />} />
              <Route path="/relatorios" element={<Relatorios />} />
              <Route path="/inspecoes/nova" element={<NovaInspecao />} />
              <Route path="/configuracoes" element={<Configuracoes />} />
            </Route>
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  )
}
