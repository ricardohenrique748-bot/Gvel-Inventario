import { useState, useRef, useEffect } from 'react'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameDay,
  isBefore,
  isAfter,
  isWithinInterval,
  parseISO,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, CalendarDays, X } from 'lucide-react'
import { cn } from '@/lib/cn'

interface DateRangePickerProps {
  startDate?: string // 'yyyy-MM-dd'
  endDate?: string   // 'yyyy-MM-dd'
  onChange: (start: string | undefined, end: string | undefined) => void
  placeholder?: string
}

function buildCalendarDays(month: Date): Date[] {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 })
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 })
  const days: Date[] = []
  for (let d = start; !isAfter(d, end); d = addDays(d, 1)) {
    days.push(new Date(d))
  }
  return days
}

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

export function DateRangePicker({ startDate, endDate, onChange, placeholder = 'Selecionar período' }: DateRangePickerProps) {
  const [open, setOpen] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(() => {
    return startDate ? startOfMonth(parseISO(startDate)) : startOfMonth(new Date())
  })
  // Durante seleção: primeiro clique = picking, segundo clique = fecha
  const [picking, setPicking] = useState<Date | null>(null)
  const [hovered, setHovered] = useState<Date | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setPicking(null)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const start = startDate ? parseISO(startDate) : null
  const end = endDate ? parseISO(endDate) : null

  // Range visual durante o hover enquanto o usuário está escolhendo o segundo ponto
  const rangeStart = picking ?? start
  const rangeEnd = picking ? (hovered ?? picking) : end

  const normalizedStart = rangeStart && rangeEnd && isAfter(rangeStart, rangeEnd) ? rangeEnd : rangeStart
  const normalizedEnd = rangeStart && rangeEnd && isAfter(rangeStart, rangeEnd) ? rangeStart : rangeEnd

  function handleDayClick(day: Date) {
    if (!picking) {
      // Primeiro clique: define o início
      setPicking(day)
    } else {
      // Segundo clique: define o intervalo
      const s = isBefore(day, picking) ? day : picking
      const e = isBefore(day, picking) ? picking : day
      onChange(format(s, 'yyyy-MM-dd'), format(e, 'yyyy-MM-dd'))
      setPicking(null)
      setOpen(false)
    }
  }

  function handleClear() {
    onChange(undefined, undefined)
    setPicking(null)
  }

  function handleHoje() {
    const hoje = format(new Date(), 'yyyy-MM-dd')
    onChange(hoje, hoje)
    setPicking(null)
    setOpen(false)
  }

  function formatLabel() {
    if (!startDate && !endDate) return null
    if (startDate === endDate) return format(parseISO(startDate!), "dd/MM/yyyy")
    if (startDate && endDate) return `${format(parseISO(startDate), 'dd/MM')} → ${format(parseISO(endDate), 'dd/MM/yyyy')}`
    if (startDate) return `De ${format(parseISO(startDate), 'dd/MM/yyyy')}`
    return null
  }

  const label = formatLabel()
  const days = buildCalendarDays(currentMonth)

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-all duration-150',
          'bg-surface border-border hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/40',
          open && 'border-primary/60 ring-2 ring-primary/30',
          label ? 'text-foreground' : 'text-secondary',
        )}
      >
        <CalendarDays className="h-4 w-4 shrink-0 text-secondary" />
        <span className="whitespace-nowrap">{label ?? placeholder}</span>
        {label && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); handleClear() }}
            onKeyDown={(e) => e.key === 'Enter' && handleClear()}
            className="ml-1 rounded p-0.5 text-secondary hover:bg-overlay/10 hover:text-foreground"
            aria-label="Limpar data"
          >
            <X className="h-3.5 w-3.5" />
          </span>
        )}
      </button>

      {/* Dropdown calendário */}
      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-72 rounded-2xl border border-border bg-surface shadow-[0_16px_48px_-8px_rgba(0,0,0,0.5)] animate-fade-in-up">
          {/* Cabeçalho do mês */}
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <button
              type="button"
              onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-secondary transition-colors hover:bg-overlay/10 hover:text-foreground"
              aria-label="Mês anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold capitalize text-foreground">
              {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
            </span>
            <button
              type="button"
              onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-secondary transition-colors hover:bg-overlay/10 hover:text-foreground"
              aria-label="Próximo mês"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Dias da semana */}
          <div className="grid grid-cols-7 px-3 pb-1">
            {WEEKDAYS.map((d, i) => (
              <div key={i} className="flex h-8 items-center justify-center text-[11px] font-medium text-secondary">
                {d}
              </div>
            ))}
          </div>

          {/* Grade de dias */}
          <div className="grid grid-cols-7 px-3 pb-3">
            {days.map((day, i) => {
              const isCurrentMonth = day.getMonth() === currentMonth.getMonth()
              const isStart = normalizedStart ? isSameDay(day, normalizedStart) : false
              const isEnd = normalizedEnd ? isSameDay(day, normalizedEnd) : false
              const inRange =
                normalizedStart && normalizedEnd && !isSameDay(normalizedStart, normalizedEnd)
                  ? isWithinInterval(day, { start: normalizedStart, end: normalizedEnd })
                  : false
              const isToday = isSameDay(day, new Date())
              const isSelected = isStart || isEnd

              return (
                <div
                  key={i}
                  className={cn(
                    'relative flex h-8 items-center justify-center',
                    // fundo do range (barra horizontal)
                    inRange && isCurrentMonth && 'bg-primary/12',
                    // cantos arredondados nas pontas do range
                    isStart && normalizedEnd && !isSameDay(normalizedStart!, normalizedEnd!) && 'rounded-l-full bg-primary/12',
                    isEnd && normalizedStart && !isSameDay(normalizedStart!, normalizedEnd!) && 'rounded-r-full bg-primary/12',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => isCurrentMonth && handleDayClick(day)}
                    onMouseEnter={() => picking && setHovered(day)}
                    onMouseLeave={() => picking && setHovered(null)}
                    className={cn(
                      'relative z-10 flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium transition-all duration-100',
                      !isCurrentMonth && 'text-secondary/30 cursor-default pointer-events-none',
                      isCurrentMonth && !isSelected && 'text-foreground hover:bg-overlay/10',
                      isSelected && 'bg-primary text-white shadow-md shadow-primary/40 scale-105',
                      isToday && !isSelected && 'border border-primary/50 text-primary font-bold',
                      picking && isCurrentMonth && !isSelected && 'cursor-pointer',
                    )}
                    tabIndex={isCurrentMonth ? 0 : -1}
                    aria-label={format(day, 'dd/MM/yyyy')}
                    aria-pressed={isSelected}
                  >
                    {format(day, 'd')}
                  </button>
                </div>
              )
            })}
          </div>

          {/* Rodapé */}
          <div className="flex items-center justify-between border-t border-border px-4 py-2.5">
            <button
              type="button"
              onClick={handleClear}
              className="text-xs text-secondary transition-colors hover:text-foreground"
            >
              Limpar
            </button>
            {picking && (
              <span className="text-xs text-secondary italic">Clique no segundo dia</span>
            )}
            <button
              type="button"
              onClick={handleHoje}
              className="text-xs font-medium text-primary transition-colors hover:text-primary/80"
            >
              Hoje
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
