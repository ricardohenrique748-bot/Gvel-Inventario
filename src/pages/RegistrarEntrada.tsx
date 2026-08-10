import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { PageHeader } from '@/components/layout/Header'
import { Card, CardContent } from '@/components/ui/Card'
import { Input, Label, FieldError, Textarea } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { QuickCreateSelect } from '@/components/QuickCreateSelect'
import { SearchableSelect } from '@/components/SearchableSelect'
import { TipoVeiculoRadioGroup } from '@/components/TipoVeiculoRadioGroup'
import { useClientes, criarCliente } from '@/hooks/useClientes'
import { useMarcas, useModelos, criarMarca, criarModelo } from '@/hooks/useMarcasModelos'
import { usePatios, criarPatio } from '@/hooks/usePatios'
import { useStatusManutencao, criarStatusManutencao } from '@/hooks/useStatusManutencao'
import { useVeiculosPorCliente } from '@/hooks/useVeiculos'
import { registrarEntrada, type FotosEntrada } from '@/hooks/useMovimentacoes'
import { FotoInput } from '@/components/FotoInput'
import { nowLocalInputValue } from '@/lib/format'
import { ANGULOS_FOTO, type AnguloFoto } from '@/lib/fotos'
import { tipoVeiculoLabel } from '@/lib/tipoVeiculo'

const NOVO_VEICULO = '__novo__'
const anoAtual = new Date().getFullYear()

const schema = z
  .object({
    clienteId: z.string().min(1, 'Selecione o cliente'),
    veiculoId: z.string().min(1, 'Selecione a placa'),
    placa: z.string().optional(),
    tipo: z.enum(['pesado', 'leve', 'trator', 'carreta']).optional(),
    cor: z.string().optional(),
    chassi: z.string().optional(),
    situacao: z.enum(['operante', 'inoperante']).optional(),
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

    // Tipo sempre obrigatório
    if (!values.tipo) ctx.addIssue({ code: 'custom', path: ['tipo'], message: 'Selecione o tipo' })

    const isPesadoOuLeve = values.tipo === 'pesado' || values.tipo === 'leve'

    if (isPesadoOuLeve) {
      // Pesado e Leve: todos os campos obrigatórios
      if (!values.placa || values.placa.trim().length < 7) {
        ctx.addIssue({ code: 'custom', path: ['placa'], message: 'Placa inválida' })
      }
      if (!values.cor || values.cor.trim() === '') {
        ctx.addIssue({ code: 'custom', path: ['cor'], message: 'Informe a cor' })
      }
      if (!values.ano || Number.isNaN(values.ano)) {
        ctx.addIssue({ code: 'custom', path: ['ano'], message: 'Informe o ano' })
      }
      if (!values.marcaId) {
        ctx.addIssue({ code: 'custom', path: ['marcaId'], message: 'Selecione a marca' })
      }
      if (!values.modeloId) {
        ctx.addIssue({ code: 'custom', path: ['modeloId'], message: 'Selecione o modelo' })
      }
      if (!values.situacao) {
        ctx.addIssue({ code: 'custom', path: ['situacao'], message: 'Selecione a situação' })
      }
      if (!values.motorista || values.motorista.trim() === '') {
        ctx.addIssue({ code: 'custom', path: ['motorista'], message: 'Informe o motorista' })
      }
    } else {
      // Trator e Carreta: apenas cor obrigatória (pátio e data já validados pelo schema base)
      if (!values.cor || values.cor.trim() === '') {
        ctx.addIssue({ code: 'custom', path: ['cor'], message: 'Informe a cor' })
      }
    }
  })

type FormValues = z.infer<typeof schema>


export function RegistrarEntrada() {
  const navigate = useNavigate()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [fotos, setFotos] = useState<Partial<Record<AnguloFoto, { file: File; previewUrl: string }>>>({})
  const [erroFotos, setErroFotos] = useState<string | null>(null)

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
      situacao: 'operante',
      dataHoraEntrada: nowLocalInputValue(),
    },
  })

  const clienteId = watch('clienteId')
  const veiculoId = watch('veiculoId')
  const marcaId = watch('marcaId')
  const tipoSelecionado = watch('tipo')
  const modoNovoVeiculo = veiculoId === NOVO_VEICULO
  const isPesadoOuLeve = tipoSelecionado === 'pesado' || tipoSelecionado === 'leve'
  const isTratorOuCarreta = tipoSelecionado === 'trator' || tipoSelecionado === 'carreta'

  const { veiculos: frotaCliente, loading: loadingFrota } = useVeiculosPorCliente(clienteId)
  const { modelos, refetch: refetchModelos } = useModelos(marcaId)

  useEffect(() => {
    setValue('veiculoId', '')
  }, [clienteId, setValue])

  function handleSelecionarFoto(campo: AnguloFoto, file: File, previewUrl: string) {
    setFotos((prev) => ({ ...prev, [campo]: { file, previewUrl } }))
    setErroFotos(null)
  }

  function handleRemoverFoto(campo: AnguloFoto) {
    setFotos((prev) => {
      const next = { ...prev }
      delete next[campo]
      return next
    })
  }

  async function onSubmit(values: FormValues) {
    setSubmitError(null)
    setErroFotos(null)

    const fotosEntrada: FotosEntrada = {
      frente: fotos.frente?.file,
      ladoEsquerdo: fotos.ladoEsquerdo?.file,
      ladoDireito: fotos.ladoDireito?.file,
      traseira: fotos.traseira?.file,
      painel: fotos.painel?.file,
    }

    try {
      const mov =
        values.veiculoId === NOVO_VEICULO
          ? await registrarEntrada(
              {
                placa: values.placa ?? `SEM-${Date.now()}`,
                marcaId: values.marcaId ?? '',
                modeloId: values.modeloId ?? '',
                clienteId: values.clienteId,
                tipo: values.tipo!,
                cor: values.cor ?? '',
                chassi: values.chassi,
                operante: values.situacao ? values.situacao === 'operante' : true,
                ano: values.ano && !Number.isNaN(values.ano) ? values.ano : new Date().getFullYear(),
                patioId: values.patioId,
                statusId: values.statusId || undefined,
                motorista: values.motorista,
                dataHoraEntrada: new Date(values.dataHoraEntrada).toISOString(),
                observacoes: values.observacoes,
              },
              fotosEntrada,
            )
          : await registrarEntrada(
              {
                veiculoId: values.veiculoId,
                patioId: values.patioId,
                statusId: values.statusId || undefined,
                motorista: values.motorista,
                dataHoraEntrada: new Date(values.dataHoraEntrada).toISOString(),
                observacoes: values.observacoes,
              },
              fotosEntrada,
            )
      navigate(`/veiculos/${mov.veiculo_id}`)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Não foi possível registrar a entrada.')
    }
  }

  const veiculoSelecionado = frotaCliente.find((v) => v.id === veiculoId)

  // Helper para label com asterisco de obrigatório
  function Req() {
    return <span className="ml-0.5 text-red-400">*</span>
  }

  return (
    <div>
      <PageHeader title="Registrar entrada" subtitle="Novo veículo no pátio" back />

      <Card className="max-w-2xl">
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
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
              <Controller
                control={control}
                name="veiculoId"
                render={({ field }) => (
                  <SearchableSelect
                    label="Placa"
                    value={field.value}
                    onChange={field.onChange}
                    loading={loadingFrota}
                    loadingLabel="Carregando frota…"
                    emptyMessage="Nenhuma placa encontrada."
                    options={frotaCliente.map((v) => ({
                      id: v.id,
                      label: `${v.placa} — ${v.marca?.nome ?? ''} ${v.modelo?.nome ?? ''}`.trim(),
                    }))}
                    extraOption={{ id: NOVO_VEICULO, label: '+ Cadastrar veículo novo' }}
                    placeholder="Buscar placa…"
                    error={errors.veiculoId?.message}
                  />
                )}
              />
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

                {/* Aviso visual de campos obrigatórios conforme tipo */}
                {isTratorOuCarreta && (
                  <p className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-400">
                    Para <strong>{tipoSelecionado === 'trator' ? 'trator' : 'carreta'}</strong>: pátio, cor, data/hora e fotos são obrigatórios — os demais campos são opcionais.
                  </p>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="placa">
                      Placa{isPesadoOuLeve && <Req />}
                      {isTratorOuCarreta && <span className="ml-1 text-xs text-secondary font-normal">(opcional)</span>}
                    </Label>
                    <Input id="placa" placeholder="ABC1D23" className="uppercase" {...register('placa')} />
                    <FieldError message={errors.placa?.message} />
                  </div>
                  <div>
                    <Label htmlFor="cor">
                      Cor<Req />
                    </Label>
                    <Input id="cor" placeholder="Branco" {...register('cor')} />
                    <FieldError message={errors.cor?.message} />
                  </div>
                </div>

                <div>
                  <Label>
                    Situação
                    {isPesadoOuLeve && <Req />}
                    {isTratorOuCarreta && <span className="ml-1 text-xs text-secondary font-normal">(opcional)</span>}
                  </Label>
                  <div className="flex gap-3">
                    <label className="flex-1">
                      <input type="radio" value="operante" className="peer sr-only" {...register('situacao')} />
                      <div className="h-12 flex items-center justify-center rounded-xl border border-secondary/30 text-secondary peer-checked:border-status-success peer-checked:bg-status-success/10 peer-checked:text-foreground cursor-pointer">
                        Operante
                      </div>
                    </label>
                    <label className="flex-1">
                      <input type="radio" value="inoperante" className="peer sr-only" {...register('situacao')} />
                      <div className="h-12 flex items-center justify-center rounded-xl border border-secondary/30 text-secondary peer-checked:border-status-danger peer-checked:bg-status-danger/10 peer-checked:text-foreground cursor-pointer">
                        Inoperante
                      </div>
                    </label>
                  </div>
                  <FieldError message={errors.situacao?.message} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="ano">
                      Ano
                      {isPesadoOuLeve && <Req />}
                      {isTratorOuCarreta && <span className="ml-1 text-xs text-secondary font-normal">(opcional)</span>}
                    </Label>
                    <Input
                      id="ano"
                      type="number"
                      placeholder={String(anoAtual)}
                      min={1950}
                      max={anoAtual + 1}
                      {...register('ano', { valueAsNumber: true })}
                    />
                    <FieldError message={errors.ano?.message} />
                  </div>
                  <div>
                    <Label htmlFor="chassi">
                      Chassi
                      <span className="ml-1 text-xs text-secondary font-normal">(opcional)</span>
                    </Label>
                    <Input id="chassi" placeholder="Opcional" {...register('chassi')} />
                    <FieldError message={errors.chassi?.message} />
                  </div>
                </div>

                <Controller
                  control={control}
                  name="marcaId"
                  render={({ field }) => (
                    <QuickCreateSelect
                      label={
                        isPesadoOuLeve
                          ? 'Marca *'
                          : 'Marca (opcional)'
                      }
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
                      label={
                        isPesadoOuLeve
                          ? 'Modelo *'
                          : 'Modelo (opcional)'
                      }
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
                  label="Pátio *"
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
                  label="Status (opcional)"
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
                <Label htmlFor="motorista">
                  Motorista
                  {isPesadoOuLeve && modoNovoVeiculo && <Req />}
                  {(isTratorOuCarreta || !modoNovoVeiculo) && (
                    <span className="ml-1 text-xs text-secondary font-normal">(opcional)</span>
                  )}
                </Label>
                <Input id="motorista" placeholder={isPesadoOuLeve && modoNovoVeiculo ? '' : 'Opcional'} {...register('motorista')} />
                <FieldError message={errors.motorista?.message} />
              </div>
              <div>
                <Label htmlFor="dataHoraEntrada">Data/hora de entrada<Req /></Label>
                <Input id="dataHoraEntrada" type="datetime-local" {...register('dataHoraEntrada')} />
                <FieldError message={errors.dataHoraEntrada?.message} />
              </div>
            </div>

            <div>
              <Label htmlFor="observacoes">
                Observações
                <span className="ml-1 text-xs text-secondary font-normal">(opcional)</span>
              </Label>
              <Textarea id="observacoes" placeholder="Opcional" {...register('observacoes')} />
            </div>

            <div>
              <Label>
                Fotos do veículo
                <span className="ml-1 text-xs text-secondary font-normal">(opcional)</span>
              </Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {ANGULOS_FOTO.map(({ campo, label }) => (
                  <FotoInput
                    key={campo}
                    label={label}
                    previewUrl={fotos[campo]?.previewUrl}
                    onSelect={(file, previewUrl) => handleSelecionarFoto(campo, file, previewUrl)}
                    onRemove={() => handleRemoverFoto(campo)}
                  />
                ))}
              </div>
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
