import { useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { LogOut, X, User } from 'lucide-react'
import { PageHeader } from '@/components/layout/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input, Label, FieldError } from '@/components/ui/Input'
import { StatusManutencaoBadge } from '@/components/StatusManutencaoBadge'
import { TrajetoAtualCard } from '@/components/TrajetoAtualCard'
import { useVeiculoDetalhe } from '@/hooks/useVeiculos'
import { registrarSaida } from '@/hooks/useMovimentacoes'
import { useChecklistOS } from '@/hooks/useChecklistOS'
import { obterNomeCompletoMembro, formatarNomeSobrenome } from '@/constants/equipe'
import { useAuth } from '@/contexts/AuthContext'
import { isAdminUsuario } from '@/lib/permissoes'
import { formatDateTime, formatPermanencia } from '@/lib/format'
import { urlMiniatura, aoFalharMiniatura } from '@/lib/thumb'
import { tipoVeiculoLabel } from '@/lib/tipoVeiculo'
import { extrairFotosExtras } from '@/lib/fotosExtras'
import type { Movimentacao } from '@/lib/types'

function MecanicosAtividadesCard({ movimentacaoId }: { movimentacaoId: string }) {
  const { osData, items, loading } = useChecklistOS(movimentacaoId)

  if (loading) return null

  const mecanicoPrincipal = osData.mecanico ? obterNomeCompletoMembro(osData.mecanico) : ''
  const atividadesComMecanico = Object.values(items)
    .filter((item) => item.mecanico && item.mecanico.trim())
    .sort((a, b) => (a.data_inicio || '').localeCompare(b.data_inicio || '') || (a.hora_inicio || '').localeCompare(b.hora_inicio || ''))

  if (!mecanicoPrincipal && atividadesComMecanico.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Mecânico(s) e atividades</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-secondary">Nenhum mecânico apontado ainda no checklist de manutenção.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mecânico(s) e atividades</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {mecanicoPrincipal && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-xs font-bold uppercase text-blue-400">
              <User className="h-3.5 w-3.5" />
              {formatarNomeSobrenome(mecanicoPrincipal)}
            </span>
            {osData.funcao && <span className="text-xs uppercase text-secondary">{osData.funcao}</span>}
            {osData.statusOS && <Badge tone={osData.dataHoraFechamento ? 'success' : 'warning'}>{osData.statusOS}</Badge>}
          </div>
        )}

        {atividadesComMecanico.length > 0 && (
          <div className="space-y-2">
            {atividadesComMecanico.map((item) => (
              <div
                key={item.item_id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-background px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{item.label}</p>
                  <p className="text-xs text-secondary">{formatarNomeSobrenome(obterNomeCompletoMembro(item.mecanico))}</p>
                </div>
                <Badge tone={item.checked ? 'success' : item.hora_inicio ? 'warning' : 'neutral'}>
                  {item.hora_inicio && item.hora_fim
                    ? `${item.hora_inicio}–${item.hora_fim}`
                    : item.hora_inicio
                      ? 'Em andamento'
                      : item.checked
                        ? 'Concluído'
                        : 'Pendente'}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
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
  const { perfil, user } = useAuth()
  const isAdmin = isAdminUsuario(perfil, user?.email)
  const { veiculo, historico, loading, refetch } = useVeiculoDetalhe(id)
  const [confirmandoSaida, setConfirmandoSaida] = useState(false)
  const [erroSaida, setErroSaida] = useState<string | null>(null)
  const [fotoAmpliada, setFotoAmpliada] = useState<{ url: string; label: string } | null>(null)

  const movimentacaoAtiva = historico.find((m) => m.status === 'no_patio')

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
                  <Label htmlFor="saida-motorista">Motorista</Label>
                  <Input id="saida-motorista" placeholder="Opcional" {...regSaida('motorista')} />
                </div>
                <div>
                  <Label htmlFor="saida-destino">Destino</Label>
                  <Input id="saida-destino" placeholder="Opcional" {...regSaida('destino')} />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Label htmlFor="saida-data">Data</Label>
                  <Input id="saida-data" type="date" {...regSaida('data')} />
                  <FieldError message={errSaida.data?.message} />
                </div>
                <div>
                  <Label htmlFor="saida-horario">Horário</Label>
                  <Input id="saida-horario" type="time" {...regSaida('horario')} />
                  <FieldError message={errSaida.horario?.message} />
                </div>
                <div>
                  <Label htmlFor="saida-km">KM de saída</Label>
                  <Input
                    id="saida-km"
                    type="number"
                    placeholder="Opcional"
                    {...regSaida('km', { valueAsNumber: true })}
                  />
                  <FieldError message={errSaida.km?.message} />
                </div>
              </div>
              <FieldError message={erroSaida ?? undefined} />
              <div className="flex justify-end gap-2">
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
          <div className="lg:col-span-2">
            <TrajetoAtualCard
              movimentacao={movimentacaoAtiva}
              disableHeaderActions={confirmandoSaida}
              onAtualizar={refetch}
            />
          </div>
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
                  <div className="text-sm uppercase">
                    <p className="text-foreground">
                      {m.veiculo?.placa ? `Placa: ${m.veiculo.placa} · ` : ''}
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
                    {(() => {
                      const { textoLimpo, fotosExtras } = extrairFotosExtras(m.observacoes)
                      const temFotosPadrao = FOTOS_MOVIMENTACAO.some(({ campo }) => m[campo])
                      const temFotos = temFotosPadrao || fotosExtras.length > 0

                      return (
                        <>
                          {textoLimpo && <p className="text-secondary mt-1">Obs: {textoLimpo}</p>}

                          {temFotos && (
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

                              {fotosExtras.map((extra, idx) => (
                                <button
                                  key={`extra-${idx}-${extra.url}`}
                                  type="button"
                                  onClick={() =>
                                    setFotoAmpliada({
                                      url: extra.url,
                                      label: extra.label || `Foto extra ${idx + 1}`,
                                    })
                                  }
                                  className="shrink-0 relative group"
                                  aria-label={`Ampliar ${extra.label || `Foto extra ${idx + 1}`}`}
                                >
                                  <img
                                    src={urlMiniatura(extra.url, 128)}
                                    onError={aoFalharMiniatura(extra.url)}
                                    alt={extra.label || `Foto extra ${idx + 1}`}
                                    loading="lazy"
                                    decoding="async"
                                    width={64}
                                    height={64}
                                    className="h-16 w-16 rounded-lg object-cover border border-primary/40 hover:opacity-80 ring-1 ring-primary/30"
                                  />
                                  <span className="absolute bottom-0.5 left-0.5 right-0.5 text-[7px] font-bold text-center bg-black/70 text-white rounded px-0.5 truncate">
                                    {extra.label || `+${idx + 1}`}
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      )
                    })()}
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

      {/* — Mecânico(s) e atividades apontados no checklist de manutenção (só admin) — */}
      {isAdmin && movimentacaoAtiva && (
        <div className="mt-6">
          <MecanicosAtividadesCard movimentacaoId={movimentacaoAtiva.id} />
        </div>
      )}

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

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border/5 py-1.5 last:border-0">
      <span className="text-secondary">{label}</span>
      <span className="text-foreground font-medium">{children}</span>
    </div>
  )
}
