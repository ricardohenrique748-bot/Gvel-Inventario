import { useState } from 'react'
import { CheckCircle2, CloudOff, RefreshCw, Trash2 } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { resolverAlerta, type AbastecimentoConsumo, type AlertaConsumo } from '@/hooks/useConsumoCombustivel'
import { HIPOTESES_QUEDA_CONTINUA, TIPO_ALERTA_LABEL } from './dominio'
import { enfileirarAbastecimento, type ItemFilaOffline } from './filaOffline'
import { SecaoTitulo, fmtDataHora, fmtNum } from './ui'
import { erroConsumo } from './erros'

interface Props {
  abastecimentos: AbastecimentoConsumo[]
  alertas: AlertaConsumo[]
  filaOffline: ItemFilaOffline[]
  usuarioNome: string
  onAbrir: (a: AbastecimentoConsumo) => void
  onSincronizar: () => void
  onRemoverDaFila: (id: string) => void
}

const SEVERIDADE_TONE = { alta: 'danger', media: 'warning', baixa: 'neutral' } as const

export function RevisaoAlertas({ abastecimentos, alertas, filaOffline, usuarioNome, onAbrir, onSincronizar, onRemoverDaFila }: Props) {
  const [mostrarResolvidos, setMostrarResolvidos] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const pendentes = abastecimentos.filter((a) => a.status === 'pendente_revisao').sort((a, b) => b.dataHora.localeCompare(a.dataHora))
  const listaAlertas = alertas.filter((a) => mostrarResolvidos || !a.resolvido)

  return (
    <div className="space-y-6">
      {filaOffline.length > 0 && (
        <Card className="space-y-3 p-4">
          <SecaoTitulo
            titulo={`Pendentes de sincronização (${filaOffline.length})`}
            descricao="Registrados sem internet neste aparelho. Sobem sozinhos quando a conexão volta."
            acoes={
              <Button type="button" size="md" variant="secondary" onClick={onSincronizar}>
                <RefreshCw className="h-4 w-4" /> Sincronizar agora
              </Button>
            }
          />
          <ul className="space-y-2 text-xs">
            {filaOffline.map((i) => (
              <li key={i.input.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-background p-3">
                <span className="flex items-center gap-2">
                  <CloudOff className="h-4 w-4 text-status-warning" />
                  <strong className="text-foreground">{i.input.placa}</strong> · {fmtDataHora(i.input.dataHora)} · {fmtNum(i.input.litros, 1)} L
                  {i.erro && <span className="normal-case text-status-danger">— {i.erro}</span>}
                </span>
                <span className="flex gap-1.5">
                  {i.erro && (
                    <Button
                      type="button"
                      size="md"
                      variant="ghost"
                      className="h-8"
                      onClick={() => {
                        enfileirarAbastecimento(i.input) // limpa o erro
                        onSincronizar()
                      }}
                    >
                      Tentar de novo
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="md"
                    variant="ghost"
                    className="h-8 text-status-danger"
                    onClick={() => confirm('Descartar este abastecimento não enviado?') && onRemoverDaFila(i.input.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <section className="space-y-3">
        <SecaoTitulo
          titulo={`Fila de revisão (${pendentes.length})`}
          descricao="Registros com inconsistência. Não entram na média oficial até serem validados ou corrigidos."
        />
        {pendentes.length === 0 ? (
          <Card className="flex items-center gap-2 p-4 text-sm normal-case text-secondary">
            <CheckCircle2 className="h-4 w-4 text-status-success" /> Nada pendente de revisão.
          </Card>
        ) : (
          <div className="grid gap-2">
            {pendentes.map((a) => (
              <Card key={a.id} className="cursor-pointer p-3 text-xs transition-colors hover:bg-overlay/[0.04]" onClick={() => onAbrir(a)}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <strong className="text-foreground">{a.placa}</strong> · {fmtDataHora(a.dataHora)} · {fmtNum(a.litros, 1)} L ·{' '}
                    {a.odometro != null ? `${fmtNum(a.odometro)} km` : 'sem odômetro'} {a.tanqueCheio ? '· tanque cheio' : ''}
                  </span>
                  <span className="flex flex-wrap gap-1">
                    {a.motivosRevisao.map((m) => (
                      <Badge key={m} tone="warning">
                        {TIPO_ALERTA_LABEL[m] ?? m}
                      </Badge>
                    ))}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <SecaoTitulo
          titulo="Alertas"
          descricao="Gerados no registro e no fechamento de cada ciclo. Causas sugeridas são hipóteses, não diagnóstico."
          acoes={
            <label className="flex items-center gap-2 text-xs normal-case text-secondary">
              <input type="checkbox" checked={mostrarResolvidos} onChange={(e) => setMostrarResolvidos(e.target.checked)} /> Mostrar resolvidos
            </label>
          }
        />
        {erro && <p className="text-xs normal-case text-status-danger">{erro}</p>}
        {listaAlertas.length === 0 ? (
          <Card className="p-4 text-sm normal-case text-secondary">Nenhum alerta em aberto.</Card>
        ) : (
          <div className="grid gap-2">
            {listaAlertas.map((al) => {
              const ref = abastecimentos.find((a) => a.id === al.referenciaId)
              return (
                <Card key={al.id} className={`p-3 text-xs ${al.resolvido ? 'opacity-60' : ''}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={SEVERIDADE_TONE[al.severidade]}>{TIPO_ALERTA_LABEL[al.tipo]}</Badge>
                        <strong className="text-foreground">{al.placa}</strong>
                        <span className="text-secondary">{fmtDataHora(al.createdAt)}</span>
                      </div>
                      <p className="normal-case text-foreground">{al.mensagem}</p>
                      {al.tipo === 'QUEDA_CONTINUA' && (
                        <p className="normal-case text-secondary">Possíveis causas (hipóteses): {HIPOTESES_QUEDA_CONTINUA.join(', ')}.</p>
                      )}
                      {al.resolvido && (
                        <p className="normal-case text-secondary">
                          Resolvido por {al.resolvidoPor} em {fmtDataHora(al.resolvidoEm)}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1.5">
                      {ref && (
                        <Button type="button" size="md" variant="ghost" className="h-8" onClick={() => onAbrir(ref)}>
                          Ver registro
                        </Button>
                      )}
                      {!al.resolvido && (
                        <Button
                          type="button"
                          size="md"
                          variant="secondary"
                          className="h-8"
                          onClick={() => resolverAlerta(al.id, usuarioNome).catch((e) => setErro(erroConsumo(e, 'Erro ao resolver alerta.')))}
                        >
                          Resolver
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
