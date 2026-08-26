import type { ReactNode } from 'react'
import { useState, useRef, useEffect } from 'react'
import { ArrowLeft, Building2, Check, ChevronDown } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Logo } from '@/components/ui/Logo'
import { ThemeToggleButton } from '@/components/ThemeToggleButton'
import { NotificacoesDropdown } from '@/components/NotificacoesDropdown'
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
        className="flex items-center gap-1.5 group rounded-xl px-1.5 py-1 transition-colors hover:bg-overlay/5 active:scale-95 max-w-full overflow-hidden text-left cursor-pointer"
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Trocar de empresa"
      >
        <div className="min-w-0 flex-1 overflow-hidden">
          <Logo size="sm" />
        </div>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 shrink-0 text-secondary/60 transition-transform duration-200',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 w-56 rounded-xl border border-border/[0.08] bg-surface shadow-2xl shadow-black/40 z-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-border/[0.06]">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-secondary/60">
              Grupo GVEL — Trocar Empresa
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
