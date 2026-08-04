import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export type BadgeTone = 'success' | 'danger' | 'warning' | 'neutral'

const toneClasses: Record<BadgeTone, string> = {
  success: 'bg-status-success/15 text-status-success border-status-success/30',
  danger: 'bg-status-danger/15 text-status-danger border-status-danger/30',
  warning: 'bg-status-warning/15 text-status-warning border-status-warning/30',
  neutral: 'bg-status-neutral/15 text-status-neutral border-status-neutral/30',
}

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone
}

export function Badge({ className, tone = 'neutral', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  )
}
