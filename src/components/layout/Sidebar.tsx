import { useMemo, useState, useRef, type ChangeEvent } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, useLocation } from 'react-router-dom'
import { LogOut, Search, Home, ArrowLeftRight, Settings, ChevronDown, ChevronLeft, ChevronRight, Plus, Minus, Wrench, Check, Building2, Camera } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { ThemeToggleButton } from '@/components/ThemeToggleButton'
import { NotificacoesDropdown } from '@/components/NotificacoesDropdown'
import { navItems, isKanbanAuthorized, isDashboardGerencialAuthorized, isFinanceiroAuthorized, isRhAuthorized, isRelatoriosAuthorized, isEstoqueAuthorized, isModuloAuthorized } from './nav'
import { useAuth } from '@/contexts/AuthContext'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { useEmpresasDoSeletor } from '@/hooks/useCompanies'
import { temAcessoModuloEmpresa } from '@/lib/permissoes'
import { cn } from '@/lib/cn'
import { isNativeApp } from '@/lib/isNativeApp'
import { uploadFotoUsuario, atualizarUsuario } from '@/hooks/useUsuarios'
import { RecortarFotoModal } from '@/components/RecortarFotoModal'

function CompanySwitcher() {
  const { empresaAtiva, setEmpresaAtiva, trocandoEmpresa } = useEmpresa()
  const empresas = useEmpresasDoSeletor()
  const { user, perfil, perfilLoading } = useAuth()
  const isAdmin = !perfilLoading && (perfil?.nivel === 'admin' || user?.email === 'ricardo_h.16@hotmail.com' || user?.email === 'victor@gveldiesel.com')
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const buttonRef = useRef<HTMLButtonElement>(null)

  function toggleOpen() {
    if (!isAdmin) return
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setCoords({
        top: rect.bottom + 6,
        left: rect.left,
      })
    }
    setOpen((o) => !o)
  }

  return (
    <div className="relative flex-1 min-w-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleOpen}
        disabled={!isAdmin}
        className={cn(
          "flex items-center justify-between gap-1 w-full max-w-full group rounded-lg p-1 transition-colors overflow-hidden text-left",
          isAdmin ? "hover:bg-overlay/5 cursor-pointer" : "cursor-default"
        )}
        title={isAdmin ? "Trocar de empresa (Administrador)" : "Empresa ativa"}
        aria-haspopup={isAdmin ? "listbox" : undefined}
        aria-expanded={open}
      >
        <div className="min-w-0 flex-1 overflow-hidden">
          <Logo size="sm" />
        </div>
        {isAdmin && (
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 shrink-0 text-secondary/60 transition-transform duration-200 group-hover:text-secondary',
              open && 'rotate-180',
            )}
          />
        )}
      </button>

      {open && isAdmin && createPortal(
        <>
          <div className="fixed inset-0 z-[99998]" onClick={() => setOpen(false)} />
          <div
            style={{
              position: 'fixed',
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              width: '300px',
            }}
            className="z-[99999] rounded-xl border border-border/20 bg-[#18181b] shadow-2xl shadow-black/90 overflow-hidden animate-in fade-in zoom-in-95 duration-150 font-sans"
          >
            <div className="px-3 py-2 border-b border-border/10 bg-black/40 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wider text-secondary/80">
                {trocandoEmpresa ? 'Trocando de empresa…' : 'Trocar de Empresa'}
              </p>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-bold tracking-wider">
                ADMIN
              </span>
            </div>
            <div className="py-1 max-h-72 overflow-y-auto">
              {empresas.map((empresa) => {
                const isActive = empresa.id === empresaAtiva?.id
                return (
                  <button
                    key={empresa.id}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    disabled={trocandoEmpresa}
                    onClick={() => {
                      setEmpresaAtiva(empresa.id)
                      setOpen(false)
                    }}
                    style={isActive ? { borderLeftColor: empresa.cor } : undefined}
                    className={cn(
                      'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors cursor-pointer border-l-2 disabled:opacity-50 disabled:cursor-wait',
                      isActive
                        ? 'bg-white/[0.06] text-foreground font-semibold'
                        : 'border-l-transparent text-secondary hover:bg-white/5 hover:text-foreground',
                    )}
                  >
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white text-[10px] font-black shadow-sm ring-1 ring-white/15"
                      style={{ backgroundColor: empresa.cor }}
                    >
                      <Building2 className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold leading-snug break-words text-foreground">{empresa.nome}</p>
                      <p className="text-[10px] text-secondary/70 uppercase tracking-wide truncate">
                        {empresa.sistemaLabel}
                      </p>
                    </div>
                    {isActive && <Check className="h-4 w-4 shrink-0 text-white bg-primary rounded-full p-0.5" />}
                  </button>
                )
              })}
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  )
}

const MENU_RECOLHIDO_KEY = 'gvel_menu_recolhido'

function lerMenuRecolhido(): boolean {
  try {
    return localStorage.getItem(MENU_RECOLHIDO_KEY) === '1'
  } catch {
    return false
  }
}

export function Sidebar() {
  const [recolhido, setRecolhido] = useState(lerMenuRecolhido)
  const alternarRecolhido = () =>
    setRecolhido((atual) => {
      const novo = !atual
      try {
        localStorage.setItem(MENU_RECOLHIDO_KEY, novo ? '1' : '0')
      } catch {
        // sem storage (aba anônima etc.): só não lembra a escolha
      }
      return novo
    })
  const { signOut, user, perfil, perfilLoading, refetchPerfil, empresa } = useAuth()
  const [search, setSearch] = useState('')
  const native = isNativeApp()
  const isAdmin = !perfilLoading && perfil?.nivel === 'admin'
  const userRef = perfil || { email: user?.email }

  const [enviandoFoto, setEnviandoFoto] = useState(false)
  const [erroFoto, setErroFoto] = useState<string | null>(null)
  const [arquivoParaRecortar, setArquivoParaRecortar] = useState<File | null>(null)
  const fotoInputRef = useRef<HTMLInputElement>(null)

  function handleFotoPerfilChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !perfil) return
    setErroFoto(null)
    setArquivoParaRecortar(file)
  }

  async function handleFotoRecortada(arquivoRecortado: File) {
    setArquivoParaRecortar(null)
    if (!perfil) return
    setEnviandoFoto(true)
    try {
      const fotoUrl = await uploadFotoUsuario(arquivoRecortado, perfil.id)
      await atualizarUsuario(perfil.id, {
        nome: perfil.nome,
        nivel: perfil.nivel,
        telefone: perfil.telefone || undefined,
        foto_url: fotoUrl,
      })
      await refetchPerfil()
    } catch (err) {
      console.error('Erro ao atualizar foto de perfil:', err)
      setErroFoto(err instanceof Error ? err.message : 'Não foi possível salvar a foto de perfil.')
      setTimeout(() => setErroFoto(null), 8000)
    } finally {
      setEnviandoFoto(false)
    }
  }

  const canAccessKanban = isKanbanAuthorized(userRef)
  const canAccessDashboardGerencial = isDashboardGerencialAuthorized(userRef) && temAcessoModuloEmpresa(empresa, 'dashboard_gerencial')
  const canAccessFinanceiro = isFinanceiroAuthorized(userRef) && temAcessoModuloEmpresa(empresa, 'financeiro')
  const canAccessRh = isRhAuthorized(userRef) && temAcessoModuloEmpresa(empresa, 'rh')
  const canAccessRelatorios = isRelatoriosAuthorized(userRef)
  const canAccessEstoque = isEstoqueAuthorized(userRef, native) && temAcessoModuloEmpresa(empresa, 'estoque')
  const canAccessManutencao = isModuloAuthorized(userRef, 'manutencao') && temAcessoModuloEmpresa(empresa, 'manutencao')
  const canAccessInventarioCaminhoes = isModuloAuthorized(userRef, 'inventario_caminhoes') && temAcessoModuloEmpresa(empresa, 'inventario_caminhoes')
  const canAccessFrotas = isModuloAuthorized(userRef, 'frotas') && temAcessoModuloEmpresa(empresa, 'frotas')
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
          // Liberação do Veículo fica como aba dentro da Manutenção.
          ...(canAccessManutencao ? [{ to: '/manutencao', label: 'Manutenção', icon: Wrench }] : []),
          ...(canAccessInventarioCaminhoes && isModuloAuthorized(userRef, 'caminhoes_movimentacoes')
            ? [{ to: '/movimentacoes', label: 'Movimentação', icon: ArrowLeftRight }]
            : []),
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
        if (item.to === '/rh') return canAccessRh
        if (item.to === '/kanban') return canAccessKanban
        if (item.to === '/configuracoes') return canAccessConfiguracoes || canAccessRelatorios
        return true
      })
      .map((item) => {
        if ('children' in item && item.children && (item as any).children.length > 0) {
          const filteredChildren = ((item as any).children as any[]).filter((c: any) => {
            if (c.to === '/controle-horas') return isModuloAuthorized(userRef, 'dashboard_controle_horas') && temAcessoModuloEmpresa(empresa, 'dashboard_controle_horas')
            if (c.to === '/') return isModuloAuthorized(userRef, 'caminhoes_dashboard')
            if (c.to === '/movimentacoes') return isModuloAuthorized(userRef, 'caminhoes_movimentacoes')
            if (c.to === '/frotas') return isModuloAuthorized(userRef, 'frotas_dashboard')
            if (c.to === '/frotas?aba=veiculos') return isModuloAuthorized(userRef, 'frotas_veiculos')
            if (c.to === '/frotas?aba=checklist') return isModuloAuthorized(userRef, 'frotas_checklist')
            if (c.to === '/frotas?aba=viagens') return isModuloAuthorized(userRef, 'frotas_viagens')
            if (c.to === '/frotas?aba=consumo') return isModuloAuthorized(userRef, 'frotas_consumo')
            if (c.to === '/inventario-ferramentas') return isModuloAuthorized(userRef, 'estoque_ferramentas')
            if (c.to === '/inventario-ferramentas?aba=consumo') return isModuloAuthorized(userRef, 'estoque_consumo')
            if (c.to === '/inventario-ferramentas?aba=caixas') return isModuloAuthorized(userRef, 'estoque_caixas')
            if (c.to === '/inventario-ferramentas?aba=em_uso') return isModuloAuthorized(userRef, 'estoque_em_uso')
            if (c.to === '/inventario-ferramentas?aba=historico') return isModuloAuthorized(userRef, 'estoque_historico')
            if (c.to === '/clientes') return isModuloAuthorized(userRef, 'config_clientes') && temAcessoModuloEmpresa(empresa, 'config_clientes')
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
    canAccessRh,
    canAccessRelatorios,
    canAccessEstoque,
    canAccessManutencao,
    canAccessInventarioCaminhoes,
    canAccessFrotas,
    canAccessConfiguracoes,
    perfil,
    user?.email,
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
    <aside
      className={cn(
        'group/menu relative hidden md:sticky md:top-3 md:m-3 md:flex md:h-[calc(100svh-1.5rem)] md:shrink-0 md:flex-col md:self-start md:rounded-[28px] glass-bar transition-[width] duration-300 ease-out',
        recolhido ? 'md:w-[84px]' : 'md:w-[272px]',
      )}
    >
      {/* Alça na borda: recolhe/expande o menu */}
      <button
        type="button"
        onClick={alternarRecolhido}
        aria-label={recolhido ? 'Expandir menu' : 'Recolher menu'}
        title={recolhido ? 'Expandir menu' : 'Recolher menu'}
        className="absolute -right-3 top-1/2 z-40 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full glass-btn text-secondary opacity-80 hover:text-foreground hover:opacity-100"
      >
        {recolhido ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
      </button>

      {/* Cabeçalho */}
      <div
        className={cn(
          'relative z-30 flex shrink-0 items-center border-b border-border/[0.06]',
          recolhido ? 'h-[76px] flex-col justify-center gap-1' : 'h-[76px] gap-2 px-4',
        )}
      >
        {recolhido ? (
          <Logo size="sm" showText={false} className="w-auto justify-center" />
        ) : (
          <>
            <div className="min-w-0 flex-1">
              <CompanySwitcher />
            </div>
            {temAcessoModuloEmpresa(empresa, 'config_notificacoes') && <NotificacoesDropdown />}
          </>
        )}
      </div>

      {!recolhido && (
        <div className="px-4 pt-4 pb-1">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-secondary" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar no menu..."
              className="h-9 w-full rounded-full border border-border/[0.06] bg-overlay/5 pl-9 pr-3 text-[13px] text-foreground placeholder:text-secondary/60 transition-all focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
          </div>
        </div>
      )}

      <nav className={cn('flex-1 overflow-y-auto py-4', recolhido ? 'px-0' : 'px-3')}>
        {!recolhido && (
          <p className="px-3 pb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-secondary/60">Menu</p>
        )}
        <div className={cn('flex flex-col', recolhido ? 'items-center gap-2.5' : 'gap-1')}>
          {filteredNavItems.map((item) => {
            const hasChildren = 'children' in item && item.children && item.children.length > 0
            const children = hasChildren ? ((item as any).children as { to: string; label: string; icon: React.ElementType; end?: boolean }[]) : []
            const childActive = isGroupActive(children)
            const isOpen = openGroups[item.to] ?? childActive
            const end = 'end' in item ? (item as any).end : false

            // ---------- Recolhido: só o ícone ----------
            if (recolhido) {
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={end}
                  title={item.label}
                  aria-label={item.label}
                  className={({ isActive }) =>
                    cn(
                      'flex h-11 w-11 items-center justify-center rounded-full transition-all',
                      isLinkActive(item.to, isActive) || childActive
                        ? 'bg-surface text-foreground shadow-[0_8px_20px_-8px_rgb(0_0_0/0.45)] ring-1 ring-border/10'
                        : 'text-secondary hover:bg-overlay/5 hover:text-foreground',
                    )
                  }
                >
                  <item.icon className="h-[19px] w-[19px]" />
                </NavLink>
              )
            }

            // ---------- Expandido ----------
            const pilula = (ativo: boolean) =>
              cn(
                'flex min-w-0 flex-1 items-center gap-3 rounded-full py-2.5 pl-3.5 pr-3 text-[13px] font-medium transition-all',
                ativo
                  ? 'bg-foreground text-background font-semibold shadow-[0_10px_24px_-10px_rgb(0_0_0/0.55)]'
                  : 'text-secondary hover:bg-overlay/5 hover:text-foreground',
              )

            if (hasChildren) {
              const grupoAtivo = childActive
              return (
                <div key={item.to}>
                  <div className={cn('flex items-center rounded-full', grupoAtivo && 'bg-foreground shadow-[0_10px_24px_-10px_rgb(0_0_0/0.55)]')}>
                    <NavLink
                      to={item.to}
                      end={end}
                      className={({ isActive }) =>
                        grupoAtivo
                          ? 'flex min-w-0 flex-1 items-center gap-3 rounded-full py-2.5 pl-3.5 pr-1 text-[13px] font-semibold text-background'
                          : pilula(isLinkActive(item.to, isActive))
                      }
                    >
                      <item.icon className="h-[18px] w-[18px] shrink-0" />
                      <span className="flex-1 truncate">{item.label}</span>
                    </NavLink>
                    <button
                      type="button"
                      onClick={() => toggleGroup(item.to)}
                      aria-label={isOpen ? `Recolher ${item.label}` : `Expandir ${item.label}`}
                      aria-expanded={isOpen}
                      className={cn(
                        'mr-1.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors',
                        grupoAtivo ? 'text-background/80 hover:text-background' : 'text-secondary hover:bg-overlay/5 hover:text-foreground',
                      )}
                    >
                      {isOpen ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                    </button>
                  </div>

                  {isOpen && (
                    <div className="relative ml-[26px] mt-1.5 mb-1 space-y-1 border-l border-border/15 pl-3">
                      {children
                        .filter((c) => (search.trim() ? c.label.toLowerCase().includes(search.trim().toLowerCase()) : true))
                        .map((child) => (
                          <NavLink
                            key={child.to}
                            to={child.to}
                            end={child.end ?? false}
                            className={({ isActive }) =>
                              cn(
                                'flex items-center gap-3 rounded-full py-2 pl-3 pr-3 text-[13px] font-medium transition-all',
                                isLinkActive(child.to, isActive)
                                  ? 'bg-surface text-foreground font-semibold shadow-[0_6px_18px_-8px_rgb(0_0_0/0.4)] ring-1 ring-border/10'
                                  : 'text-secondary hover:bg-overlay/5 hover:text-foreground',
                              )
                            }
                          >
                            <child.icon className="h-4 w-4 shrink-0" />
                            <span className="truncate">{child.label}</span>
                          </NavLink>
                        ))}
                    </div>
                  )}
                </div>
              )
            }

            return (
              <NavLink key={item.to} to={item.to} end={end} className={({ isActive }) => pilula(isLinkActive(item.to, isActive))}>
                <item.icon className="h-[18px] w-[18px] shrink-0" />
                <span className="truncate">{item.label}</span>
              </NavLink>
            )
          })}
          {filteredNavItems.length === 0 && <p className="px-3 py-1.5 text-xs text-secondary/60">Nenhum resultado.</p>}
        </div>
      </nav>

      {/* Rodapé: usuário, tema e sair */}
      <div className={cn('shrink-0 border-t border-border/[0.06] p-3', recolhido && 'flex flex-col items-center gap-2.5')}>
        <div className={cn(recolhido ? 'flex flex-col items-center gap-2.5' : 'flex items-center gap-2.5 rounded-full px-1.5 py-1.5 transition-colors hover:bg-overlay/5')}>
          <button
            type="button"
            onClick={() => perfil && fotoInputRef.current?.click()}
            disabled={!perfil || enviandoFoto}
            aria-label="Alterar foto de perfil"
            title={perfil ? (recolhido ? `${user?.email} — alterar foto` : 'Alterar foto de perfil') : undefined}
            className="group relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/20 text-[11px] font-semibold text-primary disabled:cursor-default"
          >
            {perfil?.foto_url ? <img src={perfil.foto_url} alt="" className="h-full w-full object-cover" /> : initials}
            {perfil && (
              <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                <Camera className={cn('h-3.5 w-3.5 text-white', enviandoFoto && 'animate-pulse')} />
              </span>
            )}
          </button>
          <input ref={fotoInputRef} type="file" accept="image/*" className="hidden" onChange={handleFotoPerfilChange} />
          {!recolhido && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-foreground">{user?.email}</p>
              <p className="flex items-center gap-1.5 text-[11px] text-secondary">
                <span className="h-1.5 w-1.5 rounded-full bg-status-success" />
                Online
              </p>
            </div>
          )}
          <ThemeToggleButton />
          <button
            onClick={() => signOut()}
            aria-label="Sair"
            title="Sair"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-secondary transition-colors hover:bg-overlay/10 hover:text-foreground"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
        {erroFoto && !recolhido && <p className="mt-1 px-1.5 text-[11px] font-medium text-status-danger">{erroFoto}</p>}
      </div>

      {arquivoParaRecortar && (
        <RecortarFotoModal
          arquivo={arquivoParaRecortar}
          onCancelar={() => setArquivoParaRecortar(null)}
          onConfirmar={handleFotoRecortada}
        />
      )}
    </aside>
  )
}
