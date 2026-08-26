import { useMemo, useState, useRef, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { LogOut, Search, Home, ArrowLeftRight, Settings, ChevronDown, Wrench, Check, Building2 } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { ThemeToggleButton } from '@/components/ThemeToggleButton'
import { NotificacoesDropdown } from '@/components/NotificacoesDropdown'
import { navItems, isKanbanAuthorized, isDashboardGerencialAuthorized, isFinanceiroAuthorized, isRelatoriosAuthorized, isEstoqueAuthorized, isModuloAuthorized } from './nav'
import { useAuth } from '@/contexts/AuthContext'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { cn } from '@/lib/cn'
import { isNativeApp } from '@/lib/isNativeApp'

function CompanySwitcher() {
  const { empresas, empresaAtiva, setEmpresaAtiva } = useEmpresa()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className="relative flex-1 min-w-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between gap-1 w-full max-w-full group rounded-lg p-1 transition-colors hover:bg-overlay/5 overflow-hidden text-left cursor-pointer"
        title="Trocar de empresa"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <div className="min-w-0 flex-1 overflow-hidden">
          <Logo size="sm" />
        </div>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 shrink-0 text-secondary/60 transition-transform duration-200 group-hover:text-secondary',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 w-60 rounded-xl border border-border/[0.15] bg-[#18181b] shadow-2xl shadow-black/80 z-[100] overflow-hidden">
          <div className="px-3 py-2 border-b border-border/[0.08] bg-black/20">
            <p className="text-[10px] font-bold uppercase tracking-wider text-secondary/70">
              Trocar de Empresa
            </p>
          </div>
          <div className="py-1 max-h-64 overflow-y-auto">
            {empresas.map((empresa) => {
              const isActive = empresa.id === empresaAtiva?.id
              return (
                <button
                  key={empresa.id}
                  role="option"
                  aria-selected={isActive}
                  onClick={() => {
                    setEmpresaAtiva(empresa.id)
                    setOpen(false)
                  }}
                  className={cn(
                    'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors',
                    isActive
                      ? 'bg-primary/10 text-foreground'
                      : 'text-secondary hover:bg-overlay/5 hover:text-foreground',
                  )}
                >
                  <div
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white text-[10px] font-black shadow-sm"
                    style={{ backgroundColor: empresa.cor }}
                  >
                    <Building2 className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate">{empresa.nome}</p>
                    <p className="text-[10px] text-secondary/70 uppercase tracking-wide truncate">
                      {empresa.sistemaLabel}
                    </p>
                  </div>
                  {isActive && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export function Sidebar() {
  const { signOut, user, perfil, perfilLoading } = useAuth()
  const [search, setSearch] = useState('')
  const native = isNativeApp()
  const isAdmin = !perfilLoading && perfil?.nivel === 'admin'
  const userRef = perfil || { email: user?.email }

  const canAccessKanban = isKanbanAuthorized(userRef)
  const canAccessDashboardGerencial = isDashboardGerencialAuthorized(userRef)
  const canAccessFinanceiro = isFinanceiroAuthorized(userRef)
  const canAccessRelatorios = isRelatoriosAuthorized(userRef)
  const canAccessEstoque = isEstoqueAuthorized(userRef, native)
  const canAccessManutencao = isModuloAuthorized(userRef, 'manutencao')
  const canAccessInventarioCaminhoes = isModuloAuthorized(userRef, 'inventario_caminhoes')
  const canAccessFrotas = isModuloAuthorized(userRef, 'frotas')
  const canAccessRH = isModuloAuthorized(userRef, 'rh')
  const canAccessCompras = isModuloAuthorized(userRef, 'compras')
  const canAccessConfiguracoes = isAdmin || isModuloAuthorized(userRef, 'configuracoes')
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
    const base = native
      ? [
          { to: '/', label: 'Home', icon: Home, end: true },
          ...(canAccessEstoque ? [{ to: '/inventario-ferramentas', label: 'Estoque', icon: Wrench }] : []),
          ...(canAccessManutencao ? [{ to: '/manutencao', label: 'Manutenção', icon: Wrench }] : []),
          ...(canAccessInventarioCaminhoes ? [{ to: '/movimentacoes', label: 'Movimentação', icon: ArrowLeftRight }] : []),
          ...(canAccessConfiguracoes ? [{ to: '/configuracoes', label: 'Configurações', icon: Settings }] : []),
        ]
      : navItems

    return base
      .filter((item) => {
        if (item.to === '/dashboard-gerencial') return canAccessDashboardGerencial
        if (item.to === '/manutencao') return canAccessManutencao
        if (item.to === '/inventario-caminhoes') return canAccessInventarioCaminhoes
        if (item.to === '/frotas') return canAccessFrotas
        if (item.to === '/inventario-ferramentas') return canAccessEstoque
        if (item.to === '/financeiro') return canAccessFinanceiro
        if (item.to === '/kanban') return canAccessKanban
        if (item.to === '/rh') return canAccessRH
        if (item.to === '/compras') return canAccessCompras
        if (item.to === '/configuracoes') return canAccessConfiguracoes || canAccessRelatorios
        return true
      })
      .map((item) => {
        if ('children' in item && item.children && (item as any).children.length > 0) {
          const filteredChildren = ((item as any).children as any[]).filter((c: any) => {
            if (c.to === '/controle-horas') return isModuloAuthorized(userRef, 'dashboard_controle_horas')
            if (c.to === '/') return isModuloAuthorized(userRef, 'caminhoes_dashboard')
            if (c.to === '/movimentacoes') return isModuloAuthorized(userRef, 'caminhoes_movimentacoes')
            if (c.to === '/frotas') return isModuloAuthorized(userRef, 'frotas_dashboard')
            if (c.to === '/frotas?aba=veiculos') return isModuloAuthorized(userRef, 'frotas_veiculos')
            if (c.to === '/frotas?aba=checklist') return isModuloAuthorized(userRef, 'frotas_checklist')
            if (c.to === '/inventario-ferramentas') return isModuloAuthorized(userRef, 'estoque_ferramentas')
            if (c.to === '/inventario-ferramentas?aba=consumo') return isModuloAuthorized(userRef, 'estoque_consumo')
            if (c.to === '/inventario-ferramentas?aba=caixas') return isModuloAuthorized(userRef, 'estoque_caixas')
            if (c.to === '/inventario-ferramentas?aba=em_uso') return isModuloAuthorized(userRef, 'estoque_em_uso')
            if (c.to === '/inventario-ferramentas?aba=historico') return isModuloAuthorized(userRef, 'estoque_historico')
            if (c.to === '/clientes') return isModuloAuthorized(userRef, 'config_clientes')
            if (c.to === '/relatorios') return isModuloAuthorized(userRef, 'relatorios')
            return true
          })
          if (filteredChildren.length === 0) {
            const { children: _children, ...rest } = item as any
            return rest
          }
          return { ...item, children: filteredChildren }
        }
        return item
      })
  }, [
    native,
    isAdmin,
    canAccessKanban,
    canAccessDashboardGerencial,
    canAccessFinanceiro,
    canAccessRelatorios,
    canAccessEstoque,
    canAccessManutencao,
    canAccessInventarioCaminhoes,
    canAccessFrotas,
    canAccessRH,
    canAccessCompras,
    canAccessConfiguracoes,
  ])

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

  const isLinkActive = (to: string, isDefaultActive: boolean) => {
    const currentFull = location.pathname + location.search
    if (to.includes('?')) {
      return currentFull === to
    }
    if (location.search && location.search.length > 0) {
      if (to === location.pathname) return false
    }
    return isDefaultActive
  }

  return (
    <aside className="hidden md:sticky md:top-3 md:m-3 md:flex md:h-[calc(100svh-1.5rem)] md:w-64 md:shrink-0 md:flex-col md:self-start md:overflow-hidden md:rounded-2xl md:border md:border-border/[0.06] bg-surface shadow-2xl shadow-black/50">
      <div className="flex h-14 items-center justify-between px-3 border-b border-border/[0.06] gap-2 relative z-30">
        <div className="flex-1 min-w-0">
          <CompanySwitcher />
        </div>
        <div className="flex items-center gap-1 shrink-0">
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
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-3 rounded-lg border-l-2 py-2.5 pl-3 pr-3 text-sm font-medium transition-colors',
                          isLinkActive(item.to, isActive)
                            ? 'border-primary text-foreground font-semibold'
                            : 'border-transparent text-secondary hover:bg-overlay/5 hover:text-foreground',
                        )
                      }
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
                            end={'end' in child ? (child as any).end : false}
                            className={({ isActive }) =>
                              cn(
                                'flex items-center gap-3 rounded-lg border-l-2 py-2.5 pl-3 pr-3 text-sm font-medium transition-colors',
                                isLinkActive(child.to, isActive)
                                  ? 'border-primary text-foreground font-semibold'
                                  : 'border-transparent text-secondary hover:bg-overlay/5 hover:text-foreground',
                              )
                            }
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
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-lg border-l-2 py-2.5 pl-3 pr-3 text-sm font-medium transition-colors',
                    isLinkActive(item.to, isActive)
                      ? 'border-primary text-foreground font-semibold'
                      : 'border-transparent text-secondary hover:bg-overlay/5 hover:text-foreground',
                  )
                }
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
