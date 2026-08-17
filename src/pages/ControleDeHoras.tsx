import { useMemo, useState } from 'react'
import { Clock, Truck, Timer, X } from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LabelList,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { PageHeader } from '@/components/layout/Header'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { StatCard } from '@/components/ui/StatCard'
import { Select } from '@/components/ui/Input'
import { DateRangePicker } from '@/components/ui/DateRangePicker'
import { StatusManutencaoBadge } from '@/components/StatusManutencaoBadge'
import { useControleHoras, type ControleHorasItem } from '@/hooks/useControleHoras'
import { formatDateTime, formatMinutosParaTexto, permanenciaEmMinutos } from '@/lib/format'
import { CHART_SAIDA, CHART_CHROME, CHART_CATEGORICAL, CHART_OTHER } from '@/lib/chartColors'

const tooltipStyle = {
  backgroundColor: CHART_CHROME.tooltipBg,
  border: `1px solid ${CHART_CHROME.tooltipBorder}`,
  borderRadius: 12,
  color: '#fff',
  fontSize: 13,
}

const MEDALHAS = ['🥇', '🥈', '🥉']

interface Filtros {
  nome?: string
  funcao?: string
  setor?: string
  dataInicio?: string
  dataFim?: string
}

function inicioAbertura(item: ControleHorasItem) {
  return item.data_hora_abertura ?? item.data_hora
}

function dataLocalYMD(iso: string) {
  const date = new Date(iso)
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 10)
}

function opcoes(itens: ControleHorasItem[], campo: 'mecanico_executor' | 'funcao' | 'setor') {
  const valores = new Set<string>()
  for (const item of itens) {
    const valor = item[campo]
    if (valor) valores.add(valor)
  }
  return [...valores].sort((a, b) => a.localeCompare(b))
}

function Horas({ abertura, fechamento }: { abertura: string; fechamento: string | null }) {
  if (!fechamento) {
    return <span className="text-secondary/70">Em aberto</span>
  }
  return <span>{formatMinutosParaTexto(permanenciaEmMinutos(abertura, fechamento))}</span>
}

export function ControleDeHoras() {
  const { itens, loading, error } = useControleHoras()
  const [filtros, setFiltros] = useState<Filtros>({})

  function patch(next: Partial<Filtros>) {
    setFiltros((prev) => ({ ...prev, ...next }))
  }

  const nomes = useMemo(() => opcoes(itens, 'mecanico_executor'), [itens])
  const funcoes = useMemo(() => opcoes(itens, 'funcao'), [itens])
  const setores = useMemo(() => opcoes(itens, 'setor'), [itens])

  const itensFiltrados = useMemo(() => {
    return itens.filter((item) => {
      if (filtros.nome && item.mecanico_executor !== filtros.nome) return false
      if (filtros.funcao && item.funcao !== filtros.funcao) return false
      if (filtros.setor && item.setor !== filtros.setor) return false
      const dataRef = dataLocalYMD(inicioAbertura(item))
      if (filtros.dataInicio && dataRef < filtros.dataInicio) return false
      if (filtros.dataFim && dataRef > filtros.dataFim) return false
      return true
    })
  }, [itens, filtros])

  const stats = useMemo(() => {
    const placas = new Set<string>()
    let minutosTotais = 0
    for (const item of itensFiltrados) {
      const placa = item.movimentacao?.veiculo?.placa
      if (placa) placas.add(placa)
      if (item.data_hora_fechamento) {
        minutosTotais += permanenciaEmMinutos(inicioAbertura(item), item.data_hora_fechamento)
      }
    }
    return { veiculosAtendendo: placas.size, minutosTotais }
  }, [itensFiltrados])

  const porMecanico = useMemo(() => {
    const somaMinutos = new Map<string, number>()
    for (const item of itensFiltrados) {
      if (!item.data_hora_fechamento) continue
      const nome = item.mecanico_executor || 'Sem nome'
      const minutos = permanenciaEmMinutos(inicioAbertura(item), item.data_hora_fechamento)
      somaMinutos.set(nome, (somaMinutos.get(nome) ?? 0) + minutos)
    }
    return [...somaMinutos.entries()]
      .map(([name, minutos]) => ({ name, horas: Math.round((minutos / 60) * 10) / 10, minutos }))
      .sort((a, b) => b.minutos - a.minutos)
  }, [itensFiltrados])

  const rankingMecanicoHoras = useMemo(
    () => porMecanico.map((item, i) => ({ ...item, name: MEDALHAS[i] ? `${MEDALHAS[i]} ${item.name}` : item.name })),
    [porMecanico],
  )

  const porSetor = useMemo(() => {
    const counts = new Map<string, number>()
    for (const item of itensFiltrados) {
      const nome = item.setor || 'Sem setor'
      counts.set(nome, (counts.get(nome) ?? 0) + 1)
    }
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
    const top = sorted.slice(0, 5).map(([name, value]) => ({ name, value }))
    const outras = sorted.slice(5).reduce((acc, [, v]) => acc + v, 0)
    if (outras > 0) top.push({ name: 'Outras', value: outras })
    return top
  }, [itensFiltrados])

  const rankingSetorVeiculos = useMemo(() => {
    const porSetorPlacas = new Map<string, Set<string>>()
    for (const item of itensFiltrados) {
      const placa = item.movimentacao?.veiculo?.placa
      if (!placa) continue
      const setor = item.setor || 'Sem setor'
      if (!porSetorPlacas.has(setor)) porSetorPlacas.set(setor, new Set())
      porSetorPlacas.get(setor)!.add(placa)
    }
    return [...porSetorPlacas.entries()]
      .map(([name, placas]) => ({ name, value: placas.size }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  }, [itensFiltrados])

  const hasFiltros = Boolean(filtros.nome || filtros.funcao || filtros.setor || filtros.dataInicio || filtros.dataFim)

  return (
    <div className="uppercase">
      <PageHeader title="INDICADOR DE PERFORMANCE" subtitle="HORAS DE ABERTURA E FECHAMENTO DAS ETAPAS E PRODUTIVIDADE" />

      {error && (
        <p className="mb-4 text-sm text-status-danger">Não foi possível carregar os dados: {error}</p>
      )}

      <div className="grid grid-cols-2 gap-4 mb-6">
        <StatCard icon={Truck} label="Veículos atendendo" value={String(stats.veiculosAtendendo)} />
        <StatCard
          icon={Timer}
          label="Horas concluídas"
          value={stats.minutosTotais > 0 ? formatMinutosParaTexto(stats.minutosTotais) : '—'}
        />
      </div>

      <div className="mb-6 flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Select value={filtros.nome ?? ''} onChange={(e) => patch({ nome: e.target.value || undefined })}>
            <option value="">Todos os nomes</option>
            {nomes.map((nome) => (
              <option key={nome} value={nome}>
                {nome}
              </option>
            ))}
          </Select>
          <Select value={filtros.funcao ?? ''} onChange={(e) => patch({ funcao: e.target.value || undefined })}>
            <option value="">Todas as funções</option>
            {funcoes.map((funcao) => (
              <option key={funcao} value={funcao}>
                {funcao}
              </option>
            ))}
          </Select>
          <Select value={filtros.setor ?? ''} onChange={(e) => patch({ setor: e.target.value || undefined })}>
            <option value="">Todos os setores</option>
            {setores.map((setor) => (
              <option key={setor} value={setor}>
                {setor}
              </option>
            ))}
          </Select>
          <DateRangePicker
            startDate={filtros.dataInicio}
            endDate={filtros.dataFim}
            onChange={(start, end) => patch({ dataInicio: start, dataFim: end })}
            placeholder="Selecionar período"
          />
        </div>
        {hasFiltros && (
          <button
            type="button"
            onClick={() => setFiltros({})}
            className="flex w-fit items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-secondary transition-colors hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-400"
          >
            <X className="h-4 w-4" />
            Limpar filtros
          </button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Horas por mecânico</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              {porMecanico.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-secondary">Sem dados</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={porMecanico} margin={{ top: 24 }}>
                    <CartesianGrid vertical={false} stroke={CHART_CHROME.grid} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="name"
                      stroke={CHART_CHROME.axis}
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      type="number"
                      allowDecimals
                      stroke={CHART_CHROME.axis}
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      width={32}
                      unit="h"
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                      formatter={(_value, _name, props) => [
                        formatMinutosParaTexto(props.payload.minutos),
                        'Horas',
                      ]}
                    />
                    <Bar dataKey="horas" name="Horas" fill={CHART_SAIDA} radius={[4, 4, 0, 0]} maxBarSize={48}>
                      <LabelList
                        dataKey="minutos"
                        position="top"
                        fill={CHART_CHROME.axis}
                        fontSize={12}
                        formatter={(val: any) => (typeof val === 'number' ? formatMinutosParaTexto(val) : String(val ?? ''))}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Distribuição por setor</CardTitle>
          </CardHeader>
          <CardContent>
            {porSetor.length === 0 ? (
              <div className="flex h-72 items-center justify-center text-sm text-secondary">Sem dados</div>
            ) : (
              (() => {
                const total = porSetor.reduce((acc, s) => acc + s.value, 0)
                const corDe = (entry: (typeof porSetor)[number], i: number) =>
                  entry.name === 'Outras' ? CHART_OTHER : CHART_CATEGORICAL[i % CHART_CATEGORICAL.length]
                return (
                  <>
                    <div className="h-52">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={porSetor}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={60}
                            outerRadius={90}
                            paddingAngle={2}
                          >
                            {porSetor.map((entry, i) => (
                              <Cell
                                key={entry.name}
                                fill={corDe(entry, i)}
                                stroke={CHART_CHROME.tooltipBg}
                                strokeWidth={2}
                              />
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
                      {porSetor.map((entry, i) => {
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
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Ranking de mecânicos por horas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              {rankingMecanicoHoras.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-secondary">Sem dados</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={rankingMecanicoHoras} layout="vertical" margin={{ left: 8, right: 24 }}>
                    <CartesianGrid horizontal={false} stroke={CHART_CHROME.grid} strokeDasharray="3 3" />
                    <XAxis
                      type="number"
                      allowDecimals
                      stroke={CHART_CHROME.axis}
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      unit="h"
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      stroke={CHART_CHROME.axis}
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      width={140}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                      formatter={(_value, _name, props) => [
                        formatMinutosParaTexto(props.payload.minutos),
                        'Horas',
                      ]}
                    />
                    <Bar dataKey="horas" name="Horas" fill={CHART_SAIDA} radius={[0, 4, 4, 0]} maxBarSize={22}>
                      <LabelList
                        dataKey="minutos"
                        position="right"
                        fill="#fff"
                        fontSize={12}
                        formatter={(val: any) => (typeof val === 'number' ? formatMinutosParaTexto(val) : String(val ?? ''))}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ranking de setores por veículos atendidos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              {rankingSetorVeiculos.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-secondary">Sem dados</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={rankingSetorVeiculos} layout="vertical" margin={{ left: 8, right: 24 }}>
                    <CartesianGrid horizontal={false} stroke={CHART_CHROME.grid} strokeDasharray="3 3" />
                    <XAxis
                      type="number"
                      allowDecimals={false}
                      stroke={CHART_CHROME.axis}
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
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

      {loading ? (
        <p className="text-sm text-secondary">Carregando…</p>
      ) : itensFiltrados.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-10 text-center text-secondary">
          <Clock className="h-8 w-8" />
          <p className="text-sm">
            {itens.length === 0 ? 'Nenhuma etapa de OS registrada ainda.' : 'Nenhum resultado para os filtros selecionados.'}
          </p>
        </Card>
      ) : (
        <>
          {/* Desktop: tabela */}
          <Card className="hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/5 text-left text-secondary">
                    <th className="px-3 py-3 font-medium whitespace-nowrap">Nome</th>
                    <th className="px-3 py-3 font-medium">Descrição</th>
                    <th className="px-3 py-3 font-medium">Status</th>
                    <th className="px-3 py-3 font-medium whitespace-nowrap">Placa</th>
                    <th className="px-3 py-3 font-medium whitespace-nowrap">Horas</th>
                  </tr>
                </thead>
                <tbody>
                  {itensFiltrados.map((item) => (
                    <tr key={item.id} className="border-b border-border/5 last:border-0">
                      <td className="px-3 py-3 font-medium text-foreground whitespace-nowrap">
                        {item.mecanico_executor || '—'}
                      </td>
                      <td className="px-3 py-3 text-secondary max-w-[240px] truncate" title={item.descricao}>
                        {item.descricao}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <StatusManutencaoBadge status={item.movimentacao?.status_manutencao} />
                      </td>
                      <td className="px-3 py-3 text-secondary whitespace-nowrap">
                        {item.movimentacao?.veiculo?.placa || '—'}
                      </td>
                      <td className="px-3 py-3 text-secondary whitespace-nowrap">
                        <Horas abertura={inicioAbertura(item)} fechamento={item.data_hora_fechamento} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Mobile: cards */}
          <div className="md:hidden space-y-3">
            {itensFiltrados.map((item) => (
              <Card key={item.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">{item.mecanico_executor || '—'}</p>
                    <p className="text-sm text-secondary truncate">{item.descricao}</p>
                  </div>
                  <StatusManutencaoBadge status={item.movimentacao?.status_manutencao} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-secondary">
                  <p>Placa: {item.movimentacao?.veiculo?.placa || '—'}</p>
                  <p>
                    Horas: <Horas abertura={inicioAbertura(item)} fechamento={item.data_hora_fechamento} />
                  </p>
                  <p>Abertura: {formatDateTime(inicioAbertura(item))}</p>
                  <p>Fechamento: {item.data_hora_fechamento ? formatDateTime(item.data_hora_fechamento) : '—'}</p>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
