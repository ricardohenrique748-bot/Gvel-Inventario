import { Search } from 'lucide-react'
import { Input, Select } from '@/components/ui/Input'
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
}

export function FiltersBar({ value, onChange, showSearch = false, showPeriod = true }: FiltersBarProps) {
  const { clientes } = useClientes()
  const { marcas } = useMarcas()
  const { modelos } = useModelos(value.marcaId)
  const { patios } = usePatios()

  function patch(next: Partial<FiltersValue>) {
    onChange({ ...value, ...next })
  }

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
      {showSearch && (
        <div className="relative col-span-2 md:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary" />
          <Input
            placeholder="Buscar por placa"
            className="pl-9"
            value={value.search ?? ''}
            onChange={(e) => patch({ search: e.target.value })}
          />
        </div>
      )}

      {showPeriod && (
        <>
          <Input
            type="date"
            aria-label="Data início"
            value={value.dataInicio ?? ''}
            onChange={(e) => patch({ dataInicio: e.target.value })}
          />
          <Input
            type="date"
            aria-label="Data fim"
            value={value.dataFim ?? ''}
            onChange={(e) => patch({ dataFim: e.target.value })}
          />
        </>
      )}

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
  )
}
