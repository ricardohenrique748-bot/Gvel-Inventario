import { useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { LogOut, X, Plus, Trash2, Pencil, MapPin, Clock, LogIn } from 'lucide-react'
import { PageHeader } from '@/components/layout/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input, Label, FieldError, Select } from '@/components/ui/Input'
import { StatusManutencaoBadge } from '@/components/StatusManutencaoBadge'
import { useVeiculoDetalhe } from '@/hooks/useVeiculos'
import { registrarSaida, atualizarStatusMovimentacao } from '@/hooks/useMovimentacoes'
import { useStatusManutencao } from '@/hooks/useStatusManutencao'
import {
  useHistoricoMovimentacao,
  adicionarHistorico,
  atualizarHistorico,
  excluirHistorico,
  type HistoricoItem,
} from '@/hooks/useHistoricoMovimentacao'
import { formatDateTime, formatPermanencia } from '@/lib/format'
import { urlMiniatura, aoFalharMiniatura } from '@/lib/thumb'
import { tipoVeiculoLabel } from '@/lib/tipoVeiculo'
import type { Movimentacao } from '@/lib/types'

const SETORES = ['Oficina Pesada', 'Funilaria', 'Oficina Leves'] as const
const SETOR_CRIAR = '__criar_setor__'

function SetorInput({ id, value, onChange }: { id: string; value: string; onChange: (value: string) => void }) {
  const [criandoNovo, setCriandoNovo] = useState(
    () => Boolean(value) && !SETORES.includes(value as (typeof SETORES)[number]),
  )

  if (criandoNovo) {
    return (
      <div className="flex gap-2">
        <Input
          id={id}
          autoFocus
          placeholder="Nome do setor"
          className="!h-9 !text-sm !px-3"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          onClick={() => {
            setCriandoNovo(false)
            onChange('')
          }}
          title="Cancelar"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-secondary/30 text-secondary transition-colors hover:text-foreground"
          aria-label="Cancelar novo setor"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <Select
      id={id}
      className="!h-9 !text-sm !px-3"
      value={SETORES.includes(value as (typeof SETORES)[number]) ? value : ''}
      onChange={(e) => {
        if (e.target.value === SETOR_CRIAR) {
          setCriandoNovo(true)
          onChange('')
        } else {
          onChange(e.target.value)
        }
      }}
    >
      <option value="">Selecione</option>
      {SETORES.map((setor) => (
        <option key={setor} value={setor}>
          {setor}
        </option>
      ))}
      <option value={SETOR_CRIAR}>+ Adicionar outro…</option>
    </Select>
  )
}

const FOTOS_MOVIMENTACAO: { campo: keyof Movimentacao; label: string }[] = [
  { campo: 'foto_frente_url', label: 'Frente' },
  { campo: 'foto_lado_esquerdo_url', label: 'Lado esquerdo' },
  { campo: 'foto_lado_direito_url', label: 'Lado direito' },
  { campo: 'foto_traseira_url', label: 'Traseira' },
  { campo: 'foto_painel_url', label: 'Painel' },
]

const saidaSchema = z.object({
  motorista: z.string().optional(),
  destino: z.string().optional(),
  data: z.string().min(1, 'Informe a data'),
  horario: z.string().min(1, 'Informe o horário'),
  km: z.number().int('KM inválido').min(0, 'KM inválido').optional(),
})

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
  osCriada: z.boolean().optional(),
})

type SaidaFormValues = z.infer<typeof saidaSchema>
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

export function VeiculoDetalhe() {
  const { id } = useParams<{ id: string }>()
  const { veiculo, historico, loading, refetch } = useVeiculoDetalhe(id)
  const [confirmandoSaida, setConfirmandoSaida] = useState(false)
  const [erroSaida, setErroSaida] = useState<string | null>(null)
  const [fotoAmpliada, setFotoAmpliada] = useState<{ url: string; label: string } | null>(null)
  const [adicionandoEtapa, setAdicionandoEtapa] = useState(false)
  const [novaEtapaOsCriada, setNovaEtapaOsCriada] = useState(false)
  const [erroEtapa, setErroEtapa] = useState<string | null>(null)
  const [editandoEtapaId, setEditandoEtapaId] = useState<string | null>(null)

  const movimentacaoAtiva = historico.find((m) => m.status === 'no_patio')

  const { historico: etapas, refetch: refetchEtapas } = useHistoricoMovimentacao(
    movimentacaoAtiva?.id,
  )
  const { statusManutencao } = useStatusManutencao()

  // — Formulário de saída —
  const {
    register: regSaida,
    handleSubmit: handleSaida,
    formState: { errors: errSaida, isSubmitting: submittingSaida },
  } = useForm<SaidaFormValues>({
    resolver: zodResolver(saidaSchema),
    values: {
      motorista: movimentacaoAtiva?.motorista ?? '',
      destino: movimentacaoAtiva?.destino ?? '',
      data: hojeInputValue(),
      horario: agoraInputValue(),
      km: undefined as unknown as number,
    },
  })

  // — Formulário de nova etapa —
  const {
    register: regEtapa,
    handleSubmit: handleEtapa,
    reset: resetEtapa,
    control: controlEtapa,
    formState: { errors: errEtapa, isSubmitting: submittingEtapa },
  } = useForm<EtapaFormValues>({
    resolver: zodResolver(etapaSchema),
    defaultValues: {
      mecanicoExecutor: '',
      funcao: '',
      setor: '',
      data: hojeInputValue(),
      horario: agoraInputValue(),
      statusId: '',
    },
  })

  async function onConfirmarSaida(values: SaidaFormValues) {
    if (!movimentacaoAtiva) return
    setErroSaida(null)
    try {
      await registrarSaida(movimentacaoAtiva.id, {
        motorista: values.motorista,
        destino: values.destino,
        dataHoraSaida: new Date(`${values.data}T${values.horario}`).toISOString(),
        kmSaida: values.km,
      })
      setConfirmandoSaida(false)
      await refetch()
    } catch (err) {
      setErroSaida(err instanceof Error ? err.message : 'Não foi possível registrar a saída.')
    }
  }

  async function onAdicionarEtapa(values: EtapaFormValues) {
    if (!movimentacaoAtiva) return
    setErroEtapa(null)
    try {
      const dataHoraEtapa = new Date(`${values.data}T${values.horario}`).toISOString()
      await adicionarHistorico(movimentacaoAtiva.id, values.descricao, dataHoraEtapa, {
        mecanicoExecutor: values.mecanicoExecutor,
        funcao: values.funcao,
        setor: values.setor,
        dataHoraAbertura: novaEtapaOsCriada ? dataHoraEtapa : undefined,
        osCriada: novaEtapaOsCriada,
      })
      if ((values.statusId || '') !== (movimentacaoAtiva.status_id ?? '')) {
        await atualizarStatusMovimentacao(movimentacaoAtiva.id, values.statusId || null)
      }
      resetEtapa({
        descricao: '',
        mecanicoExecutor: '',
        funcao: '',
        setor: '',
        data: hojeInputValue(),
        horario: agoraInputValue(),
        statusId: '',
      })
      setNovaEtapaOsCriada(false)
      setAdicionandoEtapa(false)
      await refetchEtapas()
      await refetch()
    } catch (err) {
      setErroEtapa(err instanceof Error ? err.message : 'Não foi possível salvar a etapa.')
    }
  }

  async function onExcluirEtapa(etapaId: string) {
    try {
      await excluirHistorico(etapaId)
      await refetchEtapas()
    } catch {
      // silently fail — UI will keep the item
    }
  }

  if (loading) {
    return <p className="text-sm text-secondary">Carregando…</p>
  }

  if (!veiculo) {
    return <p className="text-sm text-secondary">Veículo não encontrado.</p>
  }

  return (
    <div>
      <PageHeader
        title={veiculo.placa}
        subtitle={`${veiculo.marca?.nome ?? ''} ${veiculo.modelo?.nome ?? ''}`}
        back
        actions={
          movimentacaoAtiva && !confirmandoSaida ? (
            <Button variant="danger" onClick={() => setConfirmandoSaida(true)}>
              <LogOut className="h-4 w-4" />
              Registrar saída
            </Button>
          ) : undefined
        }
      />

      {/* — Formulário de saída — */}
      {movimentacaoAtiva && confirmandoSaida && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Saída de veículo</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaida(onConfirmarSaida)} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Placa</Label>
                  <Input value={veiculo.placa} disabled />
                </div>
                <div>
                  <Label>Cliente</Label>
                  <Input value={veiculo.cliente?.nome ?? ''} disabled />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="motorista">Motorista</Label>
                  <Input id="motorista" placeholder="Opcional" {...regSaida('motorista')} />
                </div>
                <div>
                  <Label htmlFor="destino">Destino</Label>
                  <Input id="destino" placeholder="Opcional" {...regSaida('destino')} />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="data">Data</Label>
                  <Input id="data" type="date" {...regSaida('data')} />
                  <FieldError message={errSaida.data?.message} />
                </div>
                <div>
                  <Label htmlFor="horario">Horário</Label>
                  <Input id="horario" type="time" {...regSaida('horario')} />
                  <FieldError message={errSaida.horario?.message} />
                </div>
              </div>
              <div>
                <Label htmlFor="km">KM</Label>
                <Input
                  id="km"
                  type="number"
                  inputMode="numeric"
                  placeholder="Opcional"
                  {...regSaida('km', { valueAsNumber: true })}
                />
                <FieldError message={errSaida.km?.message} />
              </div>
              <FieldError message={erroSaida ?? undefined} />
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => { setConfirmandoSaida(false); setErroSaida(null) }}
                >
                  <X className="h-4 w-4" />
                  Cancelar
                </Button>
                <Button type="submit" variant="danger" disabled={submittingSaida}>
                  {submittingSaida ? 'Registrando…' : 'Confirmar saída'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3 mb-6">
        {/* — Dados do veículo — */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Dados do veículo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Status">
              <div className="flex items-center gap-2">
                {movimentacaoAtiva ? <Badge tone="success">No pátio</Badge> : <Badge tone="neutral">Fora do pátio</Badge>}
                <StatusManutencaoBadge status={movimentacaoAtiva?.status_manutencao} />
              </div>
            </Row>
            <Row label="Tipo">{tipoVeiculoLabel(veiculo.tipo)}</Row>
            <Row label="Situação">
              <Badge tone={veiculo.operante ? 'success' : 'danger'}>
                {veiculo.operante ? 'Operante' : 'Inoperante'}
              </Badge>
            </Row>
            <Row label="Marca">{veiculo.marca?.nome}</Row>
            <Row label="Modelo">{veiculo.modelo?.nome}</Row>
            <Row label="Ano">{veiculo.ano || '—'}</Row>
            <Row label="Cor">{veiculo.cor || '—'}</Row>
            <Row label="Chassi">{veiculo.chassi || '—'}</Row>
            <Row label="Cliente">{veiculo.cliente?.nome}</Row>
          </CardContent>
        </Card>

        {/* — Timeline da movimentação ativa — */}
        {movimentacaoAtiva && (
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle>Trajeto atual</CardTitle>
              {!confirmandoSaida && (
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-border/40 accent-primary"
                      checked={novaEtapaOsCriada}
                      onChange={(e) => setNovaEtapaOsCriada(e.target.checked)}
                    />
                    <span className="text-sm text-foreground whitespace-nowrap">OS (ordem de serviço) criada</span>
                  </label>
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
                        statusId: movimentacaoAtiva.status_id ?? '',
                      })
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    Adicionar etapa
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {/* Formulário de nova etapa */}
              {adicionandoEtapa && (
                <form
                  onSubmit={handleEtapa(onAdicionarEtapa)}
                  className="mb-5 rounded-xl border border-border/40 bg-background p-4 space-y-2.5"
                >
                  <p className="text-sm font-medium text-foreground">Nova etapa</p>
                  <div>
                    <Label htmlFor="etapa-descricao" className="!text-xs !mb-1">Descrição</Label>
                    <Input
                      id="etapa-descricao"
                      placeholder="Ex: Enviado para oficina, Lavagem, Retornou ao pátio…"
                      className="!h-9 !text-sm !px-3"
                      {...regEtapa('descricao')}
                    />
                    <FieldError message={errEtapa.descricao?.message} />
                  </div>
                  <div>
                    <Label htmlFor="etapa-mecanico" className="!text-xs !mb-1">Mecânico executor</Label>
                    <Input id="etapa-mecanico" placeholder="Opcional" className="!h-9 !text-sm !px-3" {...regEtapa('mecanicoExecutor')} />
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <Label htmlFor="etapa-funcao" className="!text-xs !mb-1">Função</Label>
                      <Input id="etapa-funcao" placeholder="Opcional" className="!h-9 !text-sm !px-3" {...regEtapa('funcao')} />
                    </div>
                    <div>
                      <Label htmlFor="etapa-setor" className="!text-xs !mb-1">Setor</Label>
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
                      <Label htmlFor="etapa-data" className="!text-xs !mb-1">Data</Label>
                      <Input id="etapa-data" type="date" className="!h-9 !text-sm !px-3" {...regEtapa('data')} />
                      <FieldError message={errEtapa.data?.message} />
                    </div>
                    <div>
                      <Label htmlFor="etapa-horario" className="!text-xs !mb-1">Horário</Label>
                      <Input id="etapa-horario" type="time" className="!h-9 !text-sm !px-3" {...regEtapa('horario')} />
                      <FieldError message={errEtapa.horario?.message} />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="etapa-status" className="!text-xs !mb-1">Status</Label>
                    <Select id="etapa-status" className="!h-9 !text-sm !px-3" {...regEtapa('statusId')}>
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
                        setNovaEtapaOsCriada(false)
                        setErroEtapa(null)
                        resetEtapa()
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button type="submit" size="md" disabled={submittingEtapa}>
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
                    dateTime={formatDateTime(movimentacaoAtiva.data_hora_entrada)}
                    detail={[
                      movimentacaoAtiva.patio?.nome ? `Pátio: ${movimentacaoAtiva.patio.nome}` : null,
                      movimentacaoAtiva.motorista ? `Motorista: ${movimentacaoAtiva.motorista}` : null,
                      movimentacaoAtiva.km_entrada != null ? `KM: ${movimentacaoAtiva.km_entrada}` : null,
                      movimentacaoAtiva.usuario_entrada?.nome ? `Registrado por: ${movimentacaoAtiva.usuario_entrada.nome}` : null,
                    ].filter(Boolean).join(' · ')}
                  />

                  {/* Nós: etapas intermediárias */}
                  {etapas.map((etapa) =>
                    editandoEtapaId === etapa.id ? (
                      <EditarEtapaForm
                        key={etapa.id}
                        etapa={etapa}
                        onCancel={() => setEditandoEtapaId(null)}
                        onSalvo={async () => {
                          setEditandoEtapaId(null)
                          await refetchEtapas()
                        }}
                      />
                    ) : (
                      <TimelineNode
                        key={etapa.id}
                        icon={<MapPin className="h-4 w-4" />}
                        color="neutral"
                        label={etapa.descricao}
                        dateTime={formatDateTime(etapa.data_hora)}
                        detail={[
                          etapa.mecanico_executor ? `Mecânico: ${etapa.mecanico_executor}` : null,
                          etapa.funcao ? `Função: ${etapa.funcao}` : null,
                          etapa.setor ? `Setor: ${etapa.setor}` : null,
                          etapa.data_hora_abertura ? `Abertura: ${formatDateTime(etapa.data_hora_abertura)}` : null,
                          etapa.data_hora_fechamento
                            ? `Fechamento: ${formatDateTime(etapa.data_hora_fechamento)}`
                            : null,
                          etapa.usuario?.nome ? `Registrado por: ${etapa.usuario.nome}` : null,
                        ]
                          .filter(Boolean)
                          .join(' · ') || undefined}
                        osCriada={etapa.os_criada}
                        onEdit={() => setEditandoEtapaId(etapa.id)}
                        onDelete={() => onExcluirEtapa(etapa.id)}
                      />
                    ),
                  )}

                  {/* Nó: aguardando (fim) */}
                  <TimelineNode
                    icon={<Clock className="h-4 w-4" />}
                    color="muted"
                    label="No pátio"
                    dateTime={`Permanência: ${formatPermanencia(movimentacaoAtiva.data_hora_entrada)}`}
                    isLast
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* — Histórico de todas as movimentações — */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de movimentações</CardTitle>
        </CardHeader>
        <CardContent>
          {historico.length === 0 ? (
            <p className="text-sm text-secondary">Sem histórico.</p>
          ) : (
            <div className="space-y-3">
              {historico.map((m) => (
                <div
                  key={m.id}
                  className="flex flex-col gap-1 rounded-xl bg-background px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="text-sm">
                    <p className="text-foreground">
                      Entrada: {formatDateTime(m.data_hora_entrada)}
                      {m.patio?.nome ? ` · Pátio: ${m.patio.nome}` : ''}
                      {m.motorista ? ` · ${m.motorista}` : ''}
                      {m.km_entrada != null ? ` · KM entrada: ${m.km_entrada}` : ''}
                    </p>
                    <p className="text-secondary">
                      Saída: {m.data_hora_saida ? formatDateTime(m.data_hora_saida) : '—'} · Permanência:{' '}
                      {formatPermanencia(m.data_hora_entrada, m.data_hora_saida)}
                      {m.destino ? ` · Destino: ${m.destino}` : ''}
                      {m.km_saida != null ? ` · KM saída: ${m.km_saida}` : ''}
                    </p>
                    <p className="text-xs text-secondary mt-1">
                      Registrado por: {m.usuario_entrada?.nome ?? '—'}
                      {m.data_hora_saida ? ` · Saída registrada por: ${m.usuario_saida?.nome ?? '—'}` : ''}
                    </p>
                    {m.observacoes && <p className="text-secondary mt-1">Obs: {m.observacoes}</p>}

                    {FOTOS_MOVIMENTACAO.some(({ campo }) => m[campo]) && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {FOTOS_MOVIMENTACAO.map(({ campo, label }) => {
                          const url = m[campo] as string | null
                          if (!url) return null
                          return (
                            <button
                              key={campo}
                              type="button"
                              onClick={() => setFotoAmpliada({ url, label })}
                              className="shrink-0"
                              aria-label={`Ampliar foto — ${label}`}
                            >
                              <img
                                src={urlMiniatura(url, 128)}
                                onError={aoFalharMiniatura(url)}
                                alt={label}
                                loading="lazy"
                                decoding="async"
                                width={64}
                                height={64}
                                className="h-16 w-16 rounded-lg object-cover border border-border/10 hover:opacity-80"
                              />
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {m.status === 'no_patio' ? (
                      <Badge tone="success">No pátio</Badge>
                    ) : (
                      <Badge tone="neutral">Saiu</Badge>
                    )}
                    <StatusManutencaoBadge status={m.status_manutencao} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* — Modal de foto ampliada — */}
      {fotoAmpliada && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setFotoAmpliada(null)}
        >
          <button
            type="button"
            onClick={() => setFotoAmpliada(null)}
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-surface text-foreground"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="flex max-h-full max-w-full flex-col items-center gap-2">
            <img
              src={fotoAmpliada.url}
              alt={fotoAmpliada.label}
              className="max-h-[80vh] max-w-full rounded-xl object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            <p className="text-sm text-secondary">{fotoAmpliada.label}</p>
          </div>
        </div>
      )}
    </div>
  )
}

// — Componentes auxiliares —

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border/5 py-1.5 last:border-0">
      <span className="text-secondary">{label}</span>
      <span className="text-foreground font-medium">{children}</span>
    </div>
  )
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

function TimelineNode({ icon, color, label, dateTime, detail, isLast, osCriada, onEdit, onDelete }: TimelineNodeProps) {
  const dotBg =
    color === 'success'
      ? 'bg-status-success/15 text-status-success'
      : color === 'neutral'
        ? 'bg-surface text-secondary border border-border/40'
        : 'bg-surface text-secondary/40 border border-border/20'

  return (
    <div className="relative flex gap-4 pb-5 last:pb-0">
      {/* Dot */}
      <div className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${dotBg}`}>
        {icon}
      </div>

      {/* Content */}
      <div className="flex flex-1 items-start justify-between gap-2 pt-1.5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className={`text-sm font-medium ${isLast ? 'text-secondary' : 'text-foreground'}`}>{label}</p>
            {osCriada && <Badge tone="warning">OS criada</Badge>}
          </div>
          <p className="text-xs text-secondary">{dateTime}</p>
          {detail && <p className="text-xs text-secondary/70 mt-0.5">{detail}</p>}
        </div>
        {(onEdit || onDelete) && (
          <div className="flex shrink-0 items-center gap-1">
            {onEdit && (
              <button
                type="button"
                onClick={onEdit}
                title="Editar etapa"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-secondary/50 transition-colors hover:bg-overlay/10 hover:text-foreground"
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
      osCriada: etapa.os_criada,
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
        dataHoraAbertura: values.osCriada ? (etapa.data_hora_abertura ?? dataHoraEtapa) : undefined,
        dataHoraFechamento:
          values.dataFechamento && values.horarioFechamento
            ? new Date(`${values.dataFechamento}T${values.horarioFechamento}`).toISOString()
            : undefined,
        osCriada: values.osCriada,
      })
      await onSalvo()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível salvar a etapa.')
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="mb-5 rounded-xl border border-border/40 bg-background p-4 space-y-2.5"
    >
      <p className="text-sm font-medium text-foreground">Editar etapa</p>
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input type="checkbox" className="h-4 w-4 rounded border-border/40 accent-primary" {...register('osCriada')} />
        <span className="text-sm text-foreground">OS (ordem de serviço) criada</span>
      </label>
      <div>
        <Label htmlFor={`editar-descricao-${etapa.id}`} className="!text-xs !mb-1">Descrição</Label>
        <Input id={`editar-descricao-${etapa.id}`} className="!h-9 !text-sm !px-3" {...register('descricao')} />
        <FieldError message={errors.descricao?.message} />
      </div>
      <div>
        <Label htmlFor={`editar-mecanico-${etapa.id}`} className="!text-xs !mb-1">Mecânico executor</Label>
        <Input
          id={`editar-mecanico-${etapa.id}`}
          placeholder="Opcional"
          className="!h-9 !text-sm !px-3"
          {...register('mecanicoExecutor')}
        />
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <Label htmlFor={`editar-funcao-${etapa.id}`} className="!text-xs !mb-1">Função</Label>
          <Input
            id={`editar-funcao-${etapa.id}`}
            placeholder="Opcional"
            className="!h-9 !text-sm !px-3"
            {...register('funcao')}
          />
        </div>
        <div>
          <Label htmlFor={`editar-setor-${etapa.id}`} className="!text-xs !mb-1">Setor</Label>
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
          <Label htmlFor={`editar-data-${etapa.id}`} className="!text-xs !mb-1">Data</Label>
          <Input id={`editar-data-${etapa.id}`} type="date" className="!h-9 !text-sm !px-3" {...register('data')} />
          <FieldError message={errors.data?.message} />
        </div>
        <div>
          <Label htmlFor={`editar-horario-${etapa.id}`} className="!text-xs !mb-1">Horário</Label>
          <Input
            id={`editar-horario-${etapa.id}`}
            type="time"
            className="!h-9 !text-sm !px-3"
            {...register('horario')}
          />
          <FieldError message={errors.horario?.message} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <Label htmlFor={`editar-data-fechamento-${etapa.id}`} className="!text-xs !mb-1">
            Data de fechamento
          </Label>
          <Input
            id={`editar-data-fechamento-${etapa.id}`}
            type="date"
            placeholder="Opcional"
            className="!h-9 !text-sm !px-3"
            {...register('dataFechamento')}
          />
        </div>
        <div>
          <Label htmlFor={`editar-horario-fechamento-${etapa.id}`} className="!text-xs !mb-1">
            Hora de fechamento
          </Label>
          <Input
            id={`editar-horario-fechamento-${etapa.id}`}
            type="time"
            placeholder="Opcional"
            className="!h-9 !text-sm !px-3"
            {...register('horarioFechamento')}
          />
        </div>
      </div>
      <FieldError message={erro ?? undefined} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" size="md" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" size="md" disabled={isSubmitting}>
          {isSubmitting ? 'Salvando…' : 'Salvar'}
        </Button>
      </div>
    </form>
  )
}
