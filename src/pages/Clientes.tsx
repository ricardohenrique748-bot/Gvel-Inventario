import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Users } from 'lucide-react'
import { PageHeader } from '@/components/layout/Header'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { useClientes } from '@/hooks/useClientes'
import { useMovimentacoes } from '@/hooks/useMovimentacoes'

export function Clientes() {
  const [search, setSearch] = useState('')
  const { clientes, loading } = useClientes()
  const { movimentacoes } = useMovimentacoes()

  const stats = useMemo(() => {
    const map = new Map<string, { noPatio: number; total: number }>()
    for (const m of movimentacoes) {
      const clienteId = m.veiculo?.cliente_id
      if (!clienteId) continue
      const current = map.get(clienteId) ?? { noPatio: 0, total: 0 }
      current.total += 1
      if (m.status === 'no_patio') current.noPatio += 1
      map.set(clienteId, current)
    }
    return map
  }, [movimentacoes])

  const filtered = clientes.filter((c) => c.nome.toLowerCase().includes(search.toLowerCase()))

  return (
    <div>
      <PageHeader title="Clientes" subtitle="Base de clientes da oficina" />

      <div className="relative mb-6 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary" />
        <Input
          placeholder="Buscar cliente"
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <p className="text-sm text-secondary">Carregando…</p>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-sm text-secondary">Nenhum cliente encontrado.</Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => {
            const s = stats.get(c.id) ?? { noPatio: 0, total: 0 }
            return (
              <Link key={c.id} to={`/clientes/${c.id}`}>
                <Card className="p-4 h-full hover:border-primary/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                      <Users className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-white truncate">{c.nome}</p>
                      <p className="text-xs text-secondary truncate">{c.telefone || 'Sem telefone'}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    {s.noPatio > 0 && <Badge tone="success">{s.noPatio} no pátio</Badge>}
                    <Badge tone="neutral">{s.total} movimentações</Badge>
                  </div>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
