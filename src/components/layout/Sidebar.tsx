import { useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { LogOut, Search } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { navItems } from './nav'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/cn'

export function Sidebar() {
  const { signOut, user } = useAuth()
  const [search, setSearch] = useState('')

  const filteredNavItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return navItems
    return navItems.filter((item) => item.label.toLowerCase().includes(q))
  }, [search])

  const initials = (user?.email ?? '?').slice(0, 2).toUpperCase()

  return (
    <aside className="hidden md:m-3 md:flex md:w-60 md:shrink-0 md:flex-col md:overflow-hidden md:rounded-2xl md:border md:border-white/[0.06] bg-surface shadow-2xl shadow-black/50">
      <div className="flex h-12 items-center px-3.5 border-b border-white/[0.06]">
        <Logo size="sm" />
      </div>

      <div className="px-2.5 pt-2.5 pb-1.5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-secondary" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar no menu..."
            className="h-8 w-full rounded-lg border border-white/[0.06] bg-white/5 pl-8 pr-2.5 text-[13px] text-white placeholder:text-secondary/60 transition-all focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2.5 py-2">
        <p className="px-2 pb-2 pt-2 text-[10px] font-semibold uppercase tracking-wider text-secondary/60">
          Menu
        </p>
        <div className="space-y-1.5">
          {filteredNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={'end' in item ? item.end : false}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg border-l-2 py-2.5 pl-3 pr-3 text-sm font-medium transition-colors',
                  isActive
                    ? 'border-primary text-white font-semibold'
                    : 'border-transparent text-secondary hover:bg-white/5 hover:text-white',
                )
              }
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {item.label}
            </NavLink>
          ))}
          {filteredNavItems.length === 0 && (
            <p className="px-2 py-1.5 text-xs text-secondary/60">Nenhum resultado.</p>
          )}
        </div>
      </nav>

      <div className="border-t border-white/[0.06] p-2">
        <div className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-white/5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[11px] font-semibold text-primary">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-white">{user?.email}</p>
            <p className="flex items-center gap-1.5 text-[11px] text-secondary">
              <span className="h-1.5 w-1.5 rounded-full bg-status-success" />
              Online
            </p>
          </div>
          <button
            onClick={() => signOut()}
            aria-label="Sair"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-secondary transition-colors hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  )
}
