import { NavLink } from 'react-router-dom'
import { LogOut, Home, ArrowLeftRight, Settings } from 'lucide-react'
import { navItems } from './nav'
import { cn } from '@/lib/cn'
import { useAuth } from '@/contexts/AuthContext'
import { isNativeApp } from '@/lib/isNativeApp'

export function BottomNav() {
  const { signOut } = useAuth()
  const native = isNativeApp()

  if (native) {
    return (
      <nav className="fixed bottom-0 inset-x-0 z-30 flex border-t border-white/5 bg-surface pb-[env(safe-area-inset-bottom)] shadow-lg">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            cn(
              'flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors',
              isActive ? 'text-primary font-semibold' : 'text-secondary hover:text-white',
            )
          }
        >
          <Home className="h-5 w-5" />
          <span className="truncate px-1">Home</span>
        </NavLink>

        <NavLink
          to="/movimentacoes"
          className={({ isActive }) =>
            cn(
              'flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors',
              isActive ? 'text-primary font-semibold' : 'text-secondary hover:text-white',
            )
          }
        >
          <ArrowLeftRight className="h-5 w-5" />
          <span className="truncate px-1">Movimentação</span>
        </NavLink>

        <NavLink
          to="/configuracoes"
          className={({ isActive }) =>
            cn(
              'flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors',
              isActive ? 'text-primary font-semibold' : 'text-secondary hover:text-white',
            )
          }
        >
          <Settings className="h-5 w-5" />
          <span className="truncate px-1">Configuração</span>
        </NavLink>

        <button
          type="button"
          onClick={() => signOut()}
          className="flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-secondary hover:text-white transition-colors"
        >
          <LogOut className="h-5 w-5" />
          <span className="truncate px-1">Sair</span>
        </button>
      </nav>
    )
  }

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 flex border-t border-white/5 bg-surface pb-[env(safe-area-inset-bottom)]">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={'end' in item ? item.end : false}
          className={({ isActive }) =>
            cn(
              'flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium',
              isActive ? 'text-primary' : 'text-secondary',
            )
          }
        >
          <item.icon className="h-5 w-5" />
          <span className="truncate px-1">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

