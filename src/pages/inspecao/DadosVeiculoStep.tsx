import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Card, CardContent } from '@/components/ui/Card'
import { Input, Label, FieldError } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { QuickCreateSelect } from '@/components/QuickCreateSelect'
import { useClientes, criarCliente } from '@/hooks/useClientes'
import { useMarcas, useModelos, criarMarca, criarModelo } from '@/hooks/useMarcasModelos'
import { formatDateTime } from '@/lib/format'
import type { InspecaoWizardState } from './types'

const schema = z.object({
  tipo: z.enum(['pesado', 'leve']),
  placa: z.string().trim().min(7, 'Placa inválida').max(8, 'Placa inválida'),
  marcaId: z.string().min(1, 'Selecione a marca'),
  modeloId: z.string().min(1, 'Selecione o modelo'),
  clienteId: z.string().min(1, 'Selecione o cliente'),
  motorista: z.string().optional(),
  km: z.string().optional(),
  inspetor: z.string().trim().min(1, 'Informe o nome do inspetor'),
})

type FormValues = z.infer<typeof schema>

interface Props {
  state: InspecaoWizardState
  onPatch: (next: Partial<InspecaoWizardState>) => void
  onNext: () => void
}

export function DadosVeiculoStep({ state, onPatch, onNext }: Props) {
  const { clientes, refetch: refetchClientes } = useClientes()
  const { marcas, refetch: refetchMarcas } = useMarcas()

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      tipo: state.tipo,
      placa: state.placa,
      marcaId: state.marcaId,
      modeloId: state.modeloId,
      clienteId: state.clienteId,
      motorista: state.motorista,
      km: state.km ? String(state.km) : undefined,
      inspetor: state.inspetor,
    },
  })

  const marcaId = watch('marcaId')
  const { modelos, refetch: refetchModelos } = useModelos(marcaId)

  function onSubmit(values: FormValues) {
    onPatch({
      tipo: values.tipo,
      placa: values.placa.toUpperCase(),
      marcaId: values.marcaId,
      modeloId: values.modeloId,
      clienteId: values.clienteId,
      motorista: values.motorista,
      km: values.km ? Number(values.km) : undefined,
      inspetor: values.inspetor,
      dataHora: new Date().toISOString(),
    })
    onNext()
  }

  return (
    <Card className="max-w-2xl">
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <Label>Tipo de veículo</Label>
            <div className="flex gap-3">
              <label className="flex-1">
                <input type="radio" value="pesado" className="peer sr-only" {...register('tipo')} />
                <div className="h-12 flex items-center justify-center rounded-xl border border-secondary/30 text-secondary peer-checked:border-primary peer-checked:bg-primary/10 peer-checked:text-white cursor-pointer">
                  Pesado
                </div>
              </label>
              <label className="flex-1">
                <input type="radio" value="leve" className="peer sr-only" {...register('tipo')} />
                <div className="h-12 flex items-center justify-center rounded-xl border border-secondary/30 text-secondary peer-checked:border-primary peer-checked:bg-primary/10 peer-checked:text-white cursor-pointer">
                  Leve
                </div>
              </label>
            </div>
          </div>

          <div>
            <Label htmlFor="placa">Placa</Label>
            <Input id="placa" placeholder="ABC1D23" className="uppercase" {...register('placa')} />
            <FieldError message={errors.placa?.message} />
          </div>

          <Controller
            control={control}
            name="marcaId"
            render={({ field }) => (
              <QuickCreateSelect
                label="Marca"
                value={field.value}
                onChange={field.onChange}
                options={marcas}
                onCreate={async (nome) => {
                  const created = await criarMarca(nome)
                  await refetchMarcas()
                  return created
                }}
                placeholder="Selecione a marca"
                error={errors.marcaId?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="modeloId"
            render={({ field }) => (
              <QuickCreateSelect
                label="Modelo"
                value={field.value}
                onChange={field.onChange}
                options={modelos}
                disabled={!marcaId}
                onCreate={async (nome) => {
                  const created = await criarModelo(marcaId, nome)
                  await refetchModelos()
                  return created
                }}
                placeholder={marcaId ? 'Selecione o modelo' : 'Selecione a marca primeiro'}
                error={errors.modeloId?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="clienteId"
            render={({ field }) => (
              <QuickCreateSelect
                label="Cliente"
                value={field.value}
                onChange={field.onChange}
                options={clientes}
                onCreate={async (nome) => {
                  const created = await criarCliente(nome)
                  await refetchClientes()
                  return created
                }}
                placeholder="Selecione o cliente"
                error={errors.clienteId?.message}
              />
            )}
          />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="motorista">Motorista</Label>
              <Input id="motorista" placeholder="Opcional" {...register('motorista')} />
            </div>
            <div>
              <Label htmlFor="km">KM</Label>
              <Input id="km" type="number" inputMode="numeric" placeholder="Opcional" {...register('km')} />
            </div>
          </div>

          <div>
            <Label htmlFor="inspetor">Inspetor</Label>
            <Input id="inspetor" placeholder="Nome de quem está fazendo a vistoria" {...register('inspetor')} />
            <FieldError message={errors.inspetor?.message} />
          </div>

          <p className="text-xs text-secondary">Data/hora da inspeção: {formatDateTime(new Date().toISOString())}</p>

          <div className="flex justify-end pt-2">
            <Button type="submit">Continuar</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
