import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Pencil, Trash2, X } from 'lucide-react'
import { PageHeader } from '@/components/layout/Header'
import { FiltersBar, type FiltersValue } from '@/components/FiltersBar'
import { LinkButton } from '@/components/ui/LinkButton'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/cn'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input, Label, FieldError, Textarea } from '@/components/ui/Input'
import { QuickCreateSelect } from '@/components/QuickCreateSelect'
import { StatusManutencaoBadge } from '@/components/StatusManutencaoBadge'
import { FotoInput } from '@/components/FotoInput'
import { TipoVeiculoRadioGroup } from '@/components/TipoVeiculoRadioGroup'
import { useMovimentacoes, atualizarMovimentacao, excluirMovimentacao, type FotosEntrada } from '@/hooks/useMovimentacoes'
import { usePatios, criarPatio } from '@/hooks/usePatios'
import { useStatusManutencao, criarStatusManutencao } from '@/hooks/useStatusManutencao'
import { useClientes, criarCliente } from '@/hooks/useClientes'
import { useMarcas, useModelos, criarMarca, criarModelo } from '@/hooks/useMarcasModelos'
import { atualizarVeiculo } from '@/hooks/useVeiculos'
import { formatDateTime, formatPermanencia, toLocalInputValue } from '@/lib/format'
import { ANGULOS_FOTO, type AnguloFoto } from '@/lib/fotos'
import type { MovimentacaoComVeiculo } from '@/lib/types'

const anoAtual = new Date().getFullYear()

const editSchema = z.object({
  clienteId: z.string().min(1, 'Selecione o cliente'),
  placa: z.string().trim().min(7, 'Placa inválida').max(8, 'Placa inválida'),
  tipo: z.enum(['pesado', 'leve', 'trator', 'carreta']),
  cor: z.string().trim().min(1, 'Informe a cor'),
  chassi: z.string().trim().optional(),
  situacao: z.enum(['operante', 'inoperante']),
  ano: z
    .number({ message: 'Informe o ano' })
    .int('Ano inválido')
    .min(1950, 'Ano inválido')
    .max(anoAtual + 1, 'Ano inválido'),
  marcaId: z.string().min(1, 'Selecione a marca'),
  modeloId: z.string().min(1, 'Selecione o modelo'),
  patioId: z.string().min(1, 'Selecione o pátio'),
  statusId: z.string().optional(),
  motorista: z.string().optional(),
  destino: z.string().optional(),
  observacoes: z.string().trim().min(1, 'Informe as observações'),
  dataHoraEntrada: z.string().min(1, 'Informe a data/hora de entrada'),
  dataHoraSaida: z.string().optional(),
  kmEntrada: z.number().int('KM inválido').min(0, 'KM inválido').optional(),
  kmSaida: z.number().int('KM inválido').min(0, 'KM inválido').optional(),
})

type EditFormValues = z.infer<typeof editSchema>

const LIMITE_INICIAL = 300

export function Movimentacoes() {
  const navigate = useNavigate()
  const [filters, setFilters] = useState<FiltersValue>({})
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [excluindoId, setExcluindoId] = useState<string | null>(null)
  const [erroLista, setErroLista] = useState<string | null>(null)
  const [limite, setLimite] = useState(LIMITE_INICIAL)

  useEffect(() => {
    setLimite(LIMITE_INICIAL)
  }, [filters.patioId, filters.dataInicio, filters.dataFim])

  const { movimentacoes, loading, error: erroBusca, podeTerMais, refetch } = useMovimentacoes({
    search: filters.search,
    clienteId: filters.clienteId,
    marcaId: filters.marcaId,
    modeloId: filters.modeloId,
    patioId: filters.patioId,
    dataInicio: filters.dataInicio ? `${filters.dataInicio}T00:00:00` : undefined,
    dataFim: filters.dataFim ? `${filters.dataFim}T23:59:59` : undefined,
    limit: limite,
  })

  const editandoMovimentacao = movimentacoes.find((m) => m.id === editandoId)

  const scrollRef = useRef<HTMLDivElement>(null)
  const dragState = useRef({ isDown: false, startX: 0, startScrollLeft: 0, moved: false })
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    function pararArraste() {
      if (dragState.current.isDown) {
        dragState.current.isDown = false
        setIsDragging(false)
      }
    }
    window.addEventListener('mouseup', pararArraste)
    return () => window.removeEventListener('mouseup', pararArraste)
  }, [])

  function handleMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    const container = scrollRef.current
    if (!container) return
    dragState.current = { isDown: true, startX: e.pageX, startScrollLeft: container.scrollLeft, moved: false }
    setIsDragging(true)
  }

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const state = dragState.current
    const container = scrollRef.current
    if (!state.isDown || !container) return
    const delta = e.pageX - state.startX
    if (Math.abs(delta) > 3) state.moved = true
    container.scrollLeft = state.startScrollLeft - delta
  }

  function handleMouseUpOuLeave() {
    dragState.current.isDown = false
    setIsDragging(false)
  }

  function handleClickCapture(e: React.MouseEvent<HTMLDivElement>) {
    if (dragState.current.moved) {
      e.stopPropagation()
      e.preventDefault()
      dragState.current.moved = false
    }
  }

  async function handleExcluir(id: string, placa: string | undefined) {
    if (!confirm(`Excluir a movimentação de "${placa ?? 'veículo'}"? Essa ação não pode ser desfeita.`)) return
    setErroLista(null)
    setExcluindoId(id)
    try {
      await excluirMovimentacao(id)
      if (editandoId === id) setEditandoId(null)
      await refetch()
    } catch (err) {
      setErroLista(err instanceof Error ? err.message : 'Não foi possível excluir a movimentação.')
    } finally {
      setExcluindoId(null)
    }
  }

  return (
    <div>
      <PageHeader
        title="Movimentações"
        subtitle="Entradas e saídas de veículos"
        actions={
          <LinkButton to="/movimentacoes/nova" size="md" className="hidden md:inline-flex">
            <Plus className="h-4 w-4" />
            Registrar entrada
          </LinkButton>
        }
      />

      <div className="mb-6">
        <FiltersBar value={filters} onChange={setFilters} showSearch />
      </div>

      {erroLista && <p className="mb-4 text-sm text-status-danger">{erroLista}</p>}
      {erroBusca && (
        <p className="mb-4 text-sm text-status-danger">
          Não foi possível carregar as movimentações: {erroBusca}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-secondary">Carregando…</p>
      ) : movimentacoes.length === 0 ? (
        <Card className="p-8 text-center text-sm text-secondary">Nenhuma movimentação encontrada.</Card>
      ) : (
        <>
          {/* Desktop: tabela */}
          <Card className="hidden md:block">
            <div
              ref={scrollRef}
              className={cn('overflow-x-auto', isDragging ? 'cursor-grabbing select-none' : 'cursor-grab')}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUpOuLeave}
              onMouseLeave={handleMouseUpOuLeave}
              onClickCapture={handleClickCapture}
            >
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/5 text-left text-secondary">
                    <th className="sticky left-0 z-20 bg-surface px-3 py-3 font-medium whitespace-nowrap border-r border-border/5">
                      Placa
                    </th>
                    <th className="px-3 py-3 font-medium">Marca/Modelo</th>
                    <th className="px-3 py-3 font-medium">Cliente</th>
                    <th className="px-3 py-3 font-medium">Pátio</th>
                    <th className="px-3 py-3 font-medium whitespace-nowrap">Entrada</th>
                    <th className="px-3 py-3 font-medium whitespace-nowrap">Saída</th>
                    <th className="px-3 py-3 font-medium whitespace-nowrap">Permanência</th>
                    <th className="px-3 py-3 font-medium">Status</th>
                    <th className="px-3 py-3 font-medium">Manutenção</th>
                    <th className="px-3 py-3 font-medium whitespace-nowrap">Registrado por</th>
                    <th className="px-3 py-3 font-medium whitespace-nowrap">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {movimentacoes.map((m) => (
                      <tr
                        key={m.id}
                        className="group border-b border-border/5 last:border-0 hover:bg-background/60 cursor-pointer"
                        onClick={() => navigate(`/veiculos/${m.veiculo_id}`)}
                      >
                        <td className="sticky left-0 z-10 bg-surface group-hover:bg-background/60 px-3 py-3 font-medium text-foreground whitespace-nowrap border-r border-border/5">
                          {m.veiculo?.placa}
                        </td>
                        <td className="px-3 py-3 text-secondary max-w-[140px] truncate" title={`${m.veiculo?.marca?.nome ?? ''} ${m.veiculo?.modelo?.nome ?? ''}`}>
                          {m.veiculo?.marca?.nome} {m.veiculo?.modelo?.nome}
                        </td>
                        <td className="px-3 py-3 text-secondary max-w-[140px] truncate" title={m.veiculo?.cliente?.nome}>
                          {m.veiculo?.cliente?.nome}
                        </td>
                        <td className="px-3 py-3 text-secondary max-w-[100px] truncate">{m.patio?.nome || '—'}</td>
                        <td className="px-3 py-3 text-secondary whitespace-nowrap">{formatDateTime(m.data_hora_entrada)}</td>
                        <td className="px-3 py-3 text-secondary whitespace-nowrap">
                          {m.data_hora_saida ? formatDateTime(m.data_hora_saida) : '—'}
                        </td>
                        <td className="px-3 py-3 text-secondary whitespace-nowrap">
                          {formatPermanencia(m.data_hora_entrada, m.data_hora_saida)}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          {m.status === 'no_patio' ? (
                            <Badge tone="success">No pátio</Badge>
                          ) : (
                            <Badge tone="neutral">Saiu</Badge>
                          )}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <StatusManutencaoBadge status={m.status_manutencao} />
                        </td>
                        <td className="px-3 py-3 text-secondary text-xs whitespace-nowrap">
                          <p>Entrada: {m.usuario_entrada?.nome ?? '—'}</p>
                          {m.data_hora_saida && <p>Saída: {m.usuario_saida?.nome ?? '—'}</p>}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <Button
                              type="button"
                              variant="secondary"
                              size="icon"
                              className="!h-8 !w-8"
                              onClick={() => setEditandoId(m.id)}
                              aria-label={`Editar movimentação de ${m.veiculo?.placa}`}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="danger"
                              size="icon"
                              className="!h-8 !w-8"
                              onClick={() => handleExcluir(m.id, m.veiculo?.placa)}
                              disabled={excluindoId === m.id}
                              aria-label={`Excluir movimentação de ${m.veiculo?.placa}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Mobile: cards */}
          <div className="md:hidden space-y-3">
            {movimentacoes.map((m) => (
                <Card key={m.id} className="p-4">
                  <Link to={`/veiculos/${m.veiculo_id}`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-foreground">{m.veiculo?.placa}</p>
                        <p className="text-sm text-secondary">
                          {m.veiculo?.marca?.nome} {m.veiculo?.modelo?.nome}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {m.status === 'no_patio' ? (
                          <Badge tone="success">No pátio</Badge>
                        ) : (
                          <Badge tone="neutral">Saiu</Badge>
                        )}
                        <StatusManutencaoBadge status={m.status_manutencao} />
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-secondary">
                      <p>Cliente: {m.veiculo?.cliente?.nome}</p>
                      <p>Pátio: {m.patio?.nome || '—'}</p>
                      <p>Permanência: {formatPermanencia(m.data_hora_entrada, m.data_hora_saida)}</p>
                      <p>Entrada: {formatDateTime(m.data_hora_entrada)}</p>
                      <p>Saída: {m.data_hora_saida ? formatDateTime(m.data_hora_saida) : '—'}</p>
                      <p>Registrado por: {m.usuario_entrada?.nome ?? '—'}</p>
                      {m.data_hora_saida && <p>Saída por: {m.usuario_saida?.nome ?? '—'}</p>}
                    </div>
                  </Link>
                  <div className="mt-3 flex justify-end gap-2 border-t border-border/5 pt-3">
                    <Button type="button" variant="secondary" size="icon" onClick={() => setEditandoId(m.id)} aria-label="Editar">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      size="icon"
                      onClick={() => handleExcluir(m.id, m.veiculo?.placa)}
                      disabled={excluindoId === m.id}
                      aria-label="Excluir"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
            ))}
          </div>

          {podeTerMais && (
            <div className="mt-4 flex justify-center">
              <Button type="button" variant="secondary" disabled={loading} onClick={() => setLimite((l) => l + LIMITE_INICIAL)}>
                {loading ? 'Carregando…' : 'Carregar mais'}
              </Button>
            </div>
          )}
        </>
      )}

      <LinkButton
        to="/movimentacoes/nova"
        className="md:hidden fixed right-4 z-30 shadow-lg bottom-[calc(5rem+env(safe-area-inset-bottom))]"
        size="lg"
      >
        <Plus className="h-5 w-5" />
        Entrada
      </LinkButton>

      {editandoMovimentacao && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setEditandoId(null)}
        >
          <Card
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-foreground">
                Editar movimentação — {editandoMovimentacao.veiculo?.placa}
              </h3>
              <button
                type="button"
                onClick={() => setEditandoId(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-secondary hover:text-foreground"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <EditarMovimentacaoForm
              movimentacao={editandoMovimentacao}
              onCancel={() => setEditandoId(null)}
              onSalvo={async () => {
                setEditandoId(null)
                await refetch()
              }}
              onErro={setErroLista}
            />
          </Card>
        </div>
      )}
    </div>
  )
}

function EditarMovimentacaoForm({
  movimentacao,
  onCancel,
  onSalvo,
  onErro,
}: {
  movimentacao: MovimentacaoComVeiculo
  onCancel: () => void
  onSalvo: () => void | Promise<void>
  onErro: (message: string) => void
}) {
  const { patios, refetch: refetchPatios } = usePatios()
  const { statusManutencao, refetch: refetchStatusManutencao } = useStatusManutencao()
  const { clientes, refetch: refetchClientes } = useClientes()
  const { marcas, refetch: refetchMarcas } = useMarcas()
  const [fotos, setFotos] = useState<Partial<Record<AnguloFoto, { file: File; previewUrl: string }>>>({})

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      clienteId: movimentacao.veiculo?.cliente_id ?? '',
      placa: movimentacao.veiculo?.placa ?? '',
      tipo: movimentacao.veiculo?.tipo ?? 'pesado',
      cor: movimentacao.veiculo?.cor ?? '',
      chassi: movimentacao.veiculo?.chassi ?? '',
      situacao: movimentacao.veiculo?.operante === false ? 'inoperante' : 'operante',
      ano: movimentacao.veiculo?.ano ?? (undefined as unknown as number),
      marcaId: movimentacao.veiculo?.marca_id ?? '',
      modeloId: movimentacao.veiculo?.modelo_id ?? '',
      patioId: movimentacao.patio_id ?? '',
      statusId: movimentacao.status_id ?? '',
      motorista: movimentacao.motorista ?? '',
      destino: movimentacao.destino ?? '',
      observacoes: movimentacao.observacoes ?? '',
      dataHoraEntrada: toLocalInputValue(movimentacao.data_hora_entrada),
      dataHoraSaida: toLocalInputValue(movimentacao.data_hora_saida),
      kmEntrada: movimentacao.km_entrada ?? undefined,
      kmSaida: movimentacao.km_saida ?? undefined,
    },
  })

  const marcaId = watch('marcaId')
  const { modelos, refetch: refetchModelos } = useModelos(marcaId)

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

  const fotoUrlAtual: Record<AnguloFoto, string | null> = {
    frente: movimentacao.foto_frente_url,
    ladoEsquerdo: movimentacao.foto_lado_esquerdo_url,
    ladoDireito: movimentacao.foto_lado_direito_url,
    traseira: movimentacao.foto_traseira_url,
    painel: movimentacao.foto_painel_url,
  }

  async function onSubmit(values: EditFormValues) {
    try {
      await atualizarVeiculo(movimentacao.veiculo_id, {
        placa: values.placa,
        marcaId: values.marcaId,
        modeloId: values.modeloId,
        clienteId: values.clienteId,
        tipo: values.tipo,
        cor: values.cor,
        ano: values.ano,
        chassi: values.chassi,
        operante: values.situacao === 'operante',
      })

      const fotosEntrada: FotosEntrada = {
        frente: fotos.frente?.file,
        ladoEsquerdo: fotos.ladoEsquerdo?.file,
        ladoDireito: fotos.ladoDireito?.file,
        traseira: fotos.traseira?.file,
        painel: fotos.painel?.file,
      }

      await atualizarMovimentacao(
        movimentacao.id,
        {
          patioId: values.patioId,
          statusId: values.statusId || undefined,
          motorista: values.motorista,
          destino: values.destino,
          observacoes: values.observacoes,
          dataHoraEntrada: new Date(values.dataHoraEntrada).toISOString(),
          dataHoraSaida: values.dataHoraSaida ? new Date(values.dataHoraSaida).toISOString() : undefined,
          kmEntrada: values.kmEntrada,
          kmSaida: values.kmSaida,
        },
        fotosEntrada,
      )
      await onSalvo()
    } catch (err) {
      onErro(err instanceof Error ? err.message : 'Não foi possível salvar as alterações.')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 text-left">
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

      <TipoVeiculoRadioGroup register={register} name="tipo" />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor={`placa-${movimentacao.id}`}>Placa</Label>
          <Input id={`placa-${movimentacao.id}`} placeholder="ABC1D23" className="uppercase" {...register('placa')} />
          <FieldError message={errors.placa?.message} />
        </div>
        <div>
          <Label htmlFor={`cor-${movimentacao.id}`}>Cor</Label>
          <Input id={`cor-${movimentacao.id}`} placeholder="Branco" {...register('cor')} />
          <FieldError message={errors.cor?.message} />
        </div>
      </div>

      <div>
        <Label>Situação</Label>
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
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor={`ano-${movimentacao.id}`}>Ano</Label>
          <Input
            id={`ano-${movimentacao.id}`}
            type="number"
            placeholder={String(anoAtual)}
            {...register('ano', { valueAsNumber: true })}
          />
          <FieldError message={errors.ano?.message} />
        </div>
        <div>
          <Label htmlFor={`chassi-${movimentacao.id}`}>Chassi</Label>
          <Input id={`chassi-${movimentacao.id}`} placeholder="Opcional" {...register('chassi')} />
          <FieldError message={errors.chassi?.message} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
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
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
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
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor={`motorista-${movimentacao.id}`}>Motorista</Label>
          <Input id={`motorista-${movimentacao.id}`} placeholder="Opcional" {...register('motorista')} />
        </div>
        <div>
          <Label htmlFor={`entrada-${movimentacao.id}`}>Data/hora de entrada</Label>
          <Input id={`entrada-${movimentacao.id}`} type="datetime-local" {...register('dataHoraEntrada')} />
        </div>
        <div>
          <Label htmlFor={`saida-${movimentacao.id}`}>Data/hora de saída</Label>
          <Input id={`saida-${movimentacao.id}`} type="datetime-local" {...register('dataHoraSaida')} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor={`km-entrada-${movimentacao.id}`}>KM entrada</Label>
          <Input
            id={`km-entrada-${movimentacao.id}`}
            type="number"
            inputMode="numeric"
            placeholder="Opcional"
            {...register('kmEntrada', { valueAsNumber: true })}
          />
          <FieldError message={errors.kmEntrada?.message} />
        </div>
        <div>
          <Label htmlFor={`km-saida-${movimentacao.id}`}>KM saída</Label>
          <Input
            id={`km-saida-${movimentacao.id}`}
            type="number"
            inputMode="numeric"
            placeholder="Opcional"
            {...register('kmSaida', { valueAsNumber: true })}
          />
          <FieldError message={errors.kmSaida?.message} />
        </div>
      </div>

      <div>
        <Label htmlFor={`destino-${movimentacao.id}`}>Destino</Label>
        <Input id={`destino-${movimentacao.id}`} placeholder="Opcional" {...register('destino')} />
      </div>

      <div>
        <Label htmlFor={`obs-${movimentacao.id}`}>Observações</Label>
        <Textarea id={`obs-${movimentacao.id}`} {...register('observacoes')} />
        <FieldError message={errors.observacoes?.message} />
      </div>

      <div>
        <Label>Fotos do veículo</Label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {ANGULOS_FOTO.map(({ campo, label }) => (
            <FotoInput
              key={campo}
              label={label}
              previewUrl={fotos[campo]?.previewUrl ?? fotoUrlAtual[campo] ?? undefined}
              onSelect={(file, previewUrl) => handleSelecionarFoto(campo, file, previewUrl)}
              onRemove={() => handleRemoverFoto(campo)}
            />
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="icon" onClick={onCancel} aria-label="Cancelar edição">
          <X className="h-4 w-4" />
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Salvando…' : 'Salvar'}
        </Button>
      </div>
    </form>
  )
}
