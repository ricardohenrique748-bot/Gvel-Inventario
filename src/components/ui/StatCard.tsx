import type { LucideIcon } from 'lucide-react'
import { Card } from './Card'
import { cn } from '@/lib/cn'

interface StatCardProps {
  icon: LucideIcon
  label: string
  value: string
  hint?: string
  onClick?: () => void
  active?: boolean
  align?: 'left' | 'center'
  valueClassName?: string
}

export function StatCard({ icon: Icon, label, value, hint, onClick, active, align = 'left', valueClassName }: StatCardProps) {
  const centered = align === 'center'
  const content = (
    <>
      <div className={cn('flex items-center gap-2 text-secondary', centered && 'justify-center')}>
        <Icon className="h-4 w-4 shrink-0" />
        <p className="text-sm font-medium uppercase">{label}</p>
      </div>
      <p
        className={cn(
          'mt-2 font-semibold text-foreground tabular-nums uppercase truncate',
          valueClassName || 'text-2xl sm:text-3xl',
          centered && 'text-center w-full',
        )}
        title={value}
      >
        {value}
      </p>
      {hint && <p className={cn('mt-1 text-xs text-secondary uppercase', centered && 'text-center')}>{hint}</p>}
    </>
  )

  if (onClick) {
    return (
      <Card
        className={cn(
          'p-5 text-left transition-colors cursor-pointer hover:bg-overlay/[0.04]',
          centered && 'flex flex-col items-center',
          active && 'border-primary',
        )}
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
      </Card>
    )
  }

  return <Card className={cn('p-5', centered && 'flex flex-col items-center')}>{content}</Card>
}
