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
    <div className="mb-6 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        {back && (
          <button
            onClick={() => navigate(-1)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface text-secondary hover:text-foreground"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-foreground truncate uppercase">{title}</h1>
          {subtitle && <p className="text-sm text-secondary truncate uppercase">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}

export function MobileTopBar() {
  return (
    <div className="md:hidden sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border/15 bg-surface/95 backdrop-blur-md px-4 pt-[env(safe-area-inset-top)] gap-2 shadow-sm">
      <Logo size="sm" />
      <div className="flex items-center gap-2">
        <NotificacoesDropdown />
        <ThemeToggleButton />
      </div>
    </div>
  )
}
