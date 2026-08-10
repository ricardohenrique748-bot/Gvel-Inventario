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
import { Input, Label, Textarea } from '@/components/ui/Input'
import { QuickCreateSelect } from '@/components/QuickCreateSelect'
import { StatusManutencaoBadge } from '@/components/StatusManutencaoBadge'
import { useMovimentacoes, atualizarMovimentacao, excluirMovimentacao } from '@/hooks/useMovimentacoes'
import { usePatios, criarPatio } from '@/hooks/usePatios'
import { useStatusManutencao, criarStatusManutencao } from '@/hooks/useStatusManutencao'
import { formatDateTime, formatPermanencia, toLocalInputValue } from '@/lib/format'
import type { MovimentacaoComVeiculo } from '@/lib/types'

const editSchema = z.object({
  patioId: z.string().min(1, 'Selecione o pátio'),
  statusId: z.string().optional(),
  motorista: z.string().optional(),
  observacoes: z.string().optional(),
  dataHoraEntrada: z.string().min(1, 'Informe a data/hora de entrada'),
  dataHoraSaida: z.string().optional(),
})

type EditFormValues = z.infer<typeof editSchema>

export function Movimentacoes() {
  const navigate = useNavigate()
  const [filters, setFilters] = useState<FiltersValue>({})
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [excluindoId, setExcluindoId] = useState<string | null>(null)
  const [erroLista, setErroLista] = useState<string | null>(null)
  const { movimentacoes, loading, refetch } = useMovimentacoes({
    search: filters.search,
    clienteId: filters.clienteId,
    marcaId: filters.marcaId,
    modeloId: filters.modeloId,
    patioId: filters.patioId,
    dataInicio: filters.dataInicio ? `${filters.dataInicio}T00:00:00` : undefined,
    dataFim: filters.dataFim ? `${filters.dataFim}T23:59:59` : undefined,
  })

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
                  {movimentacoes.map((m) =>
                    editandoId === m.id ? (
                      <tr key={m.id} className="border-b border-border/5 last:border-0">
                        <td colSpan={11} className="p-4">
                          <EditarMovimentacaoForm
                            movimentacao={m}
                            onCancel={() => setEditandoId(null)}
                            onSalvo={async () => {
                              setEditandoId(null)
                              await refetch()
                            }}
                            onErro={setErroLista}
                          />
                        </td>
                      </tr>
                    ) : (
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
                    ),
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Mobile: cards */}
          <div className="md:hidden space-y-3">
            {movimentacoes.map((m) =>
              editandoId === m.id ? (
                <Card key={m.id} className="p-4">
                  <EditarMovimentacaoForm
                    movimentacao={m}
                    onCancel={() => setEditandoId(null)}
                    onSalvo={async () => {
                      setEditandoId(null)
                      await refetch()
                    }}
                    onErro={setErroLista}
                  />
                </Card>
              ) : (
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
              ),
            )}
          </div>
        </>
      )}

      <LinkButton to="/movimentacoes/nova" className="md:hidden fixed bottom-20 right-4 z-30 shadow-lg" size="lg">
        <Plus className="h-5 w-5" />
        Entrada
      </LinkButton>
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
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      patioId: movimentacao.patio_id ?? '',
      statusId: movimentacao.status_id ?? '',
      motorista: movimentacao.motorista ?? '',
      observacoes: movimentacao.observacoes ?? '',
      dataHoraEntrada: toLocalInputValue(movimentacao.data_hora_entrada),
      dataHoraSaida: toLocalInputValue(movimentacao.data_hora_saida),
    },
  })

  async function onSubmit(values: EditFormValues) {
    try {
      await atualizarMovimentacao(movimentacao.id, {
        patioId: values.patioId,
        statusId: values.statusId || undefined,
        motorista: values.motorista,
        observacoes: values.observacoes,
        dataHoraEntrada: new Date(values.dataHoraEntrada).toISOString(),
        dataHoraSaida: values.dataHoraSaida ? new Date(values.dataHoraSaida).toISOString() : undefined,
      })
      await onSalvo()
    } catch (err) {
      onErro(err instanceof Error ? err.message : 'Não foi possível salvar as alterações.')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 text-left">
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

      <div>
        <Label htmlFor={`obs-${movimentacao.id}`}>Observações</Label>
        <Textarea id={`obs-${movimentacao.id}`} placeholder="Opcional" {...register('observacoes')} />
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
