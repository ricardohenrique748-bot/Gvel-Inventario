import { NavLink } from 'react-router-dom'
import { LogOut, Home, ArrowLeftRight, Settings, Wrench } from 'lucide-react'
import { navItems, ADMIN_ONLY_ROUTES } from './nav'
import { cn } from '@/lib/cn'
import { useAuth } from '@/contexts/AuthContext'
import { isNativeApp } from '@/lib/isNativeApp'

export function BottomNav() {
  const { signOut, perfil, perfilLoading } = useAuth()
  const native = isNativeApp()
  const isAdmin = !perfilLoading && perfil?.nivel === 'admin'

  if (native) {
    return (
      <nav className="fixed bottom-0 inset-x-0 z-30 flex border-t border-border/10 bg-surface/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)] shadow-xl uppercase">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            cn(
              'flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-bold transition-colors uppercase',
              isActive ? 'text-primary font-bold' : 'text-secondary hover:text-foreground',
            )
          }
        >
          <Home className="h-5 w-5" />
          <span className="truncate px-1">HOME</span>
        </NavLink>

        <NavLink
          to="/manutencao"
          className={({ isActive }) =>
            cn(
              'flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-bold transition-colors uppercase',
              isActive ? 'text-primary font-bold' : 'text-secondary hover:text-foreground',
            )
          }
        >
          <Wrench className="h-5 w-5" />
          <span className="truncate px-1">MANUTENÇÃO</span>
        </NavLink>

        <NavLink
          to="/movimentacoes"
          className={({ isActive }) =>
            cn(
              'flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-bold transition-colors uppercase',
              isActive ? 'text-primary font-bold' : 'text-secondary hover:text-foreground',
            )
          }
        >
          <ArrowLeftRight className="h-5 w-5" />
          <span className="truncate px-1">MOVIMENTAÇÃO</span>
        </NavLink>

        {isAdmin && (
          <NavLink
            to="/configuracoes"
            className={({ isActive }) =>
              cn(
                'flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-bold transition-colors uppercase',
                isActive ? 'text-primary font-bold' : 'text-secondary hover:text-foreground',
              )
            }
          >
            <Settings className="h-5 w-5" />
            <span className="truncate px-1">AJUSTES</span>
          </NavLink>
        )}

        <button
          type="button"
          onClick={() => signOut()}
          className="flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-bold text-secondary hover:text-foreground transition-colors uppercase"
        >
          <LogOut className="h-5 w-5" />
          <span className="truncate px-1">SAIR</span>
        </button>
      </nav>
    )
  }

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 flex border-t border-border/10 bg-surface/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)] uppercase">
      {navItems
        .filter((item) => !('children' in item))
        .filter((item) => isAdmin || !ADMIN_ONLY_ROUTES.includes(item.to as (typeof ADMIN_ONLY_ROUTES)[number]))
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
