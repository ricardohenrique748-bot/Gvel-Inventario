import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { MobileTopBar } from './Header'

export function AppLayout() {
  const location = useLocation()
  const isFullWidth =
    location.pathname.startsWith('/kanban') ||
    location.pathname.startsWith('/financeiro') ||
    location.pathname.startsWith('/dashboard-gerencial') ||
    location.pathname.startsWith('/controle-horas') ||
    location.pathname.startsWith('/movimentacoes') ||
    location.pathname.startsWith('/inventario') ||
    location.pathname.startsWith('/relatorios')

  return (
    <div className="flex min-h-svh bg-background">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopBar />
        <main className="flex-1 px-3 py-5 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-6 md:px-8 md:py-7 md:pb-8">
          <div className={isFullWidth ? 'w-full max-w-[2560px] mx-auto' : 'mx-auto w-full max-w-7xl'}>
            <Outlet />
          </div>
        </main>
        <BottomNav />
      </div>
    </div>
  )
}
