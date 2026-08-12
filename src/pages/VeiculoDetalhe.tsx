import { useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { LogOut, X, Plus, Trash2, MapPin, Clock, LogIn } from 'lucide-react'
import { PageHeader } from '@/components/layout/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input, Label, FieldError } from '@/components/ui/Input'
import { StatusManutencaoBadge } from '@/components/StatusManutencaoBadge'
import { useVeiculoDetalhe } from '@/hooks/useVeiculos'
import { registrarSaida } from '@/hooks/useMovimentacoes'
import {
  useHistoricoMovimentacao,
  adicionarHistorico,
  excluirHistorico,
} from '@/hooks/useHistoricoMovimentacao'
import { formatDateTime, formatPermanencia } from '@/lib/format'
import { urlMiniatura, aoFalharMiniatura } from '@/lib/thumb'
import { tipoVeiculoLabel } from '@/lib/tipoVeiculo'
import type { Movimentacao } from '@/lib/types'

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
  data: z.string().min(1, 'Informe a data'),
  horario: z.string().min(1, 'Informe o horário'),
  osCriada: z.boolean().optional(),
})

type SaidaFormValues = z.infer<typeof saidaSchema>
type EtapaFormValues = z.infer<typeof etapaSchema>

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

export function VeiculoDetalhe() {
  const { id } = useParams<{ id: string }>()
  const { veiculo, historico, loading, refetch } = useVeiculoDetalhe(id)
  const [confirmandoSaida, setConfirmandoSaida] = useState(false)
  const [erroSaida, setErroSaida] = useState<string | null>(null)
  const [fotoAmpliada, setFotoAmpliada] = useState<{ url: string; label: string } | null>(null)
  const [adicionandoEtapa, setAdicionandoEtapa] = useState(false)
  const [erroEtapa, setErroEtapa] = useState<string | null>(null)

  const movimentacaoAtiva = historico.find((m) => m.status === 'no_patio')

  const { historico: etapas, refetch: refetchEtapas } = useHistoricoMovimentacao(
    movimentacaoAtiva?.id,
  )

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
    formState: { errors: errEtapa, isSubmitting: submittingEtapa },
  } = useForm<EtapaFormValues>({
    resolver: zodResolver(etapaSchema),
    defaultValues: { data: hojeInputValue(), horario: agoraInputValue() },
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
      await adicionarHistorico(
        movimentacaoAtiva.id,
        values.descricao,
        new Date(`${values.data}T${values.horario}`).toISOString(),
        values.osCriada,
      )
      resetEtapa({ descricao: '', data: hojeInputValue(), horario: agoraInputValue(), osCriada: false })
      setAdicionandoEtapa(false)
      await refetchEtapas()
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
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Trajeto atual</CardTitle>
              {!confirmandoSaida && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => { setAdicionandoEtapa(true); setErroEtapa(null) }}
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
                  className="mb-5 rounded-xl border border-border/40 bg-background p-4 space-y-3"
                >
                  <p className="text-sm font-medium text-foreground">Nova etapa</p>
                  <div>
                    <Label htmlFor="etapa-descricao">Descrição</Label>
                    <Input
                      id="etapa-descricao"
                      placeholder="Ex: Enviado para oficina, Lavagem, Retornou ao pátio…"
                      {...regEtapa('descricao')}
                    />
                    <FieldError message={errEtapa.descricao?.message} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="etapa-data">Data</Label>
                      <Input id="etapa-data" type="date" {...regEtapa('data')} />
                      <FieldError message={errEtapa.data?.message} />
                    </div>
                    <div>
                      <Label htmlFor="etapa-horario">Horário</Label>
                      <Input id="etapa-horario" type="time" {...regEtapa('horario')} />
                      <FieldError message={errEtapa.horario?.message} />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-border/40 accent-primary"
                      {...regEtapa('osCriada')}
                    />
                    <span className="text-sm text-foreground">OS (ordem de serviço) criada</span>
                  </label>
                  <FieldError message={erroEtapa ?? undefined} />
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => { setAdicionandoEtapa(false); setErroEtapa(null); resetEtapa() }}
                    >
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={submittingEtapa}>
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
                  {etapas.map((etapa) => (
                    <TimelineNode
                      key={etapa.id}
                      icon={<MapPin className="h-4 w-4" />}
                      color="neutral"
                      label={etapa.descricao}
                      dateTime={formatDateTime(etapa.data_hora)}
                      detail={etapa.usuario?.nome ? `Registrado por: ${etapa.usuario.nome}` : undefined}
                      osCriada={etapa.os_criada}
                      onDelete={() => onExcluirEtapa(etapa.id)}
                    />
                  ))}

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
  onDelete?: () => void
}

function TimelineNode({ icon, color, label, dateTime, detail, isLast, osCriada, onDelete }: TimelineNodeProps) {
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
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            title="Remover etapa"
            className="shrink-0 flex h-7 w-7 items-center justify-center rounded-lg text-secondary/50 transition-colors hover:bg-red-500/10 hover:text-red-400"
            aria-label="Remover etapa"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}
