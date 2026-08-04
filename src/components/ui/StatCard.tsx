import type { LucideIcon } from 'lucide-react'
import { Card } from './Card'

interface StatCardProps {
  icon: LucideIcon
  label: string
  value: string
  hint?: string
}

export function StatCard({ icon: Icon, label, value, hint }: StatCardProps) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 text-secondary">
        <Icon className="h-4 w-4" />
        <p className="text-sm font-medium">{label}</p>
      </div>
      <p className="mt-2 text-3xl font-semibold text-white tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-secondary">{hint}</p>}
    </Card>
  )
}
