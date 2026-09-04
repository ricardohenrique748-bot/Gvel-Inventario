import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ShieldAlert,
  Home,
  Users,
  Wallet,
  Banknote,
  Scale,
  TrendingUp,
  RefreshCw,
  Search,
  Lock,
  AlertTriangle,
  PieChart as PieChartIcon,
  LayoutDashboard,
  FileSpreadsheet,
} from 'lucide-react'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList } from 'recharts'
import { PageHeader } from '@/components/layout/Header'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { StatCard } from '@/components/ui/StatCard'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { DragScrollArea } from '@/components/ui/DragScrollArea'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { isRhAuthorized } from '@/components/layout/nav'
import { useRhSheet, type ColaboradorRH } from '@/hooks/useRhSheet'
import { CHART_CATEGORICAL, CHART_OTHER, CHART_ENTRADA } from '@/lib/chartColors'

function formatMoeda(valor: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0)
}

function fmtCompacto(valor: number) {
  if (Math.abs(valor) >= 1_000) {
    return `R$ ${(valor / 1_000).toFixed(1).replace('.', ',')}K`
  }
  return formatMoeda(valor)
}

function corFatia(nome: string, i: number) {
  return nome === 'Outras' ? CHART_OTHER : CHART_CATEGORICAL[i % CHART_CATEGORICAL.length]
}

/** Rótulo de porcentagem cravado no meio de cada fatia — só usado quando há poucas categorias (<=4), pra não virar sopa de números. */
function renderLabelPorcentagem(props: any) {
  const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props
  if (percent < 0.06) return null
  const RADIAN = Math.PI / 180
  const raio = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + raio * Math.cos(-midAngle * RADIAN)
  const y = cy + raio * Math.sin(-midAngle * RADIAN)
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      dominantBaseline="central"
      style={{
        fill: '#ffffff',
        stroke: 'rgba(0,0,0,0.35)',
        strokeWidth: 3,
        paintOrder: 'stroke',
        fontSize: 12,
        fontWeight: 800,
      }}
    >
      {Math.round(percent * 100)}%
    </text>
  )
}

interface DonutCardProps {
  titulo: string
  icone: React.ElementType
  dados: { name: string; value: number }[]
  formatarValor: (v: number) => string
  centroValor: string
  centroLegenda: string
  tooltipStyle: React.CSSProperties
  isDark: boolean
}

function DonutCard({ titulo, icone: Icone, dados, formatarValor, centroValor, centroLegenda, tooltipStyle, isDark }: DonutCardProps) {
  const total = dados.reduce((acc, d) => acc + d.value, 0)
  const comLabelDireto = dados.length > 0 && dados.length <= 4

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icone className="h-4 w-4 text-primary" />
          {titulo}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {dados.length === 0 || total <= 0 ? (
          <div className="flex h-56 items-center justify-center text-sm text-secondary">Sem dados</div>
        ) : (
          <>
            <div className="relative h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={dados}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={64}
                    outerRadius={92}
                    paddingAngle={3}
                    label={comLabelDireto ? renderLabelPorcentagem : undefined}
                    labelLine={false}
                  >
                    {dados.map((entry, i) => (
                      <Cell key={entry.name} fill={corFatia(entry.name, i)} stroke={isDark ? '#1c1c1c' : '#ffffff'} strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value, name) => [
                      `${formatarValor(Number(value))} (${Math.round((Number(value) / total) * 100)}%)`,
                      name,
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center px-4">
                <span className="w-full text-xl font-black text-foreground leading-tight truncate">{centroValor}</span>
                <span className="w-full text-[10px] font-bold text-secondary tracking-wide">{centroLegenda}</span>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-2">
              {dados.map((entry, i) => {
                const percent = Math.round((entry.value / total) * 100)
                return (
                  <div key={entry.name} className="flex items-center gap-1.5 text-xs">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: corFatia(entry.name, i) }} />
                    <span className="text-foreground font-bold">{entry.name}</span>
                    <span className="text-secondary font-medium">{percent}%</span>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

interface BarRankingCardProps {
  titulo: string
  icone: React.ElementType
  dados: { name: string; value: number }[]
  cor: string
  formatarValor: (v: number) => string
  formatarEixo: (v: number) => string
  textColor: string
  gridColor: string
  axisLineColor: string
  tooltipStyle: React.CSSProperties
  tooltipLabel: string
}

function BarRankingCard({
  titulo,
  icone: Icone,
  dados,
  cor,
  formatarValor,
  formatarEixo,
  textColor,
  gridColor,
  axisLineColor,
  tooltipStyle,
  tooltipLabel,
}: BarRankingCardProps) {
  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icone className="h-4 w-4 text-primary" />
          {titulo}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {dados.length === 0 ? (
          <div className="flex h-56 items-center justify-center text-sm text-secondary">Sem dados</div>
        ) : (
          <div style={{ height: Math.max(220, dados.length * 40) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dados} layout="vertical" margin={{ left: 8, right: 56, top: 8, bottom: 8 }}>
                <CartesianGrid horizontal={false} stroke={gridColor} strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  stroke={textColor}
                  tick={{ fill: textColor, fontSize: 11, fontWeight: 700 }}
                  tickFormatter={formatarEixo}
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
                  width={150}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ fill: 'rgba(128,128,128,0.08)' }}
                  formatter={(value) => [formatarValor(Number(value)), tooltipLabel]}
                />
                <Bar dataKey="value" fill={cor} radius={[0, 6, 6, 0]} maxBarSize={22}>
                  <LabelList
                    dataKey="value"
                    position="right"
                    fill={textColor}
                    fontSize={11}
                    fontWeight={800}
                    offset={8}
                    formatter={(val: any) => (typeof val === 'number' ? formatarEixo(val) : String(val ?? ''))}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface TotaisFolha {
  valorCarteira: number
  custoRegistro: number
  ajudaCusto: number
  gratificacao: number
  ganhosTotais: number
  custoTotal: number
}

interface TabelaColaboradoresProps {
  itens: ColaboradorRH[]
  totais: TotaisFolha
  loading: boolean
  temItensOriginais: boolean
  busca: string
  onBuscaChange: (valor: string) => void
}

function TabelaColaboradores({ itens, totais, loading, temItensOriginais, busca, onBuscaChange }: TabelaColaboradoresProps) {
  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <CardTitle>Planilha — Folha de Pagamento</CardTitle>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary" />
          <Input
            value={busca}
            onChange={(e) => onBuscaChange(e.target.value)}
            placeholder="BUSCAR POR NOME OU FUNÇÃO"
            className="h-10 pl-9"
          />
        </div>
      </CardHeader>
      <CardContent>
        {loading && !temItensOriginais ? (
          <div className="flex items-center justify-center py-16 text-secondary text-sm">
            <RefreshCw className="h-5 w-5 animate-spin mr-2" />
            CARREGANDO DADOS DA PLANILHA...
          </div>
        ) : itens.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-secondary text-sm">
            NENHUM COLABORADOR ENCONTRADO
          </div>
        ) : (
          <DragScrollArea>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/10 text-left text-foreground font-bold">
                  <th className="px-3 py-3 font-bold whitespace-nowrap">Colaborador</th>
                  <th className="px-3 py-3 font-bold whitespace-nowrap">Função</th>
                  <th className="px-3 py-3 font-bold whitespace-nowrap text-right">Valor Carteira</th>
                  <th className="px-3 py-3 font-bold whitespace-nowrap text-right">Custo Registro (80%)</th>
                  <th className="px-3 py-3 font-bold whitespace-nowrap text-right">Ajuda de Custo</th>
                  <th className="px-3 py-3 font-bold whitespace-nowrap text-right">Gratificação</th>
                  <th className="px-3 py-3 font-bold whitespace-nowrap text-right">Ganhos Totais</th>
                  <th className="px-3 py-3 font-bold whitespace-nowrap text-right">Custo Total</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((c) => (
                  <tr key={c.id} className="border-b border-border/5 last:border-0 hover:bg-overlay/[0.03]">
                    <td className="px-3 py-3 font-medium text-foreground whitespace-nowrap">
                      {c.nome}
                    </td>
                    <td className="px-3 py-3 text-secondary whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {c.funcao}
                        {c.observacao && (
                          <Badge tone="warning" className="normal-case text-[10px]">
                            {c.observacao}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-secondary whitespace-nowrap text-right tabular-nums">
                      {formatMoeda(c.valorCarteira)}
                    </td>
                    <td className="px-3 py-3 text-secondary whitespace-nowrap text-right tabular-nums">
                      {formatMoeda(c.custoRegistro)}
                    </td>
                    <td className="px-3 py-3 text-secondary whitespace-nowrap text-right tabular-nums">
                      {formatMoeda(c.ajudaCusto)}
                    </td>
                    <td className="px-3 py-3 text-secondary whitespace-nowrap text-right tabular-nums">
                      {formatMoeda(c.gratificacao)}
                    </td>
                    <td className="px-3 py-3 font-bold text-foreground whitespace-nowrap text-right tabular-nums">
                      {formatMoeda(c.ganhosTotais)}
                    </td>
                    <td className="px-3 py-3 font-bold text-primary whitespace-nowrap text-right tabular-nums">
                      {formatMoeda(c.custoTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
              {itens.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-border/20 bg-surface/60 font-black text-foreground">
                    <td className="px-3 py-3 whitespace-nowrap" colSpan={2}>
                      TOTAL ({itens.length} {itens.length === 1 ? 'COLABORADOR' : 'COLABORADORES'})
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-right tabular-nums">
                      {formatMoeda(totais.valorCarteira)}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-right tabular-nums">
                      {formatMoeda(totais.custoRegistro)}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-right tabular-nums">
                      {formatMoeda(totais.ajudaCusto)}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-right tabular-nums">
                      {formatMoeda(totais.gratificacao)}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-right tabular-nums">
                      {formatMoeda(totais.ganhosTotais)}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-right tabular-nums text-primary">
                      {formatMoeda(totais.custoTotal)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </DragScrollArea>
        )}
      </CardContent>
    </Card>
  )
}

type AbaRH = 'dashboard' | 'planilha'
const ABAS_VALIDAS: AbaRH[] = ['dashboard', 'planilha']

export function RH() {
  const { user, perfilLoading } = useAuth()
  const autorizado = isRhAuthorized(user?.email)
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

  const { items, loading, isAutoSyncing, error, lastSync, fetchSheet } = useRhSheet()
  const [busca, setBusca] = useState('')

  const [searchParams, setSearchParams] = useSearchParams()
  const abaParam = searchParams.get('aba')
  const [abaAtiva, setAbaAtivaState] = useState<AbaRH>(() =>
    abaParam && ABAS_VALIDAS.includes(abaParam as AbaRH) ? (abaParam as AbaRH) : 'dashboard',
  )

  useEffect(() => {
    if (abaParam && ABAS_VALIDAS.includes(abaParam as AbaRH)) {
      setAbaAtivaState(abaParam as AbaRH)
    } else if (!abaParam) {
      setAbaAtivaState('dashboard')
    }
  }, [abaParam])

  function setAbaAtiva(nova: AbaRH) {
    setAbaAtivaState(nova)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (nova === 'dashboard') {
        next.delete('aba')
      } else {
        next.set('aba', nova)
      }
      return next
    })
  }

  const itensFiltrados = useMemo(() => {
    const termo = busca.trim().toUpperCase()
    if (!termo) return items
    return items.filter((c) => c.nome.includes(termo) || c.funcao.includes(termo))
  }, [items, busca])

  function somarTotais(lista: typeof items) {
    return lista.reduce(
      (acc, c) => ({
        valorCarteira: acc.valorCarteira + c.valorCarteira,
        custoRegistro: acc.custoRegistro + c.custoRegistro,
        ajudaCusto: acc.ajudaCusto + c.ajudaCusto,
        gratificacao: acc.gratificacao + c.gratificacao,
        ganhosTotais: acc.ganhosTotais + c.ganhosTotais,
        custoTotal: acc.custoTotal + c.custoTotal,
      }),
      { valorCarteira: 0, custoRegistro: 0, ajudaCusto: 0, gratificacao: 0, ganhosTotais: 0, custoTotal: 0 },
    )
  }

  const totaisGerais = useMemo(() => somarTotais(items), [items])
  const totaisFiltrados = useMemo(() => somarTotais(itensFiltrados), [itensFiltrados])
  const custoMedio = items.length > 0 ? totaisGerais.custoTotal / items.length : 0

  const porFuncao = useMemo(() => {
    const counts = new Map<string, number>()
    for (const c of items) {
      counts.set(c.funcao, (counts.get(c.funcao) ?? 0) + 1)
    }
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
    const top = sorted.slice(0, 5).map(([name, value]) => ({ name, value }))
    const outras = sorted.slice(5).reduce((acc, [, v]) => acc + v, 0)
    if (outras > 0) top.push({ name: 'Outras', value: outras })
    return top
  }, [items])

  const composicaoCusto = useMemo(() => {
    if (totaisGerais.custoTotal <= 0) return []
    return [
      { name: 'Ganhos dos Colaboradores', value: totaisGerais.ganhosTotais },
      { name: 'Encargos (Custo Registro)', value: totaisGerais.custoRegistro },
    ]
  }, [totaisGerais])

  if (!perfilLoading && !autorizado) {
    return (
      <div className="flex min-h-[65vh] flex-col items-center justify-center p-6 text-center animate-fade-in uppercase">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-red-500/15 border border-red-500/30 text-red-400 mb-4 shadow-2xl shadow-red-500/10">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h2 className="text-lg font-black text-foreground mb-1">ACESSO RESTRITO AO RH</h2>
        <p className="text-xs text-secondary font-medium max-w-md mb-6 lowercase">
          Esta área contém dados confidenciais de folha de pagamento e é exclusiva para administradores.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-2xl bg-surface border border-border/30 px-5 py-2.5 text-xs font-bold text-foreground hover:bg-surface-hover transition-colors shadow-lg"
        >
          <Home className="h-4 w-4 text-primary" />
          VOLTAR PARA A HOME
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in uppercase pb-28">
      <PageHeader
        title="RECURSOS HUMANOS (RH)"
        subtitle="FOLHA DE PAGAMENTO E QUADRO DE COLABORADORES"
        actions={
          <Button
            variant="primary"
            size="md"
            onClick={() => fetchSheet()}
            disabled={loading}
            className="gap-2 font-bold shadow-lg shadow-primary/20"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'SINCRONIZANDO...' : 'ATUALIZAR'}</span>
          </Button>
        }
      />

      {/* Aviso de Confidencialidade */}
      <div className="flex items-center gap-2.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs font-bold text-amber-400">
        <Lock className="h-4 w-4 shrink-0" />
        <span className="lowercase font-medium">
          Dados confidenciais de folha de pagamento — visível somente para administradores. Não compartilhe esta tela.
        </span>
      </div>

      {/* Banner de Sincronização */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/10 bg-surface/80 px-4 py-3 text-xs font-medium text-secondary backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className={`flex h-2.5 w-2.5 rounded-full ${isAutoSyncing ? 'bg-emerald-500 animate-pulse' : 'bg-emerald-500'}`} />
          <span className="font-bold text-foreground">GOOGLE SHEETS:</span>
          <span>{lastSync ? `ÚLTIMA SINCRONIZAÇÃO EM ${lastSync}` : 'PLANILHA CONECTADA'}</span>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs font-bold text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="lowercase font-medium">{error}</span>
        </div>
      )}

      {/* Barra de Abas */}
      <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-surface/80 border border-border/25 shadow-sm backdrop-blur-md w-full sm:w-fit">
        <button
          type="button"
          onClick={() => setAbaAtiva('dashboard')}
          className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap flex-1 sm:flex-none ${
            abaAtiva === 'dashboard'
              ? 'bg-primary text-white shadow-md shadow-primary/20'
              : 'text-secondary hover:text-foreground hover:bg-surface-hover/50'
          }`}
        >
          <LayoutDashboard className="h-4 w-4" />
          DASHBOARD
        </button>
        <button
          type="button"
          onClick={() => setAbaAtiva('planilha')}
          className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap flex-1 sm:flex-none ${
            abaAtiva === 'planilha'
              ? 'bg-primary text-white shadow-md shadow-primary/20'
              : 'text-secondary hover:text-foreground hover:bg-surface-hover/50'
          }`}
        >
          <FileSpreadsheet className="h-4 w-4" />
          PLANILHA
          <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
            abaAtiva === 'planilha' ? 'bg-white/20 text-white' : 'bg-overlay/10 text-secondary'
          }`}>
            {items.length}
          </span>
        </button>
      </div>

      {abaAtiva === 'dashboard' && (
        <>
          {/* Cards de Indicadores */}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
            <StatCard align="center" valueClassName="text-2xl" icon={Users} label="Colaboradores" value={String(items.length)} />
            <StatCard align="center" valueClassName="text-lg sm:text-xl" icon={Wallet} label="Ganhos Totais" value={formatMoeda(totaisGerais.ganhosTotais)} />
            <StatCard align="center" valueClassName="text-lg sm:text-xl" icon={TrendingUp} label="Custo Total" value={formatMoeda(totaisGerais.custoTotal)} />
            <StatCard align="center" valueClassName="text-lg sm:text-xl" icon={Banknote} label="Ajuda de Custo" value={formatMoeda(totaisGerais.ajudaCusto)} />
            <StatCard align="center" valueClassName="text-lg sm:text-xl" icon={Scale} label="Custo Médio" value={formatMoeda(custoMedio)} hint="POR COLABORADOR" />
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <DonutCard
              titulo="Composição do Custo da Folha"
              icone={Wallet}
              dados={composicaoCusto}
              formatarValor={formatMoeda}
              centroValor={fmtCompacto(totaisGerais.custoTotal)}
              centroLegenda="CUSTO TOTAL"
              tooltipStyle={tooltipStyle}
              isDark={isDark}
            />
            <BarRankingCard
              titulo="Colaboradores por Função"
              icone={PieChartIcon}
              dados={porFuncao}
              cor={CHART_ENTRADA}
              formatarValor={(v) => `${v} ${v === 1 ? 'COLABORADOR' : 'COLABORADORES'}`}
              formatarEixo={(v) => String(v)}
              textColor={textColor}
              gridColor={gridColor}
              axisLineColor={axisLineColor}
              tooltipStyle={tooltipStyle}
              tooltipLabel="Colaboradores"
            />
          </div>

          <TabelaColaboradores
            itens={itensFiltrados}
            totais={totaisFiltrados}
            loading={loading}
            temItensOriginais={items.length > 0}
            busca={busca}
            onBuscaChange={setBusca}
          />
        </>
      )}

      {abaAtiva === 'planilha' && (
        <TabelaColaboradores
          itens={itensFiltrados}
          totais={totaisFiltrados}
          loading={loading}
          temItensOriginais={items.length > 0}
          busca={busca}
          onBuscaChange={setBusca}
        />
      )}
    </div>
  )
}
