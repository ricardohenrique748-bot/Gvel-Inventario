import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PageHeader } from '@/components/layout/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { apiGet } from '@/lib/api'
import type { Cliente } from '@/lib/types'
import { useMovimentacoes } from '@/hooks/useMovimentacoes'
import { formatDateTime, formatPermanencia } from '@/lib/format'

export function ClienteDetalhe() {
  const { id } = useParams<{ id: string }>()
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const { movimentacoes, loading } = useMovimentacoes({ clienteId: id })

  useEffect(() => {
    if (!id) return
    apiGet<Cliente>(`/clientes/${id}`).then(({ data }) => setCliente(data))
  }, [id])

  const noPatio = movimentacoes.filter((m) => m.status === 'no_patio')

  return (
    <div>
      <PageHeader title={cliente?.nome ?? 'Cliente'} subtitle={cliente?.telefone ?? undefined} back />

      <div className="grid gap-4 lg:grid-cols-3 mb-6">
        <Card className="p-5">
          <p className="text-sm text-secondary">Veículos no pátio</p>
          <p className="mt-1 text-3xl font-semibold text-white">{noPatio.length}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-secondary">Total de movimentações</p>
          <p className="mt-1 text-3xl font-semibold text-white">{movimentacoes.length}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-secondary">CNPJ</p>
          <p className="mt-1 text-lg font-medium text-white">{cliente?.cnpj || '—'}</p>
        </Card>
      </div>

      {cliente?.endereco && (
        <Card className="p-5 mb-6">
          <p className="text-sm text-secondary">Endereço</p>
          <p className="mt-1 text-white">{cliente.endereco}</p>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Veículos e histórico</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-secondary">Carregando…</p>
          ) : movimentacoes.length === 0 ? (
            <p className="text-sm text-secondary">Nenhuma movimentação registrada para este cliente.</p>
          ) : (
            <div className="space-y-3">
              {movimentacoes.map((m) => (
                <Link
                  key={m.id}
                  to={`/veiculos/${m.veiculo_id}`}
                  className="flex flex-col gap-1 rounded-xl bg-background px-4 py-3 sm:flex-row sm:items-center sm:justify-between hover:bg-background/70"
                >
                  <div className="text-sm">
                    <p className="text-white font-medium">
                      {m.veiculo?.placa} · {m.veiculo?.marca?.nome} {m.veiculo?.modelo?.nome}
                      {m.patio?.nome ? ` · ${m.patio.nome}` : ''}
                    </p>
                    <p className="text-secondary">
                      Entrada: {formatDateTime(m.data_hora_entrada)} · Saída:{' '}
                      {m.data_hora_saida ? formatDateTime(m.data_hora_saida) : '—'} · Permanência:{' '}
                      {formatPermanencia(m.data_hora_entrada, m.data_hora_saida)}
                    </p>
                  </div>
                  {m.status === 'no_patio' ? (
                    <Badge tone="success">No pátio</Badge>
                  ) : (
                    <Badge tone="neutral">Saiu</Badge>
                  )}
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
