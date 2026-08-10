import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Card, CardContent } from '@/components/ui/Card'
import { Input, Label, FieldError, Select } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { QuickCreateSelect } from '@/components/QuickCreateSelect'
import { TipoVeiculoRadioGroup } from '@/components/TipoVeiculoRadioGroup'
import { useClientes, criarCliente } from '@/hooks/useClientes'
import { useMarcas, useModelos, criarMarca, criarModelo } from '@/hooks/useMarcasModelos'
import { useVeiculosPorCliente } from '@/hooks/useVeiculos'
import { formatDateTime } from '@/lib/format'
import { tipoVeiculoLabel } from '@/lib/tipoVeiculo'
import type { InspecaoWizardState } from './types'

const NOVO_VEICULO = '__novo__'

const schema = z
  .object({
    clienteId: z.string().min(1, 'Selecione o cliente'),
    veiculoId: z.string().min(1, 'Selecione a placa'),
    tipo: z.enum(['pesado', 'leve', 'trator', 'carreta']),
    placa: z.string().optional(),
    marcaId: z.string().optional(),
    modeloId: z.string().optional(),
    motorista: z.string().optional(),
    km: z.string().optional(),
    inspetor: z.string().trim().min(1, 'Informe o nome do inspetor'),
  })
  .superRefine((values, ctx) => {
    if (values.veiculoId !== NOVO_VEICULO) return
    if (!values.placa || values.placa.trim().length < 7) {
      ctx.addIssue({ code: 'custom', path: ['placa'], message: 'Placa inválida' })
    }
    if (!values.marcaId) ctx.addIssue({ code: 'custom', path: ['marcaId'], message: 'Selecione a marca' })
    if (!values.modeloId) ctx.addIssue({ code: 'custom', path: ['modeloId'], message: 'Selecione o modelo' })
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
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      tipo: state.tipo,
      placa: state.placa,
      marcaId: state.marcaId,
      modeloId: state.modeloId,
      clienteId: state.clienteId,
      veiculoId: '',
      motorista: state.motorista,
      km: state.km ? String(state.km) : undefined,
      inspetor: state.inspetor,
    },
  })

  const clienteId = watch('clienteId')
  const veiculoId = watch('veiculoId')
  const marcaId = watch('marcaId')
  const modoNovoVeiculo = veiculoId === NOVO_VEICULO

  const { veiculos: frotaCliente, loading: loadingFrota } = useVeiculosPorCliente(clienteId)
  const { modelos, refetch: refetchModelos } = useModelos(marcaId)

  useEffect(() => {
    setValue('veiculoId', '')
  }, [clienteId, setValue])

  const veiculoSelecionado = frotaCliente.find((v) => v.id === veiculoId)

  function onSubmit(values: FormValues) {
    const dados =
      values.veiculoId === NOVO_VEICULO
        ? {
            tipo: values.tipo,
            placa: values.placa!.trim().toUpperCase(),
            marcaId: values.marcaId!,
            modeloId: values.modeloId!,
          }
        : {
            tipo: veiculoSelecionado!.tipo,
            placa: veiculoSelecionado!.placa,
            marcaId: veiculoSelecionado!.marca_id,
            modeloId: veiculoSelecionado!.modelo_id,
          }

    onPatch({
      ...dados,
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

          {clienteId && (
            <div>
              <Label htmlFor="veiculoId">Placa</Label>
              <Select id="veiculoId" disabled={loadingFrota} {...register('veiculoId')}>
                <option value="">{loadingFrota ? 'Carregando frota…' : 'Selecione a placa'}</option>
                {frotaCliente.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.placa} — {v.marca?.nome} {v.modelo?.nome}
                  </option>
                ))}
                <option value={NOVO_VEICULO}>+ Cadastrar veículo novo</option>
              </Select>
              <FieldError message={errors.veiculoId?.message} />
            </div>
          )}

          {veiculoSelecionado && (
            <p className="text-sm text-secondary">
              {tipoVeiculoLabel(veiculoSelecionado.tipo)}
              {veiculoSelecionado.cor ? ` · ${veiculoSelecionado.cor}` : ''}
              {veiculoSelecionado.ano ? ` · ${veiculoSelecionado.ano}` : ''}
            </p>
          )}

          {modoNovoVeiculo && (
            <>
              <TipoVeiculoRadioGroup register={register} name="tipo" />

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
                      const created = await criarModelo(marcaId!, nome)
                      await refetchModelos()
                      return created
                    }}
                    placeholder={marcaId ? 'Selecione o modelo' : 'Selecione a marca primeiro'}
                    error={errors.modeloId?.message}
                  />
                )}
              />
            </>
          )}

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
