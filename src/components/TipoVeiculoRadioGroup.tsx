import type { FieldValues, Path, UseFormRegister } from 'react-hook-form'
import { Label } from '@/components/ui/Input'
import { TIPOS_VEICULO } from '@/lib/tipoVeiculo'

interface Props<T extends FieldValues> {
  register: UseFormRegister<T>
  name: Path<T>
}

export function TipoVeiculoRadioGroup<T extends FieldValues>({ register, name }: Props<T>) {
  return (
    <div>
      <Label>Tipo de veículo</Label>
      <div className="grid grid-cols-2 gap-3">
        {TIPOS_VEICULO.map((t) => (
          <label key={t.value}>
            <input type="radio" value={t.value} className="peer sr-only" {...register(name)} />
            <div className="h-12 flex items-center justify-center rounded-xl border border-secondary/30 text-secondary peer-checked:border-primary peer-checked:bg-primary/10 peer-checked:text-foreground cursor-pointer">
              {t.label}
            </div>
          </label>
        ))}
      </div>
    </div>
  )
}
