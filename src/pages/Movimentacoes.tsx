import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/components/layout/Header'
import { FiltersBar, type FiltersValue } from '@/components/FiltersBar'
import { LinkButton } from '@/components/ui/LinkButton'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { StatusManutencaoBadge } from '@/components/StatusManutencaoBadge'
import { useMovimentacoes } from '@/hooks/useMovimentacoes'
import { formatDateTime, formatPermanencia } from '@/lib/format'

export function Movimentacoes() {
  const navigate = useNavigate()
  const [filters, setFilters] = useState<FiltersValue>({})
  const { movimentacoes, loading } = useMovimentacoes({
    search: filters.search,
    clienteId: filters.clienteId,
    marcaId: filters.marcaId,
    modeloId: filters.modeloId,
    patioId: filters.patioId,
    dataInicio: filters.dataInicio ? `${filters.dataInicio}T00:00:00` : undefined,
    dataFim: filters.dataFim ? `${filters.dataFim}T23:59:59` : undefined,
  })

  return (
    <div>
      <PageHeader
        title="Movimentações"
        subtitle="Entradas e saídas de veículos"
        actions={
          <LinkButton to="/movimentacoes/nova" size="md" className="hidden md:inline-flex">
            <Plus className="h-4 w-4" />
            Registrar entrada
          </LinkButton>
        }
      />

      <div className="mb-6">
        <FiltersBar value={filters} onChange={setFilters} showSearch />
      </div>

      {loading ? (
        <p className="text-sm text-secondary">Carregando…</p>
      ) : movimentacoes.length === 0 ? (
        <Card className="p-8 text-center text-sm text-secondary">Nenhuma movimentação encontrada.</Card>
      ) : (
        <>
          {/* Desktop: tabela */}
          <Card className="hidden md:block overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-left text-secondary">
                  <th className="px-5 py-3 font-medium">Placa</th>
                  <th className="px-5 py-3 font-medium">Marca/Modelo</th>
                  <th className="px-5 py-3 font-medium">Cliente</th>
                  <th className="px-5 py-3 font-medium">Pátio</th>
                  <th className="px-5 py-3 font-medium">Entrada</th>
                  <th className="px-5 py-3 font-medium">Saída</th>
                  <th className="px-5 py-3 font-medium">Permanência</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Manutenção</th>
                </tr>
              </thead>
              <tbody>
                {movimentacoes.map((m) => (
                  <tr
                    key={m.id}
                    className="border-b border-white/5 last:border-0 hover:bg-background/60 cursor-pointer"
                    onClick={() => navigate(`/veiculos/${m.veiculo_id}`)}
                  >
                    <td className="px-5 py-3 font-medium text-white">{m.veiculo?.placa}</td>
                    <td className="px-5 py-3 text-secondary">
                      {m.veiculo?.marca?.nome} {m.veiculo?.modelo?.nome}
                    </td>
                    <td className="px-5 py-3 text-secondary">{m.veiculo?.cliente?.nome}</td>
                    <td className="px-5 py-3 text-secondary">{m.patio?.nome || '—'}</td>
                    <td className="px-5 py-3 text-secondary">{formatDateTime(m.data_hora_entrada)}</td>
                    <td className="px-5 py-3 text-secondary">
                      {m.data_hora_saida ? formatDateTime(m.data_hora_saida) : '—'}
                    </td>
                    <td className="px-5 py-3 text-secondary">
                      {formatPermanencia(m.data_hora_entrada, m.data_hora_saida)}
                    </td>
                    <td className="px-5 py-3">
                      {m.status === 'no_patio' ? (
                        <Badge tone="success">No pátio</Badge>
                      ) : (
                        <Badge tone="neutral">Saiu</Badge>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <StatusManutencaoBadge status={m.status_manutencao} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Mobile: cards */}
          <div className="md:hidden space-y-3">
            {movimentacoes.map((m) => (
              <Link key={m.id} to={`/veiculos/${m.veiculo_id}`}>
                <Card className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-white">{m.veiculo?.placa}</p>
                      <p className="text-sm text-secondary">
                        {m.veiculo?.marca?.nome} {m.veiculo?.modelo?.nome}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {m.status === 'no_patio' ? (
                        <Badge tone="success">No pátio</Badge>
                      ) : (
                        <Badge tone="neutral">Saiu</Badge>
                      )}
                      <StatusManutencaoBadge status={m.status_manutencao} />
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-secondary">
                    <p>Cliente: {m.veiculo?.cliente?.nome}</p>
                    <p>Pátio: {m.patio?.nome || '—'}</p>
                    <p>Permanência: {formatPermanencia(m.data_hora_entrada, m.data_hora_saida)}</p>
                    <p>Entrada: {formatDateTime(m.data_hora_entrada)}</p>
                    <p>Saída: {m.data_hora_saida ? formatDateTime(m.data_hora_saida) : '—'}</p>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}

      <LinkButton to="/movimentacoes/nova" className="md:hidden fixed bottom-20 right-4 z-30 shadow-lg" size="lg">
        <Plus className="h-5 w-5" />
        Entrada
      </LinkButton>
    </div>
  )
}
