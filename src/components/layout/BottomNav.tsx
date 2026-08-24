import { useLocation, useNavigate } from 'react-router-dom'
import { LogOut, Home, ArrowLeftRight, Settings, Wrench, Hammer, Truck, LayoutGrid } from 'lucide-react'
import { isKanbanAuthorized } from './nav'
import { cn } from '@/lib/cn'
import { useAuth } from '@/contexts/AuthContext'

export function BottomNav() {
  const { signOut, user, perfil, perfilLoading } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const isAdmin = !perfilLoading && perfil?.nivel === 'admin'
  const canAccessKanban = isKanbanAuthorized(user?.email)

  const items = [
    { to: '/', label: 'INÍCIO', icon: Home, end: true },
    { to: '/inventario-ferramentas', label: 'FERRAMENTAS', icon: Hammer },
    { to: '/frotas', label: 'FROTAS', icon: Truck },
    { to: '/manutencao', label: 'MANUTENÇÃO', icon: Wrench },
    { to: '/movimentacoes', label: 'PÁTIO', icon: ArrowLeftRight },
    ...(canAccessKanban ? [{ to: '/kanban', label: 'KANBAN', icon: LayoutGrid }] : []),
    ...(isAdmin ? [{ to: '/configuracoes', label: 'AJUSTES', icon: Settings }] : []),
  ]

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border/15 bg-surface/95 backdrop-blur-xl shadow-2xl pb-[calc(env(safe-area-inset-bottom,0px)+0.25rem)] pt-1 px-1">
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {items.slice(0, 5).map((item) => {
          const isActive = item.end
            ? location.pathname === item.to
            : location.pathname.startsWith(item.to)
          const Icon = item.icon

          return (
            <button
              key={item.to}
              type="button"
              onClick={() => navigate(item.to)}
              className={cn(
                'flex flex-1 flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all duration-150 active:scale-90 cursor-pointer min-w-0',
                isActive
                  ? 'text-primary font-black'
                  : 'text-secondary/70 hover:text-foreground font-semibold',
              )}
            >
              <div className={cn(
                'relative flex items-center justify-center p-1 rounded-xl transition-all',
                isActive && 'bg-primary/15 text-primary',
              )}>
                <Icon className="h-5 w-5 shrink-0" />
                {isActive && (
                  <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-primary" />
                )}
              </div>
              <span className="text-[9px] uppercase tracking-tight truncate max-w-full mt-0.5">
                {item.label}
              </span>
            </button>
          )
        })}

        {/* Botão Sair / Mais */}
        <button
          type="button"
          onClick={() => {
            if (confirm('Deseja sair da sua conta?')) {
              signOut()
            }
          }}
          className="flex flex-col items-center justify-center py-1.5 px-1 rounded-xl text-secondary/60 hover:text-red-400 active:scale-90 transition-all duration-150 cursor-pointer min-w-0"
          title="Sair da conta"
        >
          <div className="flex items-center justify-center p-1 rounded-xl hover:bg-red-500/10 transition-all">
            <LogOut className="h-5 w-5 shrink-0" />
          </div>
          <span className="text-[9px] uppercase tracking-tight truncate max-w-full mt-0.5 font-semibold">
            SAIR
          </span>
        </button>
      </div>
    </nav>
  )
}
