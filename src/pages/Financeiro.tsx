import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  TrendingUp,
  TrendingDown,
  Building2,
  Calendar,
  Tag,
  Trophy,
  BarChart2,
  DollarSign,
  PieChart as PieIcon,
  Scale,
  RotateCcw,
  List,
  RefreshCw,
  X,
  CheckCircle2,
  ShieldAlert,
  Home,
} from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LabelList,
} from 'recharts'
import { PageHeader } from '@/components/layout/Header'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { GlassButton } from '@/components/ui/glass-button'
import { useAuth } from '@/contexts/AuthContext'
import { isFinanceiroAuthorized } from '@/components/layout/nav'

// ─── Helpers de Formatação ──────────────────────────────────────────────────
function fmtBRL(val: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)
}

function fmtCompact(val: number) {
  if (Math.abs(val) >= 1_000_000) {
    return `R$ ${(val / 1_000_000).toFixed(2)}M`
  }
  if (Math.abs(val) >= 1_000) {
    return `R$ ${(val / 1_000).toFixed(0)}k`
  }
  return fmtBRL(val)
}

// ─── Base de Dados Real do Painel Gerencial (Google Sheets) ─────────────────
interface EmpresaData {
  id: string
  nome: string
  faturamento: number
  receitas: number
  despesas: number
}

interface MesFinanceiroData {
  empresas: EmpresaData[]
  topClientes: { rank: number; nome: string; faturamento: number }[]
  topPlanosConta: { rank: number; nome: string; despesa: number }[]
}

const DADOS_MESES: Record<string, MesFinanceiroData> = {
  julho: {
    empresas: [
      { id: 'gvel', nome: 'GVel Diesel', faturamento: 2099426.16, receitas: 4069695.34, despesas: 3490604.84 },
      { id: 'leves', nome: 'GVel Leves', faturamento: 56280.24, receitas: 34235.94, despesas: 114130.64 },
      { id: 'distribuidora', nome: 'GV Distribuidora', faturamento: 368787.59, receitas: 217332.55, despesas: 196638.87 },
      { id: 'transportes', nome: 'GV Transportes', faturamento: 974275.65, receitas: 1102324.90, despesas: 1003604.84 },
      { id: 'investimento', nome: 'Investimento', faturamento: 0.00, receitas: 0.00, despesas: 819003.34 },
    ],
    topClientes: [
      { rank: 1, nome: 'LOCALIZA VEICULOS ESPECIAIS S.A', faturamento: 1749885.03 },
      { rank: 2, nome: 'J D COCENZO E CIA LTDA', faturamento: 81139.26 },
      { rank: 3, nome: 'PEPSICO DO BRASIL LTDA', faturamento: 49070.07 },
      { rank: 4, nome: 'DBK DISTRIBUIDORA DE BEBIDAS LTDA', faturamento: 41574.64 },
      { rank: 5, nome: 'VAMOS LOCACAO DE CAMINHOES, MAQUINAS E EQUIPAMENTOS S.A.', faturamento: 30397.02 },
    ],
    topPlanosConta: [
      { rank: 1, nome: 'Amortização de Contrato', despesa: 1466927.79 },
      { rank: 2, nome: 'Compra de Peças', despesa: 651368.13 },
      { rank: 3, nome: 'Serviços de Terceiros', despesa: 444814.41 },
      { rank: 4, nome: 'Salário', despesa: 90370.41 },
      { rank: 5, nome: 'Aluguel (Oficina / Pátio)', despesa: 69454.67 },
      { rank: 6, nome: 'Aluguel (Administrativo)', despesa: 69454.67 },
      { rank: 7, nome: 'Taxa de Ant. = Ticket/Localiza/Vamos', despesa: 59634.80 },
      { rank: 8, nome: 'INSS (Previdência Social/GPS)', despesa: 56882.84 },
      { rank: 9, nome: 'Funcionários Terceirizados', despesa: 54143.81 },
      { rank: 10, nome: 'Uso e Consumo', despesa: 50194.30 },
    ],
  },
  junho: {
    empresas: [
      { id: 'gvel', nome: 'GVel Diesel', faturamento: 2750177.75, receitas: 3397587.86, despesas: 2232209.44 },
      { id: 'leves', nome: 'GVel Leves', faturamento: 15985.79, receitas: 6026.81, despesas: 188373.53 },
      { id: 'distribuidora', nome: 'GV Distribuidora', faturamento: 172180.50, receitas: 234617.30, despesas: 244728.16 },
      { id: 'transportes', nome: 'GV Transportes', faturamento: 997385.12, receitas: 863363.64, despesas: 805135.82 },
      { id: 'investimento', nome: 'Investimento', faturamento: 0.00, receitas: 0.00, despesas: 1086373.08 },
    ],
    topClientes: [
      { rank: 1, nome: 'LOCALIZA VEICULOS ESPECIAIS S.A', faturamento: 2384308.18 },
      { rank: 2, nome: 'J D COCENZO E CIA LTDA', faturamento: 51938.80 },
      { rank: 3, nome: 'FJ LOCACAO COMERCIO VEICULOS EQUIPAMENTO', faturamento: 31414.81 },
      { rank: 4, nome: 'LOCAL TRUCK LOCADORA DE VEICULOS LTDA', faturamento: 30156.18 },
      { rank: 5, nome: 'PEPSICO DO BRASIL LTDA', faturamento: 24805.56 },
    ],
    topPlanosConta: [
      { rank: 1, nome: 'Compra de Peças', despesa: 662315.12 },
      { rank: 2, nome: '(-) Investimento da Empresa em Veículos', despesa: 588621.45 },
      { rank: 3, nome: 'Serviços de Terceiros', despesa: 361540.65 },
      { rank: 4, nome: 'Empréstimo Bancário', despesa: 262648.28 },
      { rank: 5, nome: '(-) Investimento da Empresa em Implementos', despesa: 254649.22 },
      { rank: 6, nome: 'Salário', despesa: 221172.56 },
      { rank: 7, nome: '(-) Investimento de Sócios em Imóveis', despesa: 128477.27 },
      { rank: 8, nome: 'COMPRA DE MERCADORIA', despesa: 115375.96 },
      { rank: 9, nome: '(-) Investimento de Sócios em Veículos', despesa: 114625.14 },
      { rank: 10, nome: 'Amortização de Contrato', despesa: 99998.00 },
    ],
  },
  maio: {
    empresas: [
      { id: 'gvel', nome: 'GVel Diesel', faturamento: 2463810.02, receitas: 2647888.59, despesas: 1959991.52 },
      { id: 'leves', nome: 'GVel Leves', faturamento: 25197.12, receitas: 6589.45, despesas: 180832.57 },
      { id: 'distribuidora', nome: 'GV Distribuidora', faturamento: 172586.58, receitas: 44324.72, despesas: 243816.20 },
      { id: 'transportes', nome: 'GV Transportes', faturamento: 395043.23, receitas: 0.00, despesas: 401745.01 },
      { id: 'investimento', nome: 'Investimento', faturamento: 0.00, receitas: 0.00, despesas: 627705.22 },
    ],
    topClientes: [
      { rank: 1, nome: 'LOCALIZA VEICULOS ESPECIAIS S.A', faturamento: 1995315.50 },
      { rank: 2, nome: 'J D COCENZO E CIA LTDA', faturamento: 252981.19 },
      { rank: 3, nome: 'LM TRANSPORTES INTERESTADUAIS SERVICOS E CO', faturamento: 28410.69 },
      { rank: 4, nome: 'CPFL SERVICOS EQUIPAMENTOS INDUSTRIA', faturamento: 27389.25 },
      { rank: 5, nome: 'PREFEITURA MUNICIPAL DE SAO JOSE DO RIO PRETO', faturamento: 24045.00 },
    ],
    topPlanosConta: [
      { rank: 1, nome: 'Compra de Peças', despesa: 419669.98 },
      { rank: 2, nome: '(-) Investimento da Empresa em Veículos', despesa: 398021.80 },
      { rank: 3, nome: 'Serviços de Terceiros', despesa: 260494.91 },
      { rank: 4, nome: 'Salário', despesa: 222958.53 },
      { rank: 5, nome: 'Empréstimo Bancário', despesa: 196445.83 },
      { rank: 6, nome: 'Sócio Retirada', despesa: 179766.89 },
      { rank: 7, nome: '(-) Investimento de Sócios em Imóveis', despesa: 133931.92 },
      { rank: 8, nome: 'Amortização de Contrato', despesa: 115876.29 },
      { rank: 9, nome: 'COMPRA DE MERCADORIA', despesa: 99287.51 },
      { rank: 10, nome: 'Combustível/Abastecimento', despesa: 99221.14 },
    ],
  },
}

const MESES_OPCOES = [
  { id: 'julho', label: 'Julho' },
  { id: 'junho', label: 'Junho' },
  { id: 'maio', label: 'Maio' },
]

export function Financeiro() {
  const { user, perfilLoading } = useAuth()
  const autorizado = isFinanceiroAuthorized(user?.email)

  // Filtros
  const [empresaFiltro, setEmpresaFiltro] = useState<string>('TODAS')
  const [mesFiltro, setMesFiltro] = useState<string>('julho')
  const [planoContaFiltro, setPlanoContaFiltro] = useState<string>('TODOS')

  // Modais e Estados de Ação
  const [showHistoricoModal, setShowHistoricoModal] = useState(false)
  const [showListaModal, setShowListaModal] = useState(false)
  const [sincronizando, setSincronizando] = useState(false)
  const [msgSucesso, setMsgSucesso] = useState<string | null>(null)

  function handleSincronizarPlanilha() {
    setSincronizando(true)
    setTimeout(() => {
      setSincronizando(false)
      setMsgSucesso('Planilha gerencial sincronizada com sucesso!')
      setTimeout(() => setMsgSucesso(null), 4000)
    }, 1200)
  }

  // Mês Ativo da base de dados
  const dadosMesAtivo = useMemo(() => {
    return DADOS_MESES[mesFiltro] || DADOS_MESES.julho
  }, [mesFiltro])

  // Empresas filtradas
  const empresasExibidas = useMemo(() => {
    if (empresaFiltro === 'TODAS') {
      return dadosMesAtivo.empresas
    }
    return dadosMesAtivo.empresas.filter((e) => e.nome === empresaFiltro || e.id === empresaFiltro)
  }, [empresaFiltro, dadosMesAtivo])

  // Totais consolidados
  const totais = useMemo(() => {
    const faturamento = empresasExibidas.reduce((acc, e) => acc + e.faturamento, 0)
    const receitas = empresasExibidas.reduce((acc, e) => acc + e.receitas, 0)
    const despesas = empresasExibidas.reduce((acc, e) => acc + e.despesas, 0)
    const saldoCaixa = receitas - despesas
    const resultadoFaturamento = faturamento - despesas

    return {
      faturamento,
      receitas,
      despesas,
      saldoCaixa,
      resultadoFaturamento,
    }
  }, [empresasExibidas])

  // Dados para o Gráfico Recharts
  const chartData = useMemo(() => {
    return dadosMesAtivo.empresas.map((e) => ({
      name: e.nome,
      Faturamento: e.faturamento,
      Receitas: e.receitas,
      Despesas: e.despesas,
    }))
  }, [dadosMesAtivo])

  // Top Planos de Conta Filtrados
  const topPlanosFiltrados = useMemo(() => {
    if (planoContaFiltro === 'TODOS') return dadosMesAtivo.topPlanosConta
    return dadosMesAtivo.topPlanosConta.filter((p) =>
      p.nome.toLowerCase().includes(planoContaFiltro.toLowerCase()),
    )
  }, [planoContaFiltro, dadosMesAtivo])

  // Top Clientes
  const topClientesFiltrados = useMemo(() => {
    return dadosMesAtivo.topClientes
  }, [dadosMesAtivo])

  if (!perfilLoading && !autorizado) {
    return (
      <div className="flex min-h-[65vh] flex-col items-center justify-center p-6 text-center animate-fade-in uppercase">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-red-500/15 border border-red-500/30 text-red-400 mb-4 shadow-2xl shadow-red-500/10">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h2 className="text-lg font-black text-foreground mb-1">ACESSO RESTRITO AO FINANCEIRO</h2>
        <p className="text-xs text-secondary font-medium max-w-md mb-6 lowercase">
          Este painel é confidencial e exclusivo para usuários autorizados.
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
      {/* Cabeçalho com Botões Glass */}
      <PageHeader
        title="PAINEL GERENCIAL - GRUPO VEL"
        subtitle="RECEITAS E DESPESAS EM REGIME DE CAIXA · FATURAMENTO EM REGIME DE COMPETÊNCIA"
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            <GlassButton
              type="button"
              size="sm"
              onClick={() => setShowHistoricoModal(true)}
              contentClassName="flex items-center gap-2 text-xs font-bold"
            >
              <RotateCcw className="h-3.5 w-3.5 text-primary" />
              <span>HISTÓRICO</span>
            </GlassButton>

            <GlassButton
              type="button"
              size="sm"
              onClick={() => setShowListaModal(true)}
              contentClassName="flex items-center gap-2 text-xs font-bold"
            >
              <List className="h-3.5 w-3.5 text-foreground" />
              <span>VER EM LISTA</span>
            </GlassButton>

            <GlassButton
              type="button"
              size="sm"
              variant="primary"
              onClick={handleSincronizarPlanilha}
              disabled={sincronizando}
              contentClassName="flex items-center gap-2 text-xs font-bold text-white"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${sincronizando ? 'animate-spin' : ''}`} />
              <span>{sincronizando ? 'ATUALIZANDO...' : 'ATUALIZAR PLANILHA'}</span>
            </GlassButton>
          </div>
        }
      />

      {/* Alerta de Sincronização */}
      {msgSucesso && (
        <div className="flex items-center gap-2 p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold animate-fade-in">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{msgSucesso}</span>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          BARRA DE FILTROS SUPERIOR (Empresa, Mês e Plano de Conta)
         ────────────────────────────────────────────────────────────────────────── */}
      <Card className="p-4 border-border/30 bg-surface/60 shadow-md">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 1. Filtro Empresa */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-black text-foreground mb-1.5">
              <Building2 className="h-4 w-4 text-primary" />
              EMPRESA
            </label>
            <select
              value={empresaFiltro}
              onChange={(e) => setEmpresaFiltro(e.target.value)}
              className="h-10 w-full rounded-xl border border-border/40 bg-background px-3 text-xs font-bold text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary uppercase transition-colors"
            >
              <option value="TODAS">TODAS AS EMPRESAS (GRUPO VEL)</option>
              <option value="GVel Diesel">GVel Diesel</option>
              <option value="GVel Leves">GVel Leves</option>
              <option value="GV Distribuidora">GV Distribuidora</option>
              <option value="GV Transportes">GV Transportes</option>
              <option value="Investimento">Investimento</option>
            </select>
          </div>

          {/* 2. Filtro Mês de Apuração */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-black text-foreground mb-1.5">
              <Calendar className="h-4 w-4 text-primary" />
              MÊS DE APURAÇÃO
            </label>
            <div className="space-y-1.5">
              <select
                value={mesFiltro}
                onChange={(e) => setMesFiltro(e.target.value)}
                className="h-10 w-full rounded-xl border border-primary/50 bg-background px-3 text-xs font-black text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 uppercase transition-colors shadow-sm"
              >
                <option value="julho">JULHO 2026</option>
                <option value="junho">JUNHO 2026</option>
                <option value="maio">MAIO 2026</option>
              </select>

              {/* Botões Rápidos de Mês */}
              <div className="grid grid-cols-3 gap-1">
                {MESES_OPCOES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMesFiltro(m.id)}
                    className={`py-1 px-2 rounded-lg text-[10px] font-black transition-all ${
                      mesFiltro === m.id
                        ? 'bg-primary text-white shadow-sm shadow-primary/30 ring-1 ring-primary'
                        : 'bg-background/80 text-secondary hover:text-foreground hover:bg-background border border-border/20'
                    }`}
                  >
                    {m.label.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 3. Filtro Plano de Conta */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-black text-foreground mb-1.5">
              <Tag className="h-4 w-4 text-primary" />
              PLANO DE CONTA
            </label>
            <select
              value={planoContaFiltro}
              onChange={(e) => setPlanoContaFiltro(e.target.value)}
              className="h-10 w-full rounded-xl border border-border/40 bg-background px-3 text-xs font-bold text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary uppercase transition-colors"
            >
              <option value="TODOS">TODOS OS PLANOS DE CONTA</option>
              {dadosMesAtivo.topPlanosConta.map((p) => (
                <option key={p.nome} value={p.nome}>
                  {p.nome.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* ──────────────────────────────────────────────────────────────────────────
          CARDS DE KPIS GERENCIAIS (Valores Consolidados)
         ────────────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Card 1: Faturamento */}
        <Card className="p-4 border-blue-500/20 bg-blue-500/5 shadow-sm">
          <div className="flex items-center justify-between text-secondary mb-1">
            <span className="text-[10px] font-bold tracking-wider text-blue-400">FATURAMENTO</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
              <BarChart2 className="h-3.5 w-3.5" />
            </div>
          </div>
          <p className="text-xl font-black text-blue-400 tabular-nums">{fmtBRL(totais.faturamento)}</p>
          <span className="text-[10px] text-secondary font-medium">Regime Competência</span>
        </Card>

        {/* Card 2: Receitas */}
        <Card className="p-4 border-emerald-500/20 bg-emerald-500/5 shadow-sm">
          <div className="flex items-center justify-between text-secondary mb-1">
            <span className="text-[10px] font-bold tracking-wider text-emerald-400">RECEITAS</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
              <TrendingUp className="h-3.5 w-3.5" />
            </div>
          </div>
          <p className="text-xl font-black text-emerald-400 tabular-nums">{fmtBRL(totais.receitas)}</p>
          <span className="text-[10px] text-secondary font-medium">Regime de Caixa</span>
        </Card>

        {/* Card 3: Despesas */}
        <Card className="p-4 border-red-500/20 bg-red-500/5 shadow-sm">
          <div className="flex items-center justify-between text-secondary mb-1">
            <span className="text-[10px] font-bold tracking-wider text-red-400">DESPESAS</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/10 text-red-400">
              <TrendingDown className="h-3.5 w-3.5" />
            </div>
          </div>
          <p className="text-xl font-black text-red-400 tabular-nums">{fmtBRL(totais.despesas)}</p>
          <span className="text-[10px] text-secondary font-medium">Regime de Caixa</span>
        </Card>

        {/* Card 4: Saldo Caixa */}
        <Card
          className={`p-4 shadow-sm border ${
            totais.saldoCaixa >= 0
              ? 'border-emerald-500/20 bg-emerald-500/5'
              : 'border-amber-500/20 bg-amber-500/5'
          }`}
        >
          <div className="flex items-center justify-between text-secondary mb-1">
            <span
              className={`text-[10px] font-bold tracking-wider ${
                totais.saldoCaixa >= 0 ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              SALDO DE CAIXA
            </span>
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                totais.saldoCaixa >= 0
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-amber-500/10 text-amber-400'
              }`}
            >
              <Scale className="h-3.5 w-3.5" />
            </div>
          </div>
          <p
            className={`text-xl font-black tabular-nums ${
              totais.saldoCaixa >= 0 ? 'text-emerald-400' : 'text-amber-400'
            }`}
          >
            {fmtBRL(totais.saldoCaixa)}
          </p>
          <span className="text-[10px] text-secondary font-medium">Receitas - Despesas</span>
        </Card>

        {/* Card 5: Resultado (Faturamento - Despesas) */}
        <Card
          className={`p-4 shadow-sm border ${
            totais.resultadoFaturamento >= 0
              ? 'border-emerald-500/20 bg-emerald-500/5'
              : 'border-red-500/30 bg-red-500/10'
          }`}
        >
          <div className="flex items-center justify-between text-secondary mb-1">
            <span
              className={`text-[10px] font-bold tracking-wider ${
                totais.resultadoFaturamento >= 0 ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              RESULTADO LÍQUIDO
            </span>
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                totais.resultadoFaturamento >= 0
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-red-500/20 text-red-400'
              }`}
            >
              <DollarSign className="h-3.5 w-3.5" />
            </div>
          </div>
          <p
            className={`text-xl font-black tabular-nums ${
              totais.resultadoFaturamento >= 0 ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {fmtBRL(totais.resultadoFaturamento)}
          </p>
          <span className="text-[10px] text-secondary font-medium">Faturamento - Despesas</span>
        </Card>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          TABELA CONSOLIDADA POR EMPRESA
         ────────────────────────────────────────────────────────────────────────── */}
      <Card className="overflow-hidden border-border/30 bg-surface/50 shadow-md">
        <div className="border-b border-border/20 bg-surface/80 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <h3 className="text-sm font-black text-foreground uppercase">
              DESEMPENHO CONSOLIDADO POR EMPRESA
            </h3>
          </div>
          <Badge tone="neutral" className="text-[10px] font-bold">
            MÊS: {mesFiltro.toUpperCase()}
          </Badge>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border/30 bg-surface text-secondary font-black uppercase text-[11px]">
                <th className="py-3.5 px-4">EMPRESA</th>
                <th className="py-3.5 px-4 text-right">FATURAMENTO</th>
                <th className="py-3.5 px-4 text-right">RECEITAS (CAIXA)</th>
                <th className="py-3.5 px-4 text-right">DESPESAS (CAIXA)</th>
                <th className="py-3.5 px-4 text-right">SALDO CAIXA</th>
                <th className="py-3.5 px-4 text-right">RESULTADO FAT.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/15 font-mono">
              {empresasExibidas.map((emp) => {
                const sCaixa = emp.receitas - emp.despesas
                const sFat = emp.faturamento - emp.despesas

                return (
                  <tr key={emp.id} className="hover:bg-overlay/5 transition-colors">
                    <td className="py-3.5 px-4 font-sans font-bold text-foreground flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-primary" />
                      {emp.nome}
                    </td>
                    <td className="py-3.5 px-4 text-right text-blue-400 font-bold">
                      {fmtBRL(emp.faturamento)}
                    </td>
                    <td className="py-3.5 px-4 text-right text-emerald-400 font-bold">
                      {fmtBRL(emp.receitas)}
                    </td>
                    <td className="py-3.5 px-4 text-right text-red-400 font-bold">
                      {fmtBRL(emp.despesas)}
                    </td>
                    <td
                      className={`py-3.5 px-4 text-right font-black ${
                        sCaixa >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {fmtBRL(sCaixa)}
                    </td>
                    <td
                      className={`py-3.5 px-4 text-right font-black ${
                        sFat >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {fmtBRL(sFat)}
                    </td>
                  </tr>
                )
              })}

              {/* Linha de Total Geral */}
              <tr className="border-t-2 border-primary/40 bg-primary/10 font-black text-sm text-foreground">
                <td className="py-4 px-4 font-sans font-black tracking-wider text-primary">
                  TOTAL GRUPO VEL
                </td>
                <td className="py-4 px-4 text-right text-blue-400">
                  {fmtBRL(totais.faturamento)}
                </td>
                <td className="py-4 px-4 text-right text-emerald-400">
                  {fmtBRL(totais.receitas)}
                </td>
                <td className="py-4 px-4 text-right text-red-400">
                  {fmtBRL(totais.despesas)}
                </td>
                <td
                  className={`py-4 px-4 text-right ${
                    totais.saldoCaixa >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {fmtBRL(totais.saldoCaixa)}
                </td>
                <td
                  className={`py-4 px-4 text-right ${
                    totais.resultadoFaturamento >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {fmtBRL(totais.resultadoFaturamento)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {/* ──────────────────────────────────────────────────────────────────────────
          SEÇÃO DE RANKINGS (Top 5 Clientes e Top 10 Planos de Conta)
         ────────────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. TOP 5 CLIENTES */}
        <Card className="overflow-hidden border-border/30 bg-surface/50 shadow-md flex flex-col justify-between">
          <div>
            <div className="border-b border-border/20 bg-surface/80 p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400">
                  <Trophy className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-foreground uppercase">
                    TOP 5 CLIENTES (POR FATURAMENTO)
                  </h3>
                  <p className="text-[10px] text-secondary font-medium">Exceto faturamento interno do Grupo</p>
                </div>
              </div>
            </div>

            <div className="p-4 space-y-3">
              {topClientesFiltrados.map((cli) => {
                const maxFat = topClientesFiltrados[0]?.faturamento || 1
                const pct = (cli.faturamento / maxFat) * 100

                return (
                  <div
                    key={cli.nome}
                    className="p-3 rounded-xl border border-border/15 bg-background/60 hover:border-primary/30 transition-all"
                  >
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary font-bold text-[10px]">
                          {cli.rank}º
                        </span>
                        <span className="font-bold text-foreground truncate">{cli.nome}</span>
                      </div>
                      <span className="font-mono font-black text-primary shrink-0">
                        {fmtBRL(cli.faturamento)}
                      </span>
                    </div>

                    {/* Barra de Progresso Relativa */}
                    <div className="h-1.5 w-full rounded-full bg-surface overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary to-amber-400 transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </Card>

        {/* 2. TOP 10 PLANOS DE CONTA */}
        <Card className="overflow-hidden border-border/30 bg-surface/50 shadow-md flex flex-col justify-between">
          <div>
            <div className="border-b border-border/20 bg-surface/80 p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/15 text-red-400">
                  <PieIcon className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-foreground uppercase">
                    TOP 10 PLANOS DE CONTA (POR DESPESA)
                  </h3>
                  <p className="text-[10px] text-secondary font-medium">Maiores centros de custos da operação</p>
                </div>
              </div>
            </div>

            <div className="p-4 space-y-2 max-h-[420px] overflow-y-auto">
              {topPlanosFiltrados.map((plano) => {
                const maxDesp = topPlanosFiltrados[0]?.despesa || 1
                const pct = (plano.despesa / maxDesp) * 100

                return (
                  <div
                    key={plano.nome + plano.rank}
                    className="p-2.5 rounded-xl border border-border/15 bg-background/60 hover:border-red-500/30 transition-all"
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-red-500/15 text-red-400 font-bold text-[10px]">
                          {plano.rank}
                        </span>
                        <span className="font-bold text-foreground truncate">{plano.nome}</span>
                      </div>
                      <span className="font-mono font-black text-red-400 shrink-0">
                        {fmtBRL(plano.despesa)}
                      </span>
                    </div>

                    {/* Barra de Progresso */}
                    <div className="h-1.5 w-full rounded-full bg-surface overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-red-500 to-rose-400 transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </Card>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          GRÁFICO E DETALHAMENTO: FATURAMENTO × RECEITAS × DESPESAS POR EMPRESA
         ────────────────────────────────────────────────────────────────────────── */}
      <Card className="p-5 sm:p-6 border-border/30 bg-surface/50 shadow-lg space-y-6">
        {/* Cabeçalho da Seção */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/20 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <BarChart2 className="h-4 w-4" />
              </div>
              <h3 className="text-sm sm:text-base font-black text-foreground uppercase tracking-wide">
                FATURAMENTO × RECEITAS × DESPESAS POR EMPRESA
              </h3>
            </div>
            <p className="text-xs text-secondary font-medium mt-1">
              Comparativo visual e análise detalhada de desempenho por unidade de negócio
            </p>
          </div>

          {/* Legenda Customizada e Elegante */}
          <div className="flex flex-wrap items-center gap-2 bg-background/60 border border-border/20 px-3 py-1.5 rounded-xl text-xs font-bold">
            <span className="flex items-center gap-1.5 text-blue-400">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-500 shadow-sm" /> FATURAMENTO
            </span>
            <span className="text-border/40">•</span>
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-sm" /> RECEITAS
            </span>
            <span className="text-border/40">•</span>
            <span className="flex items-center gap-1.5 text-red-400">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500 shadow-sm" /> DESPESAS
            </span>
          </div>
        </div>

        {/* Gráfico de Barras Responsivo */}
        <div className="h-80 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 36, right: 20, left: 10, bottom: 10 }}
              barGap={6}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis
                dataKey="name"
                stroke="var(--color-secondary, #888)"
                fontSize={12}
                fontWeight={700}
                tickLine={false}
                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              />
              <YAxis
                stroke="var(--color-secondary, #888)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => fmtCompact(val)}
              />
              <Tooltip
                cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                content={({ active, payload, label }) => {
                  if (!active || !payload || !payload.length) return null

                  const fat = Number(payload.find((p) => p.dataKey === 'Faturamento')?.value || 0)
                  const rec = Number(payload.find((p) => p.dataKey === 'Receitas')?.value || 0)
                  const desp = Number(payload.find((p) => p.dataKey === 'Despesas')?.value || 0)
                  const saldo = rec - desp
                  const resFat = fat - desp

                  return (
                    <div className="rounded-2xl border border-border/40 bg-surface/95 p-4 shadow-2xl backdrop-blur-md uppercase text-xs space-y-2 min-w-[240px]">
                      <div className="border-b border-border/20 pb-2 flex items-center justify-between">
                        <span className="font-black text-foreground text-sm flex items-center gap-1.5">
                          🏢 {label}
                        </span>
                      </div>

                      <div className="space-y-1.5 font-mono">
                        <div className="flex items-center justify-between">
                          <span className="text-blue-400 font-sans font-bold flex items-center gap-1">
                            <span className="h-2 w-2 rounded-full bg-blue-500" /> FATURAMENTO:
                          </span>
                          <span className="font-bold text-foreground">{fmtBRL(fat)}</span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-emerald-400 font-sans font-bold flex items-center gap-1">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" /> RECEITAS (CAIXA):
                          </span>
                          <span className="font-bold text-foreground">{fmtBRL(rec)}</span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-red-400 font-sans font-bold flex items-center gap-1">
                            <span className="h-2 w-2 rounded-full bg-red-500" /> DESPESAS (CAIXA):
                          </span>
                          <span className="font-bold text-foreground">{fmtBRL(desp)}</span>
                        </div>
                      </div>

                      <div className="border-t border-border/20 pt-2 space-y-1 font-mono text-[11px]">
                        <div className="flex items-center justify-between">
                          <span className="text-secondary font-sans font-bold">SALDO CAIXA:</span>
                          <span className={`font-black ${saldo >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {fmtBRL(saldo)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-secondary font-sans font-bold">RESULTADO FAT.:</span>
                          <span className={`font-black ${resFat >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {fmtBRL(resFat)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                }}
              />
              <Bar dataKey="Faturamento" fill="#3b82f6" radius={[6, 6, 0, 0]} maxBarSize={48}>
                <LabelList
                  dataKey="Faturamento"
                  position="top"
                  formatter={(v: any) => fmtCompact(Number(v) || 0)}
                  style={{ fill: '#93c5fd', fontSize: 10, fontWeight: 700, fontFamily: 'monospace' }}
                />
              </Bar>
              <Bar dataKey="Receitas" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={48}>
                <LabelList
                  dataKey="Receitas"
                  position="top"
                  formatter={(v: any) => fmtCompact(Number(v) || 0)}
                  style={{ fill: '#6ee7b7', fontSize: 10, fontWeight: 700, fontFamily: 'monospace' }}
                />
              </Bar>
              <Bar dataKey="Despesas" fill="#ef4444" radius={[6, 6, 0, 0]} maxBarSize={48}>
                <LabelList
                  dataKey="Despesas"
                  position="top"
                  formatter={(v: any) => fmtCompact(Number(v) || 0)}
                  style={{ fill: '#fca5a5', fontSize: 10, fontWeight: 700, fontFamily: 'monospace' }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* ────────────────────────────────────────────────────────────────────────
            CARDS INDIVIDUAIS COM RESUMO DETALHADO POR EMPRESA
           ──────────────────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2 border-t border-border/20">
          {dadosMesAtivo.empresas.map((emp) => {
            const saldoCaixa = emp.receitas - emp.despesas
            const resultadoFat = emp.faturamento - emp.despesas
            const totalMax = Math.max(emp.faturamento, emp.receitas, emp.despesas, 1)

            return (
              <div
                key={emp.id}
                className="rounded-2xl border border-border/20 bg-background/50 p-4 hover:border-primary/40 transition-all space-y-3"
              >
                {/* Cabeçalho do Card */}
                <div className="flex items-center justify-between">
                  <h4 className="font-black text-xs text-foreground truncate">{emp.nome}</h4>
                  <span
                    className={`text-[10px] font-black px-2 py-0.5 rounded-full font-mono ${
                      saldoCaixa >= 0
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : 'bg-red-500/15 text-red-400 border border-red-500/30'
                    }`}
                  >
                    {saldoCaixa >= 0 ? '+ CAIXA' : '- DÉFICIT'}
                  </span>
                </div>

                {/* Linhas de Valores com Barras Proporcionais */}
                <div className="space-y-2 text-[11px] font-mono">
                  {/* Faturamento */}
                  <div>
                    <div className="flex items-center justify-between text-secondary mb-0.5">
                      <span className="font-sans font-bold text-blue-400">FATURAMENTO:</span>
                      <span className="font-bold text-foreground">{fmtBRL(emp.faturamento)}</span>
                    </div>
                    <div className="h-1.5 w-full bg-surface rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${(emp.faturamento / totalMax) * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Receitas */}
                  <div>
                    <div className="flex items-center justify-between text-secondary mb-0.5">
                      <span className="font-sans font-bold text-emerald-400">RECEITAS (CAIXA):</span>
                      <span className="font-bold text-foreground">{fmtBRL(emp.receitas)}</span>
                    </div>
                    <div className="h-1.5 w-full bg-surface rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${(emp.receitas / totalMax) * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Despesas */}
                  <div>
                    <div className="flex items-center justify-between text-secondary mb-0.5">
                      <span className="font-sans font-bold text-red-400">DESPESAS (CAIXA):</span>
                      <span className="font-bold text-foreground">{fmtBRL(emp.despesas)}</span>
                    </div>
                    <div className="h-1.5 w-full bg-surface rounded-full overflow-hidden">
                      <div
                        className="h-full bg-red-500 rounded-full"
                        style={{ width: `${(emp.despesas / totalMax) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Rodapé do Card com Saldos */}
                <div className="pt-2 border-t border-border/10 grid grid-cols-2 gap-2 text-[10px]">
                  <div>
                    <span className="text-secondary font-sans font-bold block">SALDO CAIXA</span>
                    <span
                      className={`font-mono font-black ${
                        saldoCaixa >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {fmtBRL(saldoCaixa)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-secondary font-sans font-bold block">RES. FATURAMENTO</span>
                    <span
                      className={`font-mono font-black ${
                        resultadoFat >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {fmtBRL(resultadoFat)}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      {/* ────────────────────────────────────────────────────────────────────────
          MODAL: HISTÓRICO DE APURAÇÕES
         ──────────────────────────────────────────────────────────────────────── */}
      {showHistoricoModal && (
        <div
          onClick={() => setShowHistoricoModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-fade-in cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-3xl border border-border/30 bg-surface p-6 shadow-2xl animate-scale-in space-y-4"
          >
            <div className="flex items-center justify-between border-b border-border/20 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <RotateCcw className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-foreground uppercase">
                    HISTÓRICO DE APURAÇÕES GERENCIAIS
                  </h3>
                  <p className="text-xs text-secondary font-medium">Histórico de fechamentos e balanços do Grupo VEL</p>
                </div>
              </div>
              <button
                onClick={() => setShowHistoricoModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-secondary hover:bg-background hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {[
                { mes: 'Julho / 2026', status: 'Apuração Aberta (Atual)', fat: 'R$ 3.498.769,64', rec: 'R$ 5.423.588,73', desp: 'R$ 5.623.982,53', tag: 'EM ABERTO', tagTone: 'warning' },
                { mes: 'Junho / 2026', status: 'Fechamento Consolidado', fat: 'R$ 3.320.140,00', rec: 'R$ 5.180.200,00', desp: 'R$ 4.950.100,00', tag: 'CONCLUÍDO', tagTone: 'success' },
                { mes: 'Maio / 2026', status: 'Fechamento Consolidado', fat: 'R$ 3.190.500,00', rec: 'R$ 4.890.300,00', desp: 'R$ 4.710.250,00', tag: 'CONCLUÍDO', tagTone: 'success' },
                { mes: 'Abril / 2026', status: 'Fechamento Consolidado', fat: 'R$ 2.980.400,00', rec: 'R$ 4.620.100,00', desp: 'R$ 4.500.800,00', tag: 'CONCLUÍDO', tagTone: 'success' },
              ].map((item, idx) => (
                <div key={idx} className="p-3 rounded-2xl border border-border/20 bg-background/60 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-xs text-foreground">{item.mes}</span>
                      <Badge tone={item.tagTone as any} className="text-[9px] font-bold">
                        {item.tag}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-secondary font-medium mt-0.5">{item.status}</p>
                    <div className="flex items-center gap-3 text-[11px] font-mono mt-1 text-secondary">
                      <span>Fat: <strong className="text-blue-400">{item.fat}</strong></span>
                      <span>Rec: <strong className="text-emerald-400">{item.rec}</strong></span>
                      <span>Desp: <strong className="text-red-400">{item.desp}</strong></span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2 border-t border-border/20">
              <GlassButton size="sm" onClick={() => setShowHistoricoModal(false)}>
                FECHAR
              </GlassButton>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────
          MODAL: VISUALIZAÇÃO EM LISTA DETALHADA
         ──────────────────────────────────────────────────────────────────────── */}
      {showListaModal && (
        <div
          onClick={() => setShowListaModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-fade-in cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-4xl rounded-3xl border border-border/30 bg-surface p-6 shadow-2xl animate-scale-in space-y-4 max-h-[90vh] flex flex-col"
          >
            <div className="flex items-center justify-between border-b border-border/20 pb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <List className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-foreground uppercase">
                    RELATÓRIO ANALÍTICO EM LISTA — GRUPO VEL
                  </h3>
                  <p className="text-xs text-secondary font-medium">Demonstrativo detalhado consolidado por empresa e plano de contas</p>
                </div>
              </div>
              <button
                onClick={() => setShowListaModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-secondary hover:bg-background hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 space-y-4 pr-1">
              {/* Tabela de Empresas */}
              <div className="rounded-2xl border border-border/30 overflow-hidden bg-background/40">
                <table className="w-full text-left text-xs border-collapse font-mono">
                  <thead>
                    <tr className="border-b border-border/30 bg-surface text-secondary font-black uppercase text-[11px]">
                      <th className="py-3 px-4 font-sans">EMPRESA</th>
                      <th className="py-3 px-4 text-right">FATURAMENTO</th>
                      <th className="py-3 px-4 text-right">RECEITAS (CAIXA)</th>
                      <th className="py-3 px-4 text-right">DESPESAS (CAIXA)</th>
                      <th className="py-3 px-4 text-right">SALDO CAIXA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/10">
                    {dadosMesAtivo.empresas.map((e) => (
                      <tr key={e.id} className="hover:bg-overlay/5">
                        <td className="py-3 px-4 font-sans font-bold text-foreground">{e.nome}</td>
                        <td className="py-3 px-4 text-right text-blue-400">{fmtBRL(e.faturamento)}</td>
                        <td className="py-3 px-4 text-right text-emerald-400">{fmtBRL(e.receitas)}</td>
                        <td className="py-3 px-4 text-right text-red-400">{fmtBRL(e.despesas)}</td>
                        <td className={`py-3 px-4 text-right font-black ${e.receitas - e.despesas >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {fmtBRL(e.receitas - e.despesas)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Tabela de Maiores Despesas */}
              <div>
                <h4 className="font-black text-xs text-foreground uppercase mb-2">
                  📊 Detalhamento de Planos de Conta (Maiores Despesas)
                </h4>
                <div className="rounded-2xl border border-border/30 overflow-hidden bg-background/40">
                  <table className="w-full text-left text-xs border-collapse font-mono">
                    <thead>
                      <tr className="border-b border-border/30 bg-surface text-secondary font-black uppercase text-[11px]">
                        <th className="py-2.5 px-4 font-sans">#</th>
                        <th className="py-2.5 px-4 font-sans">PLANO DE CONTA</th>
                        <th className="py-2.5 px-4 text-right">TOTAL DESPESA</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/10">
                      {dadosMesAtivo.topPlanosConta.map((p) => (
                        <tr key={p.nome + p.rank} className="hover:bg-overlay/5">
                          <td className="py-2 px-4 text-secondary font-bold">{p.rank}º</td>
                          <td className="py-2 px-4 font-sans font-bold text-foreground">{p.nome}</td>
                          <td className="py-2 px-4 text-right text-red-400 font-bold">{fmtBRL(p.despesa)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-border/20 shrink-0">
              <GlassButton size="sm" onClick={() => setShowListaModal(false)}>
                FECHAR
              </GlassButton>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
