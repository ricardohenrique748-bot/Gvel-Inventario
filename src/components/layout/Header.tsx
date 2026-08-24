import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Logo } from '@/components/ui/Logo'
import { ThemeToggleButton } from '@/components/ThemeToggleButton'
import { NotificacoesDropdown } from '@/components/NotificacoesDropdown'

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

export function MobileTopBar() {
  return (
    <div className="md:hidden sticky top-0 z-30 flex items-center justify-between border-b border-border/15 bg-surface/95 backdrop-blur-md px-4 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] pb-3 gap-3 shadow-sm">
      <Logo size="sm" />
      <div className="flex items-center gap-2 shrink-0">
        <NotificacoesDropdown />
        <ThemeToggleButton />
      </div>
    </div>
  )
}
