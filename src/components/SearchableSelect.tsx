import { useEffect, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { Label, FieldError } from '@/components/ui/Input'
import { cn } from '@/lib/cn'

export interface SearchableSelectOption {
  id: string
  label: string
  sublabel?: string
}

interface SearchableSelectProps {
  label?: string
  value: string | undefined
  onChange: (id: string) => void
  options: SearchableSelectOption[]
  placeholder: string
  loading?: boolean
  loadingLabel?: string
  emptyMessage?: string
  disabled?: boolean
  error?: string
  extraOption?: { id: string; label: string }
}

export function SearchableSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
  loading,
  loadingLabel = 'Carregando…',
  emptyMessage = 'Nenhum resultado encontrado.',
  disabled,
  error,
  extraOption,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  const selected = options.find((o) => o.id === value) ?? (extraOption?.id === value ? extraOption : undefined)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filtered = query.trim()
    ? options.filter((o) => o.label.toUpperCase().includes(query.trim().toUpperCase()))
    : options

  return (
    <div ref={containerRef} className="relative">
      {label && <Label>{label}</Label>}
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary/60" />
        <input
          type="text"
          disabled={disabled || loading}
          value={open ? query : (selected?.label ?? '')}
          onChange={(e) => {
            setQuery(e.target.value.toUpperCase())
            setOpen(true)
          }}
          onFocus={() => {
            setQuery('')
            setOpen(true)
          }}
          placeholder={loading ? loadingLabel : placeholder}
          style={{ textTransform: 'uppercase' }}
          className="w-full h-12 rounded-xl bg-background border border-secondary/30 pl-11 pr-4 text-base text-foreground placeholder:text-secondary/60 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50 uppercase placeholder:uppercase"
        />
      </div>

      {open && !loading && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-secondary/30 bg-background shadow-lg">
          {filtered.length === 0 && <p className="px-4 py-3 text-sm text-secondary uppercase">{emptyMessage}</p>}
          {filtered.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => {
                onChange(o.id)
                setQuery('')
                setOpen(false)
              }}
              className={cn(
                'block w-full px-4 py-2.5 text-left text-sm uppercase text-foreground hover:bg-surface',
                o.id === value && 'bg-primary/10 text-primary',
              )}
            >
              {o.label}
              {o.sublabel && <span className="block text-xs text-secondary uppercase">{o.sublabel}</span>}
            </button>
          ))}
          {extraOption && (
            <button
              type="button"
              onClick={() => {
                onChange(extraOption.id)
                setQuery('')
                setOpen(false)
              }}
              className="block w-full border-t border-secondary/20 px-4 py-2.5 text-left text-sm uppercase text-primary hover:bg-surface"
            >
              {extraOption.label}
            </button>
          )}
        </div>
      )}

      <FieldError message={error} />
    </div>
  )
}
