import type { ReactNode } from 'react'
import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, Building2, Check, ChevronDown } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Logo } from '@/components/ui/Logo'
import { ThemeToggleButton } from '@/components/ThemeToggleButton'
import { NotificacoesDropdown } from '@/components/NotificacoesDropdown'
import { useAuth } from '@/contexts/AuthContext'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { cn } from '@/lib/cn'

interface PageHeaderProps {
  title: string
  subtitle?: string
  back?: boolean
  actions?: ReactNode
}

export function PageHeader({ title, subtitle, back, actions }: PageHeaderProps) {
  const navigate = useNavigate()

  return (
    <div className="mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 max-w-full">
      <div className="flex items-center gap-3 min-w-0 max-w-full">
        {back && (
          <button
            onClick={() => navigate(-1)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface text-secondary hover:text-foreground"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-lg sm:text-xl font-black text-foreground truncate uppercase tracking-tight">{title}</h1>
          {subtitle && <p className="text-xs text-secondary truncate uppercase font-medium mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto shrink-0">
          {actions}
        </div>
      )}
    </div>
  )
}

function MobileCompanySwitcher() {
  const { empresas, empresaAtiva, setEmpresaAtiva } = useEmpresa()
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
        left: Math.max(12, rect.left),
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
          "flex items-center gap-1.5 group rounded-xl px-1.5 py-1 transition-colors max-w-full overflow-hidden text-left",
          isAdmin ? "hover:bg-overlay/5 active:scale-95 cursor-pointer" : "cursor-default"
        )}
        aria-haspopup={isAdmin ? "listbox" : undefined}
        aria-expanded={open}
        title={isAdmin ? "Trocar de empresa (Administrador)" : "Empresa ativa"}
      >
        <div className="min-w-0 flex-1 overflow-hidden">
          <Logo size="sm" />
        </div>
        {isAdmin && (
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 shrink-0 text-secondary/60 transition-transform duration-200',
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
              width: '260px',
              maxWidth: 'calc(100vw - 24px)',
            }}
            className="z-[99999] rounded-xl border border-border/20 bg-[#18181b] shadow-2xl shadow-black/90 overflow-hidden animate-in fade-in zoom-in-95 duration-150 font-sans"
          >
            <div className="px-3 py-2 border-b border-border/10 bg-black/40 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wider text-secondary/80">
                Trocar de Empresa
              </p>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-bold tracking-wider">
                ADMIN
              </span>
            </div>
            <div className="py-1 max-h-64 overflow-y-auto">
              {empresas.map((empresa) => {
                const isActive = empresa.id === empresaAtiva?.id
                return (
                  <button
                    key={empresa.id}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onClick={() => {
                      setEmpresaAtiva(empresa.id)
                      setOpen(false)
                    }}
                    className={cn(
                      'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors cursor-pointer',
                      isActive
                        ? 'bg-primary/15 text-foreground font-semibold'
                        : 'text-secondary hover:bg-white/5 hover:text-foreground',
                    )}
                  >
                    <div
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white text-[10px] font-black shadow-sm"
                      style={{ backgroundColor: empresa.cor }}
                    >
                      <Building2 className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate text-foreground">{empresa.nome}</p>
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
        </>,
        document.body
      )}
    </div>
  )
}

export function MobileTopBar() {
  return (
    <div className="md:hidden sticky top-0 z-30 flex items-center justify-between border-b border-border/15 bg-surface/95 backdrop-blur-md px-4 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] pb-3 gap-3 shadow-sm">
      <MobileCompanySwitcher />
      <div className="flex items-center gap-2 shrink-0">
        <NotificacoesDropdown />
        <ThemeToggleButton />
      </div>
    </div>
  )
}
