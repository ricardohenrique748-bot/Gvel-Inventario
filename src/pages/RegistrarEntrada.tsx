import { useEffect, useRef, useState } from 'react'
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
import { registrarEntrada, type FotosEntrada, type RegistrarEntradaInput } from '@/hooks/useMovimentacoes'
import { Plus, X, RotateCcw, Trash2, FileClock } from 'lucide-react'
import { FotoInput } from '@/components/FotoInput'
import { nowLocalInputValue } from '@/lib/format'
import { ANGULOS_FOTO, type AnguloFoto } from '@/lib/fotos'
import { type FotoExtraItem } from '@/lib/fotosExtras'
import { comprimirImagem } from '@/lib/imagem'
import { tipoVeiculoLabel } from '@/lib/tipoVeiculo'
import {
  salvarRascunhoEntrada,
  listarRascunhosEntrada,
  removerRascunhoEntrada,
  atualizarErroRascunhoEntrada,
  type RascunhoEntrada,
} from '@/lib/rascunhosEntrada'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

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
    kmEntrada: z.number().int('KM inválido').min(0, 'KM inválido').optional(),
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
  const [submitAviso, setSubmitAviso] = useState<string | null>(null)
  const [fotos, setFotos] = useState<Partial<Record<AnguloFoto, { file: File; previewUrl: string }>>>({})
  const [fotosExtras, setFotosExtras] = useState<FotoExtraItem[]>([])
  const inputFotoExtraRef = useRef<HTMLInputElement>(null)
  const [comprimindoExtra, setComprimindoExtra] = useState(false)

  const [rascunhos, setRascunhos] = useState<RascunhoEntrada[]>([])
  const [rascunhoEnviandoId, setRascunhoEnviandoId] = useState<string | null>(null)

  const carregarRascunhos = async () => {
    try {
      setRascunhos(await listarRascunhosEntrada())
    } catch (err) {
      console.warn('Não foi possível ler rascunhos de entrada:', err)
    }
  }

  // Retorna o id do veículo se conseguiu enviar, ou null se ainda falhou.
  // Não navega — quem chama decide o que fazer com o resultado (a tentativa
  // manual navega até o veículo, a automática em segundo plano não).
  async function tentarEnviarRascunho(rascunho: RascunhoEntrada): Promise<string | null> {
    try {
      const mov = await registrarEntrada(rascunho.input, rascunho.fotos)
      await removerRascunhoEntrada(rascunho.id)
      return mov.veiculo_id
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : 'Não foi possível enviar o rascunho.'
      await atualizarErroRascunhoEntrada(rascunho.id, mensagem)
      return null
    }
  }

  useEffect(() => {
    carregarRascunhos()

    // Quando a conexão voltar, tenta reenviar os rascunhos pendentes sozinho
    // em segundo plano (sem navegar, sem interromper o que o usuário estiver
    // fazendo na tela) — um por vez, pra não sobrecarregar uma conexão que
    // acabou de voltar.
    let cancelado = false
    const handleOnline = async () => {
      const pendentes = await listarRascunhosEntrada()
      for (const r of pendentes) {
        if (cancelado) return
        await tentarEnviarRascunho(r)
      }
      if (!cancelado) await carregarRascunhos()
    }
    window.addEventListener('online', handleOnline)
    return () => {
      cancelado = true
      window.removeEventListener('online', handleOnline)
    }
  }, [])

  async function handleTentarRascunho(rascunho: RascunhoEntrada) {
    setRascunhoEnviandoId(rascunho.id)
    try {
      const veiculoId = await tentarEnviarRascunho(rascunho)
      if (veiculoId) {
        navigate(`/veiculos/${veiculoId}`)
      } else {
        await carregarRascunhos()
      }
    } finally {
      setRascunhoEnviandoId(null)
    }
  }

  async function handleExcluirRascunho(id: string) {
    if (!confirm('Excluir este rascunho? A entrada preenchida e as fotos serão perdidas.')) return
    await removerRascunhoEntrada(id)
    await carregarRascunhos()
  }

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
  }

  function handleRemoverFoto(campo: AnguloFoto) {
    setFotos((prev) => {
      const next = { ...prev }
      delete next[campo]
      return next
    })
  }

  async function handleAdicionarFotoExtra(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setComprimindoExtra(true)
    try {
      const comprimida = await comprimirImagem(file)
      const nova: FotoExtraItem = {
        id: `nova-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        file: comprimida,
        previewUrl: URL.createObjectURL(comprimida),
        label: `Foto extra ${fotosExtras.length + 1}`,
      }
      setFotosExtras((prev) => [...prev, nova])
    } finally {
      setComprimindoExtra(false)
    }
  }

  function handleRemoverFotoExtra(id: string) {
    setFotosExtras((prev) => prev.filter((f) => f.id !== id))
  }

  async function onSubmit(values: FormValues) {
    setSubmitError(null)
    setSubmitAviso(null)

    const fotosEntrada: FotosEntrada = {
      frente: fotos.frente?.file,
      ladoEsquerdo: fotos.ladoEsquerdo?.file,
      ladoDireito: fotos.ladoDireito?.file,
      traseira: fotos.traseira?.file,
      painel: fotos.painel?.file,
      extras: fotosExtras.map((f) => ({
        file: f.file,
        label: f.label,
      })),
    }

    const temFoto = Boolean(
      fotos.frente?.file ||
      fotos.ladoEsquerdo?.file ||
      fotos.ladoDireito?.file ||
      fotos.traseira?.file ||
      fotos.painel?.file ||
      fotosExtras.length > 0
    )

    if (!temFoto) {
      setSubmitError('É obrigatório adicionar pelo menos uma foto do veículo.')
      return
    }

    const input: RegistrarEntradaInput =
      values.veiculoId === NOVO_VEICULO
        ? {
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
            motorista: values.motorista || undefined,
            dataHoraEntrada: new Date(values.dataHoraEntrada).toISOString(),
            kmEntrada: values.kmEntrada || undefined,
            observacoes: values.observacoes?.trim() || undefined,
          }
        : {
            veiculoId: values.veiculoId,
            patioId: values.patioId,
            statusId: values.statusId || undefined,
            motorista: values.motorista || undefined,
            dataHoraEntrada: new Date(values.dataHoraEntrada).toISOString(),
            kmEntrada: values.kmEntrada || undefined,
            observacoes: values.observacoes?.trim() || undefined,
          }

    try {
      const mov = await registrarEntrada(input, fotosEntrada)
      navigate(`/veiculos/${mov.veiculo_id}`)
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : 'Não foi possível registrar a entrada.'
      try {
        const nomeCliente = clientes.find((c) => c.id === values.clienteId)?.nome
        const placaResumo = values.veiculoId === NOVO_VEICULO ? values.placa : veiculoSelecionado?.placa
        const resumo = [placaResumo || 'PLACA NÃO INFORMADA', nomeCliente].filter(Boolean).join(' — ')
        await salvarRascunhoEntrada(input, fotosEntrada, resumo, mensagem)
        await carregarRascunhos()
        setSubmitAviso(
          'Não foi possível enviar agora (falha de conexão). Os dados e as fotos foram salvos como rascunho abaixo — tente novamente quando a internet melhorar.',
        )
      } catch (draftErr) {
        console.error('Falha ao salvar rascunho local da entrada:', draftErr)
        setSubmitError(mensagem)
      }
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

      {rascunhos.length > 0 && (
        <Card className="max-w-2xl mb-5 border-amber-500/30 bg-amber-500/5">
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 mb-3">
              <FileClock className="h-4 w-4 text-amber-500 shrink-0" />
              <p className="text-sm font-semibold text-foreground">
                {rascunhos.length} entrada{rascunhos.length > 1 ? 's' : ''} pendente{rascunhos.length > 1 ? 's' : ''} de envio
              </p>
            </div>
            <div className="space-y-2.5">
              {rascunhos.map((r) => (
                <div key={r.id} className="rounded-xl border border-border/10 bg-background p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{r.resumo}</p>
                      <p className="text-xs text-secondary mt-0.5">
                        Salvo em {format(new Date(r.criadoEm), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                      {r.ultimoErro && (
                        <p className="text-xs text-status-danger mt-1">{r.ultimoErro}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleTentarRascunho(r)}
                        disabled={rascunhoEnviandoId === r.id}
                        className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 bg-primary/10 hover:bg-primary/20 px-2.5 py-1.5 rounded-lg transition-all disabled:opacity-50 cursor-pointer"
                      >
                        <RotateCcw className={`h-3.5 w-3.5 ${rascunhoEnviandoId === r.id ? 'animate-spin' : ''}`} />
                        {rascunhoEnviandoId === r.id ? 'Enviando…' : 'Tentar enviar'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleExcluirRascunho(r.id)}
                        disabled={rascunhoEnviandoId === r.id}
                        className="flex items-center justify-center h-7 w-7 text-secondary hover:text-status-danger hover:bg-status-danger/10 rounded-lg transition-all disabled:opacity-50 cursor-pointer"
                        aria-label="Excluir rascunho"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="max-w-2xl">
        <CardContent className="pt-6">
          {submitAviso && (
            <div className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
              {submitAviso}
            </div>
          )}
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
                  <span className="ml-1 text-xs text-secondary font-normal">(opcional)</span>
                </Label>
                <Input id="motorista" placeholder="Opcional" {...register('motorista')} />
                <FieldError message={errors.motorista?.message} />
              </div>
              <div>
                <Label htmlFor="kmEntrada">KM</Label>
                <Input
                  id="kmEntrada"
                  type="number"
                  inputMode="numeric"
                  placeholder="Opcional"
                  {...register('kmEntrada', { valueAsNumber: true })}
                />
                <FieldError message={errors.kmEntrada?.message} />
              </div>
            </div>

            <div>
              <Label htmlFor="dataHoraEntrada">Data/hora de entrada<Req /></Label>
              <Input id="dataHoraEntrada" type="datetime-local" {...register('dataHoraEntrada')} />
              <FieldError message={errors.dataHoraEntrada?.message} />
            </div>

            <div>
              <Label htmlFor="observacoes">
                Observações
                <span className="ml-1 text-xs text-secondary font-normal">(opcional)</span>
              </Label>
              <Textarea id="observacoes" placeholder="Opcional" {...register('observacoes')} />
              <FieldError message={errors.observacoes?.message} />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="mb-0">
                  Fotos do veículo<Req />
                  <span className="ml-1.5 text-xs text-status-danger font-semibold">(obrigatório)</span>
                </Label>
                <button
                  type="button"
                  onClick={() => inputFotoExtraRef.current?.click()}
                  disabled={comprimindoExtra}
                  className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 bg-primary/10 hover:bg-primary/20 px-2.5 py-1 rounded-lg transition-all disabled:opacity-50 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" /> Adicionar foto
                </button>
              </div>

              <input
                ref={inputFotoExtraRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleAdicionarFotoExtra}
              />

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

                {fotosExtras.map((extra, idx) => (
                  <div key={extra.id} className="rounded-xl bg-background p-3 relative flex flex-col justify-between min-h-[96px]">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-foreground truncate">{extra.label || `Foto extra ${idx + 1}`}</p>
                    </div>
                    <div className="relative mt-2 inline-block">
                      <img
                        src={extra.previewUrl}
                        alt={extra.label}
                        loading="lazy"
                        decoding="async"
                        className="h-16 w-16 rounded-lg object-cover border border-border/10"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoverFotoExtra(extra.id)}
                        className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-status-danger text-white hover:bg-red-700 transition-colors shadow-sm cursor-pointer"
                        aria-label={`Remover ${extra.label}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => inputFotoExtraRef.current?.click()}
                  disabled={comprimindoExtra}
                  className="rounded-xl border-2 border-dashed border-border/40 hover:border-primary/60 bg-background/50 hover:bg-primary/5 p-3 flex flex-col items-center justify-center gap-1.5 text-secondary hover:text-primary transition-all min-h-[96px] cursor-pointer group disabled:opacity-50"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface text-secondary group-hover:text-primary transition-colors">
                    <Plus className="h-5 w-5" />
                  </div>
                  <span className="text-[11px] font-bold">
                    {comprimindoExtra ? 'Processando...' : '+ Foto extra'}
                  </span>
                </button>
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
