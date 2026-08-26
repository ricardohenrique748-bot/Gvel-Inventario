import { cn } from '@/lib/cn'
import logoIcon from '@/assets/logo-icon.png'
import { useEmpresa } from '@/contexts/EmpresaContext'

interface LogoProps {
  className?: string
  showText?: boolean
  size?: 'sm' | 'md' | 'lg'
  stacked?: boolean
}

const sizes = {
  sm: { icon: 'h-8 w-8', gap: 'gap-2', title: 'text-sm', subtitle: 'text-[9px]' },
  md: { icon: 'h-11 w-11', gap: 'gap-2.5', title: 'text-base', subtitle: 'text-[10px]' },
  lg: { icon: 'h-20 w-20', gap: 'gap-3.5', title: 'text-2xl', subtitle: 'text-xs' },
}

export function Logo({ className, showText = true, size = 'md', stacked = false }: LogoProps) {
  const s = sizes[size]
  const { empresaAtiva } = useEmpresa()
  const nomeEmpresa = empresaAtiva?.nome ?? 'GVel Diesel'
  const sistemaLabel = empresaAtiva?.sistemaLabel ?? 'CENTER TRUCK'

  return (
    <div className={cn(stacked ? 'flex flex-col items-center' : 'flex items-center min-w-0 w-full overflow-hidden', s.gap, className)}>
      <img src={logoIcon} alt={nomeEmpresa} className={cn(s.icon, 'shrink-0 object-contain')} />
      {showText && (
        <div className={cn('flex flex-col leading-tight min-w-0 flex-1 overflow-hidden max-w-full', stacked ? 'items-center text-center' : 'justify-center text-left')}>
          <p className={cn('font-bold tracking-wide text-foreground truncate block max-w-full', s.title)}>
            {sistemaLabel}
          </p>
          <p
            className={cn(
              'mt-0.5 font-medium uppercase tracking-wider text-secondary truncate block max-w-full',
              s.subtitle,
            )}
          >
            {nomeEmpresa}
          </p>
        </div>
      )}
    </div>
  )
}
