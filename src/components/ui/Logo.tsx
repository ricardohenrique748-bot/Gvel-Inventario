import { cn } from '@/lib/cn'
import logoIcon from '@/assets/logo-icon.png'

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
  return (
    <div className={cn(stacked ? 'flex flex-col items-center' : 'flex items-center', s.gap, className)}>
      <img src={logoIcon} alt="Gvel Diesel" className={cn(s.icon, 'shrink-0 object-contain')} />
      {showText && (
        <div className={cn('flex flex-col leading-none', stacked ? 'items-center' : 'justify-center')}>
          <p className={cn('font-bold tracking-wide text-foreground whitespace-nowrap', s.title)}>CENTER TRUCK</p>
          <p
            className={cn(
              'mt-1 font-medium uppercase tracking-wider text-secondary whitespace-nowrap',
              s.subtitle,
            )}
          >
            Gvel Diesel
          </p>
        </div>
      )}
    </div>
  )
}
