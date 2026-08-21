import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { LogOut, Home, ArrowLeftRight, Settings, Wrench } from 'lucide-react'
import { navItems, ADMIN_ONLY_ROUTES, isKanbanAuthorized, isDashboardGerencialAuthorized, isFinanceiroAuthorized } from './nav'
import { cn } from '@/lib/cn'
import { useAuth } from '@/contexts/AuthContext'
import { isNativeApp } from '@/lib/isNativeApp'
import { Dock, DockIcon, DockItem, DockLabel } from '@/components/ui/dock'

export function BottomNav() {
  const { signOut, user, perfil, perfilLoading } = useAuth()
  const native = isNativeApp()
  const location = useLocation()
  const navigate = useNavigate()
  const isAdmin = !perfilLoading && perfil?.nivel === 'admin'
  const canAccessKanban = isKanbanAuthorized(user?.email)
  const canAccessDashboardGerencial = isDashboardGerencialAuthorized(user?.email)
  const canAccessFinanceiro = isFinanceiroAuthorized(user?.email)

  if (native) {
    const apkItems = [
      { to: '/', label: 'HOME', icon: Home, end: true },
      { to: '/manutencao', label: 'MANUTENÇÃO', icon: Wrench },
      { to: '/movimentacoes', label: 'MOVIMENTAÇÃO', icon: ArrowLeftRight },
      ...(isAdmin ? [{ to: '/configuracoes', label: 'AJUSTES', icon: Settings }] : []),
    ]

    return (
      <div className="fixed bottom-3 inset-x-0 z-40 flex justify-center pointer-events-none pb-[env(safe-area-inset-bottom)] animate-fade-in">
        <div className="pointer-events-auto">
          <Dock
            magnification={68}
            distance={110}
            panelHeight={58}
            className="items-center bg-surface/90 border border-border/30 backdrop-blur-2xl shadow-2xl rounded-3xl py-2 px-3.5 gap-2.5"
          >
            {apkItems.map((item) => {
              const isActive = item.end
                ? location.pathname === item.to
                : location.pathname.startsWith(item.to)
              const Icon = item.icon

              return (
                <DockItem
                  key={item.to}
                  onClick={() => navigate(item.to)}
                  className={cn(
                    'aspect-square rounded-2xl transition-all',
                    isActive
                      ? 'bg-primary/20 text-primary border border-primary/40 shadow-lg shadow-primary/20'
                      : 'bg-surface-hover/50 text-secondary hover:text-foreground hover:bg-surface-hover',
                  )}
                >
                  <DockLabel>{item.label}</DockLabel>
                  <DockIcon>
                    <div className="flex flex-col items-center justify-center">
                      <Icon className="h-5 w-5" />
                      {isActive && (
                        <span className="h-1 w-1 rounded-full bg-primary mt-0.5 shadow-sm" />
                      )}
                    </div>
                  </DockIcon>
                </DockItem>
              )
            })}

            {/* Botão Sair */}
            <DockItem
              onClick={() => signOut()}
              className="aspect-square rounded-2xl bg-surface-hover/50 text-secondary hover:text-red-400 hover:bg-red-500/15 transition-all"
            >
              <DockLabel>SAIR</DockLabel>
              <DockIcon>
                <LogOut className="h-5 w-5" />
              </DockIcon>
            </DockItem>
          </Dock>
        </div>
      </div>
    )
  }

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 flex border-t border-border/10 bg-surface/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)] uppercase">
      {navItems
        .filter((item) => !('children' in item))
        .filter((item) => {
          if (item.to === '/kanban') return canAccessKanban
          if (item.to === '/dashboard-gerencial') {
            return isAdmin || canAccessDashboardGerencial
          }
          if (item.to === '/financeiro') {
            return canAccessFinanceiro
          }
          return isAdmin || !ADMIN_ONLY_ROUTES.includes(item.to as (typeof ADMIN_ONLY_ROUTES)[number])
        })
        .map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={('end' in item ? item.end : false) as boolean}
          className={({ isActive }) =>
            cn(
              'flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-bold uppercase',
              isActive ? 'text-primary' : 'text-secondary',
            )
          }
        >
          <item.icon className="h-5 w-5" />
          <span className="truncate px-1 uppercase">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
