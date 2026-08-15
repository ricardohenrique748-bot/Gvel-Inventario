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
}

export function StatCard({ icon: Icon, label, value, hint, onClick, active }: StatCardProps) {
  const content = (
    <>
      <div className="flex items-center gap-2 text-secondary">
        <Icon className="h-4 w-4" />
        <p className="text-sm font-medium uppercase">{label}</p>
      </div>
      <p className="mt-2 text-3xl font-semibold text-foreground tabular-nums uppercase">{value}</p>
      {hint && <p className="mt-1 text-xs text-secondary uppercase">{hint}</p>}
    </>
  )

  if (onClick) {
    return (
      <Card
        className={cn(
          'p-5 text-left transition-colors cursor-pointer hover:bg-overlay/[0.04]',
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

  return <Card className="p-5">{content}</Card>
}
