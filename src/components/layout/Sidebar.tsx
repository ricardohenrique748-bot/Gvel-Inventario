import { useMemo, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { LogOut, Search, Home, ArrowLeftRight, Settings, ChevronDown, Wrench } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { ThemeToggleButton } from '@/components/ThemeToggleButton'
import { NotificacoesDropdown } from '@/components/NotificacoesDropdown'
import { navItems, ADMIN_ONLY_ROUTES, isKanbanAuthorized, isDashboardGerencialAuthorized, isFinanceiroAuthorized, isRelatoriosAuthorized } from './nav'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/cn'
import { isNativeApp } from '@/lib/isNativeApp'

const nativeNavItems = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/manutencao', label: 'Manutenção', icon: Wrench },
  { to: '/movimentacoes', label: 'Movimentação', icon: ArrowLeftRight },
  { to: '/configuracoes', label: 'Configurações', icon: Settings },
] as const


export function Sidebar() {
  const { signOut, user, perfil, perfilLoading } = useAuth()
  const [search, setSearch] = useState('')
  const native = isNativeApp()
  const isAdmin = !perfilLoading && perfil?.nivel === 'admin'
  const canAccessKanban = isKanbanAuthorized(user?.email)
  const canAccessDashboardGerencial = isDashboardGerencialAuthorized(user?.email)
  const canAccessFinanceiro = isFinanceiroAuthorized(user?.email)
  const canAccessRelatorios = isRelatoriosAuthorized(user?.email)
  const location = useLocation()

  // Track which parent groups are open
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})

  const toggleGroup = (to: string) => {
    setOpenGroups((prev) => ({ ...prev, [to]: !prev[to] }))
  }

  // Check if a group should be open based on whether any child route is active
  const isGroupActive = (children: readonly { to: string; end?: boolean }[]) =>
    children.some((c) =>
      'end' in c && c.end
        ? location.pathname === c.to
        : location.pathname === c.to || location.pathname.startsWith(c.to + '/'),
    )

  const currentNavItems = useMemo(() => {
    const base = native ? nativeNavItems : navItems
    return base
      .filter((item) => {
        if (item.to === '/kanban') {
          return canAccessKanban
        }
        if (item.to === '/dashboard-gerencial') {
          return isAdmin || canAccessDashboardGerencial
        }
        if (item.to === '/financeiro') {
          return canAccessFinanceiro
        }
        return isAdmin || !ADMIN_ONLY_ROUTES.includes(item.to as (typeof ADMIN_ONLY_ROUTES)[number])
      })
      .map((item) => {
        if (!isAdmin && item.to === '/configuracoes') {
          // Usuário com acesso a relatórios mas não admin: mostrar Configurações só com Relatórios
          if (canAccessRelatorios && 'children' in item && (item as any).children) {
            const relatoriosChild = ((item as any).children as { to: string }[]).filter(
              (c) => c.to === '/relatorios',
            )
            if (relatoriosChild.length > 0) {
              return { ...item, children: relatoriosChild }
            }
          }
          const { children: _children, ...rest } = item as any
          return rest
        }
        return item
      })
  }, [native, isAdmin, canAccessKanban, canAccessDashboardGerencial, canAccessFinanceiro, canAccessRelatorios])

  // For search: flatten all items (including children) to find matches
  const filteredNavItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return currentNavItems
    return currentNavItems.filter((item) => {
      if (item.label.toLowerCase().includes(q)) return true
      if ('children' in item && (item as any).children) {
        return ((item as any).children as { label: string }[]).some((c) => c.label.toLowerCase().includes(q))
      }
      return false
    })
  }, [search, currentNavItems])

  const initials = (user?.email ?? '?').slice(0, 2).toUpperCase()

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'flex items-center gap-3 rounded-lg border-l-2 py-2.5 pl-3 pr-3 text-sm font-medium transition-colors',
      isActive
        ? 'border-primary text-foreground font-semibold'
        : 'border-transparent text-secondary hover:bg-overlay/5 hover:text-foreground',
    )

  return (
    <aside className="hidden md:sticky md:top-3 md:m-3 md:flex md:h-[calc(100svh-1.5rem)] md:w-60 md:shrink-0 md:flex-col md:self-start md:overflow-hidden md:rounded-2xl md:border md:border-border/[0.06] bg-surface shadow-2xl shadow-black/50">
      <div className="flex h-14 items-center justify-between px-3.5 border-b border-border/[0.06]">
        <Logo size="sm" />
        <div className="flex items-center gap-1">
          <NotificacoesDropdown />
        </div>
      </div>

      <div className="px-2.5 pt-2.5 pb-1.5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-secondary" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar no menu..."
            className="h-8 w-full rounded-lg border border-border/[0.06] bg-overlay/5 pl-8 pr-2.5 text-[13px] text-foreground placeholder:text-secondary/60 transition-all focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2.5 py-2">
        <p className="px-2 pb-2 pt-2 text-[10px] font-semibold uppercase tracking-wider text-secondary/60">
          Menu
        </p>
        <div className="space-y-1.5">
          {filteredNavItems.map((item) => {
            const hasChildren = 'children' in item && item.children && item.children.length > 0
            const children = hasChildren ? (item as any).children as { to: string; label: string; icon: React.ElementType }[] : []
            const childActive = isGroupActive(children)
            const isOpen = openGroups[item.to] ?? childActive

            if (hasChildren) {
              return (
                <div key={item.to}>
                  {/* Parent row – links to /configuracoes and also toggles children */}
                  <div className="flex items-center gap-1">
                    <NavLink
                      to={item.to}
                      end={'end' in item ? (item as any).end : false}
                      className={navLinkClass}
                      style={{ flex: 1 }}
                    >
                      <item.icon className="h-5 w-5 shrink-0" />
                      <span className="uppercase flex-1">{item.label}</span>
                    </NavLink>
                    <button
                      onClick={() => toggleGroup(item.to)}
                      aria-label="Expandir"
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-secondary transition-colors hover:bg-overlay/5 hover:text-foreground"
                    >
                      <ChevronDown
                        className={cn('h-4 w-4 transition-transform duration-200', isOpen && 'rotate-180')}
                      />
                    </button>
                  </div>

                  {/* Children */}
                  {isOpen && (
                    <div className="mt-1 ml-4 space-y-1 border-l border-border/10 pl-3">
                      {children
                        .filter((c) =>
                          search.trim()
                            ? c.label.toLowerCase().includes(search.trim().toLowerCase())
                            : true,
                        )
                        .map((child) => (
                          <NavLink
                            key={child.to}
                            to={child.to}
                            className={navLinkClass}
                          >
                            <child.icon className="h-4 w-4 shrink-0" />
                            <span className="uppercase">{child.label}</span>
                          </NavLink>
                        ))}
                    </div>
                  )}
                </div>
              )
            }

            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={'end' in item ? (item as any).end : false}
                className={navLinkClass}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                <span className="uppercase">{item.label}</span>
              </NavLink>
            )
          })}
          {filteredNavItems.length === 0 && (
            <p className="px-2 py-1.5 text-xs text-secondary/60">Nenhum resultado.</p>
          )}
        </div>
      </nav>

      <div className="border-t border-border/[0.06] p-2">
        <div className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-overlay/5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[11px] font-semibold text-primary">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-foreground">{user?.email}</p>
            <p className="flex items-center gap-1.5 text-[11px] text-secondary">
              <span className="h-1.5 w-1.5 rounded-full bg-status-success" />
              Online
            </p>
          </div>
          <ThemeToggleButton />
          <button
            onClick={() => signOut()}
            aria-label="Sair"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-secondary transition-colors hover:bg-overlay/10 hover:text-foreground"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  )
}
