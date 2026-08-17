import { useState, type ReactNode } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Pencil, Trash2, X, LogIn, MapPin, Clock } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Label, Select, FieldError } from '@/components/ui/Input'
import {
  useHistoricoMovimentacao,
  adicionarHistorico,
  atualizarHistorico,
  excluirHistorico,
  type HistoricoItem,
} from '@/hooks/useHistoricoMovimentacao'
import { useStatusManutencao } from '@/hooks/useStatusManutencao'
import { atualizarStatusMovimentacao } from '@/hooks/useMovimentacoes'
import { formatDateTime, formatPermanencia } from '@/lib/format'
import type { MovimentacaoComVeiculo, Movimentacao } from '@/lib/types'

const SETORES = ['Oficina Pesada', 'Funilaria', 'Oficina Leves'] as const
const SETOR_CRIAR = '__criar_setor__'

export function SetorInput({ id, value, onChange }: { id: string; value: string; onChange: (value: string) => void }) {
  const [criandoNovo, setCriandoNovo] = useState(
    () => Boolean(value) && !SETORES.includes(value as (typeof SETORES)[number]),
  )

  if (criandoNovo) {
    return (
      <div className="flex gap-2">
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Nome do novo setor"
          autoFocus
          className="!h-9 !text-sm !px-3 flex-1"
        />
        <Button
          type="button"
          variant="secondary"
          size="md"
          onClick={() => {
            setCriandoNovo(false)
            onChange('')
          }}
          className="!h-9 !px-2 text-xs"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  return (
    <Select
      id={id}
      value={SETORES.includes(value as (typeof SETORES)[number]) ? value : ''}
      onChange={(e) => {
        if (e.target.value === SETOR_CRIAR) {
          setCriandoNovo(true)
          onChange('')
        } else {
          onChange(e.target.value)
        }
      }}
      className="!h-9 !text-sm !px-3"
    >
      <option value="">Selecione ou crie um setor</option>
      {SETORES.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
      <option value={SETOR_CRIAR}>+ Criar novo setor…</option>
    </Select>
  )
}

const etapaSchema = z.object({
  descricao: z.string().min(1, 'Descreva a etapa'),
  mecanicoExecutor: z.string().optional(),
  funcao: z.string().optional(),
  setor: z.string().optional(),
  data: z.string().min(1, 'Informe a data'),
  horario: z.string().min(1, 'Informe o horário'),
  statusId: z.string().optional(),
})

const editEtapaSchema = z.object({
  descricao: z.string().min(1, 'Descreva a etapa'),
  mecanicoExecutor: z.string().optional(),
  funcao: z.string().optional(),
  setor: z.string().optional(),
  data: z.string().min(1, 'Informe a data'),
  horario: z.string().min(1, 'Informe o horário'),
  dataFechamento: z.string().optional(),
  horarioFechamento: z.string().optional(),
})

type EtapaFormValues = z.infer<typeof etapaSchema>
type EditEtapaFormValues = z.infer<typeof editEtapaSchema>

function hojeInputValue() {
  const now = new Date()
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
  return now.toISOString().slice(0, 10)
}

function agoraInputValue() {
  const now = new Date()
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
  return now.toISOString().slice(11, 16)
}

function dataInputValue(iso: string | null | undefined) {
  if (!iso) return ''
  const date = new Date(iso)
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 10)
}

function horarioInputValue(iso: string | null | undefined) {
  if (!iso) return ''
  const date = new Date(iso)
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(11, 16)
}

interface TimelineNodeProps {
  icon: ReactNode
  color: 'success' | 'neutral' | 'muted'
  label: string
  dateTime: string
  detail?: string
  isLast?: boolean
  osCriada?: boolean
  onEdit?: () => void
  onDelete?: () => void
}

function TimelineNode({ icon, color, label, dateTime, detail, isLast, onEdit, onDelete }: TimelineNodeProps) {
  const dotBg =
    color === 'success'
      ? 'bg-status-success/15 text-status-success'
      : color === 'neutral'
        ? 'bg-surface text-secondary border border-border/40'
        : 'bg-overlay/5 text-secondary'

  return (
    <div className="relative flex items-start gap-4 pb-6 last:pb-0">
      {/* Marcador do nó */}
      <div className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${dotBg}`}>
        {icon}
      </div>

      {/* Conteúdo */}
      <div className="flex-1 min-w-0 pt-1">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground uppercase">{label}</span>
          </div>
          <span className="text-xs text-secondary">{dateTime}</span>
        </div>

        {detail && <p className="mt-1 text-xs text-secondary break-words uppercase">{detail}</p>}

        {/* Botões de Ação */}
        {(onEdit || onDelete) && !isLast && (
          <div className="mt-2 flex items-center gap-1">
            {onEdit && (
              <button
                type="button"
                onClick={onEdit}
                title="Editar etapa"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-secondary transition-colors hover:bg-overlay/5 hover:text-foreground"
                aria-label="Editar etapa"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                title="Remover etapa"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-secondary/50 transition-colors hover:bg-red-500/10 hover:text-red-400"
                aria-label="Remover etapa"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function EditarEtapaForm({
  etapa,
  onCancel,
  onSalvo,
}: {
  etapa: HistoricoItem
  onCancel: () => void
  onSalvo: () => void | Promise<void>
}) {
  const [erro, setErro] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<EditEtapaFormValues>({
    resolver: zodResolver(editEtapaSchema),
    defaultValues: {
      descricao: etapa.descricao,
      mecanicoExecutor: etapa.mecanico_executor ?? '',
      funcao: etapa.funcao ?? '',
      setor: etapa.setor ?? '',
      data: dataInputValue(etapa.data_hora),
      horario: horarioInputValue(etapa.data_hora),
      dataFechamento: dataInputValue(etapa.data_hora_fechamento),
      horarioFechamento: horarioInputValue(etapa.data_hora_fechamento),
    },
  })

  async function onSubmit(values: EditEtapaFormValues) {
    setErro(null)
    try {
      const dataHoraEtapa = new Date(`${values.data}T${values.horario}`).toISOString()
      await atualizarHistorico(etapa.id, {
        descricao: values.descricao,
        dataHora: dataHoraEtapa,
        mecanicoExecutor: values.mecanicoExecutor,
        funcao: values.funcao,
        setor: values.setor,
        dataHoraAbertura: dataHoraEtapa,
        dataHoraFechamento:
          values.dataFechamento && values.horarioFechamento
            ? new Date(`${values.dataFechamento}T${values.horarioFechamento}`).toISOString()
            : undefined,
        osCriada: false,
      })
      await onSalvo()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível salvar a etapa.')
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="mb-5 rounded-xl border border-border/40 bg-background p-4 space-y-2.5 uppercase"
    >
      <p className="text-sm font-bold text-foreground uppercase">Editar etapa do trajeto</p>
      <div>
        <Label htmlFor={`editar-descricao-${etapa.id}`} className="!text-xs !mb-1 uppercase">Descrição</Label>
        <Input id={`editar-descricao-${etapa.id}`} className="!h-9 !text-sm !px-3 uppercase" {...register('descricao')} />
        <FieldError message={errors.descricao?.message} />
      </div>
      <div>
        <Label htmlFor={`editar-mecanico-${etapa.id}`} className="!text-xs !mb-1 uppercase">Responsável / Operador</Label>
        <Input
          id={`editar-mecanico-${etapa.id}`}
          placeholder="Opcional"
          className="!h-9 !text-sm !px-3 uppercase"
          {...register('mecanicoExecutor')}
        />
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <Label htmlFor={`editar-funcao-${etapa.id}`} className="!text-xs !mb-1 uppercase">Função</Label>
          <Input
            id={`editar-funcao-${etapa.id}`}
            placeholder="Opcional"
            className="!h-9 !text-sm !px-3 uppercase"
            {...register('funcao')}
          />
        </div>
        <div>
          <Label htmlFor={`editar-setor-${etapa.id}`} className="!text-xs !mb-1 uppercase">Setor / Pátio</Label>
          <Controller
            control={control}
            name="setor"
            render={({ field }) => (
              <SetorInput id={`editar-setor-${etapa.id}`} value={field.value ?? ''} onChange={field.onChange} />
            )}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <Label htmlFor={`editar-data-${etapa.id}`} className="!text-xs !mb-1 uppercase">Data</Label>
          <Input id={`editar-data-${etapa.id}`} type="date" className="!h-9 !text-sm !px-3" {...register('data')} />
          <FieldError message={errors.data?.message} />
        </div>
        <div>
          <Label htmlFor={`editar-horario-${etapa.id}`} className="!text-xs !mb-1 uppercase">Horário</Label>
          <Input
            id={`editar-horario-${etapa.id}`}
            type="time"
            className="!h-9 !text-sm !px-3"
            {...register('horario')}
          />
          <FieldError message={errors.horario?.message} />
        </div>
      </div>
      <FieldError message={erro ?? undefined} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" size="md" onClick={onCancel} className="uppercase">
          Cancelar
        </Button>
        <Button type="submit" size="md" disabled={isSubmitting} className="uppercase font-bold">
          {isSubmitting ? 'Salvando…' : 'Salvar'}
        </Button>
      </div>
    </form>
  )
}

interface TrajetoAtualCardProps {
  movimentacao: MovimentacaoComVeiculo | (Movimentacao & { patio?: { nome: string }; usuario_entrada?: { nome: string } | null })
  className?: string
  onAtualizar?: () => void | Promise<void>
  disableHeaderActions?: boolean
}

export function TrajetoAtualCard({
  movimentacao,
  className = '',
  onAtualizar,
  disableHeaderActions = false,
}: TrajetoAtualCardProps) {
  const [adicionandoEtapa, setAdicionandoEtapa] = useState(false)
  const [erroEtapa, setErroEtapa] = useState<string | null>(null)
  const [editandoEtapaId, setEditandoEtapaId] = useState<string | null>(null)
  const { historico, refetch: refetchEtapas } = useHistoricoMovimentacao(movimentacao.id)
  const { statusManutencao } = useStatusManutencao()

  const {
    register: regEtapa,
    handleSubmit: handleEtapa,
    reset: resetEtapa,
    control: controlEtapa,
    formState: { errors: errEtapa, isSubmitting: submittingEtapa },
  } = useForm<EtapaFormValues>({
    resolver: zodResolver(etapaSchema),
    defaultValues: {
      descricao: '',
      mecanicoExecutor: '',
      funcao: '',
      setor: '',
      data: hojeInputValue(),
      horario: agoraInputValue(),
      statusId: movimentacao.status_id ?? '',
    },
  })

  async function onAdicionarEtapa(values: EtapaFormValues) {
    setErroEtapa(null)
    try {
      const dataHoraEtapa = new Date(`${values.data}T${values.horario}`).toISOString()
      await adicionarHistorico(movimentacao.id, values.descricao, dataHoraEtapa, {
        mecanicoExecutor: values.mecanicoExecutor,
        funcao: values.funcao,
        setor: values.setor,
        dataHoraAbertura: dataHoraEtapa,
        osCriada: false,
      })
      if ((values.statusId || '') !== (movimentacao.status_id ?? '')) {
        await atualizarStatusMovimentacao(movimentacao.id, values.statusId || null)
      }
      resetEtapa({
        descricao: '',
        mecanicoExecutor: '',
        funcao: '',
        setor: '',
        data: hojeInputValue(),
        horario: agoraInputValue(),
        statusId: values.statusId ?? movimentacao.status_id ?? '',
      })
      setAdicionandoEtapa(false)
      await refetchEtapas()
      if (onAtualizar) await onAtualizar()
    } catch (err) {
      setErroEtapa(err instanceof Error ? err.message : 'Não foi possível adicionar a etapa.')
    }
  }

  async function onExcluirEtapa(id: string) {
    if (!window.confirm('Tem certeza que deseja remover esta etapa do trajeto?')) return
    try {
      await excluirHistorico(id)
      await refetchEtapas()
      if (onAtualizar) await onAtualizar()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Não foi possível remover a etapa.')
    }
  }

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>Trajeto atual</CardTitle>
        {!disableHeaderActions && (
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setAdicionandoEtapa(true)
              setErroEtapa(null)
              resetEtapa({
                descricao: '',
                mecanicoExecutor: '',
                funcao: '',
                setor: '',
                data: hojeInputValue(),
                horario: agoraInputValue(),
                statusId: movimentacao.status_id ?? '',
              })
            }}
          >
            <Plus className="h-4 w-4" />
            Adicionar etapa
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {/* Formulário de nova etapa */}
        {adicionandoEtapa && (
          <form
            onSubmit={handleEtapa(onAdicionarEtapa)}
            className="mb-5 rounded-xl border border-border/40 bg-background p-4 space-y-2.5 uppercase"
          >
            <p className="text-sm font-bold text-foreground uppercase">Nova etapa do trajeto</p>
            <div>
              <Label htmlFor="etapa-descricao" className="!text-xs !mb-1 uppercase">
                Descrição
              </Label>
              <Input
                id="etapa-descricao"
                placeholder="Ex: Enviado para oficina, Lavagem, Retornou ao pátio…"
                className="!h-9 !text-sm !px-3 uppercase"
                {...regEtapa('descricao')}
              />
              <FieldError message={errEtapa.descricao?.message} />
            </div>
            <div>
              <Label htmlFor="etapa-mecanico" className="!text-xs !mb-1 uppercase">
                Responsável / Operador
              </Label>
              <Input
                id="etapa-mecanico"
                placeholder="Opcional"
                className="!h-9 !text-sm !px-3 uppercase"
                {...regEtapa('mecanicoExecutor')}
              />
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <Label htmlFor="etapa-funcao" className="!text-xs !mb-1 uppercase">
                  Função
                </Label>
                <Input
                  id="etapa-funcao"
                  placeholder="Opcional"
                  className="!h-9 !text-sm !px-3 uppercase"
                  {...regEtapa('funcao')}
                />
              </div>
              <div>
                <Label htmlFor="etapa-setor" className="!text-xs !mb-1 uppercase">
                  Setor / Pátio
                </Label>
                <Controller
                  control={controlEtapa}
                  name="setor"
                  render={({ field }) => (
                    <SetorInput id="etapa-setor" value={field.value ?? ''} onChange={field.onChange} />
                  )}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <Label htmlFor="etapa-data" className="!text-xs !mb-1 uppercase">
                  Data
                </Label>
                <Input id="etapa-data" type="date" className="!h-9 !text-sm !px-3" {...regEtapa('data')} />
                <FieldError message={errEtapa.data?.message} />
              </div>
              <div>
                <Label htmlFor="etapa-horario" className="!text-xs !mb-1 uppercase">
                  Horário
                </Label>
                <Input id="etapa-horario" type="time" className="!h-9 !text-sm !px-3" {...regEtapa('horario')} />
                <FieldError message={errEtapa.horario?.message} />
              </div>
            </div>
            <div>
              <Label htmlFor="etapa-status" className="!text-xs !mb-1 uppercase">
                Status
              </Label>
              <Select id="etapa-status" className="!h-9 !text-sm !px-3 uppercase" {...regEtapa('statusId')}>
                <option value="">Sem manutenção</option>
                {statusManutencao.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome}
                  </option>
                ))}
              </Select>
            </div>
            <FieldError message={erroEtapa ?? undefined} />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => {
                  setAdicionandoEtapa(false)
                  setErroEtapa(null)
                  resetEtapa()
                }}
                className="uppercase"
              >
                Cancelar
              </Button>
              <Button type="submit" size="md" disabled={submittingEtapa} className="uppercase font-bold">
                {submittingEtapa ? 'Salvando…' : 'Salvar etapa'}
              </Button>
            </div>
          </form>
        )}

        {/* Timeline */}
        <div className="relative">
          {/* Linha vertical */}
          <div className="absolute left-[19px] top-6 bottom-6 w-px bg-border/40" />

          <div className="space-y-0">
            {/* Nó: Entrada */}
            <TimelineNode
              icon={<LogIn className="h-4 w-4" />}
              color="success"
              label="Entrada no pátio"
              dateTime={formatDateTime(movimentacao.data_hora_entrada)}
              detail={[
                movimentacao.patio?.nome ? `Pátio: ${movimentacao.patio.nome}` : null,
                movimentacao.motorista ? `Motorista: ${movimentacao.motorista}` : null,
                movimentacao.km_entrada != null ? `KM: ${movimentacao.km_entrada}` : null,
                movimentacao.usuario_entrada?.nome ? `Registrado por: ${movimentacao.usuario_entrada.nome}` : null,
              ]
                .filter(Boolean)
                .join(' • ')}
            />

            {/* Nós: Etapas intermediárias */}
            {historico.map((etapa) => {
              if (editandoEtapaId === etapa.id) {
                return (
                  <div key={etapa.id} className="relative z-10 pl-14 pb-6">
                    <EditarEtapaForm
                      etapa={etapa}
                      onCancel={() => setEditandoEtapaId(null)}
                      onSalvo={async () => {
                        setEditandoEtapaId(null)
                        await refetchEtapas()
                        if (onAtualizar) await onAtualizar()
                      }}
                    />
                  </div>
                )
              }

              const detalhes = [
                etapa.setor ? `Setor: ${etapa.setor}` : null,
                etapa.mecanico_executor ? `Executor: ${etapa.mecanico_executor}` : null,
                etapa.funcao ? `Função: ${etapa.funcao}` : null,
                etapa.data_hora_fechamento
                  ? `Fechamento: ${formatDateTime(etapa.data_hora_fechamento)}`
                  : null,
                etapa.data_hora_abertura && etapa.data_hora_fechamento
                  ? `Duração: ${formatPermanencia(etapa.data_hora_abertura, etapa.data_hora_fechamento)}`
                  : null,
                etapa.usuario?.nome ? `Por: ${etapa.usuario.nome}` : null,
              ]
                .filter(Boolean)
                .join(' • ')

              return (
                <TimelineNode
                  key={etapa.id}
                  icon={<MapPin className="h-4 w-4" />}
                  color="neutral"
                  label={etapa.descricao}
                  dateTime={formatDateTime(etapa.data_hora)}
                  detail={detalhes || undefined}
                  onEdit={() => setEditandoEtapaId(etapa.id)}
                  onDelete={() => onExcluirEtapa(etapa.id)}
                />
              )
            })}

            {/* Nó: Permanência ou Saída */}
            {movimentacao.status === 'no_patio' ? (
              <TimelineNode
                icon={<Clock className="h-4 w-4" />}
                color="muted"
                label="No pátio"
                dateTime={formatPermanencia(movimentacao.data_hora_entrada)}
                detail="Tempo de permanência até o momento"
                isLast
              />
            ) : (
              <TimelineNode
                icon={<LogIn className="h-4 w-4 rotate-180" />}
                color="success"
                label="Saída do pátio"
                dateTime={formatDateTime(movimentacao.data_hora_saida)}
                detail={[
                  `Permanência total: ${formatPermanencia(movimentacao.data_hora_entrada, movimentacao.data_hora_saida)}`,
                  movimentacao.km_saida != null ? `KM saída: ${movimentacao.km_saida}` : null,
                ]
                  .filter(Boolean)
                  .join(' • ')}
                isLast
              />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
