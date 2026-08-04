import { useState } from 'react'
import { Check, X } from 'lucide-react'
import { Select, Input, Label, FieldError } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

interface Option {
  id: string
  nome: string
}

interface QuickCreateSelectProps {
  label: string
  value: string | undefined
  onChange: (id: string) => void
  options: Option[]
  onCreate: (nome: string) => Promise<Option>
  placeholder: string
  disabled?: boolean
  error?: string
}

const CREATE_VALUE = '__create__'

export function QuickCreateSelect({
  label,
  value,
  onChange,
  options,
  onCreate,
  placeholder,
  disabled,
  error,
}: QuickCreateSelectProps) {
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleConfirmCreate() {
    if (!newName.trim()) return
    setSaving(true)
    try {
      const created = await onCreate(newName.trim())
      onChange(created.id)
      setCreating(false)
      setNewName('')
    } finally {
      setSaving(false)
    }
  }

  if (creating) {
    return (
      <div>
        <Label>{label}</Label>
        <div className="flex gap-2">
          <Input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nome"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleConfirmCreate()
              }
            }}
          />
          <Button type="button" size="icon" variant="success" disabled={saving} onClick={handleConfirmCreate}>
            <Check className="h-4 w-4" />
          </Button>
          <Button type="button" size="icon" variant="secondary" onClick={() => setCreating(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <Label>{label}</Label>
      <Select
        value={value ?? ''}
        disabled={disabled}
        onChange={(e) => {
          if (e.target.value === CREATE_VALUE) setCreating(true)
          else onChange(e.target.value)
        }}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.nome}
          </option>
        ))}
        <option value={CREATE_VALUE}>+ Adicionar novo…</option>
      </Select>
      <FieldError message={error} />
    </div>
  )
}
