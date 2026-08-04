import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { PageHeader } from '@/components/layout/Header'
import { Card, CardContent } from '@/components/ui/Card'
import { Input, Label, FieldError, Textarea, Select } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { QuickCreateSelect } from '@/components/QuickCreateSelect'
import { useClientes, criarCliente } from '@/hooks/useClientes'
import { useMarcas, useModelos, criarMarca, criarModelo } from '@/hooks/useMarcasModelos'
import { usePatios, criarPatio } from '@/hooks/usePatios'
import { useStatusManutencao, criarStatusManutencao } from '@/hooks/useStatusManutencao'
import { useVeiculosPorCliente } from '@/hooks/useVeiculos'
import { registrarEntrada } from '@/hooks/useMovimentacoes'
import { nowLocalInputValue } from '@/lib/format'

const NOVO_VEICULO = '__novo__'
const anoAtual = new Date().getFullYear()

const schema = z
  .object({
    clienteId: z.string().min(1, 'Selecione o cliente'),
    veiculoId: z.string().min(1, 'Selecione a placa'),
    placa: z.string().optional(),
    tipo: z.enum(['pesado', 'leve']).optional(),
    cor: z.string().optional(),
    ano: z.number().optional(),
    marcaId: z.string().optional(),
    modeloId: z.string().optional(),
    patioId: z.string().min(1, 'Selecione o pátio'),
    statusId: z.string().optional(),
    motorista: z.string().optional(),
    dataHoraEntrada: z.string().min(1, 'Informe a data/hora de entrada'),
    observacoes: z.string().optional(),
  })
  .superRefine((values, ctx) => {
    if (values.veiculoId !== NOVO_VEICULO) return
    if (!values.placa || values.placa.trim().length < 7) {
      ctx.addIssue({ code: 'custom', path: ['placa'], message: 'Placa inválida' })
    }
    if (!values.tipo) ctx.addIssue({ code: 'custom', path: ['tipo'], message: 'Selecione o tipo' })
    if (!values.cor) ctx.addIssue({ code: 'custom', path: ['cor'], message: 'Informe a cor' })
    if (!values.ano || Number.isNaN(values.ano)) {
      ctx.addIssue({ code: 'custom', path: ['ano'], message: 'Informe o ano' })
    }
    if (!values.marcaId) ctx.addIssue({ code: 'custom', path: ['marcaId'], message: 'Selecione a marca' })
    if (!values.modeloId) ctx.addIssue({ code: 'custom', path: ['modeloId'], message: 'Selecione o modelo' })
  })

type FormValues = z.infer<typeof schema>

export function RegistrarEntrada() {
  const navigate = useNavigate()
  const [submitError, setSubmitError] = useState<string | null>(null)

  const { clientes, refetch: refetchClientes } = useClientes()
  const { marcas, refetch: refetchMarcas } = useMarcas()
  const { patios, refetch: refetchPatios } = usePatios()
  const { statusManutencao, refetch: refetchStatusManutencao } = useStatusManutencao()

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      tipo: 'pesado',
      dataHoraEntrada: nowLocalInputValue(),
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

  async function onSubmit(values: FormValues) {
    setSubmitError(null)
    try {
      const mov =
        values.veiculoId === NOVO_VEICULO
          ? await registrarEntrada({
              placa: values.placa!,
              marcaId: values.marcaId!,
              modeloId: values.modeloId!,
              clienteId: values.clienteId,
              tipo: values.tipo!,
              cor: values.cor!,
              ano: values.ano!,
              patioId: values.patioId,
              statusId: values.statusId || undefined,
              motorista: values.motorista,
              dataHoraEntrada: new Date(values.dataHoraEntrada).toISOString(),
              observacoes: values.observacoes,
            })
          : await registrarEntrada({
              veiculoId: values.veiculoId,
              patioId: values.patioId,
              statusId: values.statusId || undefined,
              motorista: values.motorista,
              dataHoraEntrada: new Date(values.dataHoraEntrada).toISOString(),
              observacoes: values.observacoes,
            })
      navigate(`/veiculos/${mov.veiculo_id}`)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Não foi possível registrar a entrada.')
    }
  }

  const veiculoSelecionado = frotaCliente.find((v) => v.id === veiculoId)

  return (
    <div>
      <PageHeader title="Registrar entrada" subtitle="Novo veículo no pátio" back />

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
                  <option value="">
                    {loadingFrota ? 'Carregando frota…' : 'Selecione a placa'}
                  </option>
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
                {veiculoSelecionado.tipo === 'pesado' ? 'Pesado' : 'Leve'}
                {veiculoSelecionado.cor ? ` · ${veiculoSelecionado.cor}` : ''}
                {veiculoSelecionado.ano ? ` · ${veiculoSelecionado.ano}` : ''}
              </p>
            )}

            {modoNovoVeiculo && (
              <>
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

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="placa">Placa</Label>
                    <Input id="placa" placeholder="ABC1D23" className="uppercase" {...register('placa')} />
                    <FieldError message={errors.placa?.message} />
                  </div>
                  <div>
                    <Label htmlFor="cor">Cor</Label>
                    <Input id="cor" placeholder="Branco" {...register('cor')} />
                    <FieldError message={errors.cor?.message} />
                  </div>
                </div>

                <div>
                  <Label htmlFor="ano">Ano</Label>
                  <Input
                    id="ano"
                    type="number"
                    placeholder={String(anoAtual)}
                    {...register('ano', { valueAsNumber: true })}
                  />
                  <FieldError message={errors.ano?.message} />
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

            <Controller
              control={control}
              name="patioId"
              render={({ field }) => (
                <QuickCreateSelect
                  label="Pátio"
                  value={field.value}
                  onChange={field.onChange}
                  options={patios}
                  onCreate={async (nome) => {
                    const created = await criarPatio(nome)
                    await refetchPatios()
                    return created
                  }}
                  placeholder="Selecione o pátio"
                  error={errors.patioId?.message}
                />
              )}
            />

            <Controller
              control={control}
              name="statusId"
              render={({ field }) => (
                <QuickCreateSelect
                  label="Status"
                  value={field.value}
                  onChange={field.onChange}
                  options={statusManutencao}
                  onCreate={async (nome) => {
                    const created = await criarStatusManutencao(nome)
                    await refetchStatusManutencao()
                    return created
                  }}
                  placeholder="Sem manutenção"
                  error={errors.statusId?.message}
                />
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="motorista">Motorista</Label>
                <Input id="motorista" placeholder="Opcional" {...register('motorista')} />
              </div>
              <div>
                <Label htmlFor="dataHoraEntrada">Data/hora de entrada</Label>
                <Input id="dataHoraEntrada" type="datetime-local" {...register('dataHoraEntrada')} />
                <FieldError message={errors.dataHoraEntrada?.message} />
              </div>
            </div>

            <div>
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea id="observacoes" placeholder="Opcional" {...register('observacoes')} />
            </div>

            <FieldError message={submitError ?? undefined} />

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Salvando…' : 'Registrar entrada'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
