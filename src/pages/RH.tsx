import { useEffect, useMemo, useRef, useState } from 'react'
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
  Stethoscope,
  FileCheck2,
  FileX2,
  CalendarDays,
  Clock,
  UserX,
  Upload,
  Building2,
  Medal,
  Timer,
  HandCoins,
  ChevronDown,
  X,
} from 'lucide-react'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList } from 'recharts'
import { PageHeader } from '@/components/layout/Header'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { StatCard } from '@/components/ui/StatCard'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { DragScrollArea } from '@/components/ui/DragScrollArea'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { isRhAuthorized, isModuloAuthorized } from '@/components/layout/nav'
import { isAdminUsuario } from '@/lib/permissoes'
import { useRhSheet, type ColaboradorRH } from '@/hooks/useRhSheet'
import { useAtestadosSheet, type RegistroAtestado, type TipoAtestado } from '@/hooks/useAtestadosSheet'
import { useFaltas, useLotesImportacaoFaltas, importarFaltasPdf, type RegistroFalta } from '@/hooks/useFaltas'
import { useHoraExtraSheet, type RegistroHoraExtra } from '@/hooks/useHoraExtraSheet'
import { CHART_CATEGORICAL, CHART_OTHER, CHART_ENTRADA, CHART_SAIDA } from '@/lib/chartColors'
import { cn } from '@/lib/cn'
import { getErrorMessage } from '@/lib/erros'

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

// Medalha desenhada em SVG (círculo + número) no início das 3 primeiras
// barras — em vez de um emoji, que renderiza sem cor (só o contorno) dentro
// de um <text> de SVG na maioria dos navegadores.
const CORES_MEDALHA = ['#FFD700', '#C0C0C0', '#CD7F32'] // ouro, prata, bronze

function renderMedalhaNaBarra(props: any) {
  const { x, y, height, index } = props
  if (index > 2) return null
  const tamanho = 18
  const cy = y + height / 2
  return (
    <g key={`medalha-${index}`} filter="drop-shadow(0 1px 1.5px rgba(0,0,0,0.5))">
      <Medal
        x={x + 4}
        y={cy - tamanho / 2}
        width={tamanho}
        height={tamanho}
        color="rgba(0,0,0,0.55)"
        fill={CORES_MEDALHA[index]}
        strokeWidth={1.5}
      />
    </g>
  )
}

interface BarRankingCardProps {
  titulo: string
  icone: React.ElementType
  dados: Array<{ name: string; value: number } & Record<string, unknown>>
  cor: string
  formatarValor: (v: number) => string
  formatarEixo: (v: number) => string
  textColor: string
  gridColor: string
  axisLineColor: string
  tooltipStyle: React.CSSProperties
  tooltipLabel: string
  /** Desenha uma medalha (ouro/prata/bronze) no início das 3 primeiras barras. */
  destacarTop3?: boolean
  /** Quando informado, torna as barras clicáveis e recebe o item original de `dados`. */
  onBarClick?: (item: { name: string; value: number } & Record<string, unknown>) => void
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
  destacarTop3,
  onBarClick,
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
                <Bar
                  dataKey="value"
                  fill={cor}
                  radius={[0, 6, 6, 0]}
                  maxBarSize={22}
                  cursor={onBarClick ? 'pointer' : undefined}
                  onClick={(data: any) => onBarClick?.(data?.payload ?? data)}
                >
                  <LabelList
                    dataKey="value"
                    position="right"
                    fill={textColor}
                    fontSize={11}
                    fontWeight={800}
                    offset={8}
                    formatter={(val: any) => (typeof val === 'number' ? formatarEixo(val) : String(val ?? ''))}
                  />
                  {destacarTop3 && <LabelList dataKey="value" content={renderMedalhaNaBarra} />}
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
  // Empresas como "Terceiros" não têm a quebra em carteira/registro/ajuda de
  // custo/gratificação (só um salário único) — nesse caso essas colunas vêm
  // sempre zeradas. Escondê-las evita 4 colunas inúteis de "R$ 0,00" e faz a
  // tabela caber na tela sem precisar arrastar.
  const mostrarCarteira = itens.some((c) => c.valorCarteira !== 0)
  const mostrarRegistro = itens.some((c) => c.custoRegistro !== 0)
  const mostrarAjudaCusto = itens.some((c) => c.ajudaCusto !== 0)
  const mostrarGratificacao = itens.some((c) => c.gratificacao !== 0)

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
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/10 text-left text-foreground font-bold">
                  <th className="px-2 py-2.5 font-bold">Colaborador</th>
                  <th className="px-2 py-2.5 font-bold">Função</th>
                  {mostrarCarteira && <th className="px-2 py-2.5 font-bold whitespace-nowrap text-right">Carteira</th>}
                  {mostrarRegistro && <th className="px-2 py-2.5 font-bold whitespace-nowrap text-right">Registro (80%)</th>}
                  {mostrarAjudaCusto && <th className="px-2 py-2.5 font-bold whitespace-nowrap text-right">Ajuda Custo</th>}
                  {mostrarGratificacao && <th className="px-2 py-2.5 font-bold whitespace-nowrap text-right">Gratificação</th>}
                  <th className="px-2 py-2.5 font-bold whitespace-nowrap text-right">Ganhos Totais</th>
                  <th className="px-2 py-2.5 font-bold whitespace-nowrap text-right">Custo Total</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((c) => (
                  <tr key={c.id} className="border-b border-border/5 last:border-0 hover:bg-overlay/[0.03]">
                    <td className="px-2 py-2 font-medium text-foreground max-w-[160px] truncate" title={c.nome}>
                      {c.nome}
                    </td>
                    <td className="px-2 py-2 text-secondary max-w-[130px]" title={c.funcao}>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="truncate">{c.funcao}</span>
                        {c.observacao && (
                          <Badge tone="warning" className="normal-case text-[9px] shrink-0">
                            {c.observacao}
                          </Badge>
                        )}
                      </div>
                    </td>
                    {mostrarCarteira && (
                      <td className="px-2 py-2 text-secondary whitespace-nowrap text-right tabular-nums">
                        {formatMoeda(c.valorCarteira)}
                      </td>
                    )}
                    {mostrarRegistro && (
                      <td className="px-2 py-2 text-secondary whitespace-nowrap text-right tabular-nums">
                        {formatMoeda(c.custoRegistro)}
                      </td>
                    )}
                    {mostrarAjudaCusto && (
                      <td className="px-2 py-2 text-secondary whitespace-nowrap text-right tabular-nums">
                        {formatMoeda(c.ajudaCusto)}
                      </td>
                    )}
                    {mostrarGratificacao && (
                      <td className="px-2 py-2 text-secondary whitespace-nowrap text-right tabular-nums">
                        {formatMoeda(c.gratificacao)}
                      </td>
                    )}
                    <td className="px-2 py-2 font-bold text-foreground whitespace-nowrap text-right tabular-nums">
                      {formatMoeda(c.ganhosTotais)}
                    </td>
                    <td className="px-2 py-2 font-bold text-primary whitespace-nowrap text-right tabular-nums">
                      {formatMoeda(c.custoTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
              {itens.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-border/20 bg-surface/60 font-black text-foreground">
                    <td className="px-2 py-2.5 whitespace-nowrap" colSpan={2}>
                      TOTAL ({itens.length} {itens.length === 1 ? 'COLABORADOR' : 'COLABORADORES'})
                    </td>
                    {mostrarCarteira && (
                      <td className="px-2 py-2.5 whitespace-nowrap text-right tabular-nums">
                        {formatMoeda(totais.valorCarteira)}
                      </td>
                    )}
                    {mostrarRegistro && (
                      <td className="px-2 py-2.5 whitespace-nowrap text-right tabular-nums">
                        {formatMoeda(totais.custoRegistro)}
                      </td>
                    )}
                    {mostrarAjudaCusto && (
                      <td className="px-2 py-2.5 whitespace-nowrap text-right tabular-nums">
                        {formatMoeda(totais.ajudaCusto)}
                      </td>
                    )}
                    {mostrarGratificacao && (
                      <td className="px-2 py-2.5 whitespace-nowrap text-right tabular-nums">
                        {formatMoeda(totais.gratificacao)}
                      </td>
                    )}
                    <td className="px-2 py-2.5 whitespace-nowrap text-right tabular-nums">
                      {formatMoeda(totais.ganhosTotais)}
                    </td>
                    <td className="px-2 py-2.5 whitespace-nowrap text-right tabular-nums text-primary">
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

const FILTROS_TIPO_ATESTADO: Array<TipoAtestado | 'TODOS'> = ['TODOS', 'Atestado', 'Declaração', 'Outro']

const ORDEM_MESES = [
  'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
  'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO',
]

function ordenarMeses(meses: string[]): string[] {
  return [...meses].sort((a, b) => {
    const ia = ORDEM_MESES.indexOf(a)
    const ib = ORDEM_MESES.indexOf(b)
    if (ia === -1 && ib === -1) return a.localeCompare(b)
    if (ia === -1) return 1
    if (ib === -1) return -1
    return ia - ib
  })
}

interface FiltroMesDropdownProps {
  meses: string[]
  valor: string
  onChange: (valor: string) => void
}

function FiltroMesDropdown({ meses, valor, onChange }: FiltroMesDropdownProps) {
  const [aberto, setAberto] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!aberto) return
    const onClickFora = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAberto(false)
      }
    }
    document.addEventListener('mousedown', onClickFora)
    return () => document.removeEventListener('mousedown', onClickFora)
  }, [aberto])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
          valor !== 'TODOS'
            ? 'bg-primary text-white shadow-md shadow-primary/20'
            : 'border border-border/25 bg-surface/60 text-secondary hover:text-foreground hover:bg-surface-hover/50'
        }`}
      >
        {valor === 'TODOS' ? 'TODOS OS MESES' : valor}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${aberto ? 'rotate-180' : ''}`} />
      </button>

      {aberto && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-44 max-h-64 overflow-y-auto rounded-xl border border-border/25 bg-surface shadow-lg shadow-black/20 py-1.5">
          <button
            type="button"
            onClick={() => {
              onChange('TODOS')
              setAberto(false)
            }}
            className={`w-full text-left px-3.5 py-2 text-xs font-bold cursor-pointer transition-colors ${
              valor === 'TODOS' ? 'text-primary' : 'text-secondary hover:text-foreground hover:bg-surface-hover/50'
            }`}
          >
            TODOS OS MESES
          </button>
          {meses.map((mes) => (
            <button
              key={mes}
              type="button"
              onClick={() => {
                onChange(mes)
                setAberto(false)
              }}
              className={`w-full text-left px-3.5 py-2 text-xs font-bold cursor-pointer transition-colors ${
                valor === mes ? 'text-primary' : 'text-secondary hover:text-foreground hover:bg-surface-hover/50'
              }`}
            >
              {mes}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function toneStatusAtestado(status: string): 'success' | 'warning' | 'neutral' {
  const limpo = status.trim().toUpperCase()
  if (limpo === 'CONFERIDO') return 'success'
  if (!limpo) return 'neutral'
  return 'warning'
}

const MINI_BADGE_TONE_CLASSES: Record<BadgeTone, string> = {
  success: 'bg-status-success/15 text-status-success border-status-success/30',
  danger: 'bg-status-danger/15 text-status-danger border-status-danger/30',
  warning: 'bg-status-warning/15 text-status-warning border-status-warning/30',
  neutral: 'bg-status-neutral/15 text-status-neutral border-status-neutral/30',
}

// Badge compacto próprio para esta tabela densa — o <Badge> padrão (px-2.5
// py-1 text-xs) não pode ser encolhido via className aqui: como `cn()` não
// faz merge de utilitários conflitantes (é só clsx), as classes maiores do
// componente sempre venciam na ordem do CSS gerado e a pílula ficava larga
// demais, vazando por cima da coluna vizinha.
function MiniBadge({ tone, className, children }: { tone: BadgeTone; className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-full border px-1.5 py-0.5 text-[10px] font-bold leading-none uppercase',
        MINI_BADGE_TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

interface TabelaAtestadosProps {
  itens: RegistroAtestado[]
  loading: boolean
  temItensOriginais: boolean
  busca: string
  onBuscaChange: (valor: string) => void
  filtroTipo: TipoAtestado | 'TODOS'
  onFiltroTipoChange: (valor: TipoAtestado | 'TODOS') => void
  meses: string[]
  filtroMes: string
  onFiltroMesChange: (valor: string) => void
}

function TabelaAtestados({
  itens,
  loading,
  temItensOriginais,
  busca,
  onBuscaChange,
  filtroTipo,
  onFiltroTipoChange,
  meses,
  filtroMes,
  onFiltroMesChange,
}: TabelaAtestadosProps) {
  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <CardTitle>Controle de Atestados e Declarações</CardTitle>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary" />
          <Input
            value={busca}
            onChange={(e) => onBuscaChange(e.target.value)}
            placeholder="BUSCAR POR NOME, CARGO OU CID"
            className="h-10 pl-9 pr-9"
          />
          {busca && (
            <button
              type="button"
              onClick={() => onBuscaChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary hover:text-foreground transition-colors cursor-pointer"
              aria-label="Limpar busca"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-1.5 mb-4">
          {FILTROS_TIPO_ATESTADO.map((tipo) => (
            <button
              key={tipo}
              type="button"
              onClick={() => onFiltroTipoChange(tipo)}
              className={`rounded-xl px-3.5 py-2 text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                filtroTipo === tipo
                  ? 'bg-primary text-white shadow-md shadow-primary/20'
                  : 'border border-border/25 bg-surface/60 text-secondary hover:text-foreground hover:bg-surface-hover/50'
              }`}
            >
              {tipo === 'TODOS' ? 'TODOS' : tipo.toUpperCase()}
            </button>
          ))}
          {meses.length > 0 && (
            <>
              <div className="w-px h-6 bg-border/25 mx-1" />
              <FiltroMesDropdown meses={meses} valor={filtroMes} onChange={onFiltroMesChange} />
            </>
          )}
        </div>

        {loading && !temItensOriginais ? (
          <div className="flex items-center justify-center py-16 text-secondary text-sm">
            <RefreshCw className="h-5 w-5 animate-spin mr-2" />
            CARREGANDO DADOS DA PLANILHA...
          </div>
        ) : itens.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-secondary text-sm">
            NENHUM REGISTRO ENCONTRADO
          </div>
        ) : (
          <DragScrollArea>
            <table className="w-full text-[11px] table-fixed">
              <colgroup>
                <col className="w-[14%]" />
                <col className="w-[10%]" />
                <col className="w-[10%]" />
                <col className="w-[7%]" />
                <col className="w-[10%]" />
                <col className="w-[13%]" />
                <col className="w-[6%]" />
                <col className="w-[17%]" />
                <col className="w-[13%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-border/10 text-left text-foreground font-bold">
                  <th className="px-1.5 py-2 font-bold">Colaborador</th>
                  <th className="px-1.5 py-2 font-bold">Cargo</th>
                  <th className="px-1.5 py-2 font-bold whitespace-nowrap">Data</th>
                  <th className="px-1.5 py-2 font-bold whitespace-nowrap">Mês</th>
                  <th className="px-1.5 py-2 font-bold whitespace-nowrap">Tipo</th>
                  <th className="px-1.5 py-2 font-bold whitespace-nowrap">Período / Dias</th>
                  <th className="px-1.5 py-2 font-bold whitespace-nowrap">CID</th>
                  <th className="px-1.5 py-2 font-bold">Descrição</th>
                  <th className="px-1.5 py-2 font-bold whitespace-nowrap">Status / Doc.</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((a) => (
                  <tr key={a.id} className="border-b border-border/5 last:border-0 hover:bg-overlay/[0.03]">
                    <td className="px-1.5 py-1.5 font-medium text-foreground truncate" title={a.nome}>
                      {a.nome}
                    </td>
                    <td className="px-1.5 py-1.5 text-secondary truncate" title={a.cargo}>
                      {a.cargo}
                    </td>
                    <td className="px-1.5 py-1.5 text-secondary whitespace-nowrap">{a.data}</td>
                    <td className="px-1.5 py-1.5 text-secondary truncate" title={a.mes}>
                      {a.mes || '—'}
                    </td>
                    <td className="px-1.5 py-1.5 whitespace-nowrap overflow-hidden">
                      <MiniBadge tone={a.tipo === 'Atestado' ? 'danger' : a.tipo === 'Declaração' ? 'neutral' : 'warning'}>
                        {a.tipo}
                      </MiniBadge>
                    </td>
                    <td className="px-1.5 py-1.5 text-secondary whitespace-nowrap" title={a.horasAusencia > 0 ? `${a.horasAusencia.toLocaleString('pt-BR')} h de ausência` : undefined}>
                      {a.tipo === 'Atestado'
                        ? `${a.diasAfastamento} ${a.diasAfastamento === 1 ? 'dia' : 'dias'}`
                        : a.horaInicio && a.horaFim
                        ? `${a.horaInicio}–${a.horaFim}${a.horasAusencia > 0 ? ` (${a.horasAusencia.toLocaleString('pt-BR')}h)` : ''}`
                        : '—'}
                    </td>
                    <td className="px-1.5 py-1.5 text-secondary truncate">{a.cid || '—'}</td>
                    <td className="px-1.5 py-1.5 text-secondary truncate" title={a.descricao}>
                      {a.descricao || '—'}
                    </td>
                    <td className="px-1.5 py-1.5 whitespace-nowrap overflow-hidden">
                      <div className="flex items-center gap-1">
                        <MiniBadge tone={toneStatusAtestado(a.status)} className="normal-case">
                          {a.status || 'Pendente'}
                        </MiniBadge>
                        {a.documentoEntregue ? (
                          <span title="Documento entregue">
                            <FileCheck2 className="h-3.5 w-3.5 shrink-0 text-status-success" />
                          </span>
                        ) : (
                          <span title="Documento não entregue">
                            <FileX2 className="h-3.5 w-3.5 shrink-0 text-status-danger" />
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DragScrollArea>
        )}
      </CardContent>
    </Card>
  )
}

function formatDataBr(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return iso
  return `${m[3]}/${m[2]}/${m[1]}`
}

interface TabelaFaltasProps {
  itens: RegistroFalta[]
  loading: boolean
  temItensOriginais: boolean
  busca: string
  onBuscaChange: (valor: string) => void
  departamentos: string[]
  filtroDepartamento: string
  onFiltroDepartamentoChange: (valor: string) => void
}

function TabelaFaltas({
  itens,
  loading,
  temItensOriginais,
  busca,
  onBuscaChange,
  departamentos,
  filtroDepartamento,
  onFiltroDepartamentoChange,
}: TabelaFaltasProps) {
  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <CardTitle>Relatório de Ausências</CardTitle>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary" />
          <Input
            value={busca}
            onChange={(e) => onBuscaChange(e.target.value)}
            placeholder="BUSCAR POR NOME, MATRÍCULA OU FUNÇÃO"
            className="h-10 pl-9"
          />
        </div>
      </CardHeader>
      <CardContent>
        {departamentos.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mb-4">
            <button
              type="button"
              onClick={() => onFiltroDepartamentoChange('TODOS')}
              className={`rounded-xl px-3.5 py-2 text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                filtroDepartamento === 'TODOS'
                  ? 'bg-primary text-white shadow-md shadow-primary/20'
                  : 'border border-border/25 bg-surface/60 text-secondary hover:text-foreground hover:bg-surface-hover/50'
              }`}
            >
              TODOS
            </button>
            {departamentos.map((depto) => (
              <button
                key={depto}
                type="button"
                onClick={() => onFiltroDepartamentoChange(depto)}
                className={`rounded-xl px-3.5 py-2 text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                  filtroDepartamento === depto
                    ? 'bg-primary text-white shadow-md shadow-primary/20'
                    : 'border border-border/25 bg-surface/60 text-secondary hover:text-foreground hover:bg-surface-hover/50'
                }`}
              >
                {depto}
              </button>
            ))}
          </div>
        )}

        {loading && !temItensOriginais ? (
          <div className="flex items-center justify-center py-16 text-secondary text-sm">
            <RefreshCw className="h-5 w-5 animate-spin mr-2" />
            CARREGANDO REGISTROS...
          </div>
        ) : itens.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-secondary text-sm">
            NENHUMA FALTA ENCONTRADA — IMPORTE UM RELATÓRIO EM PDF PARA COMEÇAR
          </div>
        ) : (
          <DragScrollArea>
            <table className="w-full text-[11px] table-fixed">
              <colgroup>
                <col className="w-[8%]" />
                <col className="w-[24%]" />
                <col className="w-[20%]" />
                <col className="w-[18%]" />
                <col className="w-[12%]" />
                <col className="w-[18%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-border/10 text-left text-foreground font-bold">
                  <th className="px-1.5 py-2 font-bold">Matrícula</th>
                  <th className="px-1.5 py-2 font-bold">Colaborador</th>
                  <th className="px-1.5 py-2 font-bold">Função</th>
                  <th className="px-1.5 py-2 font-bold">Departamento</th>
                  <th className="px-1.5 py-2 font-bold whitespace-nowrap">Data</th>
                  <th className="px-1.5 py-2 font-bold">Observação</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((f) => (
                  <tr key={f.id} className="border-b border-border/5 last:border-0 hover:bg-overlay/[0.03]">
                    <td className="px-1.5 py-1.5 text-secondary truncate">{f.matricula}</td>
                    <td className="px-1.5 py-1.5 font-medium text-foreground truncate" title={f.nome}>
                      {f.nome}
                    </td>
                    <td className="px-1.5 py-1.5 text-secondary truncate" title={f.funcao}>
                      {f.funcao || '—'}
                    </td>
                    <td className="px-1.5 py-1.5 text-secondary truncate" title={f.departamento}>
                      {f.departamento || '—'}
                    </td>
                    <td className="px-1.5 py-1.5 text-secondary whitespace-nowrap">{formatDataBr(f.data)}</td>
                    <td className="px-1.5 py-1.5 whitespace-nowrap overflow-hidden">
                      <MiniBadge tone="danger" className="normal-case">
                        {f.observacao}
                      </MiniBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DragScrollArea>
        )}
      </CardContent>
    </Card>
  )
}

interface TabelaHoraExtraProps {
  itens: RegistroHoraExtra[]
  loading: boolean
  temItensOriginais: boolean
  busca: string
  onBuscaChange: (valor: string) => void
  empresas: string[]
  filtroEmpresa: string
  onFiltroEmpresaChange: (valor: string) => void
}

function TabelaHoraExtra({
  itens,
  loading,
  temItensOriginais,
  busca,
  onBuscaChange,
  empresas,
  filtroEmpresa,
  onFiltroEmpresaChange,
}: TabelaHoraExtraProps) {
  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <CardTitle>Relação de Horas Extras</CardTitle>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary" />
          <Input
            value={busca}
            onChange={(e) => onBuscaChange(e.target.value)}
            placeholder="BUSCAR POR COLABORADOR"
            className="h-10 pl-9"
          />
        </div>
      </CardHeader>
      <CardContent>
        {empresas.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mb-4">
            <button
              type="button"
              onClick={() => onFiltroEmpresaChange('TODOS')}
              className={`rounded-xl px-3.5 py-2 text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                filtroEmpresa === 'TODOS'
                  ? 'bg-primary text-white shadow-md shadow-primary/20'
                  : 'border border-border/25 bg-surface/60 text-secondary hover:text-foreground hover:bg-surface-hover/50'
              }`}
            >
              TODOS
            </button>
            {empresas.map((emp) => (
              <button
                key={emp}
                type="button"
                onClick={() => onFiltroEmpresaChange(emp)}
                className={`rounded-xl px-3.5 py-2 text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                  filtroEmpresa === emp
                    ? 'bg-primary text-white shadow-md shadow-primary/20'
                    : 'border border-border/25 bg-surface/60 text-secondary hover:text-foreground hover:bg-surface-hover/50'
                }`}
              >
                {emp}
              </button>
            ))}
          </div>
        )}

        {loading && !temItensOriginais ? (
          <div className="flex items-center justify-center py-16 text-secondary text-sm">
            <RefreshCw className="h-5 w-5 animate-spin mr-2" />
            CARREGANDO DADOS DA PLANILHA...
          </div>
        ) : itens.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-secondary text-sm">
            NENHUM REGISTRO DE HORA EXTRA ENCONTRADO
          </div>
        ) : (
          <DragScrollArea>
            <table className="w-full text-[11px] table-fixed">
              <colgroup>
                <col className="w-[26%]" />
                <col className="w-[14%]" />
                <col className="w-[13%]" />
                <col className="w-[13%]" />
                <col className="w-[14%]" />
                <col className="w-[20%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-border/10 text-left text-foreground font-bold">
                  <th className="px-1.5 py-2 font-bold">Colaborador</th>
                  <th className="px-1.5 py-2 font-bold">Empresa</th>
                  <th className="px-1.5 py-2 font-bold whitespace-nowrap text-right">Salário</th>
                  <th className="px-1.5 py-2 font-bold whitespace-nowrap text-right">Valor H.E.</th>
                  <th className="px-1.5 py-2 font-bold whitespace-nowrap text-right">Horas Mês</th>
                  <th className="px-1.5 py-2 font-bold whitespace-nowrap text-right">Total H.E.</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((h) => (
                  <tr key={h.id} className="border-b border-border/5 last:border-0 hover:bg-overlay/[0.03]">
                    <td className="px-1.5 py-1.5 font-medium text-foreground truncate" title={h.colaborador}>
                      {h.colaborador}
                    </td>
                    <td className="px-1.5 py-1.5 text-secondary truncate" title={h.empresa}>
                      {h.empresa}
                    </td>
                    <td className="px-1.5 py-1.5 text-secondary whitespace-nowrap text-right tabular-nums">
                      {formatMoeda(h.salario)}
                    </td>
                    <td className="px-1.5 py-1.5 text-secondary whitespace-nowrap text-right tabular-nums">
                      {formatMoeda(h.valorHoraExtra)}
                    </td>
                    <td className="px-1.5 py-1.5 text-secondary whitespace-nowrap text-right tabular-nums">
                      {h.horasExtrasMes.toLocaleString('pt-BR')}
                    </td>
                    <td className="px-1.5 py-1.5 font-bold text-primary whitespace-nowrap text-right tabular-nums">
                      {formatMoeda(h.valorTotalHE)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DragScrollArea>
        )}
      </CardContent>
    </Card>
  )
}

type AbaRH = 'dashboard' | 'planilha' | 'atestado' | 'faltas' | 'horaExtra'
const ABAS_VALIDAS: AbaRH[] = ['dashboard', 'planilha', 'atestado', 'faltas', 'horaExtra']

export function RH() {
  const { user, perfil, perfilLoading } = useAuth()
  const usuarioOuEmail = perfil || { email: user?.email }
  const autorizado = isRhAuthorized(usuarioOuEmail)
  const podeDashboard = isModuloAuthorized(usuarioOuEmail, 'rh_dashboard')
  const podePlanilha = isModuloAuthorized(usuarioOuEmail, 'rh_planilha')
  const podeAtestado = isModuloAuthorized(usuarioOuEmail, 'rh_atestado')
  const podeFaltas = isModuloAuthorized(usuarioOuEmail, 'rh_faltas')
  // Restrito de propósito: só administradores + Norival (RH) veem essa aba,
  // independente do que estiver marcado na tela de permissões — dado
  // salarial sensível que não deve ficar liberável pra qualquer usuário via
  // checkbox.
  const podeHoraExtra = isAdminUsuario(perfil, user?.email) || (user?.email || '').toLowerCase().trim() === 'rh@gveldiesel.com'
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
  const {
    items: atestados,
    loading: loadingAtestados,
    error: erroAtestados,
    fetchSheet: fetchAtestados,
  } = useAtestadosSheet()
  const { registros: faltas, loading: loadingFaltas, error: erroFaltasFetch, refetch: refetchFaltas } = useFaltas()
  const { lotes: lotesFaltas, refetch: refetchLotesFaltas } = useLotesImportacaoFaltas()
  const {
    items: horasExtras,
    mesReferencia: mesReferenciaHoraExtra,
    loading: loadingHoraExtra,
    error: erroHoraExtra,
    fetchSheet: fetchHoraExtra,
  } = useHoraExtraSheet()
  const [busca, setBusca] = useState('')
  const [buscaAtestado, setBuscaAtestado] = useState('')
  const [filtroTipoAtestado, setFiltroTipoAtestado] = useState<TipoAtestado | 'TODOS'>('TODOS')
  const [filtroMesAtestado, setFiltroMesAtestado] = useState('TODOS')
  const [buscaHoraExtra, setBuscaHoraExtra] = useState('')
  const [filtroEmpresaHoraExtra, setFiltroEmpresaHoraExtra] = useState('TODOS')
  const [colaboradorHoraExtraModal, setColaboradorHoraExtraModal] = useState<RegistroHoraExtra | null>(null)
  const [buscaFalta, setBuscaFalta] = useState('')
  const [filtroDepartamentoFalta, setFiltroDepartamentoFalta] = useState('TODOS')
  const [importandoFaltas, setImportandoFaltas] = useState(false)
  const [erroImportacaoFaltas, setErroImportacaoFaltas] = useState<string | null>(null)

  async function handleImportarFaltas(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setImportandoFaltas(true)
    setErroImportacaoFaltas(null)
    try {
      await importarFaltasPdf(file)
      await Promise.all([refetchFaltas(), refetchLotesFaltas()])
    } catch (err) {
      setErroImportacaoFaltas(getErrorMessage(err, 'Não foi possível importar o PDF.'))
    } finally {
      setImportandoFaltas(false)
    }
  }

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

  const abasPermitidas = useMemo(() => {
    const abas: AbaRH[] = []
    if (podeDashboard) abas.push('dashboard')
    if (podePlanilha) abas.push('planilha')
    if (podeAtestado) abas.push('atestado')
    if (podeFaltas) abas.push('faltas')
    if (podeHoraExtra) abas.push('horaExtra')
    return abas
  }, [podeDashboard, podePlanilha, podeAtestado, podeFaltas, podeHoraExtra])

  // Corrige a aba ativa se ela não estiver entre as liberadas pra esse
  // usuário — cobre tanto o caso de alguém digitar ?aba=faltas na mão sem
  // permissão, quanto o instante inicial em que o perfil ainda está
  // carregando (as permissões reais só ficam conhecidas depois).
  useEffect(() => {
    if (perfilLoading || abasPermitidas.length === 0) return
    if (!abasPermitidas.includes(abaAtiva)) {
      setAbaAtiva(abasPermitidas[0])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfilLoading, abasPermitidas, abaAtiva])

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

  const [empresaFiltro, setEmpresaFiltro] = useState<string>('TODAS')

  const empresasComContagem = useMemo(() => {
    const ordem: string[] = []
    const counts = new Map<string, number>()
    for (const c of items) {
      if (!counts.has(c.empresa)) ordem.push(c.empresa)
      counts.set(c.empresa, (counts.get(c.empresa) ?? 0) + 1)
    }
    return ordem.map((nome) => ({ nome, total: counts.get(nome) ?? 0 }))
  }, [items])

  const itensEmpresa = useMemo(() => {
    if (empresaFiltro === 'TODAS') return items
    return items.filter((c) => c.empresa === empresaFiltro)
  }, [items, empresaFiltro])

  const itensFiltrados = useMemo(() => {
    const termo = busca.trim().toUpperCase()
    if (!termo) return itensEmpresa
    return itensEmpresa.filter((c) => c.nome.includes(termo) || c.funcao.includes(termo))
  }, [itensEmpresa, busca])

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

  const totaisGerais = useMemo(() => somarTotais(itensEmpresa), [itensEmpresa])
  const totaisFiltrados = useMemo(() => somarTotais(itensFiltrados), [itensFiltrados])
  const custoMedio = itensEmpresa.length > 0 ? totaisGerais.custoTotal / itensEmpresa.length : 0

  const porFuncao = useMemo(() => {
    const counts = new Map<string, number>()
    for (const c of itensEmpresa) {
      counts.set(c.funcao, (counts.get(c.funcao) ?? 0) + 1)
    }
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
    const top = sorted.slice(0, 5).map(([name, value]) => ({ name, value }))
    const outras = sorted.slice(5).reduce((acc, [, v]) => acc + v, 0)
    if (outras > 0) top.push({ name: 'Outras', value: outras })
    return top
  }, [itensEmpresa])

  const composicaoCusto = useMemo(() => {
    if (totaisGerais.custoTotal <= 0) return []
    return [
      { name: 'Ganhos dos Colaboradores', value: totaisGerais.ganhosTotais },
      { name: 'Encargos (Custo Registro)', value: totaisGerais.custoRegistro },
    ]
  }, [totaisGerais])

  const mesesAtestado = useMemo(() => {
    const unicos = new Set(atestados.map((a) => a.mes).filter(Boolean))
    return ordenarMeses([...unicos])
  }, [atestados])

  const atestadosFiltrados = useMemo(() => {
    let result = atestados
    if (filtroTipoAtestado !== 'TODOS') {
      result = result.filter((a) => a.tipo === filtroTipoAtestado)
    }
    if (filtroMesAtestado !== 'TODOS') {
      result = result.filter((a) => a.mes === filtroMesAtestado)
    }
    const termo = buscaAtestado.trim().toUpperCase()
    if (termo) {
      result = result.filter(
        (a) => a.nome.includes(termo) || a.cargo.includes(termo) || a.cid.toUpperCase().includes(termo),
      )
    }
    return result
  }, [atestados, filtroTipoAtestado, filtroMesAtestado, buscaAtestado])

  const totaisAtestados = useMemo(() => {
    return atestados.reduce(
      (acc, a) => ({
        totalAtestados: acc.totalAtestados + (a.tipo === 'Atestado' ? 1 : 0),
        totalDeclaracoes: acc.totalDeclaracoes + (a.tipo === 'Declaração' ? 1 : 0),
        diasAfastamento: acc.diasAfastamento + a.diasAfastamento,
        horasAusencia: acc.horasAusencia + a.horasAusencia,
      }),
      { totalAtestados: 0, totalDeclaracoes: 0, diasAfastamento: 0, horasAusencia: 0 },
    )
  }, [atestados])

  const rankingColaboradoresAtestados = useMemo(() => {
    const contagem = new Map<string, { nome: string; dias: number; registros: number }>()
    for (const a of atestados) {
      const atual = contagem.get(a.nome)
      if (atual) {
        atual.dias += a.diasAfastamento
        atual.registros += 1
      } else {
        contagem.set(a.nome, { nome: a.nome, dias: a.diasAfastamento, registros: 1 })
      }
    }
    return [...contagem.values()]
      .sort((a, b) => b.dias - a.dias || b.registros - a.registros)
      .slice(0, 8)
      .map((c) => ({ name: c.nome, value: c.dias, registros: c.registros }))
  }, [atestados])

  const composicaoTipoAtestado = useMemo(() => {
    const contagem = new Map<string, number>()
    for (const a of atestados) {
      contagem.set(a.tipo, (contagem.get(a.tipo) || 0) + 1)
    }
    return [...contagem.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }))
  }, [atestados])

  const departamentosFaltas = useMemo(() => {
    const set = new Set<string>()
    for (const f of faltas) {
      if (f.departamento) set.add(f.departamento)
    }
    return [...set].sort()
  }, [faltas])

  const faltasFiltradas = useMemo(() => {
    let result = faltas
    if (filtroDepartamentoFalta !== 'TODOS') {
      result = result.filter((f) => f.departamento === filtroDepartamentoFalta)
    }
    const termo = buscaFalta.trim().toUpperCase()
    if (termo) {
      result = result.filter(
        (f) => f.nome.includes(termo) || f.matricula.includes(termo) || f.funcao.toUpperCase().includes(termo),
      )
    }
    return result
  }, [faltas, filtroDepartamentoFalta, buscaFalta])

  const totaisFaltas = useMemo(() => {
    const colaboradoresUnicos = new Set(faltas.map((f) => f.matricula)).size
    return { total: faltas.length, colaboradoresUnicos, departamentos: departamentosFaltas.length }
  }, [faltas, departamentosFaltas])

  const rankingColaboradoresFaltas = useMemo(() => {
    const contagem = new Map<string, { nome: string; value: number }>()
    for (const f of faltas) {
      const atual = contagem.get(f.matricula)
      if (atual) atual.value += 1
      else contagem.set(f.matricula, { nome: f.nome, value: 1 })
    }
    return [...contagem.values()]
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
      .map((c) => ({ name: c.nome, value: c.value }))
  }, [faltas])

  const rankingDepartamentosFaltas = useMemo(() => {
    const contagem = new Map<string, number>()
    for (const f of faltas) {
      if (!f.departamento) continue
      contagem.set(f.departamento, (contagem.get(f.departamento) || 0) + 1)
    }
    return [...contagem.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }))
  }, [faltas])

  const ultimoLoteFaltas = lotesFaltas[0]

  const empresasHoraExtra = useMemo(() => {
    const set = new Set<string>()
    for (const h of horasExtras) {
      if (h.empresa) set.add(h.empresa)
    }
    return [...set].sort()
  }, [horasExtras])

  const horasExtrasFiltradas = useMemo(() => {
    let result = horasExtras
    if (filtroEmpresaHoraExtra !== 'TODOS') {
      result = result.filter((h) => h.empresa === filtroEmpresaHoraExtra)
    }
    const termo = buscaHoraExtra.trim().toUpperCase()
    if (termo) {
      result = result.filter((h) => h.colaborador.includes(termo))
    }
    return result
  }, [horasExtras, filtroEmpresaHoraExtra, buscaHoraExtra])

  const totaisHoraExtra = useMemo(() => {
    return horasExtras.reduce(
      (acc, h) => ({
        colaboradores: acc.colaboradores + 1,
        totalHoras: acc.totalHoras + h.horasExtrasMes,
        totalPago: acc.totalPago + h.valorTotalHE,
      }),
      { colaboradores: 0, totalHoras: 0, totalPago: 0 },
    )
  }, [horasExtras])

  const rankingColaboradoresHoraExtra = useMemo(() => {
    return [...horasExtras]
      .sort((a, b) => b.horasExtrasMes - a.horasExtrasMes)
      .slice(0, 8)
      .map((h) => ({ name: h.colaborador, value: h.horasExtrasMes, valorPago: h.valorTotalHE }))
  }, [horasExtras])

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

  if (!perfilLoading && autorizado && abasPermitidas.length === 0) {
    return (
      <div className="flex min-h-[65vh] flex-col items-center justify-center p-6 text-center animate-fade-in uppercase">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-500/15 border border-amber-500/30 text-amber-400 mb-4 shadow-2xl shadow-amber-500/10">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h2 className="text-lg font-black text-foreground mb-1">NENHUMA ABA LIBERADA</h2>
        <p className="text-xs text-secondary font-medium max-w-md mb-6 lowercase">
          Seu acesso ao RH foi liberado, mas nenhuma aba específica (Dashboard, Planilha, Atestado ou Faltas) foi marcada. Peça a um administrador pra revisar suas permissões em Configurações.
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
            onClick={() => {
              fetchSheet()
              fetchAtestados()
              fetchHoraExtra()
            }}
            disabled={loading || loadingAtestados || loadingHoraExtra}
            className="gap-2 font-bold shadow-lg shadow-primary/20"
          >
            <RefreshCw className={`h-4 w-4 ${loading || loadingAtestados || loadingHoraExtra ? 'animate-spin' : ''}`} />
            <span>{loading || loadingAtestados || loadingHoraExtra ? 'SINCRONIZANDO...' : 'ATUALIZAR'}</span>
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

      {erroAtestados && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs font-bold text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="lowercase font-medium">{erroAtestados}</span>
        </div>
      )}

      {erroFaltasFetch && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs font-bold text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="lowercase font-medium">{erroFaltasFetch}</span>
        </div>
      )}

      {erroImportacaoFaltas && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs font-bold text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="lowercase font-medium">{erroImportacaoFaltas}</span>
        </div>
      )}

      {erroHoraExtra && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs font-bold text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="lowercase font-medium">{erroHoraExtra}</span>
        </div>
      )}

      {/* Barra de Abas */}
      <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-surface/80 border border-border/25 shadow-sm backdrop-blur-md w-full sm:w-fit">
        {podeDashboard && (
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
        )}
        {podePlanilha && (
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
              {itensEmpresa.length}
            </span>
          </button>
        )}
        {podeAtestado && (
          <button
            type="button"
            onClick={() => setAbaAtiva('atestado')}
            className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap flex-1 sm:flex-none ${
              abaAtiva === 'atestado'
                ? 'bg-primary text-white shadow-md shadow-primary/20'
                : 'text-secondary hover:text-foreground hover:bg-surface-hover/50'
            }`}
          >
            <Stethoscope className="h-4 w-4" />
            ATESTADO
            <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
              abaAtiva === 'atestado' ? 'bg-white/20 text-white' : 'bg-overlay/10 text-secondary'
            }`}>
              {atestados.length}
            </span>
          </button>
        )}
        {podeFaltas && (
          <button
            type="button"
            onClick={() => setAbaAtiva('faltas')}
            className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap flex-1 sm:flex-none ${
              abaAtiva === 'faltas'
                ? 'bg-primary text-white shadow-md shadow-primary/20'
                : 'text-secondary hover:text-foreground hover:bg-surface-hover/50'
            }`}
          >
            <UserX className="h-4 w-4" />
            FALTAS
            <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
              abaAtiva === 'faltas' ? 'bg-white/20 text-white' : 'bg-overlay/10 text-secondary'
            }`}>
              {faltas.length}
            </span>
          </button>
        )}
        {podeHoraExtra && (
          <button
            type="button"
            onClick={() => setAbaAtiva('horaExtra')}
            className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap flex-1 sm:flex-none ${
              abaAtiva === 'horaExtra'
                ? 'bg-primary text-white shadow-md shadow-primary/20'
                : 'text-secondary hover:text-foreground hover:bg-surface-hover/50'
            }`}
          >
            <Timer className="h-4 w-4" />
            HORA EXTRA
            <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
              abaAtiva === 'horaExtra' ? 'bg-white/20 text-white' : 'bg-overlay/10 text-secondary'
            }`}>
              {horasExtras.length}
            </span>
          </button>
        )}
      </div>

      {/* Importação do Relatório de Ausências (PDF) — só na aba Faltas */}
      {abaAtiva === 'faltas' && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/10 bg-surface/80 px-4 py-3 text-xs font-medium text-secondary backdrop-blur-md">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="flex h-2.5 w-2.5 rounded-full bg-amber-500" />
            <span className="font-bold text-foreground">RELATÓRIO EM PDF:</span>
            <span>
              {ultimoLoteFaltas
                ? `ÚLTIMA IMPORTAÇÃO — "${ultimoLoteFaltas.nomeArquivo}" EM ${new Date(ultimoLoteFaltas.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`
                : 'NENHUM ARQUIVO IMPORTADO AINDA'}
            </span>
          </div>
          <label
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black cursor-pointer transition-all ${
              importandoFaltas
                ? 'bg-primary/60 text-white cursor-not-allowed'
                : 'bg-primary text-white shadow-md shadow-primary/20 hover:bg-primary/90'
            }`}
          >
            <Upload className={`h-4 w-4 ${importandoFaltas ? 'animate-pulse' : ''}`} />
            {importandoFaltas ? 'IMPORTANDO...' : 'IMPORTAR PDF'}
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              disabled={importandoFaltas}
              onChange={handleImportarFaltas}
            />
          </label>
        </div>
      )}

      {/* Mês de referência da planilha de Hora Extra — só na aba Hora Extra */}
      {abaAtiva === 'horaExtra' && mesReferenciaHoraExtra && (
        <div className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-border/10 bg-surface/80 px-4 py-3 text-xs font-medium text-secondary backdrop-blur-md">
          <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          <span className="font-bold text-foreground">MÊS DE REFERÊNCIA:</span>
          <span>{mesReferenciaHoraExtra.toUpperCase()}</span>
        </div>
      )}

      {/* Filtro por Empresa do Grupo */}
      {abaAtiva !== 'atestado' && abaAtiva !== 'faltas' && abaAtiva !== 'horaExtra' && empresasComContagem.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setEmpresaFiltro('TODAS')}
            className={`rounded-xl px-3.5 py-2 text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
              empresaFiltro === 'TODAS'
                ? 'bg-primary text-white shadow-md shadow-primary/20'
                : 'border border-border/25 bg-surface/60 text-secondary hover:text-foreground hover:bg-surface-hover/50'
            }`}
          >
            TODAS ({items.length})
          </button>
          {empresasComContagem.map(({ nome, total }) => (
            <button
              key={nome}
              type="button"
              onClick={() => setEmpresaFiltro(nome)}
              className={`rounded-xl px-3.5 py-2 text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                empresaFiltro === nome
                  ? 'bg-primary text-white shadow-md shadow-primary/20'
                  : 'border border-border/25 bg-surface/60 text-secondary hover:text-foreground hover:bg-surface-hover/50'
              }`}
            >
              {nome} ({total})
            </button>
          ))}
        </div>
      )}

      {abaAtiva === 'dashboard' && (
        <>
          {/* Cards de Indicadores */}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
            <StatCard align="center" valueClassName="text-2xl" icon={Users} label="Colaboradores" value={String(itensEmpresa.length)} />
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

      {abaAtiva === 'atestado' && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
            <StatCard align="center" valueClassName="text-2xl" icon={Users} label="Registros" value={String(atestados.length)} />
            <StatCard align="center" valueClassName="text-2xl" icon={Stethoscope} label="Atestados" value={String(totaisAtestados.totalAtestados)} />
            <StatCard align="center" valueClassName="text-2xl" icon={FileCheck2} label="Declarações" value={String(totaisAtestados.totalDeclaracoes)} />
            <StatCard
              align="center"
              valueClassName="text-lg sm:text-xl"
              icon={CalendarDays}
              label="Dias de Afastamento"
              value={String(totaisAtestados.diasAfastamento)}
            />
            <StatCard
              align="center"
              valueClassName="text-lg sm:text-xl"
              icon={Clock}
              label="Horas de Ausência"
              value={`${totaisAtestados.horasAusencia.toLocaleString('pt-BR')} h`}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <BarRankingCard
              titulo="Colaboradores que Mais Faltaram"
              icone={UserX}
              dados={rankingColaboradoresAtestados}
              cor={CHART_SAIDA}
              formatarValor={(v) => `${v} ${v === 1 ? 'DIA DE AFASTAMENTO' : 'DIAS DE AFASTAMENTO'}`}
              formatarEixo={(v) => String(v)}
              textColor={textColor}
              gridColor={gridColor}
              axisLineColor={axisLineColor}
              tooltipStyle={tooltipStyle}
              tooltipLabel="Dias de Afastamento"
              destacarTop3
              onBarClick={(item) => {
                setFiltroTipoAtestado('TODOS')
                setFiltroMesAtestado('TODOS')
                setBuscaAtestado(item.name)
                document.getElementById('tabela-atestados')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
            />
            <DonutCard
              titulo="Atestado x Declaração"
              icone={Stethoscope}
              dados={composicaoTipoAtestado}
              formatarValor={(v) => `${v} ${v === 1 ? 'registro' : 'registros'}`}
              centroValor={String(atestados.length)}
              centroLegenda="REGISTROS"
              tooltipStyle={tooltipStyle}
              isDark={isDark}
            />
          </div>

          <div id="tabela-atestados">
            <TabelaAtestados
              itens={atestadosFiltrados}
              loading={loadingAtestados}
              temItensOriginais={atestados.length > 0}
              busca={buscaAtestado}
              onBuscaChange={setBuscaAtestado}
              filtroTipo={filtroTipoAtestado}
              onFiltroTipoChange={setFiltroTipoAtestado}
              meses={mesesAtestado}
              filtroMes={filtroMesAtestado}
              onFiltroMesChange={setFiltroMesAtestado}
            />
          </div>
        </>
      )}

      {abaAtiva === 'faltas' && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <StatCard align="center" valueClassName="text-2xl" icon={UserX} label="Faltas Registradas" value={String(totaisFaltas.total)} />
            <StatCard align="center" valueClassName="text-2xl" icon={Users} label="Colaboradores Únicos" value={String(totaisFaltas.colaboradoresUnicos)} />
            <StatCard align="center" valueClassName="text-2xl" icon={Building2} label="Departamentos" value={String(totaisFaltas.departamentos)} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <BarRankingCard
              titulo="Colaboradores com Mais Faltas"
              icone={UserX}
              dados={rankingColaboradoresFaltas}
              cor={CHART_SAIDA}
              formatarValor={(v) => `${v} ${v === 1 ? 'FALTA' : 'FALTAS'}`}
              formatarEixo={(v) => String(v)}
              textColor={textColor}
              gridColor={gridColor}
              axisLineColor={axisLineColor}
              tooltipStyle={tooltipStyle}
              tooltipLabel="Faltas"
              destacarTop3
            />
            <DonutCard
              titulo="Faltas por Departamento"
              icone={Building2}
              dados={rankingDepartamentosFaltas}
              formatarValor={(v) => `${v} ${v === 1 ? 'falta' : 'faltas'}`}
              centroValor={String(totaisFaltas.total)}
              centroLegenda="FALTAS"
              tooltipStyle={tooltipStyle}
              isDark={isDark}
            />
          </div>

          <TabelaFaltas
            itens={faltasFiltradas}
            loading={loadingFaltas}
            temItensOriginais={faltas.length > 0}
            busca={buscaFalta}
            onBuscaChange={setBuscaFalta}
            departamentos={departamentosFaltas}
            filtroDepartamento={filtroDepartamentoFalta}
            onFiltroDepartamentoChange={setFiltroDepartamentoFalta}
          />
        </>
      )}

      {abaAtiva === 'horaExtra' && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <StatCard align="center" valueClassName="text-2xl" icon={Users} label="Colaboradores" value={String(totaisHoraExtra.colaboradores)} />
            <StatCard
              align="center"
              valueClassName="text-lg sm:text-xl"
              icon={Timer}
              label="Total de Horas Extras"
              value={`${totaisHoraExtra.totalHoras.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h`}
            />
            <StatCard
              align="center"
              valueClassName="text-lg sm:text-xl"
              icon={HandCoins}
              label="Valor Total Pago"
              value={formatMoeda(totaisHoraExtra.totalPago)}
            />
          </div>

          <BarRankingCard
            titulo="Colaboradores com Mais Horas Extras"
            icone={Timer}
            dados={rankingColaboradoresHoraExtra}
            cor={CHART_SAIDA}
            formatarValor={(v) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h`}
            formatarEixo={(v) => v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
            textColor={textColor}
            gridColor={gridColor}
            axisLineColor={axisLineColor}
            tooltipStyle={tooltipStyle}
            tooltipLabel="Horas Extras"
            destacarTop3
            onBarClick={(item) => {
              const registro = horasExtras.find((h) => h.colaborador === item.name)
              if (registro) setColaboradorHoraExtraModal(registro)
            }}
          />

          <TabelaHoraExtra
            itens={horasExtrasFiltradas}
            loading={loadingHoraExtra}
            temItensOriginais={horasExtras.length > 0}
            busca={buscaHoraExtra}
            onBuscaChange={setBuscaHoraExtra}
            empresas={empresasHoraExtra}
            filtroEmpresa={filtroEmpresaHoraExtra}
            onFiltroEmpresaChange={setFiltroEmpresaHoraExtra}
          />
        </>
      )}

      {colaboradorHoraExtraModal && (
        <div
          onClick={() => setColaboradorHoraExtraModal(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-fade-in cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl border border-border/30 bg-surface p-6 shadow-2xl animate-scale-in space-y-4 cursor-default"
          >
            <div className="flex items-center justify-between border-b border-border/20 pb-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary shrink-0">
                  <Timer className="h-4 w-4" />
                </div>
                <h3 className="font-black text-sm text-foreground uppercase truncate" title={colaboradorHoraExtraModal.colaborador}>
                  {colaboradorHoraExtraModal.colaborador}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setColaboradorHoraExtraModal(null)}
                className="shrink-0 text-secondary hover:text-foreground transition-colors cursor-pointer text-xs font-bold px-2 py-1"
              >
                FECHAR
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-border/20 bg-surface-hover/40 p-3.5 text-center">
                <p className="text-[10px] font-bold text-secondary uppercase mb-1">Horas Extras</p>
                <p className="text-lg font-black text-foreground">
                  {colaboradorHoraExtraModal.horasExtrasMes.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h
                </p>
              </div>
              <div className="rounded-2xl border border-border/20 bg-surface-hover/40 p-3.5 text-center">
                <p className="text-[10px] font-bold text-secondary uppercase mb-1">Valor Pago</p>
                <p className="text-lg font-black text-primary">{formatMoeda(colaboradorHoraExtraModal.valorTotalHE)}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
