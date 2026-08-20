import { useState, useRef, useMemo } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import {
  Building2, Plus, Trash2, Upload, CheckCircle2,
  ArrowUpCircle, ArrowDownCircle, ArrowLeftRight, Link2,
  FileText, AlertCircle, Search, X, Check,
  Wallet, TrendingUp, TrendingDown,
  BarChart3, Calendar,
  Calculator,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/Header'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Label } from '@/components/ui/Input'
import { useContas, type ContaBancaria } from '@/hooks/useContas'
import { useLancamentos, type LancamentoFinanceiro } from '@/hooks/useLancamentos'
import { useExtratoBancario } from '@/hooks/useExtratoBancario'
import { parseOFXFile, type OFXTransaction } from '@/lib/ofxParser'
import { isNativeApp } from '@/lib/isNativeApp'

// ─── Helpers ────────────────────────────────────────────────────────────────
function fmt(val: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)
}

function fmtPct(val: number) {
  if (!isFinite(val) || isNaN(val)) return '0.0%'
  return (val).toFixed(1) + '%'
}

function fmtDate(d: string) {
  if (!d) return ''
  const [y, m, day] = d.split('-')
  return day + '/' + m + '/' + y
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

const CATEGORIAS_PADRAO = [
  // Receitas
  'Faturamento O.S.',
  'Venda de Peças',
  'Serviços Terceiros',
  'Rendimentos Financeiros',
  'Outras Receitas',
  // Custos Operacionais
  'Peças e Insumos',
  'Combustível',
  'Óleos e Lubrificantes',
  'Terceirização Mecânica',
  // Despesas Administrativas
  'Salários e Encargos',
  'Aluguel e IPTU',
  'Energia, Água e Internet',
  'Impostos e Tributos',
  'Tarifas Bancárias',
  'Ferramental e Equipamentos',
  'Transferência entre Contas',
  'Outros'
]

const TIPO_BANCO: Record<ContaBancaria['tipo'], string> = {
  corrente: 'Conta Corrente',
  poupanca: 'Poupança',
  cartao: 'Cartão',
  outro: 'Outro',
}

type Tab = 'lista' | 'conciliacao' | 'dre' | 'contas'

// ─── Modal Conta Form ───────────────────────────────────────────────────────
function ContaForm({
  onSave,
  onClose,
}: {
  onSave: (f: Omit<ContaBancaria, 'id' | 'created_at' | 'ativa'>) => void
  onClose: () => void
}) {
  const [nome, setNome] = useState('')
  const [banco, setBanco] = useState('')
  const [agencia, setAgencia] = useState('')
  const [conta, setConta] = useState('')
  const [tipo, setTipo] = useState<ContaBancaria['tipo']>('corrente')
  const [saldo, setSaldo] = useState('0')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!nome.trim()) return
    onSave({
      nome: nome.toUpperCase(),
      banco,
      agencia,
      conta,
      tipo,
      saldo_inicial: parseFloat(saldo.replace(',', '.')) || 0,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-background border border-border rounded-2xl shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-foreground uppercase flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            NOVA CONTA BANCÁRIA
          </h3>
          <button onClick={onClose} className="text-secondary hover:text-foreground p-1">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label className="!text-xs uppercase">Nome da Conta *</Label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="EX: BRADESCO C/C PRINCIPAL"
              className="!text-sm uppercase"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="!text-xs uppercase">Banco</Label>
              <Input
                value={banco}
                onChange={(e) => setBanco(e.target.value)}
                placeholder="Ex: 237 Bradesco"
                className="!text-sm"
              />
            </div>
            <div>
              <Label className="!text-xs uppercase">Tipo</Label>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value as ContaBancaria['tipo'])}
                className="w-full h-9 rounded-lg border border-border bg-surface text-foreground text-sm px-3 focus:outline-none focus:ring-1 focus:ring-primary uppercase"
              >
                {Object.entries(TIPO_BANCO).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="!text-xs uppercase">Agência</Label>
              <Input
                value={agencia}
                onChange={(e) => setAgencia(e.target.value)}
                placeholder="0001-0"
                className="!text-sm"
              />
            </div>
            <div>
              <Label className="!text-xs uppercase">Conta</Label>
              <Input
                value={conta}
                onChange={(e) => setConta(e.target.value)}
                placeholder="12345-6"
                className="!text-sm"
              />
            </div>
          </div>
          <div>
            <Label className="!text-xs uppercase">Saldo Inicial (R$)</Label>
            <Input
              value={saldo}
              onChange={(e) => setSaldo(e.target.value)}
              type="number"
              step="0.01"
              className="!text-sm"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1 !text-xs uppercase">
              Cancelar
            </Button>
            <Button type="submit" variant="primary" className="flex-1 !text-xs uppercase">
              Salvar Conta
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Modal Lançamento Form ──────────────────────────────────────────────────
function LancamentoForm({
  contas,
  contaId,
  onSave,
  onClose,
}: {
  contas: ContaBancaria[]
  contaId?: string
  onSave: (f: Omit<LancamentoFinanceiro, 'id' | 'created_at' | 'conciliado'>) => void
  onClose: () => void
}) {
  const [tipo, setTipo] = useState<LancamentoFinanceiro['tipo']>('despesa')
  const [cId, setCId] = useState(contaId || contas[0]?.id || '')
  const [data, setData] = useState(today())
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [categoria, setCategoria] = useState(CATEGORIAS_PADRAO[0])
  const [observacao, setObservacao] = useState('')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!descricao.trim() || !valor || !cId) return
    const v = parseFloat(valor.replace(',', '.'))
    onSave({
      conta_id: cId,
      data,
      descricao: descricao.toUpperCase(),
      valor: tipo === 'despesa' ? -Math.abs(v) : Math.abs(v),
      tipo,
      categoria,
      observacao,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-background border border-border rounded-2xl shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-foreground uppercase flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" />
            NOVO LANÇAMENTO
          </h3>
          <button onClick={onClose} className="text-secondary hover:text-foreground p-1">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          {/* Seletor de Tipo */}
          <div className="grid grid-cols-3 gap-1 rounded-xl border border-border p-1 bg-surface">
            {(['receita', 'despesa', 'transferencia'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTipo(t)}
                className={`py-2 rounded-lg text-[11px] font-bold uppercase transition-all ${
                  tipo === t
                    ? t === 'receita'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm'
                      : t === 'despesa'
                      ? 'bg-red-500/20 text-red-400 border border-red-500/40 shadow-sm'
                      : 'bg-blue-500/20 text-blue-400 border border-blue-500/40 shadow-sm'
                    : 'text-secondary hover:text-foreground'
                }`}
              >
                {t === 'transferencia' ? 'Transferência' : t}
              </button>
            ))}
          </div>

          <div>
            <Label className="!text-xs uppercase">Conta Bancária *</Label>
            <select
              value={cId}
              onChange={(e) => setCId(e.target.value)}
              className="w-full h-9 rounded-lg border border-border bg-surface text-foreground text-sm px-3 focus:outline-none focus:ring-1 focus:ring-primary uppercase"
              required
            >
              {contas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="!text-xs uppercase">Data *</Label>
              <Input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="!text-sm"
                required
              />
            </div>
            <div>
              <Label className="!text-xs uppercase">Valor (R$) *</Label>
              <Input
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0,00"
                className="!text-sm"
                required
              />
            </div>
          </div>

          <div>
            <Label className="!text-xs uppercase">Descrição *</Label>
            <Input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="EX: PAGTO FORNECEDOR PEÇAS"
              className="!text-sm uppercase"
              required
            />
          </div>

          <div>
            <Label className="!text-xs uppercase">Categoria DRE</Label>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="w-full h-9 rounded-lg border border-border bg-surface text-foreground text-sm px-3 focus:outline-none focus:ring-1 focus:ring-primary uppercase"
            >
              {CATEGORIAS_PADRAO.map((c) => (
                <option key={c} value={c}>
                  {c.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label className="!text-xs uppercase">Observação (Opcional)</Label>
            <Input
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Nº da NF, detalhes ou comprovante"
              className="!text-sm uppercase"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1 !text-xs uppercase">
              Cancelar
            </Button>
            <Button type="submit" variant="primary" className="flex-1 !text-xs uppercase">
              Salvar Lançamento
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Componente Principal ───────────────────────────────────────────────────
export function Financeiro() {
  if (isNativeApp()) {
    return <Navigate to="/" replace />
  }

  const location = useLocation()
  const navigate = useNavigate()

  const activeTab: Tab = useMemo(() => {
    if (location.pathname === '/financeiro/conciliacao') return 'conciliacao'
    if (location.pathname === '/financeiro/dre') return 'dre'
    if (location.pathname === '/financeiro/contas') return 'contas'
    return 'lista'
  }, [location.pathname])

  const handleTabChange = (tab: Tab) => {
    if (tab === 'conciliacao') navigate('/financeiro/conciliacao')
    else if (tab === 'dre') navigate('/financeiro/dre')
    else if (tab === 'contas') navigate('/financeiro/contas')
    else navigate('/financeiro')
  }

  const [contaSelecionada, setContaSelecionada] = useState<string | undefined>()

  // Hooks de Dados
  const { contas, addConta, removeConta } = useContas()
  const {
    lancamentos,
    loading: lancLoading,
    addLancamento,
    removeLancamento,
    conciliarLancamento,
  } = useLancamentos(contaSelecionada)
  const {
    extrato,
    importarTransacoes,
    conciliarExtrato,
  } = useExtratoBancario(contaSelecionada)

  // Estados de UI
  const [showContaForm, setShowContaForm] = useState(false)
  const [showLancForm, setShowLancForm] = useState(false)
  const [search, setSearch] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<'todos' | LancamentoFinanceiro['tipo']>('todos')
  const [filtroConciliado, setFiltroConciliado] = useState<'todos' | 'sim' | 'nao'>('todos')
  const [periodoAno, setPeriodoAno] = useState<string>(new Date().getFullYear().toString())
  const [periodoMes, setPeriodoMes] = useState<string>('todos')

  // OFX Import State
  const fileRef = useRef<HTMLInputElement>(null)
  const [ofxPreview, setOfxPreview] = useState<{ transactions: OFXTransaction[]; errors: string[] } | null>(null)
  const [ofxImporting, setOfxImporting] = useState(false)
  const [ofxResult, setOfxResult] = useState<{ importados: number; duplicatas: number } | null>(null)

  // Conciliação State
  const [selLanc, setSelLanc] = useState<string | null>(null)
  const [selExtrato, setSelExtrato] = useState<string | null>(null)

  // Filtragem de Lançamentos
  const lancFiltrados = useMemo(() => {
    return lancamentos.filter((l) => {
      if (filtroTipo !== 'todos' && l.tipo !== filtroTipo) return false
      if (filtroConciliado === 'sim' && !l.conciliado) return false
      if (filtroConciliado === 'nao' && l.conciliado) return false
      if (periodoAno && !l.data.startsWith(periodoAno)) return false
      if (periodoMes !== 'todos') {
        const mesStr = periodoMes.padStart(2, '0')
        if (l.data.slice(5, 7) !== mesStr) return false
      }
      if (
        search &&
        !l.descricao.toLowerCase().includes(search.toLowerCase()) &&
        !l.categoria.toLowerCase().includes(search.toLowerCase())
      ) {
        return false
      }
      return true
    })
  }, [lancamentos, search, filtroTipo, filtroConciliado, periodoAno, periodoMes])

  // Saldos por conta
  const saldoPorConta = useMemo(() => {
    const map: Record<string, number> = {}
    for (const c of contas) map[c.id] = c.saldo_inicial
    for (const l of lancamentos) {
      if (map[l.conta_id] !== undefined) map[l.conta_id] += l.valor
      else map[l.conta_id] = l.valor
    }
    return map
  }, [contas, lancamentos])

  const totalReceitas = useMemo(
    () => lancFiltrados.filter((l) => l.valor > 0).reduce((s, l) => s + l.valor, 0),
    [lancFiltrados]
  )
  const totalDespesas = useMemo(
    () => lancFiltrados.filter((l) => l.valor < 0).reduce((s, l) => s + l.valor, 0),
    [lancFiltrados]
  )
  const saldoLiquido = totalReceitas + totalDespesas

  // Dados Estruturados para o DRE
  const dreData = useMemo(() => {
    const lancs = lancFiltrados

    // 1. Receita Bruta
    const receitasOS = lancs.filter(l => l.valor > 0 && l.categoria === 'Faturamento O.S.').reduce((s, l) => s + l.valor, 0)
    const receitasPecas = lancs.filter(l => l.valor > 0 && l.categoria === 'Venda de Peças').reduce((s, l) => s + l.valor, 0)
    const receitasServicos = lancs.filter(l => l.valor > 0 && l.categoria === 'Serviços Terceiros').reduce((s, l) => s + l.valor, 0)
    const outrasReceitas = lancs.filter(l => l.valor > 0 && !['Faturamento O.S.', 'Venda de Peças', 'Serviços Terceiros'].includes(l.categoria)).reduce((s, l) => s + l.valor, 0)
    const receitaBrutaTotal = receitasOS + receitasPecas + receitasServicos + outrasReceitas

    // 2. Deduções / Impostos
    const impostos = Math.abs(lancs.filter(l => l.valor < 0 && l.categoria === 'Impostos e Tributos').reduce((s, l) => s + l.valor, 0))
    const receitaLiquida = receitaBrutaTotal - impostos

    // 3. Custos Operacionais (CPV / CSP)
    const custoPecas = Math.abs(lancs.filter(l => l.valor < 0 && l.categoria === 'Peças e Insumos').reduce((s, l) => s + l.valor, 0))
    const custoCombustivel = Math.abs(lancs.filter(l => l.valor < 0 && l.categoria === 'Combustível').reduce((s, l) => s + l.valor, 0))
    const custoOleos = Math.abs(lancs.filter(l => l.valor < 0 && l.categoria === 'Óleos e Lubrificantes').reduce((s, l) => s + l.valor, 0))
    const custoTerceiros = Math.abs(lancs.filter(l => l.valor < 0 && l.categoria === 'Terceirização Mecânica').reduce((s, l) => s + l.valor, 0))
    const totalCustosOperacionais = custoPecas + custoCombustivel + custoOleos + custoTerceiros

    // 4. Lucro Bruto
    const lucroBruto = receitaLiquida - totalCustosOperacionais
    const margemBruta = receitaLiquida > 0 ? (lucroBruto / receitaLiquida) * 100 : 0

    // 5. Despesas Operacionais e Administrativas
    const despSalarios = Math.abs(lancs.filter(l => l.valor < 0 && l.categoria === 'Salários e Encargos').reduce((s, l) => s + l.valor, 0))
    const despAluguel = Math.abs(lancs.filter(l => l.valor < 0 && l.categoria === 'Aluguel e IPTU').reduce((s, l) => s + l.valor, 0))
    const despEnergia = Math.abs(lancs.filter(l => l.valor < 0 && l.categoria === 'Energia, Água e Internet').reduce((s, l) => s + l.valor, 0))
    const despFerramentas = Math.abs(lancs.filter(l => l.valor < 0 && l.categoria === 'Ferramental e Equipamentos').reduce((s, l) => s + l.valor, 0))
    const outrasDespesas = Math.abs(lancs.filter(l => l.valor < 0 && !['Impostos e Tributos', 'Peças e Insumos', 'Combustível', 'Óleos e Lubrificantes', 'Terceirização Mecânica', 'Salários e Encargos', 'Aluguel e IPTU', 'Energia, Água e Internet', 'Ferramental e Equipamentos', 'Tarifas Bancárias'].includes(l.categoria)).reduce((s, l) => s + l.valor, 0))
    const totalDespesasAdm = despSalarios + despAluguel + despEnergia + despFerramentas + outrasDespesas

    // 6. Resultado Operacional (EBITDA)
    const resultadoOperacional = lucroBruto - totalDespesasAdm

    // 7. Resultado Financeiro
    const rendimentos = lancs.filter(l => l.valor > 0 && l.categoria === 'Rendimentos Financeiros').reduce((s, l) => s + l.valor, 0)
    const tarifas = Math.abs(lancs.filter(l => l.valor < 0 && l.categoria === 'Tarifas Bancárias').reduce((s, l) => s + l.valor, 0))
    const resultadoFinanceiro = rendimentos - tarifas

    // 8. Lucro Líquido
    const lucroLiquido = resultadoOperacional + resultadoFinanceiro
    const margemLiquida = receitaLiquida > 0 ? (lucroLiquido / receitaLiquida) * 100 : 0

    return {
      receitaBrutaTotal,
      receitasOS,
      receitasPecas,
      receitasServicos,
      outrasReceitas,
      impostos,
      receitaLiquida,
      custoPecas,
      custoCombustivel,
      custoOleos,
      custoTerceiros,
      totalCustosOperacionais,
      lucroBruto,
      margemBruta,
      despSalarios,
      despAluguel,
      despEnergia,
      despFerramentas,
      outrasDespesas,
      totalDespesasAdm,
      resultadoOperacional,
      rendimentos,
      tarifas,
      resultadoFinanceiro,
      lucroLiquido,
      margemLiquida
    }
  }, [lancFiltrados])

  // Lógica OFX
  async function handleOFX(file: File) {
    setOfxResult(null)
    try {
      setOfxPreview(await parseOFXFile(file))
    } catch (e) {
      setOfxPreview({ transactions: [], errors: [String(e)] })
    }
  }

  async function confirmarImportacao() {
    if (!ofxPreview || !contaSelecionada) return
    setOfxImporting(true)
    const res = await importarTransacoes(ofxPreview.transactions, contaSelecionada)
    setOfxResult(res)
    setOfxPreview(null)
    setOfxImporting(false)
  }

  // Conciliação
  function parear() {
    if (!selLanc || !selExtrato) return
    conciliarLancamento(selLanc, selExtrato)
    conciliarExtrato(selExtrato, selLanc)
    setSelLanc(null)
    setSelExtrato(null)
  }

  const lancNaoConciliados = lancamentos.filter((l) => !l.conciliado)
  const extratoNaoConciliado = extrato.filter((e) => !e.conciliado)
  const totalConciliados = extrato.filter((e) => e.conciliado).length

  return (
    <div className="space-y-6 animate-fade-in uppercase pb-28">
      {/* Cabeçalho */}
      <PageHeader
        title="FINANCEIRO"
        subtitle="CONTROLE DE FLUXO DE CAIXA, CONCILIAÇÃO BANCÁRIA E DEMONSTRAÇÃO DE RESULTADOS (DRE)"
      />

      {/* Cards de Indicadores Superiores (KPIs) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4 border-emerald-500/20 bg-emerald-500/5 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className="h-4 w-4 text-emerald-400" />
              <span className="text-[10px] font-bold text-secondary">RECEITAS</span>
            </div>
            <p className="text-lg font-black text-emerald-400">{fmt(totalReceitas)}</p>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 font-bold text-xs">
            {lancFiltrados.filter(l => l.valor > 0).length} Lçtos
          </div>
        </Card>

        <Card className="p-4 border-red-500/20 bg-red-500/5 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingDown className="h-4 w-4 text-red-400" />
              <span className="text-[10px] font-bold text-secondary">DESPESAS</span>
            </div>
            <p className="text-lg font-black text-red-400">{fmt(totalDespesas)}</p>
          </div>
          <div className="p-2.5 rounded-xl bg-red-500/10 text-red-400 font-bold text-xs">
            {lancFiltrados.filter(l => l.valor < 0).length} Lçtos
          </div>
        </Card>

        <Card className="p-4 border-primary/20 bg-primary/5 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <Wallet className="h-4 w-4 text-primary" />
              <span className="text-[10px] font-bold text-secondary">SALDO DO PERÍODO</span>
            </div>
            <p className={`text-lg font-black ${saldoLiquido >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {fmt(saldoLiquido)}
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary font-bold text-xs">
            {fmtPct(dreData.margemLiquida)} mg.
          </div>
        </Card>

        <Card className="p-4 border-purple-500/20 bg-purple-500/5 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <CheckCircle2 className="h-4 w-4 text-purple-400" />
              <span className="text-[10px] font-bold text-secondary">CONCILIAÇÃO BANCÁRIA</span>
            </div>
            <p className="text-lg font-black text-purple-400">
              {totalConciliados} <span className="text-xs font-normal text-secondary">conciliados</span>
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 font-bold text-xs">
            {lancNaoConciliados.length} pend.
          </div>
        </Card>
      </div>

      {/* Barra de Filtros Rápidos (Conta e Período) */}
      <Card className="p-3.5 border-border/30 bg-surface/40 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
          {/* Seletor de Conta */}
          <div className="flex items-center gap-1.5">
            <Building2 className="h-4 w-4 text-primary shrink-0" />
            <select
              value={contaSelecionada || ''}
              onChange={(e) => setContaSelecionada(e.target.value || undefined)}
              className="h-9 rounded-lg border border-border bg-background text-foreground text-xs px-3 focus:outline-none focus:ring-1 focus:ring-primary font-bold uppercase"
            >
              <option value="">TODAS AS CONTAS ({contas.length})</option>
              {contas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome} ({fmt(saldoPorConta[c.id] ?? c.saldo_inicial)})
                </option>
              ))}
            </select>
          </div>

          {/* Seletor de Ano */}
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4 text-secondary shrink-0" />
            <select
              value={periodoAno}
              onChange={(e) => setPeriodoAno(e.target.value)}
              className="h-9 rounded-lg border border-border bg-background text-foreground text-xs px-2.5 focus:outline-none focus:ring-1 focus:ring-primary font-bold"
            >
              <option value="">TODOS ANOS</option>
              <option value="2026">2026</option>
              <option value="2025">2025</option>
            </select>
          </div>

          {/* Seletor de Mês */}
          <select
            value={periodoMes}
            onChange={(e) => setPeriodoMes(e.target.value)}
            className="h-9 rounded-lg border border-border bg-background text-foreground text-xs px-2.5 focus:outline-none focus:ring-1 focus:ring-primary font-bold uppercase"
          >
            <option value="todos">TODOS OS MESES</option>
            <option value="1">JANEIRO</option>
            <option value="2">FEVEREIRO</option>
            <option value="3">MARÇO</option>
            <option value="4">ABRIL</option>
            <option value="5">MAIO</option>
            <option value="6">JUNHO</option>
            <option value="7">JULHO</option>
            <option value="8">AGOSTO</option>
            <option value="9">SETEMBRO</option>
            <option value="10">OUTUBRO</option>
            <option value="11">NOVEMBRO</option>
            <option value="12">DEZEMBRO</option>
          </select>
        </div>

        {/* Botões de Ação Rápida */}
        <div className="flex items-center gap-2">
          <Button
            size="md"
            variant="secondary"
            onClick={() => setShowContaForm(true)}
            className="!h-9 !text-xs !px-3 uppercase font-bold gap-1"
          >
            <Building2 className="h-3.5 w-3.5 text-primary" /> + CONTA
          </Button>
          <Button
            size="md"
            variant="primary"
            onClick={() => setShowLancForm(true)}
            disabled={contas.length === 0}
            className="!h-9 !text-xs !px-3.5 uppercase font-black gap-1"
          >
            <Plus className="h-3.5 w-3.5" /> + LANÇAMENTO
          </Button>
        </div>
      </Card>

      {/* Navegação de Abas do Módulo */}
      <div className="flex items-center gap-2 border-b border-border/40 pb-2 overflow-x-auto">
        {[
          { id: 'lista', label: 'LANÇAMENTOS EM LISTA', icon: <FileText className="h-4 w-4" /> },
          { id: 'conciliacao', label: 'CONCILIAÇÃO BANCÁRIA', icon: <Link2 className="h-4 w-4" /> },
          { id: 'dre', label: 'DRE (RESULTADOS)', icon: <BarChart3 className="h-4 w-4" /> },
          { id: 'contas', label: 'CONTAS BANCÁRIAS', icon: <Building2 className="h-4 w-4" /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id as Tab)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-primary text-white shadow-md shadow-primary/20'
                : 'text-secondary hover:text-foreground hover:bg-surface/60'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          1. ABA: LANÇAMENTOS EM LISTA
         ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'lista' && (
        <div className="space-y-4">
          {/* Filtros Internos da Lista */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-secondary pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="BUSCAR POR DESCRIÇÃO, CATEGORIA..."
                className="!pl-9 !h-9 !text-xs"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value as typeof filtroTipo)}
                className="h-9 rounded-lg border border-border bg-surface text-foreground text-xs px-2.5 focus:outline-none focus:ring-1 focus:ring-primary font-bold uppercase"
              >
                <option value="todos">TODOS TIPOS</option>
                <option value="receita">SOMENTE RECEITAS</option>
                <option value="despesa">SOMENTE DESPESAS</option>
                <option value="transferencia">TRANSFERÊNCIAS</option>
              </select>

              <select
                value={filtroConciliado}
                onChange={(e) => setFiltroConciliado(e.target.value as typeof filtroConciliado)}
                className="h-9 rounded-lg border border-border bg-surface text-foreground text-xs px-2.5 focus:outline-none focus:ring-1 focus:ring-primary font-bold uppercase"
              >
                <option value="todos">STATUS CONCILIAÇÃO</option>
                <option value="sim">CONCILIADOS</option>
                <option value="nao">NÃO CONCILIADOS</option>
              </select>
            </div>
          </div>

          {/* Tabela de Lançamentos em Lista */}
          <div className="rounded-2xl border border-border/30 bg-surface/30 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border/40 bg-surface/80 text-secondary font-black uppercase text-[11px]">
                    <th className="py-3 px-4">DATA</th>
                    <th className="py-3 px-4">DESCRIÇÃO</th>
                    <th className="py-3 px-4">CATEGORIA</th>
                    <th className="py-3 px-4">CONTA BANCÁRIA</th>
                    <th className="py-3 px-4 text-right">VALOR (R$)</th>
                    <th className="py-3 px-4 text-center">CONCILIADO</th>
                    <th className="py-3 px-4 text-center">AÇÕES</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {lancLoading && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-secondary">
                        Carregando lançamentos...
                      </td>
                    </tr>
                  )}

                  {!lancLoading && lancFiltrados.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-secondary">
                        <FileText className="h-8 w-8 text-secondary/40 mx-auto mb-2" />
                        Nenhum lançamento financeiro encontrado para os filtros selecionados.
                      </td>
                    </tr>
                  )}

                  {!lancLoading &&
                    lancFiltrados.map((lanc) => {
                      const isPositivo = lanc.valor >= 0
                      const conta = contas.find((c) => c.id === lanc.conta_id)

                      return (
                        <tr
                          key={lanc.id}
                          className={`hover:bg-overlay/5 transition-colors ${
                            lanc.conciliado ? 'bg-emerald-500/[0.02]' : ''
                          }`}
                        >
                          <td className="py-3 px-4 font-bold text-foreground whitespace-nowrap">
                            {fmtDate(lanc.data)}
                          </td>
                          <td className="py-3 px-4 font-black text-foreground min-w-[200px]">
                            <div className="flex items-center gap-2">
                              <span
                                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                                  isPositivo
                                    ? 'bg-emerald-500/15 text-emerald-400'
                                    : 'bg-red-500/15 text-red-400'
                                }`}
                              >
                                {lanc.tipo === 'transferencia' ? (
                                  <ArrowLeftRight className="h-3 w-3 text-blue-400" />
                                ) : isPositivo ? (
                                  <ArrowUpCircle className="h-3 w-3" />
                                ) : (
                                  <ArrowDownCircle className="h-3 w-3" />
                                )}
                              </span>
                              <span className="truncate">{lanc.descricao}</span>
                            </div>
                            {lanc.observacao && (
                              <p className="text-[10px] text-secondary font-normal truncate mt-0.5">
                                Obs: {lanc.observacao}
                              </p>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-md bg-surface border border-border/40 text-secondary font-bold text-[10px]">
                              {lanc.categoria}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-secondary font-medium whitespace-nowrap">
                            {conta ? conta.nome : 'Conta não identificada'}
                          </td>
                          <td
                            className={`py-3 px-4 text-right font-black whitespace-nowrap ${
                              isPositivo ? 'text-emerald-400' : 'text-red-400'
                            }`}
                          >
                            {fmt(lanc.valor)}
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            {lanc.conciliado ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                                <Check className="h-3 w-3" /> CONCILIADO
                              </span>
                            ) : (
                              <span className="inline-flex items-center text-[10px] font-medium text-secondary/60 bg-surface px-2 py-0.5 rounded-full border border-border/30">
                                PENDENTE
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => removeLancamento(lanc.id)}
                              title="Excluir Lançamento"
                              className="text-secondary/40 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-500/10"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          2. ABA: CONCILIAÇÃO BANCÁRIA
         ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'conciliacao' && (
        <div className="space-y-5">
          {/* Card Importar Extrato OFX */}
          <Card className="p-5 border-border/30 bg-gradient-to-br from-surface to-background">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-black text-foreground uppercase flex items-center gap-2">
                  <Upload className="h-4 w-4 text-primary" />
                  IMPORTAÇÃO DE EXTRATO BANCÁRIO (OFX)
                </h3>
                <p className="text-xs text-secondary font-medium mt-0.5">
                  Selecione a conta e carregue o arquivo .ofx baixado do internet banking do seu banco
                </p>
              </div>

              {ofxPreview && (
                <div className="flex items-center gap-2">
                  <Button
                    size="md"
                    variant="secondary"
                    onClick={() => setOfxPreview(null)}
                    className="!h-8 !text-xs !px-3 uppercase"
                  >
                    Cancelar
                  </Button>
                  <Button
                    size="md"
                    variant="primary"
                    onClick={confirmarImportacao}
                    disabled={ofxImporting || !contaSelecionada}
                    className="!h-8 !text-xs !px-4 uppercase font-bold"
                  >
                    {ofxImporting ? 'Importando...' : `Confirmar ${ofxPreview.transactions.length} Lançamentos`}
                  </Button>
                </div>
              )}
            </div>

            {!contaSelecionada && contas.length > 0 && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold mb-3 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                SELECIONE UMA CONTA NO FILTRO SUPERIOR ANTES DE IMPORTAR O EXTRATO OFX
              </div>
            )}

            {/* Dropzone */}
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                const f = e.dataTransfer.files[0]
                if (f) handleOFX(f)
              }}
              className="border-2 border-dashed border-border/50 hover:border-primary/60 transition-all rounded-2xl p-6 text-center cursor-pointer bg-surface/20 hover:bg-surface/40"
            >
              <input
                ref={fileRef}
                type="file"
                accept=".ofx,.qfx,.OFX,.QFX"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handleOFX(f)
                  e.target.value = ''
                }}
              />
              <Upload className="h-8 w-8 text-primary/70 mx-auto mb-2" />
              <p className="text-xs font-black text-foreground uppercase">
                CLIQUE OU ARRASTE O ARQUIVO .OFX AQUI
              </p>
              <p className="text-[11px] text-secondary mt-1">
                Compatível com Bradesco, Itaú, Santander, Banco do Brasil, Caixa, Sicredi, Sicoob e outros.
              </p>
            </div>

            {/* Resultado do OFX */}
            {ofxResult && (
              <div className="mt-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>
                    {ofxResult.importados} transações importadas com sucesso! ({ofxResult.duplicatas} duplicatas ignoradas)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setOfxResult(null)}
                  className="text-xs underline text-emerald-300 font-bold uppercase"
                >
                  OK
                </button>
              </div>
            )}
          </Card>

          {/* Painel de Conciliação Lado a Lado */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-foreground uppercase flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-purple-400" />
                  PAREAMENTO DE TRANSAÇÕES
                </h3>
                <p className="text-[11px] text-secondary font-medium">
                  Selecione 1 lançamento interno e 1 linha do extrato para conferir e parear
                </p>
              </div>

              {selLanc && selExtrato && (
                <Button
                  size="md"
                  variant="primary"
                  onClick={parear}
                  className="!h-9 !text-xs !px-4 uppercase font-black gap-1.5 shadow-lg animate-bounce"
                >
                  <Link2 className="h-4 w-4" /> PAREAR SELECIONADOS
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Coluna 1: Lançamentos Manuais */}
              <Card className="p-4 border-border/30 space-y-3">
                <div className="flex items-center justify-between border-b border-border/30 pb-2">
                  <span className="text-xs font-black text-foreground uppercase">
                    LANÇAMENTOS DO SISTEMA ({lancNaoConciliados.length} PENDENTES)
                  </span>
                  <span className="text-[11px] text-secondary">Clique para selecionar</span>
                </div>

                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                  {lancNaoConciliados.length === 0 && (
                    <p className="text-xs text-secondary text-center py-6">
                      ✓ Todos os lançamentos do sistema estão conciliados!
                    </p>
                  )}

                  {lancNaoConciliados.map((l) => {
                    const selected = selLanc === l.id
                    return (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => setSelLanc(selected ? null : l.id)}
                        className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer ${
                          selected
                            ? 'border-primary bg-primary/10 ring-2 ring-primary/40 shadow-sm'
                            : 'border-border/30 bg-surface/40 hover:border-border hover:bg-surface/80'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-black text-foreground truncate">{l.descricao}</p>
                            <p className="text-[10px] text-secondary mt-0.5">
                              {fmtDate(l.data)} • {l.categoria}
                            </p>
                          </div>
                          <p
                            className={`text-xs font-black whitespace-nowrap ${
                              l.valor >= 0 ? 'text-emerald-400' : 'text-red-400'
                            }`}
                          >
                            {fmt(l.valor)}
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </Card>

              {/* Coluna 2: Extrato Bancário */}
              <Card className="p-4 border-border/30 space-y-3">
                <div className="flex items-center justify-between border-b border-border/30 pb-2">
                  <span className="text-xs font-black text-foreground uppercase">
                    EXTRATO BANCÁRIO ({extratoNaoConciliado.length} PENDENTES)
                  </span>
                  <span className="text-[11px] text-secondary">Importado via OFX</span>
                </div>

                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                  {extratoNaoConciliado.length === 0 && (
                    <p className="text-xs text-secondary text-center py-6">
                      ✓ Todas as linhas do extrato foram conciliadas!
                    </p>
                  )}

                  {extratoNaoConciliado.map((e) => {
                    const selected = selExtrato === e.id
                    const lancSel = selLanc ? lancamentos.find((l) => l.id === selLanc) : null
                    const matchProvavel = lancSel && Math.abs(lancSel.valor - e.valor) < 0.01

                    return (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => setSelExtrato(selected ? null : e.id)}
                        className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer ${
                          selected
                            ? 'border-purple-500 bg-purple-500/10 ring-2 ring-purple-500/40 shadow-sm'
                            : matchProvavel
                            ? 'border-amber-500/50 bg-amber-500/10 animate-pulse'
                            : 'border-border/30 bg-surface/40 hover:border-border hover:bg-surface/80'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-black text-foreground truncate">{e.descricao}</p>
                              {matchProvavel && (
                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 shrink-0">
                                  ✦ MATCH PROVÁVEL
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-secondary mt-0.5">
                              {fmtDate(e.data)} • FITID: {e.id_banco.slice(0, 14)}...
                            </p>
                          </div>
                          <p
                            className={`text-xs font-black whitespace-nowrap ${
                              e.valor >= 0 ? 'text-emerald-400' : 'text-red-400'
                            }`}
                          >
                            {fmt(e.valor)}
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          3. ABA: DRE (DEMONSTRAÇÃO DO RESULTADO DO EXERCÍCIO)
         ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'dre' && (
        <div className="space-y-4">
          {/* Card com o Demonstrativo Gerencial Contábil */}
          <Card className="p-6 border-border/30 bg-gradient-to-b from-surface/80 to-background space-y-6 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/30 pb-4">
              <div>
                <h3 className="text-base font-black text-foreground uppercase flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  DEMONSTRAÇÃO DO RESULTADO DO EXERCÍCIO (DRE GERENCIAL)
                </h3>
                <p className="text-xs text-secondary font-medium mt-0.5">
                  Visão consolidada de Receitas, Custos, Despesas e Margens Líquidas
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-secondary uppercase">
                  PERÍODO: {periodoMes === 'todos' ? 'ANO TODO' : `MÊS ${periodoMes}`} / {periodoAno || 'TODOS'}
                </span>
              </div>
            </div>

            {/* Tabela Estruturada do DRE */}
            <div className="space-y-2 text-xs font-mono font-medium">
              {/* 1. RECEITA BRUTA */}
              <div className="p-3 rounded-xl bg-surface border border-border/30 flex items-center justify-between font-black text-foreground text-sm">
                <span className="text-emerald-400">(+) RECEITA BRUTA OPERACIONAL</span>
                <span className="text-emerald-400">{fmt(dreData.receitaBrutaTotal)}</span>
              </div>
              <div className="pl-6 pr-3 py-1 text-secondary flex justify-between text-xs">
                <span>• Faturamento de Ordens de Serviço (O.S.)</span>
                <span>{fmt(dreData.receitasOS)}</span>
              </div>
              <div className="pl-6 pr-3 py-1 text-secondary flex justify-between text-xs">
                <span>• Venda de Peças e Acessórios</span>
                <span>{fmt(dreData.receitasPecas)}</span>
              </div>
              <div className="pl-6 pr-3 py-1 text-secondary flex justify-between text-xs">
                <span>• Serviços Terceirizados / Outros</span>
                <span>{fmt(dreData.receitasServicos + dreData.outrasReceitas)}</span>
              </div>

              {/* 2. DEDUÇÕES */}
              <div className="p-3 rounded-xl bg-surface/60 border border-border/20 flex items-center justify-between text-xs font-bold text-foreground mt-2">
                <span className="text-red-400">(-) DEDUÇÕES DA RECEITA E IMPOSTOS</span>
                <span className="text-red-400">- {fmt(dreData.impostos)}</span>
              </div>

              {/* 3. RECEITA LÍQUIDA */}
              <div className="p-3 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-between font-black text-primary text-sm mt-2">
                <span>(=) RECEITA OPERACIONAL LÍQUIDA</span>
                <span>{fmt(dreData.receitaLiquida)}</span>
              </div>

              {/* 4. CUSTOS OPERACIONAIS */}
              <div className="p-3 rounded-xl bg-surface/60 border border-border/20 flex items-center justify-between text-xs font-bold text-foreground mt-3">
                <span className="text-amber-400">(-) CUSTOS DOS SERVIÇOS PRESTADOS (CPV / CSP)</span>
                <span className="text-amber-400">- {fmt(dreData.totalCustosOperacionais)}</span>
              </div>
              <div className="pl-6 pr-3 py-1 text-secondary flex justify-between text-xs">
                <span>• Peças, Filtros e Insumos Mecânicos</span>
                <span>- {fmt(dreData.custoPecas)}</span>
              </div>
              <div className="pl-6 pr-3 py-1 text-secondary flex justify-between text-xs">
                <span>• Combustível e Abastecimentos</span>
                <span>- {fmt(dreData.custoCombustivel)}</span>
              </div>
              <div className="pl-6 pr-3 py-1 text-secondary flex justify-between text-xs">
                <span>• Óleos e Lubrificantes</span>
                <span>- {fmt(dreData.custoOleos)}</span>
              </div>
              <div className="pl-6 pr-3 py-1 text-secondary flex justify-between text-xs">
                <span>• Terceirização Especializada</span>
                <span>- {fmt(dreData.custoTerceiros)}</span>
              </div>

              {/* 5. LUCRO BRUTO */}
              <div className="p-3 rounded-xl bg-surface border border-border/40 flex items-center justify-between font-black text-sm mt-3">
                <span className="text-foreground">(=) RESULTADO OPERACIONAL BRUTO (LUCRO BRUTO)</span>
                <div className="text-right">
                  <span className={dreData.lucroBruto >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                    {fmt(dreData.lucroBruto)}
                  </span>
                  <span className="text-[11px] text-secondary ml-2">({fmtPct(dreData.margemBruta)})</span>
                </div>
              </div>

              {/* 6. DESPESAS OPERACIONAIS */}
              <div className="p-3 rounded-xl bg-surface/60 border border-border/20 flex items-center justify-between text-xs font-bold text-foreground mt-3">
                <span className="text-red-400">(-) DESPESAS ADMINISTRATIVAS E FIXAS</span>
                <span className="text-red-400">- {fmt(dreData.totalDespesasAdm)}</span>
              </div>
              <div className="pl-6 pr-3 py-1 text-secondary flex justify-between text-xs">
                <span>• Folha de Pagamento, Salários e Pró-labore</span>
                <span>- {fmt(dreData.despSalarios)}</span>
              </div>
              <div className="pl-6 pr-3 py-1 text-secondary flex justify-between text-xs">
                <span>• Aluguel, IPTU e Condomínio da Oficina</span>
                <span>- {fmt(dreData.despAluguel)}</span>
              </div>
              <div className="pl-6 pr-3 py-1 text-secondary flex justify-between text-xs">
                <span>• Energia Elétrica, Água, Internet e Telefonia</span>
                <span>- {fmt(dreData.despEnergia)}</span>
              </div>
              <div className="pl-6 pr-3 py-1 text-secondary flex justify-between text-xs">
                <span>• Ferramental e Manutenção Interna</span>
                <span>- {fmt(dreData.despFerramentas)}</span>
              </div>
              <div className="pl-6 pr-3 py-1 text-secondary flex justify-between text-xs">
                <span>• Outras Despesas Administrativas</span>
                <span>- {fmt(dreData.outrasDespesas)}</span>
              </div>

              {/* 7. EBITDA */}
              <div className="p-3 rounded-xl bg-surface border border-border/40 flex items-center justify-between font-black text-sm mt-3">
                <span>(=) RESULTADO ANTES DO FINANCIAMENTO (EBITDA)</span>
                <span className={dreData.resultadoOperacional >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                  {fmt(dreData.resultadoOperacional)}
                </span>
              </div>

              {/* 8. RESULTADO FINANCEIRO */}
              <div className="p-3 rounded-xl bg-surface/60 border border-border/20 flex items-center justify-between text-xs font-bold text-foreground mt-2">
                <span className="text-secondary">(+/-) RESULTADO FINANCEIRO LÍQUIDO</span>
                <span className={dreData.resultadoFinanceiro >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                  {fmt(dreData.resultadoFinanceiro)}
                </span>
              </div>

              {/* 9. LUCRO LÍQUIDO FINAL */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-surface to-surface/90 border-2 border-primary flex items-center justify-between font-black text-base mt-4 shadow-lg">
                <div className="flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-primary" />
                  <span className="text-foreground">(=) LUCRO / PREJUÍZO LÍQUIDO DO EXERCÍCIO</span>
                </div>
                <div className="text-right">
                  <span className={dreData.lucroLiquido >= 0 ? 'text-emerald-400 text-lg' : 'text-red-400 text-lg'}>
                    {fmt(dreData.lucroLiquido)}
                  </span>
                  <p className="text-xs text-secondary font-bold">
                    Margem Líquida: {fmtPct(dreData.margemLiquida)}
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          4. ABA: CONTAS BANCÁRIAS
         ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'contas' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-foreground uppercase flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              CONTAS BANCÁRIAS CADASTRADAS ({contas.length})
            </h3>
            <Button
              size="md"
              variant="primary"
              onClick={() => setShowContaForm(true)}
              className="!h-8 !text-xs !px-3 gap-1 uppercase font-bold"
            >
              <Plus className="h-3.5 w-3.5" /> ADICIONAR CONTA
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {contas.map((c) => (
              <Card key={c.id} className="p-4 border-border/30 hover:border-primary/40 transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Building2 className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-sm font-black text-foreground truncate">{c.nome}</span>
                    </div>
                    <div className="space-y-0.5 text-[11px] text-secondary font-medium">
                      {c.banco && <p>BANCO: {c.banco}</p>}
                      {c.agencia && <p>AGÊNCIA: {c.agencia} • CONTA: {c.conta}</p>}
                      <p className="capitalize font-bold text-foreground/80">
                        {TIPO_BANCO[c.tipo]}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p
                      className={`text-base font-black ${
                        (saldoPorConta[c.id] ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {fmt(saldoPorConta[c.id] ?? c.saldo_inicial)}
                    </p>
                    <button
                      type="button"
                      onClick={() => removeConta(c.id)}
                      className="mt-2 text-secondary/40 hover:text-red-400 transition-colors p-1"
                      title="Remover Conta"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Modais */}
      {showContaForm && <ContaForm onSave={addConta} onClose={() => setShowContaForm(false)} />}
      {showLancForm && (
        <LancamentoForm
          contas={contas}
          contaId={contaSelecionada}
          onSave={addLancamento}
          onClose={() => setShowLancForm(false)}
        />
      )}
    </div>
  )
}
