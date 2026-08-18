import { useState, useMemo, type ReactNode } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Pencil, Trash2, X, LogIn, MapPin, Clock } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Label, Select, FieldError } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import {
  useHistoricoMovimentacao,
  adicionarHistorico,
  atualizarHistorico,
  excluirHistorico,
  type HistoricoItem,
} from '@/hooks/useHistoricoMovimentacao'
import { useStatusManutencao } from '@/hooks/useStatusManutencao'
import { usePatios, criarPatio } from '@/hooks/usePatios'
import { atualizarPatioMovimentacao, atualizarStatusMovimentacao } from '@/hooks/useMovimentacoes'
import { supabase } from '@/lib/supabase'
import { formatDateTime, formatPermanencia } from '@/lib/format'
import type { MovimentacaoComVeiculo, Movimentacao } from '@/lib/types'

const SETOR_CRIAR = '__criar_setor__'

export function SetorInput({ id, value, onChange }: { id: string; value: string; onChange: (value: string) => void }) {
  const { patios } = usePatios()
  const [criandoNovo, setCriandoNovo] = useState(false)

  if (criandoNovo) {
    return (
      <div className="flex gap-2">
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          placeholder="Nome do novo setor / pátio"
          autoFocus
          className="!h-9 !text-sm !px-3 flex-1 uppercase"
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
      value={value ?? ''}
      onChange={(e) => {
        if (e.target.value === SETOR_CRIAR) {
          setCriandoNovo(true)
          onChange('')
        } else {
          onChange(e.target.value)
        }
      }}
      className="!h-9 !text-sm !px-3 uppercase"
    >
      <option value="">Selecione ou crie um setor</option>
      {patios.map((p) => (
        <option key={p.id} value={p.nome}>
          {p.nome.toUpperCase()}
        </option>
      ))}
      <option value={SETOR_CRIAR}>+ Criar novo setor…</option>
    </Select>
  )
}

async function sincronizarPatioMovimentacao(movimentacaoId: string, setorNome?: string) {
  if (!setorNome || !setorNome.trim()) return
  const nomeFormatado = setorNome.trim().toUpperCase()
  try {
    const { data: patiosExistentes } = await supabase.from('patios').select('*')
    let patio = (patiosExistentes ?? []).find((p) => p.nome.toUpperCase() === nomeFormatado)
    if (!patio) {
      try {
        patio = await criarPatio(nomeFormatado)
      } catch {}
    }
    if (patio) {
      await atualizarPatioMovimentacao(movimentacaoId, patio.id)
    }
  } catch (err) {
    console.error('Erro ao sincronizar pátio da movimentação:', err)
  }
}

const etapaSchema = z.object({
  descricao: z.string().optional(),
  mecanicoExecutor: z.string().optional(),
  funcao: z.string().optional(),
  setor: z.string().optional(),
  data: z.string().min(1, 'Informe a data'),
  horario: z.string().min(1, 'Informe o horário'),
  statusId: z.string().optional(),
  osAberta: z.boolean().optional(),
})

const editEtapaSchema = z.object({
  descricao: z.string().optional(),
  mecanicoExecutor: z.string().optional(),
  funcao: z.string().optional(),
  setor: z.string().optional(),
  data: z.string().min(1, 'Informe a data'),
  horario: z.string().min(1, 'Informe o horário'),
  dataFechamento: z.string().optional(),
  horarioFechamento: z.string().optional(),
  osAberta: z.boolean().optional(),
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
  const h = String(now.getHours()).padStart(2, '0')
  const m = String(now.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

function dataInputValue(iso?: string | null) {
  if (!iso) return hojeInputValue()
  const date = new Date(iso)
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 10)
}

function horarioInputValue(iso?: string | null) {
  if (!iso) return agoraInputValue()
  const date = new Date(iso)
  const h = String(date.getHours()).padStart(2, '0')
  const m = String(date.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

interface TimelineNodeProps {
  icon: ReactNode
  color: 'success' | 'primary' | 'danger'
  label: string
  dateTime?: string
  duration?: string
  detail?: string
  osAberta?: boolean
  actions?: ReactNode
}

function TimelineNode({ icon, color, label, dateTime, duration, detail, osAberta, actions }: TimelineNodeProps) {
  const colorMap = {
    success: 'bg-status-success/20 border-status-success text-status-success',
    primary: 'bg-primary/20 border-primary text-primary',
    danger: 'bg-status-danger/20 border-status-danger text-status-danger',
  }

  return (
    <div className="relative flex gap-4 pb-6 last:pb-0">
      <div
        className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 ${colorMap[color]}`}
      >
        {icon}
      </div>

      <div className="flex-1 pt-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-foreground text-sm uppercase">{label}</p>
              {osAberta && (
                <Badge tone="success" className="!text-[10px] !py-0 !px-1.5 uppercase font-bold">
                  📋 O.S ABERTA
                </Badge>
              )}
            </div>
            {dateTime && (
              <p className="text-xs text-secondary mt-0.5 uppercase">{dateTime}</p>
            )}
            {duration && (
              <p className="text-xs font-semibold text-primary mt-0.5 flex items-center gap-1 uppercase">
                <Clock className="h-3.5 w-3.5" />
                {duration}
              </p>
            )}
          </div>
          {actions && <div className="flex items-center gap-1 shrink-0">{actions}</div>}
        </div>
        {detail && <p className="text-xs text-secondary/80 mt-1 uppercase">{detail}</p>}
      </div>
    </div>
  )
}

interface EditarEtapaFormProps {
  movimentacaoId: string
  etapa: HistoricoItem
  onCancel: () => void
  onSalvo: () => void | Promise<void>
}

function EditarEtapaForm({ movimentacaoId, etapa, onCancel, onSalvo }: EditarEtapaFormProps) {
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
      osAberta: etapa.os_criada ?? false,
    },
  })

  async function onSubmit(values: EditEtapaFormValues) {
    setErro(null)
    try {
      const dataHoraEtapa = new Date(`${values.data}T${values.horario}`).toISOString()
      const desc = values.setor || values.descricao || etapa.descricao || 'MOVIMENTAÇÃO DE PÁTIO'
      await atualizarHistorico(etapa.id, {
        descricao: desc,
        dataHora: dataHoraEtapa,
        mecanicoExecutor: values.mecanicoExecutor,
        funcao: values.funcao,
        setor: values.setor,
        dataHoraAbertura: dataHoraEtapa,
        dataHoraFechamento:
          values.dataFechamento && values.horarioFechamento
            ? new Date(`${values.dataFechamento}T${values.horarioFechamento}`).toISOString()
            : undefined,
        osCriada: values.osAberta ?? false,
      })

      // Sincroniza o pátio atual do caminhão na movimentação e tela de manutenção
      if (values.setor) {
        await sincronizarPatioMovimentacao(movimentacaoId, values.setor)
      }

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

      {/* Caixa de marcação de OS aberta */}
      <div className="pt-1">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-border/60 text-primary focus:ring-primary/40"
            {...register('osAberta')}
          />
          <span className="text-xs font-bold text-foreground uppercase">
            O.S Aberta (Sinalização de início)
          </span>
        </label>
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

const ATIVIDADES_CHECKLIST_IGNORAR = [
  'MOTOR E TRANSMISSÃO',
  'FREIOS E SUSPENSÃO',
  'VAZAMENTOS E NÍVEIS DE FLUIDOS',
  'BATERIA E SISTEMA DE CARGA',
  'ILUMINAÇÃO E SINALIZAÇÃO',
  'PAINEL E COMPONENTES ELÉTRICOS',
  'LATARIA E AMASSADOS',
  'PORTAS, CAPÔ E TAMPAS',
  'PARA-CHOQUES E ACABAMENTOS',
  'RISCOS E ARRANHÕES',
  'DESCASCADOS E MANCHAS',
  'DIFERENÇA DE TONALIDADE',
  'LIMPEZA INTERNA',
  'LIMPEZA EXTERNA',
  'BANCOS, PAINEL E REVESTIMENTOS',
  'MANUTENÇÃO GERAL',
  'MANUTENÇÃO GERAL - CHECKLIST',
]

export function TrajetoAtualCard({
  movimentacao,
  className,
  onAtualizar,
  disableHeaderActions = false,
}: TrajetoAtualCardProps) {
  const [adicionandoEtapa, setAdicionandoEtapa] = useState(false)
  const [editandoEtapaId, setEditandoEtapaId] = useState<string | null>(null)
  const [erroEtapa, setErroEtapa] = useState<string | null>(null)

  const { historico, refetch: refetchEtapas } = useHistoricoMovimentacao(movimentacao.id)
  const { statusManutencao } = useStatusManutencao()

  // Filtra itens de checklist mantendo estritamente as mudanças de setor/pátio no trajeto
  const etapasTrajeto = useMemo(() => {
    return historico.filter((etapa) => {
      const descUpper = (etapa.descricao || '').trim().toUpperCase()
      return !ATIVIDADES_CHECKLIST_IGNORAR.includes(descUpper)
    })
  }, [historico])

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
      osAberta: false,
    },
  })

  async function onAdicionarEtapa(values: EtapaFormValues) {
    setErroEtapa(null)
    try {
      const dataHoraEtapa = new Date(`${values.data}T${values.horario}`).toISOString()
      const desc = values.setor || values.descricao || 'MOVIMENTAÇÃO DE PÁTIO'
      await adicionarHistorico(movimentacao.id, desc, dataHoraEtapa, {
        mecanicoExecutor: values.mecanicoExecutor,
        funcao: values.funcao,
        setor: values.setor,
        dataHoraAbertura: dataHoraEtapa,
        osCriada: values.osAberta ?? false,
      })
      if ((values.statusId || '') !== (movimentacao.status_id ?? '')) {
        await atualizarStatusMovimentacao(movimentacao.id, values.statusId || null)
      }

      // Sincroniza o pátio atual do caminhão na movimentação e tela de manutenção
      if (values.setor) {
        await sincronizarPatioMovimentacao(movimentacao.id, values.setor)
      }

      resetEtapa({
        descricao: '',
        mecanicoExecutor: '',
        funcao: '',
        setor: '',
        data: hojeInputValue(),
        horario: agoraInputValue(),
        statusId: values.statusId ?? movimentacao.status_id ?? '',
        osAberta: false,
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
                osAberta: false,
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
                <Input
                  id="etapa-horario"
                  type="time"
                  className="!h-9 !text-sm !px-3"
                  {...regEtapa('horario')}
                />
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
                    {s.nome.toUpperCase()}
                  </option>
                ))}
              </Select>
            </div>

            {/* Caixa de marcação de OS aberta */}
            <div className="pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border/60 text-primary focus:ring-primary/40"
                  {...regEtapa('osAberta')}
                />
                <span className="text-xs font-bold text-foreground uppercase">
                  O.S Aberta (Sinalização de início)
                </span>
              </label>
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
            {etapasTrajeto.map((etapa) => {
              if (editandoEtapaId === etapa.id) {
                return (
                  <div key={etapa.id} className="relative z-10 pl-14 pb-6">
                    <EditarEtapaForm
                      movimentacaoId={movimentacao.id}
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

              const duracaoTexto =
                etapa.data_hora_abertura && etapa.data_hora_fechamento
                  ? `Duração: ${formatPermanencia(etapa.data_hora_abertura, etapa.data_hora_fechamento)}`
                  : undefined

              return (
                <TimelineNode
                  key={etapa.id}
                  icon={<MapPin className="h-4 w-4" />}
                  color="primary"
                  label={etapa.descricao}
                  dateTime={formatDateTime(etapa.data_hora)}
                  duration={duracaoTexto}
                  osAberta={etapa.os_criada}
                  detail={[
                    etapa.mecanico_executor ? `Responsável: ${etapa.mecanico_executor}` : null,
                    etapa.funcao ? `Função: ${etapa.funcao}` : null,
                    etapa.setor ? `Setor: ${etapa.setor}` : null,
                  ]
                    .filter(Boolean)
                    .join(' • ')}
                  actions={
                    !disableHeaderActions ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setEditandoEtapaId(etapa.id)}
                          className="rounded-lg p-1 text-secondary hover:bg-surface hover:text-foreground transition-colors"
                          title="Editar etapa"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onExcluirEtapa(etapa.id)}
                          className="rounded-lg p-1 text-secondary hover:bg-surface hover:text-status-danger transition-colors"
                          title="Remover etapa"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : undefined
                  }
                />
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
