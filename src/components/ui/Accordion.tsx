import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'

interface AccordionItemProps {
  title: string
  subtitle?: ReactNode
  defaultOpen?: boolean
  children: ReactNode
}

export function AccordionItem({ title, subtitle, defaultOpen = false, children }: AccordionItemProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="rounded-2xl bg-surface border border-white/5 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <div>
          <p className="font-medium text-white">{title}</p>
          {subtitle}
        </div>
        <ChevronDown
          className={cn('h-5 w-5 shrink-0 text-secondary transition-transform', open && 'rotate-180')}
        />
      </button>
      {open && <div className="px-5 pb-5 space-y-4">{children}</div>}
    </div>
  )
}
