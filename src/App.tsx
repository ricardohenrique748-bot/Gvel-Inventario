import { lazy, Suspense, useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { SplashScreen } from '@capacitor/splash-screen'
import { AuthProvider } from '@/contexts/AuthContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { HomeRedirect } from '@/components/HomeRedirect'
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
const KanbanVamos = lazy(() => import('@/pages/KanbanVamos').then((m) => ({ default: m.KanbanVamos })))
const RH = lazy(() => import('@/pages/RH').then((m) => ({ default: m.RH })))
const FrotaPublica = lazy(() =>
  import('@/pages/publico/FrotaPublica').then((m) => ({ default: m.FrotaPublica })),
)
const VeiculoPublico = lazy(() =>
  import('@/pages/publico/VeiculoPublico').then((m) => ({ default: m.VeiculoPublico })),
)

import { NotificacoesProvider } from '@/contexts/NotificacoesContext'
import { EmpresaProvider } from '@/contexts/EmpresaContext'

/**
 * Telas do menu, na ordem de uso mais comum. Depois que o app abre, elas são
 * baixadas uma a uma quando o navegador está ocioso — assim o primeiro clique
 * no menu não fica esperando o download do pacote da tela.
 */
const PRE_CARREGAR_TELAS: (() => Promise<unknown>)[] = [
  () => import('@/pages/Manutencao'),
  () => import('@/pages/Dashboard'),
  () => import('@/pages/DashboardGerencial'),
  () => import('@/pages/Movimentacoes'),
  () => import('@/pages/Frotas'),
  () => import('@/pages/InventarioFerramentas'),
  () => import('@/pages/InventarioCaminhoes'),
  () => import('@/pages/ControleDeHoras'),
  () => import('@/pages/Configuracoes'),
  () => import('@/pages/Financeiro'),
  () => import('@/pages/RH'),
  () => import('@/pages/Kanban'),
  () => import('@/pages/KanbanVamos'),
  () => import('@/pages/Relatorios'),
  () => import('@/pages/inspecao/NovaInspecao'),
]

function quandoOcioso(fn: () => void) {
  const w = window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }
  if (w.requestIdleCallback) w.requestIdleCallback(fn, { timeout: 3000 })
  else setTimeout(fn, 300)
}

function usePreCarregarTelas(ativo: boolean) {
  useEffect(() => {
    if (!ativo) return
    let cancelado = false
    let i = 0
    const proxima = () => {
      if (cancelado || i >= PRE_CARREGAR_TELAS.length) return
      const carregar = PRE_CARREGAR_TELAS[i++]
      carregar()
        .catch(() => {}) // falhou (offline etc.): a tela carrega normal no clique
        .finally(() => quandoOcioso(proxima))
    }
    // Dá um respiro pra primeira tela terminar de montar antes de começar.
    const t = setTimeout(() => quandoOcioso(proxima), 2000)
    return () => {
      cancelado = true
      clearTimeout(t)
    }
  }, [ativo])
}

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

  usePreCarregarTelas(!booting)

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
                  <Route path="/" element={<HomeRedirect><Dashboard /></HomeRedirect>} />
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
                  <Route path="/kanban-vamos" element={<KanbanVamos />} />
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
