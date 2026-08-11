import { Search, X } from 'lucide-react'
import { Input, Select } from '@/components/ui/Input'
import { DateRangePicker } from '@/components/ui/DateRangePicker'
import { SearchableSelect } from '@/components/SearchableSelect'
import { useClientes } from '@/hooks/useClientes'
import { useMarcas, useModelos } from '@/hooks/useMarcasModelos'
import { usePatios } from '@/hooks/usePatios'

export interface FiltersValue {
  search?: string
  dataInicio?: string
  dataFim?: string
  clienteId?: string
  marcaId?: string
  modeloId?: string
  patioId?: string
}

interface FiltersBarProps {
  value: FiltersValue
  onChange: (value: FiltersValue) => void
  showSearch?: boolean
  showPeriod?: boolean
  onClear?: () => void
}

export function FiltersBar({ value, onChange, showSearch = false, showPeriod = true, onClear }: FiltersBarProps) {
  const { clientes } = useClientes()
  const { marcas } = useMarcas()
  const { modelos } = useModelos(value.marcaId)
  const { patios } = usePatios()

  function patch(next: Partial<FiltersValue>) {
    onChange({ ...value, ...next })
  }

  const hasFilters = Boolean(
    value.search || value.clienteId || value.marcaId || value.modeloId || value.patioId || value.dataInicio || value.dataFim
  )

  return (
    <div className="flex flex-col gap-3">
      {/* Linha 1: busca + período + limpar */}
      {(showSearch || showPeriod || onClear) && (
        <div className="flex flex-wrap items-center gap-2">
          {showSearch && (
            <div className="relative min-w-[160px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary" />
              <Input
                placeholder="Buscar por placa"
                className="pl-9"
                value={value.search ?? ''}
                onChange={(e) => patch({ search: e.target.value.toUpperCase() })}
              />
            </div>
          )}

          {showPeriod && (
            <DateRangePicker
              startDate={value.dataInicio}
              endDate={value.dataFim}
              onChange={(start, end) => patch({ dataInicio: start, dataFim: end })}
              placeholder="Selecionar período"
            />
          )}

          {onClear && hasFilters && (
            <button
              type="button"
              onClick={onClear}
              title="Limpar filtros"
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-secondary transition-colors hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-400"
            >
              <X className="h-4 w-4" />
              Limpar
            </button>
          )}
        </div>
      )}

      {/* Linha 2: cliente + pátio + marca + modelo */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SearchableSelect
          value={value.clienteId ?? ''}
          onChange={(id) => patch({ clienteId: id || undefined })}
          options={[{ id: '', label: 'Todos os clientes' }, ...clientes.map((c) => ({ id: c.id, label: c.nome }))]}
          placeholder="Todos os clientes"
          emptyMessage="Nenhum cliente encontrado."
        />

        <Select
          value={value.patioId ?? ''}
          onChange={(e) => patch({ patioId: e.target.value || undefined })}
        >
          <option value="">Todos os pátios</option>
          {patios.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </Select>

        <Select
          value={value.marcaId ?? ''}
          onChange={(e) => patch({ marcaId: e.target.value || undefined, modeloId: undefined })}
        >
          <option value="">Todas as marcas</option>
          {marcas.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nome}
            </option>
          ))}
        </Select>

        <Select
          value={value.modeloId ?? ''}
          onChange={(e) => patch({ modeloId: e.target.value || undefined })}
          disabled={!value.marcaId}
        >
          <option value="">{value.marcaId ? 'Todos os modelos' : 'Selecione a marca'}</option>
          {modelos.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nome}
            </option>
          ))}
        </Select>
      </div>
    </div>
  )
}
