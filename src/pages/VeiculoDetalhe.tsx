import { useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { LogOut, Truck } from 'lucide-react'
import { PageHeader } from '@/components/layout/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { StatusManutencaoBadge } from '@/components/StatusManutencaoBadge'
import { useVeiculoDetalhe } from '@/hooks/useVeiculos'
import { registrarSaida } from '@/hooks/useMovimentacoes'
import { formatDateTime, formatPermanencia } from '@/lib/format'

export function VeiculoDetalhe() {
  const { id } = useParams<{ id: string }>()
  const { veiculo, historico, loading, refetch } = useVeiculoDetalhe(id)
  const [saving, setSaving] = useState(false)

  const movimentacaoAtiva = historico.find((m) => m.status === 'no_patio')

  async function handleRegistrarSaida() {
    if (!movimentacaoAtiva) return
    setSaving(true)
    try {
      await registrarSaida(movimentacaoAtiva.id)
      await refetch()
    } finally {
      setSaving(false)
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
          movimentacaoAtiva ? (
            <Button variant="danger" onClick={handleRegistrarSaida} disabled={saving}>
              <LogOut className="h-4 w-4" />
              {saving ? 'Registrando…' : 'Registrar saída'}
            </Button>
          ) : undefined
        }
      />

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
                <p className="text-lg font-semibold text-white">
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
                    <p className="text-white">
                      Entrada: {formatDateTime(m.data_hora_entrada)}
                      {m.patio?.nome ? ` · Pátio: ${m.patio.nome}` : ''}
                      {m.motorista ? ` · ${m.motorista}` : ''}
                    </p>
                    <p className="text-secondary">
                      Saída: {m.data_hora_saida ? formatDateTime(m.data_hora_saida) : '—'} · Permanência:{' '}
                      {formatPermanencia(m.data_hora_entrada, m.data_hora_saida)}
                    </p>
                    {m.observacoes && <p className="text-secondary mt-1">Obs: {m.observacoes}</p>}
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
    </div>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-white/5 py-1.5 last:border-0">
      <span className="text-secondary">{label}</span>
      <span className="text-white font-medium">{children}</span>
    </div>
  )
}
