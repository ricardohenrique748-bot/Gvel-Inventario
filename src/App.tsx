import { lazy, Suspense, useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { SplashScreen } from '@capacitor/splash-screen'
import { AuthProvider } from '@/contexts/AuthContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { AppLayout } from '@/components/layout/AppLayout'
import { Login } from '@/pages/Login'
import { OrbitSplash, ORBIT_SPLASH_MS } from '@/components/OrbitSplash'
import { isNativeApp } from '@/lib/isNativeApp'

const TrocarSenha = lazy(() => import('@/pages/TrocarSenha').then((m) => ({ default: m.TrocarSenha })))
const Dashboard = lazy(() => import('@/pages/Dashboard').then((m) => ({ default: m.Dashboard })))
const ControleDeHoras = lazy(() =>
  import('@/pages/ControleDeHoras').then((m) => ({ default: m.ControleDeHoras })),
)
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
const Manutencao = lazy(() => import('@/pages/Manutencao').then((m) => ({ default: m.Manutencao })))
const Frotas = lazy(() => import('@/pages/Frotas').then((m) => ({ default: m.Frotas })))
const InventarioCaminhoes = lazy(() => import('@/pages/InventarioCaminhoes').then((m) => ({ default: m.InventarioCaminhoes })))
const InventarioFerramentas = lazy(() => import('@/pages/InventarioFerramentas').then((m) => ({ default: m.InventarioFerramentas })))
const DashboardGerencial = lazy(() => import('@/pages/DashboardGerencial').then((m) => ({ default: m.DashboardGerencial })))
const Financeiro = lazy(() => import('@/pages/Financeiro').then((m) => ({ default: m.Financeiro })))
const Kanban = lazy(() => import('@/pages/Kanban').then((m) => ({ default: m.Kanban })))
const RH = lazy(() => import('@/pages/RH').then((m) => ({ default: m.RH })))
const FrotaPublica = lazy(() =>
  import('@/pages/publico/FrotaPublica').then((m) => ({ default: m.FrotaPublica })),
)
const VeiculoPublico = lazy(() =>
  import('@/pages/publico/VeiculoPublico').then((m) => ({ default: m.VeiculoPublico })),
)

import { NotificacoesProvider } from '@/contexts/NotificacoesContext'
import { EmpresaProvider } from '@/contexts/EmpresaContext'

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
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <EmpresaProvider>
          <NotificacoesProvider>
            <Suspense fallback={<PaginaCarregando />}>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/publico/frota/:token" element={<FrotaPublica />} />
                <Route path="/publico/frota/:token/veiculo/:veiculoId" element={<VeiculoPublico />} />
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
                  <Route path="/controle-horas" element={<ControleDeHoras />} />
                  <Route path="/movimentacoes" element={<Movimentacoes />} />
                  <Route path="/movimentacoes/nova" element={<RegistrarEntrada />} />
                  <Route path="/veiculos/:id" element={<VeiculoDetalhe />} />
                  <Route path="/clientes" element={<Clientes />} />
                  <Route path="/clientes/:id" element={<ClienteDetalhe />} />
                  <Route path="/relatorios" element={<Relatorios />} />
                  <Route path="/manutencao" element={<Manutencao />} />
                  <Route path="/frotas" element={<Frotas />} />
                  <Route path="/inventario-caminhoes" element={<InventarioCaminhoes />} />
                  <Route path="/inventario-ferramentas" element={<InventarioFerramentas />} />
                  <Route path="/dashboard-gerencial" element={<DashboardGerencial />} />
                  <Route path="/kanban" element={<Kanban />} />
                  <Route path="/financeiro" element={<Financeiro />} />
                  <Route path="/rh" element={<RH />} />
                  <Route path="/inspecoes/nova" element={<NovaInspecao />} />
                  <Route path="/configuracoes" element={<Configuracoes />} />
                </Route>
              </Routes>
            </Suspense>
          </NotificacoesProvider>
          </EmpresaProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  )
}
