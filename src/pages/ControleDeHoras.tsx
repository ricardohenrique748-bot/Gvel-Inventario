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
import { useTheme } from '@/contexts/ThemeContext'
import { useControleHoras, type ControleHorasItem } from '@/hooks/useControleHoras'
import { formatDateTime, formatMinutosParaTexto } from '@/lib/format'
import { CHART_SAIDA, CHART_CATEGORICAL, CHART_OTHER } from '@/lib/chartColors'
import { formatarNomeSobrenome, obterNomeCompletoMembro } from '@/constants/equipe'

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

function fimFechamento(item: ControleHorasItem) {
  return item.data_hora_fechamento ?? item.data_hora_abertura ?? item.data_hora
}

function dataLocalYMD(iso: string) {
  const date = new Date(iso)
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 10)
}

function opcoes(itens: ControleHorasItem[], campo: 'mecanico_executor' | 'funcao' | 'setor') {
  const valores = new Set<string>()
  for (const item of itens) {
    let valor = item[campo]
    if (valor) {
      if (campo === 'mecanico_executor') {
        valor = obterNomeCompletoMembro(valor)
      }
      valores.add(valor)
    }
  }
  return [...valores].sort((a, b) => a.localeCompare(b))
}

function extrairMinutosItem(item: ControleHorasItem): number {
  if (typeof item.minutos_atividade === 'number') {
    return item.minutos_atividade
  }
  return 0
}

function formatMinutosCompacto(minutos: number): string {
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

function Horas({ item }: { item: ControleHorasItem }) {
  if (typeof item.minutos_atividade === 'number' && item.minutos_atividade > 0) {
    return <span className="font-bold text-foreground">{formatMinutosParaTexto(item.minutos_atividade)}</span>
  }
  return <span className="text-secondary/60">0min</span>
}

export function ControleDeHoras() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const textColor = isDark ? '#ffffff' : '#18181b'
  const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
  const axisLineColor = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)'
  const tooltipStyle = {
    backgroundColor: isDark ? '#1c1c1c' : '#ffffff',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
    borderRadius: 12,
    color: isDark ? '#ffffff' : '#18181b',
    fontSize: 13,
    boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
  }

  const { itens, loading, error } = useControleHoras()
  const [filtros, setFiltros] = useState<Filtros>({})
  const [colabGrafico, setColabGrafico] = useState<string | null>(null)

  function patch(next: Partial<Filtros>) {
    setFiltros((prev) => ({ ...prev, ...next }))
  }

  const nomes = useMemo(() => opcoes(itens, 'mecanico_executor'), [itens])
  const funcoes = useMemo(() => opcoes(itens, 'funcao'), [itens])
  const setores = useMemo(() => opcoes(itens, 'setor'), [itens])

  const itensFiltrados = useMemo(() => {
    return itens.filter((item) => {
      if (filtros.nome) {
        const itemMec = obterNomeCompletoMembro(item.mecanico_executor || '')
        const filtroMec = obterNomeCompletoMembro(filtros.nome)
        if (itemMec !== filtroMec) return false
      }
      if (filtros.funcao && item.funcao !== filtros.funcao) return false
      if (filtros.setor && item.setor !== filtros.setor) return false
      
      const dataInicioItem = dataLocalYMD(inicioAbertura(item))
      const dataFimItem = dataLocalYMD(fimFechamento(item))

      // Valida se o período da atividade sobrepõe o filtro de datas
      if (filtros.dataInicio && dataFimItem < filtros.dataInicio) return false
      if (filtros.dataFim && dataInicioItem > filtros.dataFim) return false
      return true
    })
  }, [itens, filtros])

  const stats = useMemo(() => {
    const placas = new Set<string>()
    let minutosTotais = 0
    for (const item of itensFiltrados) {
      const placa = item.movimentacao?.veiculo?.placa
      if (placa) placas.add(placa)
      minutosTotais += extrairMinutosItem(item)
    }
    return { veiculosAtendendo: placas.size, minutosTotais }
  }, [itensFiltrados])

  const porMecanico = useMemo(() => {
    const mapa = new Map<string, { minutos: number; placasMap: Map<string, number> }>()
    for (const item of itensFiltrados) {
      const nomeOriginal = item.mecanico_executor || 'Sem nome'
      const nomeExibicao = formatarNomeSobrenome(nomeOriginal)
      const minutos = extrairMinutosItem(item)
      const placa = item.movimentacao?.veiculo?.placa

      if (!mapa.has(nomeExibicao)) {
        mapa.set(nomeExibicao, { minutos: 0, placasMap: new Map() })
      }
      const entry = mapa.get(nomeExibicao)!
      entry.minutos += minutos
      if (placa) {
        entry.placasMap.set(placa, (entry.placasMap.get(placa) ?? 0) + minutos)
      }
    }
    return [...mapa.entries()]
      .filter(([, data]) => data.minutos > 0)
      .map(([name, data]) => {
        const placasOrdenadas = [...data.placasMap.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([p]) => p)
        return {
          name,
          horas: Math.round((data.minutos / 60) * 10) / 10,
          minutos: data.minutos,
          placas: placasOrdenadas,
          placaTexto: placasOrdenadas.join(' • '),
          placasDetalhe: [...data.placasMap.entries()].sort((a, b) => b[1] - a[1]),
        }
      })
      .sort((a, b) => b.minutos - a.minutos)
  }, [itensFiltrados])

  const rankingMecanicoHoras = useMemo(
    () => porMecanico.map((item, i) => ({ ...item, name: MEDALHAS[i] ? `${MEDALHAS[i]} ${item.name}` : item.name })),
    [porMecanico],
  )

  // Dados unificados de Colaborador e Placas para gráfico único
  const { listaColaboradoresGrafico, dadosGraficoUnico } = useMemo(() => {
    // Mapa: "Colaborador|||Placa" -> minutos
    const mapaPares = new Map<string, { colaborador: string; placa: string; minutos: number }>()
    const colabsSet = new Set<string>()

    for (const item of itensFiltrados) {
      const placa = item.movimentacao?.veiculo?.placa
      if (!placa) continue
      const colab = formatarNomeSobrenome(item.mecanico_executor || 'Sem nome')
      const chave = `${colab}|||${placa}`
      const minutos = extrairMinutosItem(item)
      if (minutos <= 0) continue

      colabsSet.add(colab)
      if (!mapaPares.has(chave)) {
        mapaPares.set(chave, { colaborador: colab, placa, minutos: 0 })
      }
      mapaPares.get(chave)!.minutos += minutos
    }

    const listaColaboradoresGrafico = [...colabsSet].sort((a, b) => a.localeCompare(b))

    let pares = [...mapaPares.values()]
    if (colabGrafico) {
      pares = pares.filter((p) => p.colaborador === colabGrafico)
    }

    // Ordena decrescente por minutos
    pares.sort((a, b) => b.minutos - a.minutos)

    const dadosGraficoUnico = pares.map((p) => ({
      label: colabGrafico ? p.placa : `${p.colaborador} - ${p.placa}`,
      colaborador: p.colaborador,
      placa: p.placa,
      horas: Math.round((p.minutos / 60) * 10) / 10,
      minutos: p.minutos,
    }))

    return { listaColaboradoresGrafico, dadosGraficoUnico }
  }, [itensFiltrados, colabGrafico])

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
            <CardTitle>HORAS POR COLABORADOR</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80 w-full overflow-x-auto">
              {porMecanico.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-secondary">Sem dados</div>
              ) : (
                <div style={{ minWidth: Math.max(380, porMecanico.length * 85), height: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart key={theme} data={porMecanico} margin={{ top: 32, right: 16, left: -10, bottom: 40 }}>
                      <CartesianGrid vertical={false} stroke={gridColor} strokeDasharray="3 3" />
                      <XAxis
                        dataKey="name"
                        stroke={textColor}
                        tick={{ fill: textColor, fontSize: 10, fontWeight: 700 }}
                        tickLine={false}
                        axisLine={{ stroke: axisLineColor }}
                        interval={0}
                        angle={porMecanico.length > 2 ? -35 : 0}
                        textAnchor={porMecanico.length > 2 ? 'end' : 'middle'}
                        height={porMecanico.length > 2 ? 65 : 26}
                      />
                      <YAxis
                        type="number"
                        allowDecimals={false}
                        stroke={textColor}
                        tick={{ fill: textColor, fontSize: 11, fontWeight: 700 }}
                        tickFormatter={(v) => `${v}h`}
                        tickLine={false}
                        axisLine={false}
                        width={36}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        cursor={{ fill: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }}
                        formatter={(_value, _name, props: any) => {
                          const payload = props.payload
                          const detalhes = payload?.placasDetalhe as [string, number][] | undefined
                          return [
                            <div key="tt" className="space-y-1">
                              <p className="font-bold text-primary">{formatMinutosParaTexto(payload.minutos)}</p>
                              {detalhes && detalhes.length > 0 && (
                                <div className="border-t border-border/20 pt-1 mt-1 space-y-0.5">
                                  {detalhes.map(([placa, min]) => (
                                    <p key={placa} className="text-xs text-secondary flex justify-between gap-3">
                                      <span className="font-mono font-bold text-foreground">{placa}:</span>
                                      <span>{formatMinutosCompacto(min)}</span>
                                    </p>
                                  ))}
                                </div>
                              )}
                            </div>,
                            payload.name,
                          ]
                        }}
                      />
                      <Bar dataKey="horas" name="Horas" fill={CHART_SAIDA} radius={[6, 6, 0, 0]} maxBarSize={48}>
                        <LabelList
                          dataKey="minutos"
                          position="top"
                          fill={textColor}
                          fontSize={11}
                          fontWeight={800}
                          offset={8}
                          formatter={(val: any) => (typeof val === 'number' ? formatMinutosCompacto(val) : String(val ?? ''))}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
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
                        <PieChart key={theme}>
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
                                stroke={isDark ? '#1c1c1c' : '#ffffff'}
                                strokeWidth={2}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={tooltipStyle}
                            itemStyle={{ color: textColor }}
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
                            <span className="text-foreground font-bold">{entry.name}</span>
                            <span className="text-secondary font-medium">{percent}%</span>
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

      {/* ===== GRÁFICO: HORAS POR COLABORADOR E PLACA (COM ABAS DE SELEÇÃO) ===== */}
      {dadosGraficoUnico.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>HORAS POR COLABORADOR E PLACA</CardTitle>
                <p className="text-xs text-secondary font-medium mt-0.5">
                  {colabGrafico ? `Exibindo placas atendidas por ${colabGrafico}` : 'Exibindo todos os atendimentos por colaborador e placa'}
                </p>
              </div>

              {/* Filtro rápido por colaborador em Chips */}
              <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto max-w-full pb-1 sm:pb-0">
                <button
                  type="button"
                  onClick={() => setColabGrafico(null)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-colors uppercase ${
                    colabGrafico === null
                      ? 'bg-primary text-white shadow-sm'
                      : 'border border-border/30 bg-surface/60 text-secondary hover:bg-surface hover:text-foreground'
                  }`}
                >
                  Todos
                </button>
                {listaColaboradoresGrafico.map((colab) => (
                  <button
                    key={colab}
                    type="button"
                    onClick={() => setColabGrafico(colabGrafico === colab ? null : colab)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-colors uppercase whitespace-nowrap ${
                      colabGrafico === colab
                        ? 'bg-primary text-white shadow-sm'
                        : 'border border-border/30 bg-surface/60 text-secondary hover:bg-surface hover:text-foreground'
                    }`}
                  >
                    {colab}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-80 w-full overflow-x-auto">
              <div style={{ minWidth: Math.max(380, dadosGraficoUnico.length * 80), height: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    key={`${theme}-${colabGrafico ?? 'todos'}`}
                    data={dadosGraficoUnico}
                    margin={{ top: 32, right: 16, left: -10, bottom: 45 }}
                  >
                    <CartesianGrid vertical={false} stroke={gridColor} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="label"
                      stroke={textColor}
                      tick={{ fill: textColor, fontSize: 10, fontWeight: 700 }}
                      tickLine={false}
                      axisLine={{ stroke: axisLineColor }}
                      interval={0}
                      angle={dadosGraficoUnico.length > 2 ? -35 : 0}
                      textAnchor={dadosGraficoUnico.length > 2 ? 'end' : 'middle'}
                      height={dadosGraficoUnico.length > 2 ? 65 : 26}
                    />
                    <YAxis
                      type="number"
                      allowDecimals={false}
                      stroke={textColor}
                      tick={{ fill: textColor, fontSize: 11, fontWeight: 700 }}
                      tickFormatter={(v) => `${v}h`}
                      tickLine={false}
                      axisLine={false}
                      width={36}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      cursor={{ fill: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }}
                      formatter={(_value, _name, props) => [
                        formatMinutosParaTexto(props.payload.minutos),
                        `${props.payload.colaborador} • ${props.payload.placa}`,
                      ]}
                    />
                    <Bar dataKey="horas" name="Horas" fill={CHART_SAIDA} radius={[6, 6, 0, 0]} maxBarSize={44}>
                      <LabelList
                        dataKey="minutos"
                        position="top"
                        fill={textColor}
                        fontSize={11}
                        fontWeight={800}
                        offset={8}
                        formatter={(val: any) => (typeof val === 'number' ? formatMinutosCompacto(val) : String(val ?? ''))}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Ranking de colaboradores por horas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-[380px] overflow-y-auto overflow-x-hidden pr-1">
              {rankingMecanicoHoras.length === 0 ? (
                <div className="flex h-72 items-center justify-center text-sm text-secondary">Sem dados</div>
              ) : (
                <div style={{ height: Math.max(288, rankingMecanicoHoras.length * 36) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart key={theme} data={rankingMecanicoHoras} layout="vertical" margin={{ left: 8, right: 65, top: 10, bottom: 10 }}>
                      <CartesianGrid horizontal={false} stroke={gridColor} strokeDasharray="3 3" />
                      <XAxis
                        type="number"
                        allowDecimals={false}
                        stroke={textColor}
                        tick={{ fill: textColor, fontSize: 11, fontWeight: 700 }}
                        tickFormatter={(v) => `${v}h`}
                        tickLine={false}
                        axisLine={{ stroke: axisLineColor }}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        stroke={textColor}
                        tick={{ fill: textColor, fontSize: 11, fontWeight: 700 }}
                        tickLine={false}
                        axisLine={false}
                        interval={0}
                        width={160}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        cursor={{ fill: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }}
                        formatter={(_value, _name, props) => [
                          formatMinutosParaTexto(props.payload.minutos),
                          'Tempo Total',
                        ]}
                      />
                      <Bar dataKey="horas" name="Horas" fill={CHART_SAIDA} radius={[0, 6, 6, 0]} maxBarSize={22}>
                        <LabelList
                          dataKey="minutos"
                          position="right"
                          fill={textColor}
                          fontSize={11}
                          fontWeight={800}
                          offset={8}
                          formatter={(val: any) => (typeof val === 'number' ? formatMinutosCompacto(val) : String(val ?? ''))}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ranking de setores por veículos atendidos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-[380px] overflow-y-auto overflow-x-hidden pr-1">
              {rankingSetorVeiculos.length === 0 ? (
                <div className="flex h-72 items-center justify-center text-sm text-secondary">Sem dados</div>
              ) : (
                <div style={{ height: Math.max(288, rankingSetorVeiculos.length * 36) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart key={theme} data={rankingSetorVeiculos} layout="vertical" margin={{ left: 8, right: 45, top: 10, bottom: 10 }}>
                      <CartesianGrid horizontal={false} stroke={gridColor} strokeDasharray="3 3" />
                      <XAxis
                        type="number"
                        allowDecimals={false}
                        stroke={textColor}
                        tick={{ fill: textColor, fontSize: 11, fontWeight: 700 }}
                        tickLine={false}
                        axisLine={{ stroke: axisLineColor }}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        stroke={textColor}
                        tick={{ fill: textColor, fontSize: 11, fontWeight: 700 }}
                        tickLine={false}
                        axisLine={false}
                        interval={0}
                        width={130}
                      />
                      <Tooltip contentStyle={tooltipStyle} cursor={{ fill: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }} />
                      <Bar dataKey="value" name="Veículos" fill={CHART_SAIDA} radius={[0, 6, 6, 0]} maxBarSize={22}>
                        <LabelList dataKey="value" position="right" fill={textColor} fontSize={11} fontWeight={800} offset={8} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
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
                  <tr className="border-b border-border/10 text-left text-white font-bold">
                    <th className="px-3 py-3 font-bold whitespace-nowrap text-white">Nome</th>
                    <th className="px-3 py-3 font-bold text-white">Descrição</th>
                    <th className="px-3 py-3 font-bold text-white">Status</th>
                    <th className="px-3 py-3 font-bold whitespace-nowrap text-white">Placa</th>
                    <th className="px-3 py-3 font-bold whitespace-nowrap text-white">Horas</th>
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
                        <Horas item={item} />
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
                    Horas: <Horas item={item} />
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
