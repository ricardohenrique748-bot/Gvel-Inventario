import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { supabase } from '@/lib/supabase'
import { formatDateTime, formatPermanencia } from '@/lib/format'
import { tipoVeiculoLabel } from '@/lib/tipoVeiculo'
import { extrairFotosExtras } from '@/lib/fotosExtras'
import type { VeiculoPublicoItem } from '@/lib/types'

function StatusManutencaoBadgePublico({ status }: { status: string | null }) {
  if (!status) return null
  const nome = status.toLowerCase()
  const tone = nome.includes('corretiva') ? 'danger' : nome.includes('preventiva') ? 'warning' : 'neutral'
  return <Badge tone={tone}>{status}</Badge>
}

const FOTOS_MOVIMENTACAO: { campo: keyof VeiculoPublicoItem; label: string }[] = [
  { campo: 'foto_frente_url', label: 'Frente' },
  { campo: 'foto_lado_esquerdo_url', label: 'Lado esquerdo' },
  { campo: 'foto_lado_direito_url', label: 'Lado direito' },
  { campo: 'foto_traseira_url', label: 'Traseira' },
  { campo: 'foto_painel_url', label: 'Painel' },
]

export function VeiculoPublico() {
  const { token, veiculoId } = useParams<{ token: string; veiculoId: string }>()
  const [historico, setHistorico] = useState<VeiculoPublicoItem[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [fotoAmpliada, setFotoAmpliada] = useState<{ url: string; label: string } | null>(null)

  useEffect(() => {
    if (!token || !veiculoId) return
    let ativo = true
    setLoading(true)
    supabase
      .rpc('get_veiculo_publico', { p_token: token, p_veiculo_id: veiculoId })
      .then(({ data, error }) => {
        if (!ativo) return
        if (error) setErro(error.message)
        else setHistorico((data as VeiculoPublicoItem[]) ?? [])
        setLoading(false)
      })
    return () => {
      ativo = false
    }
  }, [token, veiculoId])

  const veiculo = historico?.[0]
  const ativo = historico?.find((m) => m.status === 'no_patio')

  return (
    <div className="min-h-svh bg-background px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <Link
            to={`/publico/frota/${token}`}
            className="flex items-center gap-2 text-sm text-secondary hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
          <Logo size="sm" showText={false} />
        </div>

        {loading ? (
          <p className="text-center text-sm text-secondary">Carregando…</p>
        ) : erro || !historico || historico.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="text-sm text-secondary">Não foi possível carregar os dados deste veículo.</p>
          </Card>
        ) : (
          <>
            <h1 className="mb-1 text-2xl font-bold text-foreground">{veiculo!.placa}</h1>
            <p className="mb-6 text-sm text-secondary">
              {veiculo!.marca} {veiculo!.modelo}
            </p>

            <div className="grid gap-4 lg:grid-cols-3 mb-6">
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle>Dados do veículo</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center justify-between border-b border-border/5 py-1.5">
                    <span className="text-secondary">Status</span>
                    {ativo ? <Badge tone="success">No pátio</Badge> : <Badge tone="neutral">Fora do pátio</Badge>}
                  </div>
                  <div className="flex items-center justify-between border-b border-border/5 py-1.5">
                    <span className="text-secondary">Tipo</span>
                    <span className="text-foreground font-medium">{tipoVeiculoLabel(veiculo!.tipo)}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-border/5 py-1.5">
                    <span className="text-secondary">Situação</span>
                    <Badge tone={veiculo!.operante ? 'success' : 'danger'}>
                      {veiculo!.operante ? 'Operante' : 'Inoperante'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between border-b border-border/5 py-1.5">
                    <span className="text-secondary">Ano</span>
                    <span className="text-foreground font-medium">{veiculo!.ano || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-border/5 py-1.5">
                    <span className="text-secondary">Cor</span>
                    <span className="text-foreground font-medium">{veiculo!.cor || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-secondary">Chassi</span>
                    <span className="text-foreground font-medium">{veiculo!.chassi || '—'}</span>
                  </div>
                </CardContent>
              </Card>

              {ativo && (
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle>No pátio desde</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-lg font-semibold text-foreground">{formatDateTime(ativo.data_hora_entrada)}</p>
                    <p className="text-sm text-secondary">
                      Permanência: {formatPermanencia(ativo.data_hora_entrada)}
                      {ativo.patio_nome ? ` · Pátio: ${ativo.patio_nome}` : ''}
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Histórico de movimentações</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {historico.map((m) => {
                    const { textoLimpo, fotosExtras } = extrairFotosExtras(m.observacoes)
                    const temFotosPadrao = FOTOS_MOVIMENTACAO.some(({ campo }) => m[campo])
                    const temFotos = temFotosPadrao || fotosExtras.length > 0

                    return (
                      <div key={m.movimentacao_id} className="rounded-xl bg-background px-4 py-3">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                          <div className="text-sm">
                            <p className="text-foreground">
                              Entrada: {formatDateTime(m.data_hora_entrada)}
                              {m.patio_nome ? ` · Pátio: ${m.patio_nome}` : ''}
                              {m.motorista ? ` · ${m.motorista}` : ''}
                            </p>
                            <p className="text-secondary">
                              Saída: {m.data_hora_saida ? formatDateTime(m.data_hora_saida) : '—'} · Permanência:{' '}
                              {formatPermanencia(m.data_hora_entrada, m.data_hora_saida)}
                              {m.destino ? ` · Destino: ${m.destino}` : ''}
                            </p>
                            {textoLimpo && <p className="text-secondary mt-1">Obs: {textoLimpo}</p>}
                          </div>
                          <div className="flex items-center gap-2">
                            {m.status === 'no_patio' ? (
                              <Badge tone="success">No pátio</Badge>
                            ) : (
                              <Badge tone="neutral">Saiu</Badge>
                            )}
                            <StatusManutencaoBadgePublico status={m.status_manutencao} />
                          </div>
                        </div>

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
                                    src={url}
                                    alt={label}
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
                                  src={extra.url}
                                  alt={extra.label || `Foto extra ${idx + 1}`}
                                  className="h-16 w-16 rounded-lg object-cover border border-primary/40 hover:opacity-80 ring-1 ring-primary/30"
                                />
                                <span className="absolute bottom-0.5 left-0.5 right-0.5 text-[7px] font-bold text-center bg-black/70 text-white rounded px-0.5 truncate">
                                  {extra.label || `+${idx + 1}`}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {fotoAmpliada && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setFotoAmpliada(null)}
        >
          <img
            src={fotoAmpliada.url}
            alt={fotoAmpliada.label}
            className="max-h-[80vh] max-w-full rounded-xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}
