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
import { format, isToday, subDays } from 'date-fns'
import { PageHeader } from '@/components/layout/Header'
import { FiltersBar, type FiltersValue } from '@/components/FiltersBar'
import { StatCard } from '@/components/ui/StatCard'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { StatusManutencaoBadge } from '@/components/StatusManutencaoBadge'
import { useMovimentacoes } from '@/hooks/useMovimentacoes'
import { permanenciaEmMinutos, formatMinutosParaTexto } from '@/lib/format'
import { CHART_ENTRADA, CHART_SAIDA, CHART_CATEGORICAL, CHART_OTHER, CHART_CHROME } from '@/lib/chartColors'

const tooltipStyle = {
  backgroundColor: CHART_CHROME.tooltipBg,
  border: `1px solid ${CHART_CHROME.tooltipBorder}`,
  borderRadius: 12,
  color: '#fff',
  fontSize: 13,
}

export function Dashboard() {
  const [filters, setFilters] = useState<FiltersValue>({
    dataInicio: format(subDays(new Date(), 13), 'yyyy-MM-dd'),
    dataFim: format(new Date(), 'yyyy-MM-dd'),
  })

  const { movimentacoes: noPatio, loading: loadingNoPatio } = useMovimentacoes({
    status: 'no_patio',
    clienteId: filters.clienteId,
    marcaId: filters.marcaId,
    modeloId: filters.modeloId,
    patioId: filters.patioId,
  })

  const { movimentacoes: periodo, loading: loadingPeriodo } = useMovimentacoes({
    dataInicio: filters.dataInicio ? `${filters.dataInicio}T00:00:00` : undefined,
    dataFim: filters.dataFim ? `${filters.dataFim}T23:59:59` : undefined,
    clienteId: filters.clienteId,
    marcaId: filters.marcaId,
    modeloId: filters.modeloId,
    patioId: filters.patioId,
  })

  const stats = useMemo(() => {
    const entradasHoje = periodo.filter((m) => isToday(new Date(m.data_hora_entrada))).length
    const saidasHoje = periodo.filter((m) => m.data_hora_saida && isToday(new Date(m.data_hora_saida))).length
    const finalizadas = periodo.filter((m) => m.data_hora_saida)
    const tempoMedio =
      finalizadas.length > 0
        ? Math.round(
            finalizadas.reduce((acc, m) => acc + permanenciaEmMinutos(m.data_hora_entrada, m.data_hora_saida), 0) /
              finalizadas.length,
          )
        : 0

    return { entradasHoje, saidasHoje, tempoMedio }
  }, [periodo])

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

  const loading = loadingNoPatio || loadingPeriodo

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Visão geral do pátio" />

      <div className="mb-6">
        <FiltersBar value={filters} onChange={setFilters} />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-6">
        <StatCard icon={Truck} label="No pátio agora" value={String(noPatio.length)} />
        <StatCard icon={LogIn} label="Entradas hoje" value={String(stats.entradasHoje)} />
        <StatCard icon={LogOut} label="Saídas hoje" value={String(stats.saidasHoje)} />
        <StatCard
          icon={Clock}
          label="Tempo médio de permanência"
          value={stats.tempoMedio > 0 ? formatMinutosParaTexto(stats.tempoMedio) : '—'}
        />
      </div>

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
                    <p className="text-white font-medium">{m.veiculo?.placa}</p>
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
            <div className="h-72">
              {porMarca.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-secondary">Sem dados</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={porMarca}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                      label={({ name, percent }) => `${name} ${Math.round((percent ?? 0) * 100)}%`}
                      labelLine={false}
                    >
                      {porMarca.map((entry, i) => (
                        <Cell
                          key={entry.name}
                          fill={entry.name === 'Outras' ? CHART_OTHER : CHART_CATEGORICAL[i % CHART_CATEGORICAL.length]}
                          stroke={CHART_CHROME.tooltipBg}
                          strokeWidth={2}
                        />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 12, color: '#9A9A9A' }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
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
