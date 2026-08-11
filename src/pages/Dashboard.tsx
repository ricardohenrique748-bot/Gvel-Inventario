import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Truck, LogIn, LogOut, Clock } from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  LabelList,
} from 'recharts'
import { format, isSameDay, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { PageHeader } from '@/components/layout/Header'
import { FiltersBar, type FiltersValue } from '@/components/FiltersBar'
import { StatCard } from '@/components/ui/StatCard'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { StatusManutencaoBadge } from '@/components/StatusManutencaoBadge'
import { useMovimentacoes } from '@/hooks/useMovimentacoes'
import { permanenciaEmMinutos, formatMinutosParaTexto } from '@/lib/format'
import { CHART_ENTRADA, CHART_SAIDA, CHART_CATEGORICAL, CHART_OTHER, CHART_CHROME } from '@/lib/chartColors'
import { urlMiniatura, aoFalharMiniatura } from '@/lib/thumb'

const tooltipStyle = {
  backgroundColor: CHART_CHROME.tooltipBg,
  border: `1px solid ${CHART_CHROME.tooltipBorder}`,
  borderRadius: 12,
  color: '#fff',
  fontSize: 13,
}

export function Dashboard() {
  const filtroInicial = {
    dataInicio: format(new Date(), 'yyyy-MM-dd'),
    dataFim: format(new Date(), 'yyyy-MM-dd'),
  }

  const [filters, setFilters] = useState<FiltersValue>(filtroInicial)

  const { movimentacoes: noPatio, loading: loadingNoPatio } = useMovimentacoes({
    status: 'no_patio',
    search: filters.search,
    clienteId: filters.clienteId,
    marcaId: filters.marcaId,
    modeloId: filters.modeloId,
    patioId: filters.patioId,
  })

  const { movimentacoes: periodo, loading: loadingPeriodo } = useMovimentacoes({
    dataInicio: filters.dataInicio ? `${filters.dataInicio}T00:00:00` : undefined,
    dataFim: filters.dataFim ? `${filters.dataFim}T23:59:59` : undefined,
    search: filters.search,
    clienteId: filters.clienteId,
    marcaId: filters.marcaId,
    modeloId: filters.modeloId,
    patioId: filters.patioId,
  })

  // Determina se o filtro representa um único dia ou um intervalo
  const umDiaSelecionado =
    filters.dataInicio && filters.dataFim && filters.dataInicio === filters.dataFim
      ? parseISO(filters.dataInicio)
      : null

  // Label dinâmico dos cards de entrada/saída
  const labelEntradas = umDiaSelecionado
    ? `Entradas em ${format(umDiaSelecionado, "dd/MM", { locale: ptBR })}`
    : 'Entradas no período'
  const labelSaidas = umDiaSelecionado
    ? `Saídas em ${format(umDiaSelecionado, "dd/MM", { locale: ptBR })}`
    : 'Saídas no período'

  const stats = useMemo(() => {
    const entradasFiltradas = umDiaSelecionado
      ? periodo.filter((m) => isSameDay(new Date(m.data_hora_entrada), umDiaSelecionado))
      : periodo
    const saidasFiltradas = umDiaSelecionado
      ? periodo.filter((m) => m.data_hora_saida && isSameDay(new Date(m.data_hora_saida), umDiaSelecionado))
      : periodo.filter((m) => m.data_hora_saida)

    const entradasHoje = entradasFiltradas.length
    const saidasHoje = saidasFiltradas.length
    const finalizadas = periodo.filter((m) => m.data_hora_saida)
    const tempoMedio =
      finalizadas.length > 0
        ? Math.round(
            finalizadas.reduce((acc, m) => acc + permanenciaEmMinutos(m.data_hora_entrada, m.data_hora_saida), 0) /
              finalizadas.length,
          )
        : 0

    return { entradasHoje, saidasHoje, tempoMedio, entradasFiltradas }
  }, [periodo, umDiaSelecionado])

  const porDia = useMemo(() => {
    if (!filters.dataInicio || !filters.dataFim) return []
    const inicio = new Date(`${filters.dataInicio}T00:00:00`)
    const fim = new Date(`${filters.dataFim}T00:00:00`)
    const dias: { key: string; dia: string; Entradas: number; Saídas: number }[] = []
    for (let d = new Date(inicio); d <= fim; d.setDate(d.getDate() + 1)) {
      dias.push({ key: format(d, 'yyyy-MM-dd'), dia: format(d, 'dd/MM'), Entradas: 0, Saídas: 0 })
    }
    const byKey = new Map(dias.map((d) => [d.key, d]))
    for (const m of periodo) {
      const entradaKey = format(new Date(m.data_hora_entrada), 'yyyy-MM-dd')
      const bucket = byKey.get(entradaKey)
      if (bucket) bucket.Entradas += 1
      if (m.data_hora_saida) {
        const saidaKey = format(new Date(m.data_hora_saida), 'yyyy-MM-dd')
        const bucketSaida = byKey.get(saidaKey)
        if (bucketSaida) bucketSaida.Saídas += 1
      }
    }
    return dias
  }, [periodo, filters.dataInicio, filters.dataFim])

  const porMarca = useMemo(() => {
    const counts = new Map<string, number>()
    for (const m of noPatio) {
      const nome = m.veiculo?.marca?.nome ?? 'Sem marca'
      counts.set(nome, (counts.get(nome) ?? 0) + 1)
    }
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
    const top = sorted.slice(0, 5).map(([name, value]) => ({ name, value }))
    const outras = sorted.slice(5).reduce((acc, [, v]) => acc + v, 0)
    if (outras > 0) top.push({ name: 'Outras', value: outras })
    return top
  }, [noPatio])

  const rankingPatios = useMemo(() => {
    const counts = new Map<string, number>()
    for (const m of periodo) {
      const nome = m.patio?.nome ?? 'Sem pátio'
      counts.set(nome, (counts.get(nome) ?? 0) + 1)
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, value]) => ({ name, value }))
  }, [periodo])

  const entradasHojeAgrupadas = useMemo(() => {
    const lista = stats.entradasFiltradas
    const porCliente = new Map<string, typeof lista>()
    for (const m of lista) {
      const nome = m.veiculo?.cliente?.nome ?? 'Sem cliente'
      if (!porCliente.has(nome)) porCliente.set(nome, [])
      porCliente.get(nome)!.push(m)
    }
    return [...porCliente.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [stats.entradasFiltradas])

  const [painelAberto, setPainelAberto] = useState<'no_patio' | 'entradas_hoje' | null>(null)

  const loading = loadingNoPatio || loadingPeriodo

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Visão geral do pátio" />

      <div className="mb-6">
        <FiltersBar
          value={filters}
          onChange={setFilters}
          showSearch
          onClear={() => setFilters(filtroInicial)}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-6">
        <StatCard
          icon={Truck}
          label="No pátio agora"
          value={String(noPatio.length)}
          active={painelAberto === 'no_patio'}
          onClick={() => setPainelAberto((p) => (p === 'no_patio' ? null : 'no_patio'))}
        />
        <StatCard
          icon={LogIn}
          label={labelEntradas}
          value={String(stats.entradasHoje)}
          active={painelAberto === 'entradas_hoje'}
          onClick={() => setPainelAberto((p) => (p === 'entradas_hoje' ? null : 'entradas_hoje'))}
        />
        <StatCard icon={LogOut} label={labelSaidas} value={String(stats.saidasHoje)} />
        <StatCard
          icon={Clock}
          label="Tempo médio de permanência"
          value={stats.tempoMedio > 0 ? formatMinutosParaTexto(stats.tempoMedio) : '—'}
        />
      </div>

      {painelAberto === 'no_patio' && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{loadingNoPatio ? 'Carregando…' : `${noPatio.length} veículo(s) no pátio agora`}</CardTitle>
          </CardHeader>
          <CardContent>
            {!loadingNoPatio && noPatio.length === 0 ? (
              <p className="text-sm text-secondary">Nenhum veículo no pátio no momento.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {noPatio.map((m) => (
                  <Link
                    key={m.id}
                    to={`/veiculos/${m.veiculo_id}`}
                    className="block rounded-xl bg-background px-4 py-3 transition-colors hover:bg-background/70"
                  >
                    <p className="text-foreground font-medium">{m.veiculo?.placa}</p>
                    <p className="text-sm text-secondary">
                      {m.veiculo?.marca?.nome} {m.veiculo?.modelo?.nome}
                    </p>
                    <p className="text-sm text-secondary">{m.veiculo?.cliente?.nome}</p>
                    <p className="text-sm text-secondary">Pátio: {m.patio?.nome || '—'}</p>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {painelAberto === 'entradas_hoje' && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{loadingPeriodo ? 'Carregando…' : `${stats.entradasHoje} entrada(s) — ${labelEntradas.toLowerCase()}`}</CardTitle>
          </CardHeader>
          <CardContent>
            {!loadingPeriodo && entradasHojeAgrupadas.length === 0 ? (
              <p className="text-sm text-secondary">Nenhuma entrada registrada no período selecionado.</p>
            ) : (
              <div className="space-y-4">
                {entradasHojeAgrupadas.map(([cliente, movs]) => (
                  <div key={cliente}>
                    <p className="mb-2 text-sm font-medium text-secondary">{cliente}</p>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {movs.map((m) => (
                        <Link
                          key={m.id}
                          to={`/veiculos/${m.veiculo_id}`}
                          className="flex items-center gap-3 rounded-xl bg-background px-4 py-3 transition-colors hover:bg-background/70"
                        >
                          {m.foto_frente_url ? (
                            <img
                              src={urlMiniatura(m.foto_frente_url, 112)}
                              onError={aoFalharMiniatura(m.foto_frente_url)}
                              alt={`Frente — ${m.veiculo?.placa}`}
                              loading="lazy"
                              decoding="async"
                              width={56}
                              height={56}
                              className="h-14 w-14 shrink-0 rounded-lg object-cover"
                            />
                          ) : (
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-surface text-secondary">
                              <Truck className="h-6 w-6" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-foreground font-medium">{m.veiculo?.placa}</p>
                            <p className="text-sm text-secondary">
                              {m.veiculo?.marca?.nome} {m.veiculo?.modelo?.nome}
                            </p>
                            <p className="text-sm text-secondary">Pátio: {m.patio?.nome || '—'}</p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {filters.clienteId && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>
              {loadingNoPatio ? 'Carregando…' : `${noPatio.length} caminhão(ões) no pátio deste cliente`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!loadingNoPatio && noPatio.length === 0 ? (
              <p className="text-sm text-secondary">Nenhum caminhão deste cliente está no pátio no momento.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {noPatio.map((m) => (
                  <Link
                    key={m.id}
                    to={`/veiculos/${m.veiculo_id}`}
                    className="block rounded-xl bg-background px-4 py-3 transition-colors hover:bg-background/70"
                  >
                    <p className="text-foreground font-medium">{m.veiculo?.placa}</p>
                    <p className="text-sm text-secondary">
                      {m.veiculo?.marca?.nome} {m.veiculo?.modelo?.nome}
                    </p>
                    <p className="text-sm text-secondary">Pátio: {m.patio?.nome || '—'}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge tone="success">No pátio</Badge>
                      <StatusManutencaoBadge status={m.status_manutencao} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!loading && periodo.length === 0 && noPatio.length === 0 && (
        <Card className="p-6 mb-6 text-center text-secondary text-sm">
          Nenhuma movimentação encontrada. Assim que houver entradas/saídas registradas, os gráficos aparecem aqui.
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Entradas x Saídas por dia</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={porDia} barGap={4}>
                  <CartesianGrid vertical={false} stroke={CHART_CHROME.grid} strokeDasharray="3 3" />
                  <XAxis dataKey="dia" stroke={CHART_CHROME.axis} fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis
                    allowDecimals={false}
                    stroke={CHART_CHROME.axis}
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    width={28}
                  />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                  <Legend wrapperStyle={{ fontSize: 12, color: '#9A9A9A' }} />
                  <Bar dataKey="Entradas" fill={CHART_ENTRADA} radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="Saídas" fill={CHART_SAIDA} radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Distribuição por marca (no pátio)</CardTitle>
          </CardHeader>
          <CardContent>
            {porMarca.length === 0 ? (
              <div className="flex h-72 items-center justify-center text-sm text-secondary">Sem dados</div>
            ) : (
              (() => {
                const total = porMarca.reduce((acc, m) => acc + m.value, 0)
                const corDe = (entry: (typeof porMarca)[number], i: number) =>
                  entry.name === 'Outras' ? CHART_OTHER : CHART_CATEGORICAL[i % CHART_CATEGORICAL.length]
                return (
                  <>
                    <div className="h-52">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={porMarca} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={2}>
                            {porMarca.map((entry, i) => (
                              <Cell key={entry.name} fill={corDe(entry, i)} stroke={CHART_CHROME.tooltipBg} strokeWidth={2} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={tooltipStyle}
                            itemStyle={{ color: '#fff' }}
                            formatter={(value, name) => [
                              `${value} (${Math.round((Number(value) / total) * 100)}%)`,
                              name,
                            ]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-2">
                      {porMarca.map((entry, i) => {
                        const percent = Math.round((entry.value / total) * 100)
                        return (
                          <div key={entry.name} className="flex items-center gap-1.5 text-xs">
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: corDe(entry, i) }}
                            />
                            <span className="text-foreground">{entry.name}</span>
                            <span className="text-secondary">{percent}%</span>
                          </div>
                        )
                      })}
                    </div>
                  </>
                )
              })()
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Ranking de pátios com mais veículos no período</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              {rankingPatios.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-secondary">Sem dados</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={rankingPatios} layout="vertical" margin={{ left: 8, right: 24 }}>
                    <CartesianGrid horizontal={false} stroke={CHART_CHROME.grid} strokeDasharray="3 3" />
                    <XAxis type="number" allowDecimals={false} stroke={CHART_CHROME.axis} fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      stroke={CHART_CHROME.axis}
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      width={120}
                    />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                    <Bar dataKey="value" name="Veículos" fill={CHART_SAIDA} radius={[0, 4, 4, 0]} maxBarSize={22}>
                      <LabelList dataKey="value" position="right" fill="#fff" fontSize={12} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
