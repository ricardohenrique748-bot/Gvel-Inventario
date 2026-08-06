import { useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { LogOut, Truck, X } from 'lucide-react'
import { PageHeader } from '@/components/layout/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input, Label, FieldError } from '@/components/ui/Input'
import { StatusManutencaoBadge } from '@/components/StatusManutencaoBadge'
import { useVeiculoDetalhe } from '@/hooks/useVeiculos'
import { registrarSaida } from '@/hooks/useMovimentacoes'
import { formatDateTime, formatPermanencia } from '@/lib/format'
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
})

type SaidaFormValues = z.infer<typeof saidaSchema>

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

  const movimentacaoAtiva = historico.find((m) => m.status === 'no_patio')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SaidaFormValues>({
    resolver: zodResolver(saidaSchema),
    values: {
      motorista: movimentacaoAtiva?.motorista ?? '',
      destino: movimentacaoAtiva?.destino ?? '',
      data: hojeInputValue(),
      horario: agoraInputValue(),
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
      })
      setConfirmandoSaida(false)
      await refetch()
    } catch (err) {
      setErroSaida(err instanceof Error ? err.message : 'Não foi possível registrar a saída.')
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

      {movimentacaoAtiva && confirmandoSaida && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Saída de veículo</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onConfirmarSaida)} className="space-y-4">
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
                  <Input id="motorista" placeholder="Opcional" {...register('motorista')} />
                </div>
                <div>
                  <Label htmlFor="destino">Destino</Label>
                  <Input id="destino" placeholder="Opcional" {...register('destino')} />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="data">Data</Label>
                  <Input id="data" type="date" {...register('data')} />
                  <FieldError message={errors.data?.message} />
                </div>
                <div>
                  <Label htmlFor="horario">Horário</Label>
                  <Input id="horario" type="time" {...register('horario')} />
                  <FieldError message={errors.horario?.message} />
                </div>
              </div>

              <FieldError message={erroSaida ?? undefined} />

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setConfirmandoSaida(false)
                    setErroSaida(null)
                  }}
                >
                  <X className="h-4 w-4" />
                  Cancelar
                </Button>
                <Button type="submit" variant="danger" disabled={isSubmitting}>
                  {isSubmitting ? 'Registrando…' : 'Confirmar saída'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3 mb-6">
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
            <Row label="Tipo">{veiculo.tipo === 'pesado' ? 'Pesado' : 'Leve'}</Row>
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

        {movimentacaoAtiva && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>No pátio desde</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-status-success/15 text-status-success">
                <Truck className="h-6 w-6" />
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground">
                  {formatDateTime(movimentacaoAtiva.data_hora_entrada)}
                </p>
                <p className="text-sm text-secondary">
                  Permanência: {formatPermanencia(movimentacaoAtiva.data_hora_entrada)}
                  {movimentacaoAtiva.motorista ? ` · Motorista: ${movimentacaoAtiva.motorista}` : ''}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

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
                    </p>
                    <p className="text-secondary">
                      Saída: {m.data_hora_saida ? formatDateTime(m.data_hora_saida) : '—'} · Permanência:{' '}
                      {formatPermanencia(m.data_hora_entrada, m.data_hora_saida)}
                      {m.destino ? ` · Destino: ${m.destino}` : ''}
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
                                src={url}
                                alt={label}
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

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border/5 py-1.5 last:border-0">
      <span className="text-secondary">{label}</span>
      <span className="text-foreground font-medium">{children}</span>
    </div>
  )
}
