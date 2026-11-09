// Tooltip padrão dos gráficos (Recharts `content`): cartão com o título
// (dia, marca…) e uma linha por série com a bolinha da cor + valor.
// O texto fica nas cores de texto do tema; a cor da série só na bolinha.

interface Item {
  name?: string | number
  value?: string | number | (string | number)[]
  color?: string
  payload?: Record<string, unknown> & { fill?: string }
}

interface ChartTooltipProps {
  active?: boolean
  label?: string | number
  payload?: readonly Item[]
  /** Formata o valor de cada linha (ex.: acrescentar %). */
  formatValue?: (value: number, item: Item) => string
  /** Título quando não vem `label` (ex.: rosca, que usa o nome da fatia). */
  titleFromName?: boolean
}

export function ChartTooltip({ active, label, payload, formatValue, titleFromName }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  const titulo = titleFromName ? payload[0]?.name : label

  return (
    <div className="min-w-[140px] rounded-xl border border-border/10 bg-surface/95 px-3 py-2.5 shadow-xl shadow-black/30 backdrop-blur">
      {titulo !== undefined && titulo !== '' && (
        <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-secondary">{titulo}</p>
      )}
      <div className="space-y-1">
        {payload.map((item, i) => {
          const valor = Number(Array.isArray(item.value) ? item.value[0] : item.value ?? 0)
          const cor = item.color || item.payload?.fill
          return (
            <div key={`${item.name}-${i}`} className="flex items-center justify-between gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-secondary">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: cor }} />
                {titleFromName ? 'Veículos' : item.name}
              </span>
              <span className="font-bold tabular-nums text-foreground">
                {formatValue ? formatValue(valor, item) : valor.toLocaleString('pt-BR')}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
