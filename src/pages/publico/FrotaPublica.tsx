import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Search, Truck } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { supabase } from '@/lib/supabase'
import { formatDateTime } from '@/lib/format'
import type { FrotaPublicaItem } from '@/lib/types'

function StatusManutencaoBadgePublico({ status }: { status: string | null }) {
  if (!status) return null
  const nome = status.toLowerCase()
  const tone = nome.includes('corretiva') ? 'danger' : nome.includes('preventiva') ? 'warning' : 'neutral'
  return <Badge tone={tone}>{status}</Badge>
}

type FiltroSituacao = 'todos' | 'operante' | 'inoperante'

// `operante` só existe no retorno da função pública depois da migration 0023 — em
// projetos que ainda não rodaram, o campo vem `undefined`. Tratamos qualquer coisa
// diferente de `false` como operante, pra não marcar a frota inteira como
// inoperante por engano enquanto a migration não foi aplicada.
function isOperante(item: FrotaPublicaItem) {
  return item.operante !== false
}

export function FrotaPublica() {
  const { token } = useParams<{ token: string }>()
  const [itens, setItens] = useState<FrotaPublicaItem[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [filtroSituacao, setFiltroSituacao] = useState<FiltroSituacao>('todos')
  const [buscaPlaca, setBuscaPlaca] = useState('')

  useEffect(() => {
    if (!token) return
    let ativo = true
    setLoading(true)
    supabase
      .rpc('get_frota_publica', { p_token: token })
      .then(({ data, error }) => {
        if (!ativo) return
        if (error) {
          setErro(error.message)
        } else {
          setItens((data as FrotaPublicaItem[]) ?? [])
        }
        setLoading(false)
      })
    return () => {
      ativo = false
    }
  }, [token])

  const { clienteNome, porPatio, jaSaiu, totalGeral } = useMemo(() => {
    const listaCompleta = itens ?? []
    const clienteNome = listaCompleta[0]?.cliente_nome ?? ''
    const termoPlaca = buscaPlaca.trim().toUpperCase()
    const lista = listaCompleta.filter((i) => {
      if (filtroSituacao === 'operante' && !isOperante(i)) return false
      if (filtroSituacao === 'inoperante' && isOperante(i)) return false
      if (termoPlaca && !i.placa?.toUpperCase().includes(termoPlaca)) return false
      return true
    })
    const noPatio = lista.filter((i) => i.status === 'no_patio')
    const jaSaiu = lista
      .filter((i) => i.status === 'saiu')
      .sort((a, b) => new Date(b.data_hora_saida ?? 0).getTime() - new Date(a.data_hora_saida ?? 0).getTime())

    const porPatioMap = new Map<string, { nome: string; veiculos: FrotaPublicaItem[] }>()
    for (const item of noPatio) {
      const key = item.patio_nome ?? 'Sem pátio'
      if (!porPatioMap.has(key)) porPatioMap.set(key, { nome: key, veiculos: [] })
      porPatioMap.get(key)!.veiculos.push(item)
    }

    return {
      clienteNome,
      porPatio: [...porPatioMap.values()].sort((a, b) => a.nome.localeCompare(b.nome)),
      jaSaiu,
      totalGeral: lista.length,
    }
  }, [itens, filtroSituacao, buscaPlaca])

  return (
    <div className="min-h-svh bg-background px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex justify-center">
          <Logo size="md" />
        </div>

        {loading ? (
          <p className="text-center text-sm text-secondary">Carregando…</p>
        ) : erro || !itens || itens.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="text-sm text-secondary">
              {erro ? 'Não foi possível carregar os dados.' : 'Nenhuma informação disponível para este link.'}
            </p>
          </Card>
        ) : (
          <>
            <h1 className="mb-1 text-center text-xl font-semibold text-foreground">{clienteNome}</h1>
            <p className="mb-4 text-center text-sm text-secondary">Situação atual da frota</p>

            <div className="relative mx-auto mb-4 max-w-xs">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary" />
              <Input
                value={buscaPlaca}
                onChange={(e) => setBuscaPlaca(e.target.value)}
                placeholder="Buscar placa…"
                className="pl-10"
              />
            </div>

            <div className="mb-6 flex justify-center gap-2">
              {(
                [
                  { valor: 'todos', label: 'Todos' },
                  { valor: 'operante', label: 'Operante' },
                  { valor: 'inoperante', label: 'Inoperante' },
                ] as const
              ).map((opcao) => (
                <button
                  key={opcao.valor}
                  type="button"
                  onClick={() => setFiltroSituacao(opcao.valor)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                    filtroSituacao === opcao.valor
                      ? opcao.valor === 'inoperante'
                        ? 'bg-status-danger text-white'
                        : opcao.valor === 'operante'
                          ? 'bg-status-success text-white'
                          : 'bg-primary text-white'
                      : 'bg-surface text-secondary hover:text-foreground'
                  }`}
                >
                  {opcao.label}
                </button>
              ))}
            </div>

            {totalGeral === 0 && (
              <Card className="mb-6 p-6 text-center">
                <p className="text-sm text-secondary">Nenhum veículo encontrado com esses filtros.</p>
              </Card>
            )}

            {porPatio.length > 0 && (
              <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {porPatio.map((p) => (
                  <Card key={p.nome} className="p-5">
                    <p className="text-sm text-secondary truncate">{p.nome}</p>
                    <p className="mt-1 text-3xl font-semibold text-foreground">{p.veiculos.length}</p>
                    <p className="text-xs text-secondary">{p.veiculos.length === 1 ? 'caminhão' : 'caminhões'}</p>
                  </Card>
                ))}
              </div>
            )}

            {porPatio.length > 0 && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>No pátio</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {porPatio.map((p) => (
                      <div key={p.nome}>
                        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-secondary">{p.nome}</p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {p.veiculos.map((v) => (
                            <Link
                              key={v.movimentacao_id}
                              to={`/publico/frota/${token}/veiculo/${v.veiculo_id}`}
                              className="flex items-center justify-between gap-2 rounded-xl bg-background px-4 py-3 hover:bg-surface-hover"
                            >
                              <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-status-success/15 text-status-success">
                                  <Truck className="h-4 w-4" />
                                </div>
                                <div>
                                  <p className="text-foreground font-medium">{v.placa}</p>
                                  <p className="text-sm text-secondary">
                                    {v.marca} {v.modelo}
                                  </p>
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                <Badge tone={isOperante(v) ? 'success' : 'danger'}>
                                  {isOperante(v) ? 'Operante' : 'Inoperante'}
                                </Badge>
                                <StatusManutencaoBadgePublico status={v.status_manutencao} />
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {jaSaiu.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Fora do pátio ({jaSaiu.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {jaSaiu.map((v) => (
                      <Link
                        key={v.movimentacao_id}
                        to={`/publico/frota/${token}/veiculo/${v.veiculo_id}`}
                        className="block rounded-xl bg-background px-4 py-3 hover:bg-surface-hover"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-foreground font-medium">{v.placa}</p>
                          <div className="flex items-center gap-1.5">
                            <Badge tone={isOperante(v) ? 'success' : 'danger'}>
                              {isOperante(v) ? 'Operante' : 'Inoperante'}
                            </Badge>
                            <Badge tone="neutral">Saiu</Badge>
                          </div>
                        </div>
                        <p className="text-sm text-secondary">
                          {v.marca} {v.modelo}
                        </p>
                        <p className="mt-1 text-xs text-secondary">Saída: {formatDateTime(v.data_hora_saida)}</p>
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="mt-6 p-5 text-center">
              <p className="text-sm text-secondary">Total geral</p>
              <p className="mt-1 text-3xl font-semibold text-foreground">{totalGeral}</p>
              <p className="text-xs text-secondary">{totalGeral === 1 ? 'veículo' : 'veículos'}</p>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}
