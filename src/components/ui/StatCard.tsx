import type { CSSProperties } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

/** Cor do orbe/radar do card. `primary` segue a cor da empresa. */
export type StatCardTone = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'neutral'

const TONE_RGB: Record<StatCardTone, string> = {
  primary: 'var(--color-primary)',
  success: '16 185 129',
  warning: '245 158 11',
  danger: '244 63 94',
  info: '59 130 246',
  purple: '168 85 247',
  neutral: '113 113 122',
}

interface StatCardProps {
  icon: LucideIcon
  label: string
  value: string
  hint?: string
  onClick?: () => void
  active?: boolean
  align?: 'left' | 'center'
  valueClassName?: string
  tone?: StatCardTone
  className?: string
  /** Quebra o valor em várias linhas em vez de cortar com "..." — use para
   * valores que não são números curtos (ex: um nome completo). */
  wrap?: boolean
}

// Card de número no estilo "bezel": casca externa + painel interno (orbe do
// ícone com anéis pulsando e radar girando no canto) + legenda embaixo.
// Visual e animações em index.css (.bezel-*).
export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  onClick,
  active,
  align = 'left',
  valueClassName,
  tone = 'primary',
  className,
  wrap,
}: StatCardProps) {
  const centered = align === 'center'
  const style = { '--tone': TONE_RGB[tone] } as CSSProperties

  const content = (
    <>
      <div className={cn('bezel-panel flex-1 p-4', centered && 'flex flex-col items-center text-center')}>
        <span className="bezel-radar" aria-hidden />
        <span className="bezel-orb">
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <p
          className={cn(
            'relative mt-4 font-bold text-foreground tabular-nums uppercase',
            wrap ? 'whitespace-normal break-words leading-snug' : 'truncate',
            valueClassName || (wrap ? 'text-lg sm:text-xl' : 'text-2xl sm:text-3xl'),
            centered && 'w-full',
          )}
          title={value}
        >
          {value}
        </p>
        {hint && <p className="relative mt-1 text-[11px] text-secondary uppercase">{hint}</p>}
      </div>
      <p className="bezel-caption">{label}</p>
    </>
  )

  if (onClick) {
    return (
      <div
        className={cn('bezel-card cursor-pointer text-left', className)}
        style={style}
        data-active={active ? 'true' : undefined}
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onClick()
          }
        }}
      >
        {content}
      </div>
    )
  }

  return (
    <div className={cn('bezel-card', className)} style={style}>
      {content}
    </div>
  )
}
