import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
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
  X,
  CheckCircle2,
  ShieldAlert,
  Home,
  LayoutDashboard,
  Wallet,
  ArrowUpCircle,
  ArrowDownCircle,
  Activity,
  Plus,
  Trash2,
  Loader2,
  AlertTriangle,
  Users,
  Truck,
  CreditCard,
  Upload,
} from 'lucide-react'
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
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
import { isFinanceiroAuthorized, isModuloAuthorized } from '@/components/layout/nav'
import { useClientes } from '@/hooks/useClientes'
import {
  useFluxoCaixaLancamentos,
  criarLancamentoFluxoCaixa,
  excluirLancamentoFluxoCaixa,
} from '@/hooks/useFluxoCaixaLancamentos'
import { useEmpresasDivisoesOverrides, importarDivisoesVariosMeses } from '@/hooks/usePainelGerencialDivisoes'
import { importarPainelGerencialExcel } from '@/lib/importarPainelGerencialExcel'

// ─── Helpers de Formatação ──────────────────────────────────────────────────
function fmtBRL(val: number) {
  const formatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)
  return formatted.replace(/\s+/g, '\u00A0')
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

const ORDEM_MESES = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto']
// Saldo de caixa apurado e fechado até junho/2026 — valor congelado, não recalculado.
// A partir de julho/2026 o saldo passa a se movimentar de fato, somando as
// receitas - despesas reais de cada mês em cima dessa base.
const SALDO_CAIXA_BASE_JUNHO = -350000.0

function calcularSaldoCaixa(
  mesFiltroAtual: string,
  empresaFiltroAtual: string,
  dadosMeses: Record<string, MesFinanceiroData>,
  empresasExcluidas?: Set<string>,
): number {
  const mesAlvo = mesFiltroAtual === 'todos' ? 'agosto' : mesFiltroAtual
  const idxMes = ORDEM_MESES.indexOf(mesAlvo)
  const idxJulho = ORDEM_MESES.indexOf('julho')
  if (idxMes < 0 || idxMes < idxJulho) return SALDO_CAIXA_BASE_JUNHO

  let saldo = SALDO_CAIXA_BASE_JUNHO
  for (let i = idxJulho; i <= idxMes; i++) {
    const dataMes = dadosMeses[ORDEM_MESES[i]]
    if (!dataMes) continue
    let empresas =
      empresaFiltroAtual === 'TODAS'
        ? dataMes.empresas
        : dataMes.empresas.filter((e) => e.nome === empresaFiltroAtual || e.id === empresaFiltroAtual)
    if (empresasExcluidas && empresasExcluidas.size > 0) {
      empresas = empresas.filter((e) => !empresasExcluidas.has(e.id))
    }
    const receitas = empresas.reduce((acc, e) => acc + e.receitas, 0)
    const despesas = empresas.reduce((acc, e) => acc + e.despesas, 0)
    saldo += receitas - despesas
  }
  return saldo
}

const DADOS_MESES: Record<string, MesFinanceiroData> = {
  agosto: {
    empresas: [
      { id: 'gvel', nome: 'GVel Diesel', faturamento: 2881678.02, receitas: 3149933.71, despesas: 2456074.97 },
      { id: 'leves', nome: 'GVel Leves', faturamento: 243347.53, receitas: 15581.48, despesas: 227307.84 },
      { id: 'distribuidora', nome: 'GV Distribuidora', faturamento: 227018.14, receitas: 423737.42, despesas: 234748.13 },
      { id: 'transportes', nome: 'GV Transportes', faturamento: 969902.50, receitas: 927383.70, despesas: 1065922.29 },
      { id: 'investimento', nome: 'Investimento', faturamento: 0.00, receitas: 0.00, despesas: 675496.49 },
    ],
    topClientes: [
      { rank: 1, nome: 'LOCALIZA VEICULOS ESPECIAIS S.A', faturamento: 2412089.43 },
      { rank: 2, nome: 'Contrato Mensal Rodando', faturamento: 160000.00 },
      { rank: 3, nome: 'VAMOS LOCACAO DE CAMINHOES, MAQUINAS E EQUIPAMENTOS S.A.', faturamento: 132074.84 },
      { rank: 4, nome: 'GDT0I02', faturamento: 130159.16 },
      { rank: 5, nome: 'CUL2E24', faturamento: 114920.68 },
    ],
    topPlanosConta: [
      { rank: 1, nome: 'Compra de Peças', despesa: 758784.64 },
      { rank: 2, nome: 'Serviços de Terceiros', despesa: 487105.55 },
      { rank: 3, nome: '(-) Investimento da Empresa em Veículos', despesa: 377068.22 },
      { rank: 4, nome: 'Combustível', despesa: 353170.18 },
      { rank: 5, nome: 'Aluguel - conjunto', despesa: 210000.00 },
      { rank: 6, nome: 'Estorno', despesa: 190000.00 },
      { rank: 7, nome: 'COMPRA DE MERCADORIA', despesa: 165713.53 },
      { rank: 8, nome: 'Amortização de Contrato', despesa: 160105.08 },
      { rank: 9, nome: 'Salário', despesa: 137261.68 },
      { rank: 10, nome: '(-) Investimento de Sócios em Imóveis', despesa: 115506.44 },
    ],
  },
  julho: {
    empresas: [
      { id: 'gvel', nome: 'GVel Diesel', faturamento: 2289426.16, receitas: 4266448.55, despesas: 3490604.84 },
      { id: 'leves', nome: 'GVel Leves', faturamento: 56280.24, receitas: 34235.94, despesas: 114130.64 },
      { id: 'distribuidora', nome: 'GV Distribuidora', faturamento: 368787.59, receitas: 217332.55, despesas: 196638.87 },
      { id: 'transportes', nome: 'GV Transportes', faturamento: 1357219.84, receitas: 1485269.09, despesas: 1003604.84 },
      { id: 'investimento', nome: 'Investimento', faturamento: 0.00, receitas: 0.00, despesas: 1019003.34 },
    ],
    topClientes: [
      { rank: 1, nome: 'LOCALIZA VEICULOS ESPECIAIS S.A', faturamento: 1749885.03 },
      { rank: 2, nome: 'J D COCENZO E CIA LTDA', faturamento: 81139.26 },
      { rank: 3, nome: 'PEPSICO DO BRASIL LTDA', faturamento: 49070.07 },
      { rank: 4, nome: 'DBK DISTRIBUIDORA DE BEBIDAS LTDA', faturamento: 41574.64 },
      { rank: 5, nome: 'VAMOS LOCACAO DE CAMINHOES, MAQUINAS E EQUIPAMENTOS S.A.', faturamento: 36197.32 },
    ],
    topPlanosConta: [
      { rank: 1, nome: 'Amortização de Contrato', despesa: 1466927.79 },
      { rank: 2, nome: 'Compra de Peças', despesa: 651368.13 },
      { rank: 3, nome: 'Serviços de Terceiros', despesa: 444814.41 },
      { rank: 4, nome: 'Salário', despesa: 90370.41 },
      { rank: 5, nome: 'Aluguel', despesa: 69454.67 },
      { rank: 6, nome: 'Taxa de Ant.= Ticket/Localiza/Vamos', despesa: 59634.80 },
      { rank: 7, nome: 'INSS (Previdência Social/GPS)', despesa: 56882.84 },
      { rank: 8, nome: 'Funcionários Terceirizados', despesa: 54143.81 },
      { rank: 9, nome: 'Uso e Consumo', despesa: 50194.30 },
      { rank: 10, nome: 'Adiantamento/ Vale', despesa: 37007.54 },
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
  abril: {
    empresas: [
      { id: 'gvel', nome: 'GVel Diesel', faturamento: 707764.10, receitas: 707764.10, despesas: 300000.00 },
      { id: 'leves', nome: 'GVel Leves', faturamento: 0.00, receitas: 0.00, despesas: 0.00 },
      { id: 'distribuidora', nome: 'GV Distribuidora', faturamento: 0.00, receitas: 0.00, despesas: 0.00 },
      { id: 'transportes', nome: 'GV Transportes', faturamento: 513760.35, receitas: 513760.35, despesas: 480000.00 },
      { id: 'investimento', nome: 'Investimento', faturamento: 0.00, receitas: 0.00, despesas: 300000.00 },
    ],
    topClientes: [
      { rank: 1, nome: 'LOCALIZA VEICULOS ESPECIAIS S.A', faturamento: 565000.00 },
      { rank: 2, nome: 'J D COCENZO E CIA LTDA', faturamento: 54000.00 },
      { rank: 3, nome: 'PEPSICO DO BRASIL LTDA', faturamento: 25000.00 },
      { rank: 4, nome: 'VAMOS LOCACAO DE CAMINHOES, MAQUINAS E EQUIPAMENTOS S.A.', faturamento: 18000.00 },
      { rank: 5, nome: 'FJ LOCACAO COMERCIO VEICULOS EQUIPAMENTO', faturamento: 15000.00 },
    ],
    topPlanosConta: [
      { rank: 1, nome: '(-) Investimento da Empresa em Veículos', despesa: 300000.00 },
      { rank: 2, nome: 'Compra de Peças', despesa: 280000.00 },
      { rank: 3, nome: 'Serviços de Terceiros', despesa: 190000.00 },
      { rank: 4, nome: 'Salário', despesa: 160000.00 },
      { rank: 5, nome: 'Amortização de Contrato', despesa: 95000.00 },
      { rank: 6, nome: 'Combustível/Abastecimento', despesa: 80000.00 },
      { rank: 7, nome: 'COMPRA DE MERCADORIA', despesa: 65000.00 },
      { rank: 8, nome: 'Aluguel', despesa: 60000.00 },
      { rank: 9, nome: 'Taxa de Ant.= Ticket/Localiza/Vamos', despesa: 40000.00 },
      { rank: 10, nome: 'INSS (Previdência Social/GPS)', despesa: 40000.00 },
    ],
  },
  marco: {
    empresas: [
      { id: 'gvel', nome: 'GVel Diesel', faturamento: 1002818.46, receitas: 1000000.00, despesas: 250000.00 },
      { id: 'leves', nome: 'GVel Leves', faturamento: 0.00, receitas: 0.00, despesas: 0.00 },
      { id: 'distribuidora', nome: 'GV Distribuidora', faturamento: 0.00, receitas: 0.00, despesas: 0.00 },
      { id: 'transportes', nome: 'GV Transportes', faturamento: 105972.64, receitas: 105972.64, despesas: 89000.00 },
      { id: 'investimento', nome: 'Investimento', faturamento: 0.00, receitas: 0.00, despesas: 250000.00 },
    ],
    topClientes: [
      { rank: 1, nome: 'LOCALIZA VEICULOS ESPECIAIS S.A', faturamento: 802000.00 },
      { rank: 2, nome: 'J D COCENZO E CIA LTDA', faturamento: 78000.00 },
      { rank: 3, nome: 'PEPSICO DO BRASIL LTDA', faturamento: 32000.00 },
      { rank: 4, nome: 'VAMOS LOCACAO DE CAMINHOES, MAQUINAS E EQUIPAMENTOS S.A.', faturamento: 24000.00 },
      { rank: 5, nome: 'FJ LOCACAO COMERCIO VEICULOS EQUIPAMENTO', faturamento: 19000.00 },
    ],
    topPlanosConta: [
      { rank: 1, nome: '(-) Investimento da Empresa em Veículos', despesa: 250000.00 },
      { rank: 2, nome: 'Compra de Peças', despesa: 190000.00 },
      { rank: 3, nome: 'Serviços de Terceiros', despesa: 120000.00 },
      { rank: 4, nome: 'Salário', despesa: 110000.00 },
      { rank: 5, nome: 'Amortização de Contrato', despesa: 60000.00 },
      { rank: 6, nome: 'Aluguel', despesa: 50000.00 },
      { rank: 7, nome: 'COMPRA DE MERCADORIA', despesa: 45000.00 },
      { rank: 8, nome: 'Combustível/Abastecimento', despesa: 35000.00 },
      { rank: 9, nome: 'INSS (Previdência Social/GPS)', despesa: 30000.00 },
      { rank: 10, nome: 'Uso e Consumo', despesa: 25000.00 },
    ],
  },
  fevereiro: {
    empresas: [
      { id: 'gvel', nome: 'GVel Diesel', faturamento: 1871920.91, receitas: 1850000.00, despesas: 1000000.00 },
      { id: 'leves', nome: 'GVel Leves', faturamento: 0.00, receitas: 0.00, despesas: 0.00 },
      { id: 'distribuidora', nome: 'GV Distribuidora', faturamento: 0.00, receitas: 0.00, despesas: 0.00 },
      { id: 'transportes', nome: 'GV Transportes', faturamento: 202685.16, receitas: 202685.16, despesas: 169000.00 },
      { id: 'investimento', nome: 'Investimento', faturamento: 0.00, receitas: 0.00, despesas: 500000.00 },
    ],
    topClientes: [
      { rank: 1, nome: 'LOCALIZA VEICULOS ESPECIAIS S.A', faturamento: 1495800.00 },
      { rank: 2, nome: 'J D COCENZO E CIA LTDA', faturamento: 145000.00 },
      { rank: 3, nome: 'PEPSICO DO BRASIL LTDA', faturamento: 58000.00 },
      { rank: 4, nome: 'VAMOS LOCACAO DE CAMINHOES, MAQUINAS E EQUIPAMENTOS S.A.', faturamento: 42000.00 },
      { rank: 5, nome: 'FJ LOCACAO COMERCIO VEICULOS EQUIPAMENTO', faturamento: 36000.00 },
    ],
    topPlanosConta: [
      { rank: 1, nome: '(-) Investimento da Empresa em Veículos', despesa: 500000.00 },
      { rank: 2, nome: 'Compra de Peças', despesa: 420000.00 },
      { rank: 3, nome: 'Serviços de Terceiros', despesa: 250000.00 },
      { rank: 4, nome: 'Salário', despesa: 220000.00 },
      { rank: 5, nome: 'Empréstimo Bancário', despesa: 180000.00 },
      { rank: 6, nome: 'Amortização de Contrato', despesa: 110000.00 },
      { rank: 7, nome: 'COMPRA DE MERCADORIA', despesa: 95000.00 },
      { rank: 8, nome: 'Aluguel', despesa: 70000.00 },
      { rank: 9, nome: 'Combustível/Abastecimento', despesa: 65000.00 },
      { rank: 10, nome: 'INSS (Previdência Social/GPS)', despesa: 58000.00 },
    ],
  },
  janeiro: {
    empresas: [
      { id: 'gvel', nome: 'GVel Diesel', faturamento: 6426396.31, receitas: 6250000.00, despesas: 3500000.00 },
      { id: 'leves', nome: 'GVel Leves', faturamento: 0.00, receitas: 0.00, despesas: 0.00 },
      { id: 'distribuidora', nome: 'GV Distribuidora', faturamento: 0.00, receitas: 0.00, despesas: 0.00 },
      { id: 'transportes', nome: 'GV Transportes', faturamento: 169277.00, receitas: 169277.00, despesas: 160000.00 },
      { id: 'investimento', nome: 'Investimento', faturamento: 0.00, receitas: 0.00, despesas: 2500000.00 },
    ],
    topClientes: [
      { rank: 1, nome: 'LOCALIZA VEICULOS ESPECIAIS S.A', faturamento: 5125890.15 },
      { rank: 2, nome: 'J D COCENZO E CIA LTDA', faturamento: 482500.00 },
      { rank: 3, nome: 'PEPSICO DO BRASIL LTDA', faturamento: 185000.00 },
      { rank: 4, nome: 'VAMOS LOCACAO DE CAMINHOES, MAQUINAS E EQUIPAMENTOS S.A.', faturamento: 142000.00 },
      { rank: 5, nome: 'FJ LOCACAO COMERCIO VEICULOS EQUIPAMENTO', faturamento: 118000.00 },
    ],
    topPlanosConta: [
      { rank: 1, nome: '(-) Investimento em Veículos e Implementos', despesa: 2500000.00 },
      { rank: 2, nome: 'Compra de Peças', despesa: 1450000.00 },
      { rank: 3, nome: 'Serviços de Terceiros', despesa: 820000.00 },
      { rank: 4, nome: 'Salário', despesa: 380000.00 },
      { rank: 5, nome: 'Amortização de Contrato', despesa: 310000.00 },
      { rank: 6, nome: 'Empréstimo Bancário', despesa: 250000.00 },
      { rank: 7, nome: 'COMPRA DE MERCADORIA', despesa: 120000.00 },
      { rank: 8, nome: 'Combustível/Abastecimento', despesa: 95000.00 },
      { rank: 9, nome: 'Aluguel', despesa: 70000.00 },
      { rank: 10, nome: 'INSS (Previdência Social/GPS)', despesa: 65000.00 },
    ],
  },
}

type AbaFinanceiro = 'visao-geral' | 'fluxo-caixa'
const ABAS_VALIDAS: AbaFinanceiro[] = ['visao-geral', 'fluxo-caixa']

const MESES_OPCOES = [
  { id: 'todos', label: 'Todos os Meses (Janeiro a Agosto / Consolidado)' },
  { id: 'agosto', label: 'Agosto' },
  { id: 'julho', label: 'Julho' },
  { id: 'junho', label: 'Junho' },
  { id: 'maio', label: 'Maio' },
  { id: 'abril', label: 'Abril' },
  { id: 'marco', label: 'Março' },
  { id: 'fevereiro', label: 'Fevereiro' },
  { id: 'janeiro', label: 'Janeiro' },
]

// Painel "Visão Geral" abaixo é conteúdo fixo (planilha importada uma vez,
// não vem do banco) com o histórico financeiro real das divisões internas
// da própria GVEL — não faz sentido pra nenhuma outra empresa da plataforma,
// então fica restrito a essa empresa mesmo com permissão de módulo liberada.
const GVEL_COMPANY_ID = '0923c894-85ca-45c1-ba1b-3124d19b4d65'

const FORMAS_PAGAMENTO_OPCOES = [
  'PIX', 'BOLETO', 'BOLETO ITAU', 'NF E BOLETO', 'MENSAL', 'ANUAL', 'CORTESIA', 'DESC PAGAMENTO',
]
const STATUS_PAGAMENTO_OPCOES = [
  'PENDENTE', 'PAGO', 'COBRADO', 'CANCELADO', 'ISENTO', 'ABATER', 'RETIRAR', 'SOMANDO', 'TROCAR AP', 'ZEROU',
]

export function Financeiro() {
  const { user, perfil, perfilLoading, empresa } = useAuth()
  const userRef = perfil || { email: user?.email }
  const autorizado = isFinanceiroAuthorized(userRef)
  const podeVisaoGeral = isModuloAuthorized(userRef, 'financeiro_visao_geral') && empresa?.id === GVEL_COMPANY_ID
  const podeFluxoCaixa = isModuloAuthorized(userRef, 'financeiro_fluxo_caixa')
  const permissaoPorAba: Record<AbaFinanceiro, boolean> = {
    'visao-geral': podeVisaoGeral,
    'fluxo-caixa': podeFluxoCaixa,
  }

  // Abas
  const [searchParams, setSearchParams] = useSearchParams()
  const abaParam = searchParams.get('aba')
  const abaPadrao: AbaFinanceiro = ABAS_VALIDAS.find((a) => permissaoPorAba[a]) || 'visao-geral'
  const [abaAtiva, setAbaAtivaState] = useState<AbaFinanceiro>(() =>
    abaParam && ABAS_VALIDAS.includes(abaParam as AbaFinanceiro) ? (abaParam as AbaFinanceiro) : abaPadrao,
  )

  useEffect(() => {
    if (abaParam && ABAS_VALIDAS.includes(abaParam as AbaFinanceiro)) {
      setAbaAtivaState(abaParam as AbaFinanceiro)
    } else if (!abaParam) {
      setAbaAtivaState(abaPadrao)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abaParam])

  // Se o usuário não tem acesso à aba que está ativa (ex: perdeu a permissão,
  // ou entrou direto pela URL com ?aba=fluxo-caixa sem ter liberação), pula
  // para a primeira aba que ele realmente pode ver.
  useEffect(() => {
    if (perfilLoading) return
    if (!permissaoPorAba[abaAtiva]) {
      const primeiraPermitida = ABAS_VALIDAS.find((a) => permissaoPorAba[a])
      if (primeiraPermitida) setAbaAtiva(primeiraPermitida)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfilLoading, podeVisaoGeral, podeFluxoCaixa, abaAtiva])

  function setAbaAtiva(nova: AbaFinanceiro) {
    setAbaAtivaState(nova)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (nova === 'visao-geral') {
        next.delete('aba')
      } else {
        next.set('aba', nova)
      }
      return next
    })
  }

  // Filtros
  const [empresaFiltro, setEmpresaFiltro] = useState<string>('TODAS')
  const [mesFiltro, setMesFiltro] = useState<string>('todos')
  const [planoContaFiltro, setPlanoContaFiltro] = useState<string>('TODOS')
  const [empresasOcultasTabela, setEmpresasOcultasTabela] = useState<Set<string>>(new Set())

  // Dados das divisões (faturamento/receitas/despesas) importados do Excel,
  // por mês — sobrescrevem DADOS_MESES quando existirem pra aquele mês. Ver
  // src/hooks/usePainelGerencialDivisoes.ts.
  const { overrides: divisoesOverrides, refetch: refetchDivisoesOverrides } = useEmpresasDivisoesOverrides()
  const dadosMesesComOverrides = useMemo(() => {
    const merged: Record<string, MesFinanceiroData> = {}
    for (const mes of Object.keys(DADOS_MESES)) {
      merged[mes] = {
        ...DADOS_MESES[mes],
        empresas: divisoesOverrides[mes] ?? DADOS_MESES[mes].empresas,
      }
    }
    return merged
  }, [divisoesOverrides])

  const [importandoPainel, setImportandoPainel] = useState(false)
  const [avisosImportacaoPainel, setAvisosImportacaoPainel] = useState<string[]>([])
  const [sucessoImportacaoPainel, setSucessoImportacaoPainel] = useState<string | null>(null)
  const importPainelInputRef = useRef<HTMLInputElement>(null)

  async function handleImportarPainelExcel(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setImportandoPainel(true)
    setAvisosImportacaoPainel([])
    setSucessoImportacaoPainel(null)
    try {
      const { porMes, avisos } = await importarPainelGerencialExcel(file)
      const meses = Object.keys(porMes)
      if (meses.length === 0) {
        setAvisosImportacaoPainel(avisos.length ? avisos : ['Nenhuma linha reconhecida na planilha.'])
        return
      }
      await importarDivisoesVariosMeses(porMes)
      await refetchDivisoesOverrides()
      setAvisosImportacaoPainel(avisos)
      const totalDivisoes = meses.reduce((acc, m) => acc + porMes[m].length, 0)
      const rotulosMeses = meses
        .map((m) => MESES_OPCOES.find((opt) => opt.id === m)?.label ?? m)
        .join(', ')
      setSucessoImportacaoPainel(`${totalDivisoes} divisõe(s) atualizada(s) — ${rotulosMeses}.`)
    } catch (err) {
      setAvisosImportacaoPainel([err instanceof Error ? err.message : 'Não foi possível importar o arquivo.'])
    } finally {
      setImportandoPainel(false)
    }
  }

  // Modais e Estados de Ação
  const [showHistoricoModal, setShowHistoricoModal] = useState(false)
  const [showListaModal, setShowListaModal] = useState(false)

  // Mês Ativo da base de dados (ou consolidação de todos os meses)
  const dadosMesAtivo = useMemo(() => {
    if (mesFiltro === 'todos') {
      const listaMeses = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto']
      const empresasIds = ['gvel', 'leves', 'distribuidora', 'transportes', 'investimento']
      const empresas = empresasIds.map((id) => {
        const nome =
          id === 'gvel'
            ? 'GVel Diesel'
            : id === 'leves'
            ? 'GVel Leves'
            : id === 'distribuidora'
            ? 'GV Distribuidora'
            : id === 'transportes'
            ? 'GV Transportes'
            : 'Investimento'

        const faturamento = listaMeses.reduce((acc, m) => {
          const emp = dadosMesesComOverrides[m]?.empresas.find((e) => e.id === id)
          return acc + (emp?.faturamento || 0)
        }, 0)

        const receitas = listaMeses.reduce((acc, m) => {
          const emp = dadosMesesComOverrides[m]?.empresas.find((e) => e.id === id)
          return acc + (emp?.receitas || 0)
        }, 0)

        const despesas = listaMeses.reduce((acc, m) => {
          const emp = dadosMesesComOverrides[m]?.empresas.find((e) => e.id === id)
          return acc + (emp?.despesas || 0)
        }, 0)

        return { id, nome, faturamento, receitas, despesas }
      })

      // Consolidação de Top Clientes
      const mapClientes: Record<string, number> = {}
      listaMeses.forEach((m) => {
        DADOS_MESES[m]?.topClientes.forEach((cli) => {
          mapClientes[cli.nome] = (mapClientes[cli.nome] || 0) + cli.faturamento
        })
      })
      const topClientes = Object.entries(mapClientes)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([nome, faturamento], idx) => ({ rank: idx + 1, nome, faturamento }))

      // Consolidação de Top Planos de Contas
      const mapPlanos: Record<string, number> = {}
      listaMeses.forEach((m) => {
        DADOS_MESES[m]?.topPlanosConta.forEach((p) => {
          mapPlanos[p.nome] = (mapPlanos[p.nome] || 0) + p.despesa
        })
      })
      const topPlanosConta = Object.entries(mapPlanos)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([nome, despesa], idx) => ({ rank: idx + 1, nome, despesa }))

      return { empresas, topClientes, topPlanosConta }
    }

    return dadosMesesComOverrides[mesFiltro] || dadosMesesComOverrides.agosto
  }, [mesFiltro, dadosMesesComOverrides])

  // Empresas filtradas
  const empresasExibidas = useMemo(() => {
    if (empresaFiltro === 'TODAS') {
      return dadosMesAtivo.empresas
    }
    return dadosMesAtivo.empresas.filter((e) => e.nome === empresaFiltro || e.id === empresaFiltro)
  }, [empresaFiltro, dadosMesAtivo])

  // Empresas com checkbox marcado na tabela "Desempenho Consolidado" ficam de
  // fora daqui — a ocultação de uma empresa (ex.: Investimento) precisa refletir
  // em toda a página, não só na própria tabela, senão os cards do topo (Saldo de
  // Caixa, Resultado Líquido etc.) continuam somando um valor que a tela já não
  // mostra mais em lugar nenhum.
  const empresasTabela = useMemo(
    () => empresasExibidas.filter((e) => !empresasOcultasTabela.has(e.id)),
    [empresasExibidas, empresasOcultasTabela],
  )

  function alternarEmpresaTabela(id: string) {
    setEmpresasOcultasTabela((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Totais consolidados — já excluem as empresas ocultadas pelos checkboxes.
  const totais = useMemo(() => {
    const faturamento = empresasTabela.reduce((acc, e) => acc + e.faturamento, 0)
    const receitas = empresasTabela.reduce((acc, e) => acc + e.receitas, 0)
    const despesas = empresasTabela.reduce((acc, e) => acc + e.despesas, 0)
    const saldoCaixa = calcularSaldoCaixa(mesFiltro, empresaFiltro, dadosMesesComOverrides, empresasOcultasTabela)
    const resultadoFaturamento = faturamento - despesas

    return {
      faturamento,
      receitas,
      despesas,
      saldoCaixa,
      resultadoFaturamento,
    }
  }, [empresasTabela, mesFiltro, empresaFiltro, empresasOcultasTabela, dadosMesesComOverrides])

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

  // Comparativo Mês a Mês (Evolutivo)
  const dadosComparativoMeses = useMemo(() => {
    const meses = [
      { id: 'janeiro', label: 'JAN 2026' },
      { id: 'fevereiro', label: 'FEV 2026' },
      { id: 'marco', label: 'MAR 2026' },
      { id: 'abril', label: 'ABR 2026' },
      { id: 'maio', label: 'MAI 2026' },
      { id: 'junho', label: 'JUN 2026' },
      { id: 'julho', label: 'JUL 2026' },
      { id: 'agosto', label: 'AGO 2026' },
    ]

    return meses.map((m) => {
      const dataMes = dadosMesesComOverrides[m.id] || dadosMesesComOverrides.agosto
      const empresas =
        empresaFiltro === 'TODAS'
          ? dataMes.empresas
          : dataMes.empresas.filter((e) => e.nome === empresaFiltro || e.id === empresaFiltro)

      const faturamento = empresas.reduce((acc, e) => acc + e.faturamento, 0)
      const receitas = empresas.reduce((acc, e) => acc + e.receitas, 0)
      const despesas = empresas.reduce((acc, e) => acc + e.despesas, 0)
      const saldoCaixa = receitas - despesas
      const resFat = faturamento - despesas

      return {
        mes: m.label,
        id: m.id,
        Faturamento: faturamento,
        Receitas: receitas,
        Despesas: despesas,
        saldoCaixa,
        resFat,
      }
    })
  }, [empresaFiltro, dadosMesesComOverrides])

  // Fluxo de Caixa: lançamentos reais (entradas e saídas) persistidos no Supabase
  const { lancamentos, loading: carregandoLancamentos, error: erroLancamentos } = useFluxoCaixaLancamentos()

  // Campos extras (cliente, veículo, vencimento, forma/status de pagamento) —
  // só aparecem pras empresas com esse flag marcado (ver companies.financeiro_campos_estendidos).
  // A GVEL fica com o formulário exatamente como sempre foi.
  const camposEstendidos = empresa?.financeiro_campos_estendidos ?? false
  const { clientes } = useClientes()

  const [novoLancamento, setNovoLancamento] = useState({
    data: new Date().toISOString().slice(0, 10),
    movimentacao: 'entrada' as 'entrada' | 'saida',
    descricao: '',
    valor: '',
    observacao: '',
    clienteId: '',
    quantidadeVeiculos: '',
    dataVencimento: '',
    formaPagamento: '',
    statusPagamento: 'PENDENTE',
  })
  const [formaPagamentoOutro, setFormaPagamentoOutro] = useState(false)
  const [statusPagamentoOutro, setStatusPagamentoOutro] = useState(false)
  const [visaoGraficoFluxoCaixa, setVisaoGraficoFluxoCaixa] = useState<'diario' | 'mensal'>('diario')
  const [salvandoLancamento, setSalvandoLancamento] = useState(false)
  const [erroFormLancamento, setErroFormLancamento] = useState<string | null>(null)
  const [excluindoLancamentoId, setExcluindoLancamentoId] = useState<string | null>(null)

  async function handleAdicionarLancamento(e: React.FormEvent) {
    e.preventDefault()
    setErroFormLancamento(null)

    const valorNumerico = Number(novoLancamento.valor.replace(',', '.'))
    if (!novoLancamento.data || !novoLancamento.descricao.trim() || !valorNumerico || valorNumerico <= 0) {
      setErroFormLancamento('Preencha data, descrição e um valor válido para lançar.')
      return
    }

    setSalvandoLancamento(true)
    try {
      await criarLancamentoFluxoCaixa({
        data: novoLancamento.data,
        movimentacao: novoLancamento.movimentacao,
        descricao: novoLancamento.descricao.trim().toUpperCase(),
        valor: valorNumerico,
        observacao: novoLancamento.observacao.trim() || undefined,
        usuarioNome: user?.email,
        clienteId: camposEstendidos ? novoLancamento.clienteId || undefined : undefined,
        quantidadeVeiculos: camposEstendidos && novoLancamento.quantidadeVeiculos
          ? Number(novoLancamento.quantidadeVeiculos)
          : undefined,
        dataVencimento: camposEstendidos ? novoLancamento.dataVencimento || undefined : undefined,
        formaPagamento: camposEstendidos ? novoLancamento.formaPagamento || undefined : undefined,
        statusPagamento: camposEstendidos ? novoLancamento.statusPagamento : undefined,
      })
      setNovoLancamento((prev) => ({
        ...prev,
        descricao: '',
        valor: '',
        observacao: '',
        clienteId: '',
        quantidadeVeiculos: '',
        dataVencimento: '',
        formaPagamento: '',
        statusPagamento: 'PENDENTE',
      }))
    } catch (err) {
      setErroFormLancamento(err instanceof Error ? err.message : 'Erro ao salvar lançamento.')
    } finally {
      setSalvandoLancamento(false)
    }
  }

  async function handleExcluirLancamento(id: string) {
    setExcluindoLancamentoId(id)
    try {
      await excluirLancamentoFluxoCaixa(id)
    } catch (err) {
      console.warn('Erro ao excluir lançamento:', err)
    } finally {
      setExcluindoLancamentoId(null)
    }
  }

  const lancamentosOrdenadosCronologicamente = useMemo(() => {
    return [...lancamentos].sort((a, b) => a.data.localeCompare(b.data) || a.createdAt.localeCompare(b.createdAt))
  }, [lancamentos])

  // Agrupamento mensal (só para o gráfico, que fica ilegível com uma barra por lançamento)
  const dadosFluxoCaixaMensal = useMemo(() => {
    const porMes = new Map<
      string,
      { label: string; Entradas: number; Saidas: number; primeiraData: string; ultimaData: string }
    >()

    for (const l of lancamentosOrdenadosCronologicamente) {
      const [ano, mes] = l.data.split('-')
      const key = `${ano}-${mes}`
      if (!porMes.has(key)) {
        const label = new Date(Number(ano), Number(mes) - 1, 1).toLocaleDateString('pt-BR', {
          month: 'short',
          year: '2-digit',
        })
        porMes.set(key, {
          label: label.replace('.', '').toUpperCase(),
          Entradas: 0,
          Saidas: 0,
          primeiraData: l.data,
          ultimaData: l.data,
        })
      }
      const bucket = porMes.get(key)!
      if (l.movimentacao === 'entrada') bucket.Entradas += l.valor
      else bucket.Saidas += l.valor
      if (l.data < bucket.primeiraData) bucket.primeiraData = l.data
      if (l.data > bucket.ultimaData) bucket.ultimaData = l.data
    }

    const fmtDia = (iso: string) => {
      const [ano, mes, dia] = iso.split('-')
      return `${dia}/${mes}/${ano}`
    }

    let acumulado = 0
    return [...porMes.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => {
        const saldoMes = v.Entradas - v.Saidas
        acumulado += saldoMes
        const periodo =
          v.primeiraData === v.ultimaData
            ? fmtDia(v.primeiraData)
            : `${fmtDia(v.primeiraData)} A ${fmtDia(v.ultimaData)}`
        return {
          id: key,
          mes: v.label,
          periodo,
          Entradas: v.Entradas,
          Saidas: v.Saidas,
          saldoMes,
          saldoAcumulado: acumulado,
        }
      })
  }, [lancamentosOrdenadosCronologicamente])

  // Agrupamento diário — usado só pelas empresas com campos estendidos
  // (Pedrão), onde a linha de saldo acumulado precisa subir aos poucos
  // conforme os lançamentos do mês vão entrando, em vez de "pular" de uma
  // vez no fechamento mensal.
  const dadosFluxoCaixaDiario = useMemo(() => {
    const porDia = new Map<string, { label: string; Entradas: number; Saidas: number }>()

    for (const l of lancamentosOrdenadosCronologicamente) {
      const key = l.data
      if (!porDia.has(key)) {
        const [, mes, dia] = key.split('-')
        porDia.set(key, { label: `${dia}/${mes}`, Entradas: 0, Saidas: 0 })
      }
      const bucket = porDia.get(key)!
      if (l.movimentacao === 'entrada') bucket.Entradas += l.valor
      else bucket.Saidas += l.valor
    }

    let acumulado = 0
    return [...porDia.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => {
        const saldoMes = v.Entradas - v.Saidas
        acumulado += saldoMes
        return {
          id: key,
          mes: v.label,
          periodo: v.label,
          Entradas: v.Entradas,
          Saidas: v.Saidas,
          saldoMes,
          saldoAcumulado: acumulado,
        }
      })
  }, [lancamentosOrdenadosCronologicamente])

  const dadosGraficoFluxoCaixa =
    camposEstendidos && visaoGraficoFluxoCaixa === 'diario' ? dadosFluxoCaixaDiario : dadosFluxoCaixaMensal

  // Pra Pedrão a linha acompanha o saldo de cada ponto (sobe/desce junto com
  // a barra daquele dia/mês). A GVEL mantém a linha acumulada de sempre
  // (soma total desde o início, tipo saldo bancário).
  const campoLinha = camposEstendidos ? 'saldoMes' : 'saldoAcumulado'
  const campoLinhaLabel = camposEstendidos ? 'SALDO DO PERÍODO' : 'SALDO ACUMULADO'

  // Extrato: um lançamento por linha, na ordem da planilha, com saldo acumulado
  const dadosFluxoCaixaDetalhado = useMemo(() => {
    let acumulado = 0
    return lancamentosOrdenadosCronologicamente.map((l) => {
      const entrada = l.movimentacao === 'entrada' ? l.valor : 0
      const saida = l.movimentacao === 'saida' ? l.valor : 0
      acumulado += entrada - saida
      return {
        id: l.id,
        data: l.data,
        descricao: l.descricao,
        movimentacao: l.movimentacao,
        Entradas: entrada,
        Saidas: saida,
        saldoAcumulado: acumulado,
      }
    })
  }, [lancamentosOrdenadosCronologicamente])

  const totaisFluxoCaixa = useMemo(() => {
    const totalEntradas = lancamentos
      .filter((l) => l.movimentacao === 'entrada')
      .reduce((acc, l) => acc + l.valor, 0)
    const totalSaidas = lancamentos.filter((l) => l.movimentacao === 'saida').reduce((acc, l) => acc + l.valor, 0)
    const saldoPeriodo = totalEntradas - totalSaidas
    const saldoFinal =
      dadosFluxoCaixaDetalhado[dadosFluxoCaixaDetalhado.length - 1]?.saldoAcumulado ?? saldoPeriodo

    return { totalEntradas, totalSaidas, saldoPeriodo, saldoFinal }
  }, [lancamentos, dadosFluxoCaixaDetalhado])

  const periodoLancamentosLabel = useMemo(() => {
    if (lancamentosOrdenadosCronologicamente.length === 0) return 'Nenhum lançamento'
    const primeira = lancamentosOrdenadosCronologicamente[0].data
    const ultima = lancamentosOrdenadosCronologicamente[lancamentosOrdenadosCronologicamente.length - 1].data
    const fmt = (iso: string) => {
      const [ano, mes, dia] = iso.split('-')
      return `${dia}/${mes}/${ano}`
    }
    return primeira === ultima ? fmt(primeira) : `${fmt(primeira)} a ${fmt(ultima)}`
  }, [lancamentosOrdenadosCronologicamente])

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
      />

      {/* Barra de Abas */}
      {[podeVisaoGeral, podeFluxoCaixa].filter(Boolean).length > 1 && (
      <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-surface/80 border border-border/25 shadow-sm backdrop-blur-md w-full sm:w-fit">
        {podeVisaoGeral && (
        <button
          type="button"
          onClick={() => setAbaAtiva('visao-geral')}
          className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap flex-1 sm:flex-none ${
            abaAtiva === 'visao-geral'
              ? 'bg-primary text-white shadow-md shadow-primary/20'
              : 'text-secondary hover:text-foreground hover:bg-surface-hover/50'
          }`}
        >
          <LayoutDashboard className="h-4 w-4" />
          VISÃO GERAL
        </button>
        )}
        {podeFluxoCaixa && (
        <button
          type="button"
          onClick={() => setAbaAtiva('fluxo-caixa')}
          className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap flex-1 sm:flex-none ${
            abaAtiva === 'fluxo-caixa'
              ? 'bg-primary text-white shadow-md shadow-primary/20'
              : 'text-secondary hover:text-foreground hover:bg-surface-hover/50'
          }`}
        >
          <Wallet className="h-4 w-4" />
          FLUXO DE CAIXA
        </button>
        )}
      </div>
      )}

      {abaAtiva === 'visao-geral' && podeVisaoGeral && (
      <>
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
            <select
              value={mesFiltro}
              onChange={(e) => setMesFiltro(e.target.value)}
              className="h-10 w-full rounded-xl border border-border/40 bg-background px-3 text-xs font-bold text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary uppercase transition-colors"
            >
              {MESES_OPCOES.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label.toUpperCase()}
                </option>
              ))}
            </select>
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
          IMPORTAR EXCEL — atualiza os dados das divisões de um mês
         ────────────────────────────────────────────────────────────────────────── */}
      <Card className="p-4 border-border/30 bg-surface/60 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex-1">
            <label className="flex items-center gap-1.5 text-xs font-black text-foreground mb-1.5">
              <Upload className="h-4 w-4 text-primary" />
              ATUALIZAR DADOS DAS DIVISÕES (IMPORTAR EXCEL)
            </label>
            <p className="text-[11px] text-secondary normal-case mb-2">
              Planilha com colunas MÊS, EMPRESA, FATURAMENTO, RECEITAS, DESPESAS — uma linha por divisão
              (GVel Diesel, GVel Leves, GV Distribuidora, GV Transportes, Investimento). Substitui os dados do(s) mês(es) que vierem na planilha.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <GlassButton
                type="button"
                size="sm"
                variant="primary"
                disabled={importandoPainel}
                onClick={() => importPainelInputRef.current?.click()}
                className="whitespace-nowrap"
              >
                {importandoPainel ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {importandoPainel ? 'IMPORTANDO...' : 'IMPORTAR EXCEL'}
              </GlassButton>
              <input
                ref={importPainelInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleImportarPainelExcel}
              />
            </div>
          </div>
        </div>

        {sucessoImportacaoPainel && (
          <p className="mt-3 text-xs font-bold text-emerald-400 normal-case">{sucessoImportacaoPainel}</p>
        )}
        {avisosImportacaoPainel.length > 0 && (
          <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-1">
            {avisosImportacaoPainel.map((a, i) => (
              <p key={i} className="text-[11px] text-amber-400 normal-case">{a}</p>
            ))}
          </div>
        )}
      </Card>

      {/* ──────────────────────────────────────────────────────────────────────────
          CARDS DE KPIS GERENCIAIS (Valores Consolidados)
         ────────────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        {/* Card 1: Faturamento */}
        <Card className="p-3 sm:p-4 border-blue-500/20 bg-blue-500/5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-secondary mb-1.5">
            <span className="text-[10px] font-black tracking-wider text-blue-400 uppercase">FATURAMENTO</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
              <BarChart2 className="h-3.5 w-3.5" />
            </div>
          </div>
          <p className="text-sm sm:text-base lg:text-[15px] xl:text-[16px] 2xl:text-xl font-mono font-black text-blue-400 whitespace-nowrap tracking-tight leading-tight my-1">
            {fmtBRL(totais.faturamento)}
          </p>
          <span className="text-[10px] text-secondary font-bold uppercase tracking-wider">Regime Competência</span>
        </Card>

        {/* Card 2: Receitas */}
        <Card className="p-3 sm:p-4 border-emerald-500/20 bg-emerald-500/5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-secondary mb-1.5">
            <span className="text-[10px] font-black tracking-wider text-emerald-400 uppercase">RECEITAS</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
              <TrendingUp className="h-3.5 w-3.5" />
            </div>
          </div>
          <p className="text-sm sm:text-base lg:text-[15px] xl:text-[16px] 2xl:text-xl font-mono font-black text-emerald-400 whitespace-nowrap tracking-tight leading-tight my-1">
            {fmtBRL(totais.receitas)}
          </p>
          <span className="text-[10px] text-secondary font-bold uppercase tracking-wider">Regime de Caixa</span>
        </Card>

        {/* Card 3: Despesas */}
        <Card className="p-3 sm:p-4 border-red-500/20 bg-red-500/5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-secondary mb-1.5">
            <span className="text-[10px] font-black tracking-wider text-red-400 uppercase">DESPESAS</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/10 text-red-400">
              <TrendingDown className="h-3.5 w-3.5" />
            </div>
          </div>
          <p className="text-sm sm:text-base lg:text-[15px] xl:text-[16px] 2xl:text-xl font-mono font-black text-red-400 whitespace-nowrap tracking-tight leading-tight my-1">
            {fmtBRL(totais.despesas)}
          </p>
          <span className="text-[10px] text-secondary font-bold uppercase tracking-wider">Regime de Caixa</span>
        </Card>

        {/* Card 4: Saldo Caixa */}
        <Card
          className={`p-3 sm:p-4 shadow-sm border flex flex-col justify-between ${
            totais.saldoCaixa >= 0
              ? 'border-emerald-500/20 bg-emerald-500/5'
              : 'border-red-500/30 bg-red-500/10'
          }`}
        >
          <div className="flex items-center justify-between text-secondary mb-1.5">
            <span
              className={`text-[10px] font-black tracking-wider uppercase ${
                totais.saldoCaixa >= 0 ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              SALDO DE CAIXA
            </span>
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                totais.saldoCaixa >= 0
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-red-500/10 text-red-400'
              }`}
            >
              <Scale className="h-3.5 w-3.5" />
            </div>
          </div>
          <p
            className={`text-sm sm:text-base lg:text-[15px] xl:text-[16px] 2xl:text-xl font-mono font-black whitespace-nowrap tracking-tight leading-tight my-1 ${
              totais.saldoCaixa >= 0 ? 'text-emerald-400' : 'text-amber-400'
            }`}
          >
            {fmtBRL(totais.saldoCaixa)}
          </p>
          <span className="text-[10px] text-secondary font-bold uppercase tracking-wider">Receitas - Despesas</span>
        </Card>

        {/* Card 5: Resultado (Faturamento - Despesas) */}
        <Card
          className={`p-3 sm:p-4 shadow-sm border flex flex-col justify-between ${
            totais.resultadoFaturamento >= 0
              ? 'border-emerald-500/20 bg-emerald-500/5'
              : 'border-red-500/30 bg-red-500/10'
          }`}
        >
          <div className="flex items-center justify-between text-secondary mb-1.5">
            <span
              className={`text-[10px] font-black tracking-wider uppercase ${
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
            className={`text-sm sm:text-base lg:text-[15px] xl:text-[16px] 2xl:text-xl font-mono font-black whitespace-nowrap tracking-tight leading-tight my-1 ${
              totais.resultadoFaturamento >= 0 ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {fmtBRL(totais.resultadoFaturamento)}
          </p>
          <span className="text-[10px] text-secondary font-bold uppercase tracking-wider">Faturamento - Despesas</span>
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
                const oculta = empresasOcultasTabela.has(emp.id)
                const sCaixa = emp.receitas - emp.despesas
                const sFat = emp.faturamento - emp.despesas

                return (
                  <tr key={emp.id} className={`hover:bg-overlay/5 transition-colors ${oculta ? 'opacity-40' : ''}`}>
                    <td className="py-3.5 px-4 font-sans font-bold text-foreground">
                      <label className="flex items-center gap-2 cursor-pointer select-none uppercase">
                        <input
                          type="checkbox"
                          checked={oculta}
                          onChange={() => alternarEmpresaTabela(emp.id)}
                          title="Ocultar da tabela e do total"
                          className="h-3.5 w-3.5 rounded border-border/40 accent-primary cursor-pointer shrink-0"
                        />
                        {emp.nome}
                      </label>
                    </td>
                    <td className="py-3.5 px-4 text-right text-blue-400 font-bold">
                      {oculta ? '••••••' : fmtBRL(emp.faturamento)}
                    </td>
                    <td className="py-3.5 px-4 text-right text-emerald-400 font-bold">
                      {oculta ? '••••••' : fmtBRL(emp.receitas)}
                    </td>
                    <td className="py-3.5 px-4 text-right text-red-400 font-bold">
                      {oculta ? '••••••' : fmtBRL(emp.despesas)}
                    </td>
                    <td
                      className={`py-3.5 px-4 text-right font-black ${oculta ? '' : sCaixa >= 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}
                    >
                      {oculta ? '••••••' : fmtBRL(sCaixa)}
                    </td>
                    <td
                      className={`py-3.5 px-4 text-right font-black ${oculta ? '' : sFat >= 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}
                    >
                      {oculta ? '••••••' : fmtBRL(sFat)}
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
                  className={`py-4 px-4 text-right ${totais.saldoCaixa >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}
                >
                  {fmtBRL(totais.saldoCaixa)}
                </td>
                <td
                  className={`py-4 px-4 text-right ${totais.resultadoFaturamento >= 0 ? 'text-emerald-400' : 'text-red-400'
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

        {/* 2. TOP 5 PLANOS DE CONTA */}
        <Card className="overflow-hidden border-border/30 bg-surface/50 shadow-md flex flex-col justify-between">
          <div>
            <div className="border-b border-border/20 bg-surface/80 p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/15 text-red-400">
                  <PieIcon className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-foreground uppercase">
                    TOP 5 PLANOS DE CONTA (POR DESPESA)
                  </h3>
                  <p className="text-[10px] text-secondary font-medium">Maiores centros de custos da operação</p>
                </div>
              </div>
            </div>

            <div className="p-4 space-y-3">
              {topPlanosFiltrados.slice(0, 5).map((plano) => {
                const maxDesp = topPlanosFiltrados[0]?.despesa || 1
                const pct = (plano.despesa / maxDesp) * 100

                return (
                  <div
                    key={plano.nome + plano.rank}
                    className="p-3 rounded-xl border border-border/15 bg-background/60 hover:border-red-500/30 transition-all"
                  >
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-500/15 text-red-400 font-bold text-[10px]">
                          {plano.rank}º
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
                FATURAMENTO × DESPESAS POR EMPRESA — {mesFiltro === 'todos' ? 'TODOS OS MESES (JANEIRO A AGOSTO)' : `${mesFiltro.toUpperCase()} 2026`}
              </h3>
            </div>
            <p className="text-xs text-secondary font-medium mt-1">
              Comparativo de faturamento e despesas por unidade de negócio {mesFiltro === 'todos' ? 'consolidado (Janeiro a Agosto)' : `em ${mesFiltro.toUpperCase()} / 2026`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Seletor Interativo de Mês no Gráfico */}
            <div className="relative flex items-center">
              <Calendar className="absolute left-2.5 h-3.5 w-3.5 text-primary pointer-events-none" />
              <select
                value={mesFiltro}
                onChange={(e) => setMesFiltro(e.target.value)}
                className="h-8 pl-8 pr-3 rounded-xl border border-primary/40 bg-surface/90 text-xs font-black text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary uppercase transition-colors shadow-sm cursor-pointer hover:border-primary"
              >
                {MESES_OPCOES.map((m) => (
                  <option key={m.id} value={m.id} className="bg-surface text-foreground font-bold">
                    {m.label.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            {/* Legenda Customizada e Elegante */}
            <div className="flex flex-wrap items-center gap-2 bg-background/60 border border-border/20 px-3 py-1.5 rounded-xl text-xs font-bold">
              <span className="flex items-center gap-1.5 text-blue-400">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-500 shadow-sm" /> FATURAMENTO
              </span>
              <span className="text-border/40">•</span>
              <span className="flex items-center gap-1.5 text-red-400">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500 shadow-sm" /> DESPESAS
              </span>
            </div>
          </div>
        </div>

        {/* Gráfico de Barras Responsivo */}
        <div className="h-80 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 36, right: 20, left: 10, bottom: 10 }}
              barGap={8}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--color-border) / 0.1)" vertical={false} />
              <XAxis
                dataKey="name"
                stroke="rgb(var(--color-foreground))"
                tick={{ fill: 'rgb(var(--color-foreground))', fontWeight: 800, fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: 'rgb(var(--color-border) / 0.2)' }}
              />
              <YAxis
                stroke="rgb(var(--color-foreground))"
                tick={{ fill: 'rgb(var(--color-foreground))', fontWeight: 700, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => fmtCompact(val)}
              />
              <Tooltip
                cursor={{ fill: 'rgb(var(--color-foreground) / 0.03)' }}
                content={({ active, payload, label }) => {
                  if (!active || !payload || !payload.length) return null

                  const fat = Number(payload.find((p) => p.dataKey === 'Faturamento')?.value || 0)
                  const desp = Number(payload.find((p) => p.dataKey === 'Despesas')?.value || 0)
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
                          <span className="text-red-400 font-sans font-bold flex items-center gap-1">
                            <span className="h-2 w-2 rounded-full bg-red-500" /> DESPESAS:
                          </span>
                          <span className="font-bold text-foreground">{fmtBRL(desp)}</span>
                        </div>
                      </div>

                      <div className="border-t border-border/20 pt-2 space-y-1 font-mono text-[11px]">
                        <div className="flex items-center justify-between">
                          <span className="text-secondary font-sans font-bold">RESULTADO:</span>
                          <span className={`font-black ${resFat >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {fmtBRL(resFat)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                }}
              />
              <Bar dataKey="Faturamento" fill="#3b82f6" radius={[6, 6, 0, 0]} maxBarSize={56}>
                <LabelList
                  dataKey="Faturamento"
                  position="top"
                  formatter={(v: any) => fmtCompact(Number(v) || 0)}
                  style={{ fill: '#93c5fd', fontSize: 10, fontWeight: 700, fontFamily: 'monospace' }}
                />
              </Bar>
              <Bar dataKey="Despesas" fill="#ef4444" radius={[6, 6, 0, 0]} maxBarSize={56}>
                <LabelList
                  dataKey="Despesas"
                  position="top"
                  formatter={(v: any) => fmtCompact(Number(v) || 0)}
                  style={{ fill: '#fca5a5', fontSize: 10, fontWeight: 700, fontFamily: 'monospace' }}
                />
              </Bar>
              <Line
                type="monotone"
                dataKey="Faturamento"
                stroke="#60a5fa"
                strokeWidth={3}
                dot={{ r: 5, fill: '#3b82f6', stroke: '#ffffff', strokeWidth: 2 }}
                activeDot={{ r: 7, stroke: '#ffffff', strokeWidth: 2 }}
              />
              <Line
                type="monotone"
                dataKey="Despesas"
                stroke="#f87171"
                strokeWidth={3}
                dot={{ r: 5, fill: '#ef4444', stroke: '#ffffff', strokeWidth: 2 }}
                activeDot={{ r: 7, stroke: '#ffffff', strokeWidth: 2 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* ──────────────────────────────────────────────────────────────────────────
          GRÁFICO COMPARATIVO EVOLUTIVO MÊS A MÊS (FATURAMENTO vs DESPESAS vs RECEITAS)
         ────────────────────────────────────────────────────────────────────────── */}
      <Card className="p-6 border-border/30 bg-surface/50 shadow-xl space-y-6">
        {/* Cabeçalho do Gráfico Comparativo */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/20 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/15 border border-primary/30 text-primary shadow-inner">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-foreground tracking-wide uppercase">
                COMPARATIVO EVOLUTIVO MÊS A MÊS — {empresaFiltro === 'TODAS' ? 'GRUPO VEL' : empresaFiltro.toUpperCase()}
              </h3>
              <p className="text-xs text-secondary font-medium lowercase">
                Evolução comparativa de faturamento, receitas e despesas ao longo do ano (Janeiro a Agosto / 2026)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Seletor Interativo de Empresa no Gráfico */}
            <div className="relative flex items-center">
              <Building2 className="absolute left-2.5 h-3.5 w-3.5 text-primary pointer-events-none" />
              <select
                value={empresaFiltro}
                onChange={(e) => setEmpresaFiltro(e.target.value)}
                className="h-8 pl-8 pr-3 rounded-xl border border-primary/40 bg-surface/90 text-xs font-black text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary uppercase transition-colors shadow-sm cursor-pointer hover:border-primary"
              >
                <option value="TODAS" className="bg-surface text-foreground font-bold">
                  TODAS AS EMPRESAS (GRUPO VEL)
                </option>
                <option value="GVel Diesel" className="bg-surface text-foreground font-bold">
                  GVEL DIESEL
                </option>
                <option value="GVel Leves" className="bg-surface text-foreground font-bold">
                  GVEL LEVES
                </option>
                <option value="GV Distribuidora" className="bg-surface text-foreground font-bold">
                  GV DISTRIBUIDORA
                </option>
                <option value="GV Transportes" className="bg-surface text-foreground font-bold">
                  GV TRANSPORTES
                </option>
                <option value="Investimento" className="bg-surface text-foreground font-bold">
                  INVESTIMENTO
                </option>
              </select>
            </div>

            <Badge tone="neutral" className="text-[11px] font-bold border-border/30">
              JAN · FEV · MAR · ABR · MAI · JUN · JUL · AGO
            </Badge>
          </div>
        </div>

        {/* Legenda do Gráfico */}
        <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-foreground bg-background/40 p-3 rounded-2xl border border-border/20">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-md bg-blue-500 shadow-sm shadow-blue-500/50" />
            <span className="text-blue-400 font-black">FATURAMENTO</span>
            <span className="text-secondary text-[10px] lowercase font-normal">(competência)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-md bg-red-500 shadow-sm shadow-red-500/50" />
            <span className="text-red-400 font-black">DESPESAS</span>
            <span className="text-secondary text-[10px] lowercase font-normal">(caixa)</span>
          </div>
        </div>

        {/* Área do Gráfico Comparativo Recharts */}
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={dadosComparativoMeses}
              margin={{ top: 36, right: 20, left: 10, bottom: 10 }}
              barGap={10}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--color-border) / 0.1)" vertical={false} />
              <XAxis
                dataKey="mes"
                stroke="rgb(var(--color-foreground))"
                tick={{ fill: 'rgb(var(--color-foreground))', fontWeight: 800, fontSize: 13 }}
                tickLine={false}
                axisLine={{ stroke: 'rgb(var(--color-border) / 0.2)' }}
              />
              <YAxis
                stroke="rgb(var(--color-foreground))"
                tick={{ fill: 'rgb(var(--color-foreground))', fontWeight: 700, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => fmtCompact(val)}
              />
              <Tooltip
                cursor={{ fill: 'rgb(var(--color-foreground) / 0.03)' }}
                content={({ active, payload, label }) => {
                  if (!active || !payload || !payload.length) return null

                  const fat = Number(payload.find((p) => p.dataKey === 'Faturamento')?.value || 0)
                  const desp = Number(payload.find((p) => p.dataKey === 'Despesas')?.value || 0)
                  const resFat = fat - desp

                  return (
                    <div className="rounded-2xl border border-border/40 bg-surface/95 p-4 shadow-2xl backdrop-blur-md uppercase text-xs space-y-2 min-w-[250px]">
                      <div className="border-b border-border/20 pb-2 flex items-center justify-between">
                        <span className="font-black text-foreground text-sm flex items-center gap-1.5">
                          📅 {label}
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
                          <span className="text-red-400 font-sans font-bold flex items-center gap-1">
                            <span className="h-2 w-2 rounded-full bg-red-500" /> DESPESAS:
                          </span>
                          <span className="font-bold text-foreground">{fmtBRL(desp)}</span>
                        </div>
                      </div>

                      <div className="border-t border-border/20 pt-2 space-y-1 font-mono text-[11px]">
                        <div className="flex items-center justify-between">
                          <span className="text-secondary font-sans font-bold">RESULTADO LÍQUIDO:</span>
                          <span className={`font-black ${resFat >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {fmtBRL(resFat)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                }}
              />
              <Bar dataKey="Faturamento" fill="#3b82f6" radius={[6, 6, 0, 0]} maxBarSize={70}>
                <LabelList
                  dataKey="Faturamento"
                  position="top"
                  formatter={(v: any) => fmtCompact(Number(v) || 0)}
                  style={{ fill: '#93c5fd', fontSize: 11, fontWeight: 800, fontFamily: 'monospace' }}
                />
              </Bar>
              <Bar dataKey="Despesas" fill="#ef4444" radius={[6, 6, 0, 0]} maxBarSize={70}>
                <LabelList
                  dataKey="Despesas"
                  position="top"
                  formatter={(v: any) => fmtCompact(Number(v) || 0)}
                  style={{ fill: '#fca5a5', fontSize: 11, fontWeight: 800, fontFamily: 'monospace' }}
                />
              </Bar>
              <Line
                type="monotone"
                dataKey="Faturamento"
                stroke="#60a5fa"
                strokeWidth={3}
                dot={{ r: 6, fill: '#3b82f6', stroke: '#ffffff', strokeWidth: 2 }}
                activeDot={{ r: 8, stroke: '#ffffff', strokeWidth: 2 }}
              />
              <Line
                type="monotone"
                dataKey="Despesas"
                stroke="#f87171"
                strokeWidth={3}
                dot={{ r: 6, fill: '#ef4444', stroke: '#ffffff', strokeWidth: 2 }}
                activeDot={{ r: 8, stroke: '#ffffff', strokeWidth: 2 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* ──────────────────────────────────────────────────────────────────────────
          GRÁFICO 3: RECEITAS × DESPESAS (REGIME DE CAIXA)
         ────────────────────────────────────────────────────────────────────────── */}
      <Card className="p-5 sm:p-6 border-border/30 bg-surface/50 shadow-lg space-y-6">
        {/* Cabeçalho da Seção */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/20 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                <Scale className="h-4 w-4" />
              </div>
              <h3 className="text-sm sm:text-base font-black text-foreground uppercase tracking-wide">
                RECEITAS × DESPESAS (REGIME DE CAIXA) — {mesFiltro === 'todos' ? 'TODOS OS MESES (MAIO A JULHO)' : `${mesFiltro.toUpperCase()} 2026`}
              </h3>
            </div>
            <p className="text-xs text-secondary font-medium mt-1">
              Comparativo de entradas efetivas de caixa (Receitas) versus saídas (Despesas) por unidade de negócio
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Seletor Interativo de Mês no Gráfico */}
            <div className="relative flex items-center">
              <Calendar className="absolute left-2.5 h-3.5 w-3.5 text-primary pointer-events-none" />
              <select
                value={mesFiltro}
                onChange={(e) => setMesFiltro(e.target.value)}
                className="h-8 pl-8 pr-3 rounded-xl border border-primary/40 bg-surface/90 text-xs font-black text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary uppercase transition-colors shadow-sm cursor-pointer hover:border-primary"
              >
                {MESES_OPCOES.map((m) => (
                  <option key={m.id} value={m.id} className="bg-surface text-foreground font-bold">
                    {m.label.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            {/* Legenda Customizada e Elegante */}
            <div className="flex flex-wrap items-center gap-2 bg-background/60 border border-border/20 px-3 py-1.5 rounded-xl text-xs font-bold">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-sm" /> RECEITAS (CAIXA)
              </span>
              <span className="text-border/40">•</span>
              <span className="flex items-center gap-1.5 text-red-400">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500 shadow-sm" /> DESPESAS (CAIXA)
              </span>
            </div>
          </div>
        </div>

        {/* Gráfico de Barras e Linhas Responsivo */}
        <div className="h-80 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 36, right: 20, left: 10, bottom: 10 }}
              barGap={8}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--color-border) / 0.1)" vertical={false} />
              <XAxis
                dataKey="name"
                stroke="rgb(var(--color-foreground))"
                tick={{ fill: 'rgb(var(--color-foreground))', fontWeight: 800, fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: 'rgb(var(--color-border) / 0.2)' }}
              />
              <YAxis
                stroke="rgb(var(--color-foreground))"
                tick={{ fill: 'rgb(var(--color-foreground))', fontWeight: 700, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => fmtCompact(val)}
              />
              <Tooltip
                cursor={{ fill: 'rgb(var(--color-foreground) / 0.03)' }}
                content={({ active, payload, label }) => {
                  if (!active || !payload || !payload.length) return null

                  const rec = Number(payload.find((p) => p.dataKey === 'Receitas')?.value || 0)
                  const desp = Number(payload.find((p) => p.dataKey === 'Despesas')?.value || 0)
                  const saldo = rec - desp

                  return (
                    <div className="rounded-2xl border border-border/40 bg-surface/95 p-4 shadow-2xl backdrop-blur-md uppercase text-xs space-y-2 min-w-[240px]">
                      <div className="border-b border-border/20 pb-2 flex items-center justify-between">
                        <span className="font-black text-foreground text-sm flex items-center gap-1.5">
                          🏢 {label}
                        </span>
                      </div>

                      <div className="space-y-1.5 font-mono">
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
                      </div>
                    </div>
                  )
                }}
              />
              <Bar dataKey="Receitas" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={60}>
                <LabelList
                  dataKey="Receitas"
                  position="top"
                  formatter={(v: any) => fmtCompact(Number(v) || 0)}
                  style={{ fill: '#6ee7b7', fontSize: 11, fontWeight: 800, fontFamily: 'monospace' }}
                />
              </Bar>
              <Bar dataKey="Despesas" fill="#ef4444" radius={[6, 6, 0, 0]} maxBarSize={60}>
                <LabelList
                  dataKey="Despesas"
                  position="top"
                  formatter={(v: any) => fmtCompact(Number(v) || 0)}
                  style={{ fill: '#fca5a5', fontSize: 11, fontWeight: 800, fontFamily: 'monospace' }}
                />
              </Bar>
              <Line
                type="monotone"
                dataKey="Receitas"
                stroke="#34d399"
                strokeWidth={3}
                dot={{ r: 6, fill: '#10b981', stroke: '#ffffff', strokeWidth: 2 }}
                activeDot={{ r: 8, stroke: '#ffffff', strokeWidth: 2 }}
              />
              <Line
                type="monotone"
                dataKey="Despesas"
                stroke="#f87171"
                strokeWidth={3}
                dot={{ r: 6, fill: '#ef4444', stroke: '#ffffff', strokeWidth: 2 }}
                activeDot={{ r: 8, stroke: '#ffffff', strokeWidth: 2 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>
      </>
      )}

      {abaAtiva === 'fluxo-caixa' && podeFluxoCaixa && (
      <>
      {/* ──────────────────────────────────────────────────────────────────────────
          NOVO LANÇAMENTO (ENTRADA / SAÍDA)
         ────────────────────────────────────────────────────────────────────────── */}
      <Card className="p-4 sm:p-5 border-border/30 bg-surface/60 shadow-md">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Plus className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-black text-foreground uppercase">NOVO LANÇAMENTO</h3>
        </div>

        <form onSubmit={handleAdicionarLancamento} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label className="flex items-center gap-1.5 text-[10px] font-black text-secondary mb-1.5">
                <Calendar className="h-3.5 w-3.5 text-primary" />
                DATA
              </label>
              <input
                type="date"
                value={novoLancamento.data}
                onChange={(e) => setNovoLancamento((prev) => ({ ...prev, data: e.target.value }))}
                className="h-10 w-full rounded-xl border border-border/40 bg-background px-3 text-xs font-bold text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
              />
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-[10px] font-black text-secondary mb-1.5">
                <Scale className="h-3.5 w-3.5 text-primary" />
                MOVIMENTAÇÃO
              </label>
              <select
                value={novoLancamento.movimentacao}
                onChange={(e) =>
                  setNovoLancamento((prev) => ({ ...prev, movimentacao: e.target.value as 'entrada' | 'saida' }))
                }
                className={`h-10 w-full rounded-xl border px-3 text-xs font-black uppercase focus:outline-none focus:ring-1 transition-colors ${
                  novoLancamento.movimentacao === 'entrada'
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400 focus:ring-emerald-500'
                    : 'border-red-500/40 bg-red-500/10 text-red-400 focus:ring-red-500'
                }`}
              >
                <option value="entrada" className="bg-white text-black">ENTRADA</option>
                <option value="saida" className="bg-white text-black">SAÍDA</option>
              </select>
            </div>

            <div className="lg:col-span-2">
              <label className="flex items-center gap-1.5 text-[10px] font-black text-secondary mb-1.5">
                <Tag className="h-3.5 w-3.5 text-primary" />
                DESCRIÇÃO
              </label>
              <input
                type="text"
                value={novoLancamento.descricao}
                onChange={(e) => setNovoLancamento((prev) => ({ ...prev, descricao: e.target.value }))}
                placeholder="EX: VALE TRANSPORTE"
                className="h-10 w-full rounded-xl border border-border/40 bg-background px-3 text-xs font-bold text-foreground placeholder:text-secondary/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary uppercase transition-colors"
              />
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-[10px] font-black text-secondary mb-1.5">
                <DollarSign className="h-3.5 w-3.5 text-primary" />
                VALOR (R$)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={novoLancamento.valor}
                onChange={(e) => setNovoLancamento((prev) => ({ ...prev, valor: e.target.value }))}
                placeholder="0,00"
                className="h-10 w-full rounded-xl border border-border/40 bg-background px-3 text-xs font-mono font-bold text-foreground placeholder:text-secondary/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
              />
            </div>
          </div>

          {camposEstendidos && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div>
                <label className="flex items-center gap-1.5 text-[10px] font-black text-secondary mb-1.5">
                  <Users className="h-3.5 w-3.5 text-primary" />
                  CLIENTE
                </label>
                <select
                  value={novoLancamento.clienteId}
                  onChange={(e) => setNovoLancamento((prev) => ({ ...prev, clienteId: e.target.value }))}
                  className="h-10 w-full rounded-xl border border-border/40 bg-background px-3 text-xs font-bold text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                >
                  <option value="">SEM CLIENTE</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-[10px] font-black text-secondary mb-1.5">
                  <Calendar className="h-3.5 w-3.5 text-primary" />
                  VENCIMENTO
                </label>
                <input
                  type="date"
                  value={novoLancamento.dataVencimento}
                  onChange={(e) => setNovoLancamento((prev) => ({ ...prev, dataVencimento: e.target.value }))}
                  className="h-10 w-full rounded-xl border border-border/40 bg-background px-3 text-xs font-bold text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                />
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-[10px] font-black text-secondary mb-1.5">
                  <Truck className="h-3.5 w-3.5 text-primary" />
                  QTD. VEÍCULOS
                </label>
                <input
                  type="number"
                  min={0}
                  value={novoLancamento.quantidadeVeiculos}
                  onChange={(e) => setNovoLancamento((prev) => ({ ...prev, quantidadeVeiculos: e.target.value }))}
                  placeholder="0"
                  className="h-10 w-full rounded-xl border border-border/40 bg-background px-3 text-xs font-mono font-bold text-foreground placeholder:text-secondary/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                />
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-[10px] font-black text-secondary mb-1.5">
                  <CreditCard className="h-3.5 w-3.5 text-primary" />
                  BOLETO/PIX
                </label>
                {formaPagamentoOutro ? (
                  <input
                    type="text"
                    autoFocus
                    value={novoLancamento.formaPagamento}
                    onChange={(e) => setNovoLancamento((prev) => ({ ...prev, formaPagamento: e.target.value }))}
                    onBlur={() => { if (!novoLancamento.formaPagamento.trim()) setFormaPagamentoOutro(false) }}
                    placeholder="DIGITE A FORMA DE PAGAMENTO"
                    className="h-10 w-full rounded-xl border border-border/40 bg-background px-3 text-xs font-bold text-foreground placeholder:text-secondary/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary uppercase transition-colors"
                  />
                ) : (
                  <select
                    value={novoLancamento.formaPagamento}
                    onChange={(e) => {
                      if (e.target.value === '__outro__') {
                        setFormaPagamentoOutro(true)
                        setNovoLancamento((prev) => ({ ...prev, formaPagamento: '' }))
                      } else {
                        setNovoLancamento((prev) => ({ ...prev, formaPagamento: e.target.value }))
                      }
                    }}
                    className="h-10 w-full rounded-xl border border-border/40 bg-background px-3 text-xs font-bold text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary uppercase transition-colors"
                  >
                    <option value="" className="bg-white text-black">NÃO INFORMADO</option>
                    {FORMAS_PAGAMENTO_OPCOES.map((opt) => (
                      <option key={opt} value={opt} className="bg-white text-black">{opt}</option>
                    ))}
                    <option value="__outro__" className="bg-white text-black">OUTRO...</option>
                  </select>
                )}
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-[10px] font-black text-secondary mb-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                  PGT
                </label>
                {statusPagamentoOutro ? (
                  <input
                    type="text"
                    autoFocus
                    value={novoLancamento.statusPagamento}
                    onChange={(e) => setNovoLancamento((prev) => ({ ...prev, statusPagamento: e.target.value }))}
                    onBlur={() => { if (!novoLancamento.statusPagamento.trim()) setStatusPagamentoOutro(false) }}
                    placeholder="DIGITE O STATUS"
                    className="h-10 w-full rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 text-xs font-black text-amber-400 placeholder:text-secondary/50 focus:outline-none focus:ring-1 focus:ring-amber-500 uppercase transition-colors"
                  />
                ) : (
                  <select
                    value={novoLancamento.statusPagamento}
                    onChange={(e) => {
                      if (e.target.value === '__outro__') {
                        setStatusPagamentoOutro(true)
                        setNovoLancamento((prev) => ({ ...prev, statusPagamento: '' }))
                      } else {
                        setNovoLancamento((prev) => ({ ...prev, statusPagamento: e.target.value }))
                      }
                    }}
                    className={`h-10 w-full rounded-xl border px-3 text-xs font-black uppercase focus:outline-none focus:ring-1 transition-colors ${
                      novoLancamento.statusPagamento.toUpperCase() === 'PAGO'
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400 focus:ring-emerald-500'
                        : 'border-amber-500/40 bg-amber-500/10 text-amber-400 focus:ring-amber-500'
                    }`}
                  >
                    {STATUS_PAGAMENTO_OPCOES.map((opt) => (
                      <option key={opt} value={opt} className="bg-white text-black">{opt}</option>
                    ))}
                    <option value="__outro__" className="bg-white text-black">OUTRO...</option>
                  </select>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
            <div className="flex-1">
              <label className="flex items-center gap-1.5 text-[10px] font-black text-secondary mb-1.5">
                <List className="h-3.5 w-3.5 text-primary" />
                OBSERVAÇÃO
              </label>
              <input
                type="text"
                value={novoLancamento.observacao}
                onChange={(e) => setNovoLancamento((prev) => ({ ...prev, observacao: e.target.value }))}
                placeholder="OPCIONAL"
                className="h-10 w-full rounded-xl border border-border/40 bg-background px-3 text-xs font-bold text-foreground placeholder:text-secondary/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary uppercase transition-colors"
              />
            </div>

            <GlassButton
              type="submit"
              size="sm"
              variant="primary"
              disabled={salvandoLancamento}
              contentClassName="flex items-center justify-center gap-2 text-xs font-bold text-white px-4"
            >
              {salvandoLancamento ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              <span>{salvandoLancamento ? 'SALVANDO...' : 'ADICIONAR LANÇAMENTO'}</span>
            </GlassButton>
          </div>

          {erroFormLancamento && (
            <div className="flex items-center gap-2 text-[11px] font-bold text-red-400">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>{erroFormLancamento}</span>
            </div>
          )}
        </form>
      </Card>

      {erroLancamentos && (
        <div className="flex items-center gap-2 p-3 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-bold animate-fade-in">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{erroLancamentos}</span>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          CARDS DE KPIS DO FLUXO DE CAIXA
         ────────────────────────────────────────────────────────────────────────── */}
      {!camposEstendidos ? (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <Card className="p-3 sm:p-4 border-emerald-500/20 bg-emerald-500/5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-secondary mb-1.5">
            <span className="text-[10px] font-black tracking-wider text-emerald-400 uppercase">TOTAL ENTRADAS</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
              <ArrowUpCircle className="h-3.5 w-3.5" />
            </div>
          </div>
          <p className="text-sm sm:text-base lg:text-[15px] xl:text-[16px] 2xl:text-xl font-mono font-black text-emerald-400 whitespace-nowrap tracking-tight leading-tight my-1">
            {fmtBRL(totaisFluxoCaixa.totalEntradas)}
          </p>
          <span className="text-[10px] text-secondary font-bold uppercase tracking-wider">{periodoLancamentosLabel}</span>
        </Card>

        <Card className="p-3 sm:p-4 border-red-500/20 bg-red-500/5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-secondary mb-1.5">
            <span className="text-[10px] font-black tracking-wider text-red-400 uppercase">TOTAL SAÍDAS</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/10 text-red-400">
              <ArrowDownCircle className="h-3.5 w-3.5" />
            </div>
          </div>
          <p className="text-sm sm:text-base lg:text-[15px] xl:text-[16px] 2xl:text-xl font-mono font-black text-red-400 whitespace-nowrap tracking-tight leading-tight my-1">
            {fmtBRL(totaisFluxoCaixa.totalSaidas)}
          </p>
          <span className="text-[10px] text-secondary font-bold uppercase tracking-wider">{periodoLancamentosLabel}</span>
        </Card>

        <Card
          className={`p-3 sm:p-4 shadow-sm border flex flex-col justify-between ${
            totaisFluxoCaixa.saldoPeriodo >= 0
              ? 'border-emerald-500/20 bg-emerald-500/5'
              : 'border-red-500/30 bg-red-500/10'
          }`}
        >
          <div className="flex items-center justify-between text-secondary mb-1.5">
            <span
              className={`text-[10px] font-black tracking-wider uppercase ${
                totaisFluxoCaixa.saldoPeriodo >= 0 ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              SALDO DO PERÍODO
            </span>
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                totaisFluxoCaixa.saldoPeriodo >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
              }`}
            >
              <Activity className="h-3.5 w-3.5" />
            </div>
          </div>
          <p
            className={`text-sm sm:text-base lg:text-[15px] xl:text-[16px] 2xl:text-xl font-mono font-black whitespace-nowrap tracking-tight leading-tight my-1 ${
              totaisFluxoCaixa.saldoPeriodo >= 0 ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {fmtBRL(totaisFluxoCaixa.saldoPeriodo)}
          </p>
          <span className="text-[10px] text-secondary font-bold uppercase tracking-wider">Entradas - Saídas</span>
        </Card>

        <Card
          className={`p-3 sm:p-4 shadow-sm border flex flex-col justify-between ${
            totaisFluxoCaixa.saldoFinal >= 0
              ? 'border-emerald-500/20 bg-emerald-500/5'
              : 'border-red-500/30 bg-red-500/10'
          }`}
        >
          <div className="flex items-center justify-between text-secondary mb-1.5">
            <span
              className={`text-[10px] font-black tracking-wider uppercase ${
                totaisFluxoCaixa.saldoFinal >= 0 ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              SALDO ACUMULADO FINAL
            </span>
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                totaisFluxoCaixa.saldoFinal >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
              }`}
            >
              <Wallet className="h-3.5 w-3.5" />
            </div>
          </div>
          <p
            className={`text-sm sm:text-base lg:text-[15px] xl:text-[16px] 2xl:text-xl font-mono font-black whitespace-nowrap tracking-tight leading-tight my-1 ${
              totaisFluxoCaixa.saldoFinal >= 0 ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {fmtBRL(totaisFluxoCaixa.saldoFinal)}
          </p>
          <span className="text-[10px] text-secondary font-bold uppercase tracking-wider">Saldo acumulado dos lançamentos</span>
        </Card>
      </div>
      ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <Card className="p-3 sm:p-4 border-emerald-500/20 bg-emerald-500/5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-secondary mb-1.5">
            <span className="text-[10px] font-black tracking-wider text-emerald-400 uppercase">ENTRADAS</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
              <ArrowUpCircle className="h-3.5 w-3.5" />
            </div>
          </div>
          <p className="text-sm sm:text-base lg:text-[15px] xl:text-[16px] 2xl:text-xl font-mono font-black text-emerald-400 whitespace-nowrap tracking-tight leading-tight my-1">
            {fmtBRL(totaisFluxoCaixa.totalEntradas)}
          </p>
          <span className="text-[10px] text-secondary font-bold uppercase tracking-wider">{periodoLancamentosLabel}</span>
        </Card>

        <Card className="p-3 sm:p-4 border-red-500/20 bg-red-500/5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-secondary mb-1.5">
            <span className="text-[10px] font-black tracking-wider text-red-400 uppercase">SAÍDAS DESPESAS</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/10 text-red-400">
              <ArrowDownCircle className="h-3.5 w-3.5" />
            </div>
          </div>
          <p className="text-sm sm:text-base lg:text-[15px] xl:text-[16px] 2xl:text-xl font-mono font-black text-red-400 whitespace-nowrap tracking-tight leading-tight my-1">
            {fmtBRL(totaisFluxoCaixa.totalSaidas)}
          </p>
          <span className="text-[10px] text-secondary font-bold uppercase tracking-wider">{periodoLancamentosLabel}</span>
        </Card>

        <Card className="p-3 sm:p-4 border-amber-500/20 bg-amber-500/5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-secondary mb-1.5">
            <span className="text-[10px] font-black tracking-wider text-amber-400 uppercase">INADIMPLENTES MENSALIDADE</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5" />
            </div>
          </div>
          <p className="text-sm sm:text-base lg:text-[15px] xl:text-[16px] 2xl:text-xl font-mono font-black text-amber-400 whitespace-nowrap tracking-tight leading-tight my-1">
            —
          </p>
          <span className="text-[10px] text-secondary font-bold uppercase tracking-wider">Em breve</span>
        </Card>

        <Card
          className={`p-3 sm:p-4 shadow-sm border flex flex-col justify-between ${
            totaisFluxoCaixa.saldoPeriodo >= 0
              ? 'border-emerald-500/20 bg-emerald-500/5'
              : 'border-red-500/30 bg-red-500/10'
          }`}
        >
          <div className="flex items-center justify-between text-secondary mb-1.5">
            <span
              className={`text-[10px] font-black tracking-wider uppercase ${
                totaisFluxoCaixa.saldoPeriodo >= 0 ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              TOTAL
            </span>
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                totaisFluxoCaixa.saldoPeriodo >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
              }`}
            >
              <Activity className="h-3.5 w-3.5" />
            </div>
          </div>
          <p
            className={`text-sm sm:text-base lg:text-[15px] xl:text-[16px] 2xl:text-xl font-mono font-black whitespace-nowrap tracking-tight leading-tight my-1 ${
              totaisFluxoCaixa.saldoPeriodo >= 0 ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {fmtBRL(totaisFluxoCaixa.saldoPeriodo)}
          </p>
          <span className="text-[10px] text-secondary font-bold uppercase tracking-wider">Entradas - Saídas</span>
        </Card>
      </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          GRÁFICO: EVOLUÇÃO DO SALDO DE CAIXA ACUMULADO
         ────────────────────────────────────────────────────────────────────────── */}
      <Card className="p-5 sm:p-6 border-border/30 bg-surface/50 shadow-lg space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/20 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Wallet className="h-4 w-4" />
              </div>
              <h3 className="text-sm sm:text-base font-black text-foreground uppercase tracking-wide">
                FLUXO DE CAIXA — ENTRADAS × SAÍDAS × SALDO ACUMULADO
              </h3>
            </div>
            <p className="text-xs text-secondary font-medium mt-1">
              Movimentação de caixa {camposEstendidos && visaoGraficoFluxoCaixa === 'diario' ? 'dia a dia' : 'mês a mês'}, com base nos lançamentos registrados
            </p>
          </div>

          {camposEstendidos && (
            <div className="flex items-center gap-1 bg-background/60 border border-border/20 p-1 rounded-xl text-xs font-black uppercase">
              <button
                type="button"
                onClick={() => setVisaoGraficoFluxoCaixa('diario')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  visaoGraficoFluxoCaixa === 'diario' ? 'bg-primary text-white' : 'text-secondary hover:text-foreground'
                }`}
              >
                DIÁRIO
              </button>
              <button
                type="button"
                onClick={() => setVisaoGraficoFluxoCaixa('mensal')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  visaoGraficoFluxoCaixa === 'mensal' ? 'bg-primary text-white' : 'text-secondary hover:text-foreground'
                }`}
              >
                MENSAL
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 bg-background/60 border border-border/20 px-3 py-1.5 rounded-xl text-xs font-bold">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-sm" /> ENTRADAS
            </span>
            <span className="text-border/40">•</span>
            <span className="flex items-center gap-1.5 text-red-400">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500 shadow-sm" /> SAÍDAS
            </span>
            <span className="text-border/40">•</span>
            <span className="flex items-center gap-1.5 text-amber-400">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400 shadow-sm" /> {campoLinhaLabel}
            </span>
          </div>
        </div>

        <div className="h-80 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={dadosGraficoFluxoCaixa} margin={{ top: 36, right: 20, left: 10, bottom: 24 }} barGap={8}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--color-border) / 0.1)" vertical={false} />
              <XAxis
                dataKey="mes"
                stroke="rgb(var(--color-foreground))"
                tick={{ fill: 'rgb(var(--color-foreground))', fontWeight: 800, fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: 'rgb(var(--color-border) / 0.2)' }}
                interval={0}
                angle={-35}
                textAnchor="end"
                height={50}
              />
              <YAxis
                stroke="rgb(var(--color-foreground))"
                tick={{ fill: 'rgb(var(--color-foreground))', fontWeight: 700, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => fmtCompact(val)}
              />
              <Tooltip
                cursor={{ fill: 'rgb(var(--color-foreground) / 0.03)' }}
                content={({ active, payload, label }) => {
                  if (!active || !payload || !payload.length) return null

                  const entradas = Number(payload.find((p) => p.dataKey === 'Entradas')?.value || 0)
                  const saidas = Number(payload.find((p) => p.dataKey === 'Saidas')?.value || 0)
                  const acumulado = Number(payload.find((p) => p.dataKey === 'saldoAcumulado')?.value || 0)
                  const saldoMes = entradas - saidas

                  return (
                    <div className="rounded-2xl border border-border/40 bg-surface/95 p-4 shadow-2xl backdrop-blur-md uppercase text-xs space-y-2 min-w-[250px]">
                      <div className="border-b border-border/20 pb-2 flex items-center justify-between">
                        <span className="font-black text-foreground text-sm flex items-center gap-1.5">📅 {label}</span>
                      </div>

                      <div className="space-y-1.5 font-mono">
                        <div className="flex items-center justify-between">
                          <span className="text-emerald-400 font-sans font-bold flex items-center gap-1">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" /> ENTRADAS:
                          </span>
                          <span className="font-bold text-foreground">{fmtBRL(entradas)}</span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-red-400 font-sans font-bold flex items-center gap-1">
                            <span className="h-2 w-2 rounded-full bg-red-500" /> SAÍDAS:
                          </span>
                          <span className="font-bold text-foreground">{fmtBRL(saidas)}</span>
                        </div>
                      </div>

                      <div className="border-t border-border/20 pt-2 space-y-1 font-mono text-[11px]">
                        <div className="flex items-center justify-between">
                          <span className="text-secondary font-sans font-bold">SALDO DO MÊS:</span>
                          <span className={`font-black ${saldoMes >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {fmtBRL(saldoMes)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-secondary font-sans font-bold">SALDO ACUMULADO:</span>
                          <span className={`font-black ${acumulado >= 0 ? 'text-amber-400' : 'text-red-400'}`}>
                            {fmtBRL(acumulado)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                }}
              />
              <Bar dataKey="Entradas" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={56} />
              <Bar dataKey="Saidas" fill="#ef4444" radius={[6, 6, 0, 0]} maxBarSize={56} />
              <Line
                type="monotone"
                dataKey={campoLinha}
                name={campoLinhaLabel}
                stroke="#fbbf24"
                strokeWidth={3}
                dot={{ r: 6, fill: '#f59e0b', stroke: '#ffffff', strokeWidth: 2 }}
                activeDot={{ r: 8, stroke: '#ffffff', strokeWidth: 2 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* ──────────────────────────────────────────────────────────────────────────
          LIVRO-CAIXA: TODOS OS LANÇAMENTOS (DATA, MOVIMENTAÇÃO, DESCRIÇÃO, VALOR, OBSERVAÇÃO)
         ────────────────────────────────────────────────────────────────────────── */}
      <Card className="overflow-hidden border-border/30 bg-surface/50 shadow-md">
        <div className="border-b border-border/20 bg-surface/80 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            <h3 className="text-sm font-black text-foreground uppercase">LANÇAMENTOS</h3>
          </div>
          <Badge tone="neutral" className="text-[10px] font-bold">
            {lancamentos.length} {lancamentos.length === 1 ? 'REGISTRO' : 'REGISTROS'}
          </Badge>
        </div>

        {carregandoLancamentos ? (
          <div className="p-8 flex items-center justify-center gap-2 text-xs text-secondary font-medium">
            <Loader2 className="h-4 w-4 animate-spin" />
            CARREGANDO LANÇAMENTOS...
          </div>
        ) : lancamentos.length === 0 ? (
          <div className="p-8 text-center text-xs text-secondary font-medium lowercase">
            Nenhum lançamento registrado ainda. Use o formulário acima para começar.
          </div>
        ) : (
        <div className="overflow-x-auto max-h-[560px] overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-border/30 bg-surface text-secondary font-black uppercase text-[11px]">
                <th className="py-3 px-4">DATA</th>
                <th className="py-3 px-4">MOVIMENTAÇÃO</th>
                <th className="py-3 px-4">DESCRIÇÃO</th>
                <th className="py-3 px-4 text-right">VALOR</th>
                {camposEstendidos && <th className="py-3 px-4">CLIENTE</th>}
                {camposEstendidos && <th className="py-3 px-4">VENCIMENTO</th>}
                {camposEstendidos && <th className="py-3 px-4 text-center">QTD. VEÍCULOS</th>}
                {camposEstendidos && <th className="py-3 px-4">BOLETO/PIX</th>}
                {camposEstendidos && <th className="py-3 px-4">PGT</th>}
                <th className="py-3 px-4">OBSERVAÇÃO</th>
                <th className="py-3 px-4 text-center">AÇÕES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/10 font-mono">
              {lancamentos.map((l) => {
                const isEntrada = l.movimentacao === 'entrada'
                const [ano, mes, dia] = l.data.split('-')
                const [anoVenc, mesVenc, diaVenc] = l.dataVencimento ? l.dataVencimento.split('-') : []

                return (
                  <tr
                    key={l.id}
                    className={`transition-colors ${isEntrada ? 'bg-emerald-500/10 hover:bg-emerald-500/15' : 'bg-red-500/10 hover:bg-red-500/15'}`}
                  >
                    <td className="py-2.5 px-4 font-bold text-foreground whitespace-nowrap">{`${dia}/${mes}/${ano}`}</td>
                    <td className="py-2.5 px-4">
                      <Badge tone={isEntrada ? 'success' : 'danger'} className="text-[9px] font-bold">
                        {isEntrada ? 'ENTRADA' : 'SAÍDA'}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-4 font-sans font-bold text-foreground">{l.descricao}</td>
                    <td className={`py-2.5 px-4 text-right font-black ${isEntrada ? 'text-emerald-400' : 'text-red-400'}`}>
                      {fmtBRL(l.valor)}
                    </td>
                    {camposEstendidos && (
                      <td className="py-2.5 px-4 font-sans text-secondary">{l.clienteNome || '—'}</td>
                    )}
                    {camposEstendidos && (
                      <td className="py-2.5 px-4 text-secondary whitespace-nowrap">
                        {diaVenc ? `${diaVenc}/${mesVenc}/${anoVenc}` : '—'}
                      </td>
                    )}
                    {camposEstendidos && (
                      <td className="py-2.5 px-4 font-sans text-secondary text-center">{l.quantidadeVeiculos ?? '—'}</td>
                    )}
                    {camposEstendidos && (
                      <td className="py-2.5 px-4 font-sans text-secondary uppercase">{l.formaPagamento || '—'}</td>
                    )}
                    {camposEstendidos && (
                      <td className="py-2.5 px-4">
                        <Badge tone={l.statusPagamento?.toUpperCase() === 'PAGO' ? 'success' : 'warning'} className="text-[9px] font-bold">
                          {l.statusPagamento?.toUpperCase() || 'PENDENTE'}
                        </Badge>
                      </td>
                    )}
                    <td className="py-2.5 px-4 font-sans text-secondary lowercase">{l.observacao || '—'}</td>
                    <td className="py-2.5 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleExcluirLancamento(l.id)}
                        disabled={excluindoLancamentoId === l.id}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-secondary hover:bg-red-500/15 hover:text-red-400 transition-colors disabled:opacity-50"
                        title="Excluir lançamento"
                      >
                        {excluindoLancamentoId === l.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        )}
      </Card>
      </>
      )}

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
                { mes: 'Agosto / 2026', status: 'Apuração Aberta (Atual)', fat: 'R$ 4.321.946,20', rec: 'R$ 4.516.636,31', desp: 'R$ 4.659.549,72', tag: 'EM ABERTO', tagTone: 'warning' },
                { mes: 'Julho / 2026', status: 'Fechamento Consolidado', fat: 'R$ 4.071.713,83', rec: 'R$ 6.003.286,13', desp: 'R$ 5.823.982,53', tag: 'CONCLUÍDO', tagTone: 'success' },
                { mes: 'Junho / 2026', status: 'Fechamento Consolidado', fat: 'R$ 3.935.729,16', rec: 'R$ 4.501.605,61', desp: 'R$ 4.556.820,03', tag: 'CONCLUÍDO', tagTone: 'success' },
                { mes: 'Maio / 2026', status: 'Fechamento Consolidado', fat: 'R$ 3.056.636,95', rec: 'R$ 2.698.802,76', desp: 'R$ 3.414.090,52', tag: 'CONCLUÍDO', tagTone: 'success' },
                { mes: 'Abril / 2026', status: 'Fechamento Consolidado', fat: 'R$ 1.221.524,45', rec: 'R$ 1.221.524,45', desp: 'R$ 1.080.000,00', tag: 'CONCLUÍDO', tagTone: 'success' },
                { mes: 'Março / 2026', status: 'Fechamento Consolidado', fat: 'R$ 1.108.791,10', rec: 'R$ 1.105.972,64', desp: 'R$ 589.000,00', tag: 'CONCLUÍDO', tagTone: 'success' },
                { mes: 'Fevereiro / 2026', status: 'Fechamento Consolidado', fat: 'R$ 2.074.606,07', rec: 'R$ 2.052.685,16', desp: 'R$ 1.669.000,00', tag: 'CONCLUÍDO', tagTone: 'success' },
                { mes: 'Janeiro / 2026', status: 'Fechamento Consolidado', fat: 'R$ 6.595.673,31', rec: 'R$ 6.419.277,00', desp: 'R$ 6.160.000,00', tag: 'CONCLUÍDO', tagTone: 'success' },
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
