import { useMemo, useState, useEffect, useRef } from 'react'
import {
  Hammer,
  Plus,
  ArrowUpRight,
  RotateCcw,
  Search,
  Truck,
  CheckCircle2,
  Clock,
  Pencil,
  Trash2,
  X,
  Package,
  Layers,
  LayoutList,
  LayoutGrid,
  Camera,
  Image as ImageIcon,
  Eye,
  Loader2,
  Briefcase,
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { PageHeader } from '@/components/layout/Header'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Label } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import {
  useFerramentas,
  useRetiradasFerramentas,
  criarFerramenta,
  atualizarFerramenta,
  excluirFerramenta,
  registrarRetiradaFerramenta,
  registrarDevolucaoFerramenta,
  uploadFotoFerramenta,
} from '@/hooks/useFerramentas'
import { comprimirImagem } from '@/lib/imagem'
import { supabase } from '@/lib/supabase'
import type { Ferramenta, FerramentaRetirada } from '@/lib/types'

export interface ItemCaixa {
  id: string
  nome: string
  quantidade: number
}

export interface CaixaFerramenta {
  id: string
  nome: string
  codigo?: string
  status: 'disponivel' | 'em_uso' | 'manutencao'
  responsavel?: string
  placa?: string
  localizacao?: string
  foto_url?: string | null
  itens: ItemCaixa[]
  observacoes?: string
  data_retirada?: string
  created_at: string
}

const STORAGE_CAIXAS_KEY = 'gvel_caixas_ferramentas_v1'

const CAIXAS_INICIAIS: CaixaFerramenta[] = [
  {
    id: 'caixa_1',
    nome: 'CAIXA 01 - SOCORRO MECÂNICO',
    codigo: 'CX-001',
    status: 'disponivel',
    localizacao: 'ARMÁRIO A1',
    foto_url: null,
    itens: [
      { id: '1', nome: 'Jogo de Chaves Combinadas 6 a 32mm', quantidade: 1 },
      { id: '2', nome: 'Alicate de Pressão Gedore', quantidade: 2 },
      { id: '3', nome: 'Catraca Reversível 1/2 com Extensões', quantidade: 1 },
      { id: '4', nome: 'Jogo de Soquetes Sextavados', quantidade: 1 },
      { id: '5', nome: 'Martelo de Borracha', quantidade: 1 },
    ],
    observacoes: 'Kit completo para atendimento de socorro na pista',
    created_at: new Date().toISOString(),
  },
  {
    id: 'caixa_2',
    nome: 'CAIXA 02 - ELÉTRICA & DIAGNÓSTICO',
    codigo: 'CX-002',
    status: 'disponivel',
    localizacao: 'BANCADA ELÉTRICA',
    foto_url: null,
    itens: [
      { id: '1', nome: 'Multímetro Digital Automotivo Minipa', quantidade: 1 },
      { id: '2', nome: 'Alicate Decapador e Crimpador', quantidade: 1 },
      { id: '3', nome: 'Caneta de Polaridade 12/24V', quantidade: 1 },
      { id: '4', nome: 'Ferro de Solda 60W', quantidade: 1 },
    ],
    observacoes: 'Destinado para manutenção elétrica de caminhões',
    created_at: new Date().toISOString(),
  },
]

const CATEGORIAS_SUGERIDAS = [
  'TODAS',
  'CHAVES E SOQUETES',
  'PNEUMÁTICA',
  'ELÉTRICA E BATERIA',
  'HIDRÁULICA',
  'MEDIÇÃO E DIAGNÓSTICO',
  'CORTE E DESBASTE',
  'INSUMOS',
  'GERAL',
]

export function InventarioFerramentas() {
  const [abaAtiva, setAbaAtiva] = useState<'estoque' | 'em_uso' | 'historico' | 'caixas'>('estoque')
  const [busca, setBusca] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState('TODAS')
  const [modoVisualizacao, setModoVisualizacao] = useState<'lista' | 'grid'>('lista')

  // Caixas de Ferramentas State
  const [caixas, setCaixas] = useState<CaixaFerramenta[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_CAIXAS_KEY)
      if (raw) return JSON.parse(raw)
    } catch {}
    return CAIXAS_INICIAIS
  })
  const [buscaCaixas, setBuscaCaixas] = useState('')
  const [statusFiltroCaixas, setStatusFiltroCaixas] = useState<'TODOS' | 'disponivel' | 'em_uso' | 'manutencao'>('TODOS')
  const [modalCaixaAberto, setModalCaixaAberto] = useState(false)
  const [caixaEditando, setCaixaEditando] = useState<CaixaFerramenta | null>(null)
  const [modalRetiradaCaixaAberto, setModalRetiradaCaixaAberto] = useState(false)
  const [caixaParaRetirar, setCaixaParaRetirar] = useState<CaixaFerramenta | null>(null)

  function salvarCaixas(novasCaixas: CaixaFerramenta[]) {
    setCaixas(novasCaixas)
    try {
      localStorage.setItem(STORAGE_CAIXAS_KEY, JSON.stringify(novasCaixas))
    } catch {}
  }

  // Hooks de ferramentas e retiradas
  const { ferramentas, loading: loadingFerramentas, refetch: refetchFerramentas } = useFerramentas()
  const { retiradas, loading: loadingRetiradas, refetch: refetchRetiradas } = useRetiradasFerramentas()

  // Lista de veículos cadastrados para autocomplete de placas
  const [veiculosLista, setVeiculosLista] = useState<{ id: string; placa: string }[]>([])

  useEffect(() => {
    supabase
      .from('veiculos')
      .select('id, placa')
      .order('placa', { ascending: true })
      .then(({ data }) => {
        if (data) setVeiculosLista(data)
      })
  }, [])

  // Modais
  const [modalFerramentaAberto, setModalFerramentaAberto] = useState(false)
  const [ferramentaEditando, setFerramentaEditando] = useState<Ferramenta | null>(null)

  const [modalRetiradaAberto, setModalRetiradaAberto] = useState(false)
  const [ferramentaSelecionadaParaRetirada, setFerramentaSelecionadaParaRetirada] = useState<Ferramenta | null>(null)

  const [modalDevolucaoAberto, setModalDevolucaoAberto] = useState(false)
  const [retiradaParaDevolver, setRetiradaParaDevolver] = useState<FerramentaRetirada | null>(null)
  const [fotoModalUrl, setFotoModalUrl] = useState<{ url: string; titulo: string } | null>(null)

  // Mensagens de erro/sucesso
  const [mensagemErro, setMensagemErro] = useState<string | null>(null)

  // Métricas
  const metricas = useMemo(() => {
    const totalItens = ferramentas.reduce((acc, f) => acc + (f.quantidade_total || 0), 0)
    const disponiveis = ferramentas.reduce((acc, f) => acc + (f.quantidade_disponivel || 0), 0)
    const emUso = retiradas.filter((r) => r.status === 'em_uso').reduce((acc, r) => acc + (r.quantidade || 0), 0)
    const retiradasAtivasCount = retiradas.filter((r) => r.status === 'em_uso').length

    return {
      totalTipos: ferramentas.length,
      totalItens,
      disponiveis,
      emUso,
      retiradasAtivasCount,
      totalHistorico: retiradas.length,
    }
  }, [ferramentas, retiradas])

  // Filtragem de estoque
  const ferramentasFiltradas = useMemo(() => {
    return ferramentas.filter((f) => {
      const matchBusca =
        !busca.trim() ||
        f.nome.toLowerCase().includes(busca.toLowerCase()) ||
        (f.codigo && f.codigo.toLowerCase().includes(busca.toLowerCase())) ||
        (f.localizacao && f.localizacao.toLowerCase().includes(busca.toLowerCase()))

      const matchCat =
        categoriaFiltro === 'TODAS' ||
        (f.categoria && f.categoria.toUpperCase() === categoriaFiltro.toUpperCase())

      return matchBusca && matchCat
    })
  }, [ferramentas, busca, categoriaFiltro])

  // Retiradas ativas
  const retiradasAtivas = useMemo(() => {
    return retiradas.filter((r) => r.status === 'em_uso')
  }, [retiradas])

  // Caixas Filtradas
  const caixasFiltradas = useMemo(() => {
    return caixas.filter((c) => {
      const matchBusca =
        !buscaCaixas.trim() ||
        c.nome.toLowerCase().includes(buscaCaixas.toLowerCase()) ||
        (c.codigo && c.codigo.toLowerCase().includes(buscaCaixas.toLowerCase())) ||
        (c.placa && c.placa.toLowerCase().includes(buscaCaixas.toLowerCase())) ||
        (c.responsavel && c.responsavel.toLowerCase().includes(buscaCaixas.toLowerCase()))

      const matchStatus = statusFiltroCaixas === 'TODOS' || c.status === statusFiltroCaixas
      return matchBusca && matchStatus
    })
  }, [caixas, buscaCaixas, statusFiltroCaixas])

  // Recarrega tudo
  const recarregarDados = async () => {
    await Promise.all([refetchFerramentas(), refetchRetiradas()])
  }

  // Deletar ferramenta
  const handleExcluirFerramenta = async (f: Ferramenta) => {
    if (!confirm(`DESEJA REALMENTE EXCLUIR A FERRAMENTA "${f.nome.toUpperCase()}" DO CATÁLOGO?`)) return
    try {
      setMensagemErro(null)
      await excluirFerramenta(f.id)
      await recarregarDados()
    } catch (err) {
      setMensagemErro(err instanceof Error ? err.message : 'ERRO AO EXCLUIR FERRAMENTA.')
    }
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12 uppercase">
      {/* Cabeçalho */}
      <PageHeader
        title="INVENTÁRIO DE FERRAMENTAS"
        subtitle="CONTROLE DE ESTOQUE, EMPRÉSTIMO E VINCULAÇÃO COM CAMINHÕES"
        actions={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setFerramentaSelecionadaParaRetirada(null)
                setModalRetiradaAberto(true)
              }}
              className="gap-2 border-primary/30 text-foreground hover:border-primary uppercase font-bold"
            >
              <ArrowUpRight className="h-4 w-4 text-primary" />
              RETIRAR FERRAMENTA
            </Button>
            <Button
              type="button"
              onClick={() => {
                setFerramentaEditando(null)
                setModalFerramentaAberto(true)
              }}
              className="gap-2 uppercase font-bold"
            >
              <Plus className="h-4 w-4" />
              NOVA FERRAMENTA
            </Button>
          </div>
        }
      />

      {mensagemErro && (
        <div className="rounded-xl border border-status-danger/30 bg-status-danger/10 p-4 text-sm text-status-danger flex items-center justify-between uppercase">
          <span>{mensagemErro}</span>
          <button onClick={() => setMensagemErro(null)} className="text-status-danger hover:opacity-75">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Cards de Métricas */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 uppercase">
        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between text-secondary">
            <span className="text-xs font-semibold uppercase tracking-wider">CATÁLOGO</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Hammer className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl sm:text-3xl font-bold tabular-nums text-foreground">
            {loadingFerramentas ? '—' : metricas.totalTipos}
          </p>
          <p className="mt-1 text-xs text-secondary font-medium">{metricas.totalItens} UNIDADES TOTAIS</p>
        </Card>

        <Card className="p-4 sm:p-5 border-emerald-500/20 uppercase">
          <div className="flex items-center justify-between text-secondary">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-500">DISPONÍVEIS</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl sm:text-3xl font-bold tabular-nums text-foreground">
            {loadingFerramentas ? '—' : metricas.disponiveis}
          </p>
          <p className="mt-1 text-xs text-secondary font-medium">PRONTAS NO ESTOQUE</p>
        </Card>

        <Card className="p-4 sm:p-5 border-amber-500/20 uppercase">
          <div className="flex items-center justify-between text-secondary">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-500">EM USO</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
              <Truck className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl sm:text-3xl font-bold tabular-nums text-foreground">
            {loadingRetiradas ? '—' : metricas.emUso}
          </p>
          <p className="mt-1 text-xs text-secondary font-medium">{metricas.retiradasAtivasCount} RETIRADA(S) EM ABERTO</p>
        </Card>

        <Card className="p-4 sm:p-5 uppercase">
          <div className="flex items-center justify-between text-secondary">
            <span className="text-xs font-semibold uppercase tracking-wider">HISTÓRICO</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-overlay/10 text-secondary">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl sm:text-3xl font-bold tabular-nums text-foreground">
            {loadingRetiradas ? '—' : metricas.totalHistorico}
          </p>
          <p className="mt-1 text-xs text-secondary font-medium">MOVIMENTAÇÕES TOTAIS</p>
        </Card>
      </div>

      {/* Abas de Navegação */}
      <div className="flex border-b border-border/10 uppercase">
        <button
          type="button"
          onClick={() => setAbaAtiva('estoque')}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition-colors uppercase ${
            abaAtiva === 'estoque'
              ? 'border-primary text-foreground'
              : 'border-transparent text-secondary hover:text-foreground'
          }`}
        >
          <Package className="h-4 w-4" />
          ESTOQUE DE FERRAMENTAS ({ferramentas.length})
        </button>

        <button
          type="button"
          onClick={() => setAbaAtiva('em_uso')}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition-colors uppercase ${
            abaAtiva === 'em_uso'
              ? 'border-primary text-foreground'
              : 'border-transparent text-secondary hover:text-foreground'
          }`}
        >
          <Truck className="h-4 w-4" />
          EM USO NO MOMENTO
          {metricas.retiradasAtivasCount > 0 && (
            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-bold text-amber-500">
              {metricas.retiradasAtivasCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setAbaAtiva('historico')}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition-colors uppercase ${
            abaAtiva === 'historico'
              ? 'border-primary text-foreground'
              : 'border-transparent text-secondary hover:text-foreground'
          }`}
        >
          <Clock className="h-4 w-4" />
          HISTÓRICO DE RETIRADAS
        </button>

        <button
          type="button"
          onClick={() => setAbaAtiva('caixas')}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition-colors uppercase ${
            abaAtiva === 'caixas'
              ? 'border-primary text-foreground'
              : 'border-transparent text-secondary hover:text-foreground'
          }`}
        >
          <Briefcase className="h-4 w-4" />
          CAIXAS DE FERRAMENTAS ({caixas.length})
          {caixas.filter((c) => c.status === 'em_uso').length > 0 && (
            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-bold text-amber-500">
              {caixas.filter((c) => c.status === 'em_uso').length}
            </span>
          )}
        </button>
      </div>

      {/* ==================== ABA 1: ESTOQUE DE FERRAMENTAS ==================== */}
      {abaAtiva === 'estoque' && (
        <div className="space-y-4 uppercase">
          {/* Filtros, Busca e Alternador de Visualização */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 items-center gap-2 max-w-lg">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary" />
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="BUSCAR POR NOME, CÓDIGO OU LOCALIZAÇÃO..."
                  className="h-10 w-full rounded-xl border border-border/10 bg-surface pl-9 pr-4 text-sm text-foreground placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary uppercase"
                />
              </div>

              {/* Botões de Alternância Lista / Grade */}
              <div className="flex items-center rounded-xl border border-border/20 bg-surface p-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setModoVisualizacao('lista')}
                  className={`rounded-lg p-1.5 transition-colors cursor-pointer ${
                    modoVisualizacao === 'lista'
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-secondary hover:text-foreground'
                  }`}
                  title="VISUALIZAÇÃO EM LISTA"
                  aria-label="VISUALIZAÇÃO EM LISTA"
                >
                  <LayoutList className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setModoVisualizacao('grid')}
                  className={`rounded-lg p-1.5 transition-colors cursor-pointer ${
                    modoVisualizacao === 'grid'
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-secondary hover:text-foreground'
                  }`}
                  title="VISUALIZAÇÃO EM GRADE"
                  aria-label="VISUALIZAÇÃO EM GRADE"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Categorias */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {CATEGORIAS_SUGERIDAS.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoriaFiltro(cat)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors whitespace-nowrap uppercase cursor-pointer ${
                    categoriaFiltro === cat
                      ? 'bg-primary text-white'
                      : 'bg-overlay/5 text-secondary hover:bg-overlay/10 hover:text-foreground'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Lista do Estoque */}
          {loadingFerramentas ? (
            <div className="flex min-h-[30vh] items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-secondary/30 border-t-primary" />
            </div>
          ) : ferramentasFiltradas.length === 0 ? (
            <Card className="p-12 text-center uppercase">
              <Hammer className="mx-auto mb-3 h-10 w-10 text-secondary" />
              <p className="text-base font-bold text-foreground">NENHUMA FERRAMENTA ENCONTRADA</p>
              <p className="mt-1 text-sm text-secondary">
                {busca || categoriaFiltro !== 'TODAS'
                  ? 'TENTE ALTERAR OS FILTROS DE BUSCA.'
                  : 'CADASTRE SUA PRIMEIRA FERRAMENTA CLICANDO NO BOTÃO "NOVA FERRAMENTA".'}
              </p>
            </Card>
          ) : modoVisualizacao === 'lista' ? (
            <div className="space-y-2">
              {/* Desktop: Lista / Tabela de Estoque em Grid */}
              <div className="hidden md:block overflow-hidden rounded-2xl border border-border/30 bg-surface/60 shadow-sm backdrop-blur-sm">
                <div className="grid grid-cols-[130px_minmax(220px,1fr)_160px_160px_110px_160px] items-center gap-3 border-b border-border/15 bg-surface/80 px-4 py-3 text-[11px] font-black text-secondary tracking-wider">
                  <div>CÓDIGO</div>
                  <div>FERRAMENTA / DESCRIÇÃO</div>
                  <div>CATEGORIA</div>
                  <div>LOCALIZAÇÃO</div>
                  <div className="text-center">ESTOQUE DISP.</div>
                  <div className="text-right">AÇÕES</div>
                </div>

                <div className="divide-y divide-border/10">
                  {ferramentasFiltradas.map((f) => {
                    const emUsoQtd = (f.quantidade_total || 0) - (f.quantidade_disponivel || 0)
                    const semEstoque = (f.quantidade_disponivel || 0) <= 0

                    return (
                      <div
                        key={f.id}
                        className="grid grid-cols-[130px_minmax(220px,1fr)_160px_160px_110px_160px] items-center gap-3 px-4 py-3 transition-colors hover:bg-overlay/5"
                      >
                        {/* CÓDIGO & FOTO */}
                        <div className="flex items-center gap-2.5 min-w-0">
                          {f.foto_url ? (
                            <button
                              type="button"
                              onClick={() => setFotoModalUrl({ url: f.foto_url!, titulo: f.nome })}
                              className="relative group/thumb h-9 w-9 shrink-0 overflow-hidden rounded-xl border border-primary/30 bg-surface shadow-sm cursor-pointer hover:border-primary transition-all"
                              title="Ver foto ampliada"
                            >
                              <img
                                src={f.foto_url}
                                alt={f.nome}
                                className="h-full w-full object-cover group-hover/thumb:scale-110 transition-transform duration-200"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-opacity">
                                <Eye className="h-3.5 w-3.5 text-white" />
                              </div>
                            </button>
                          ) : (
                            <div className="h-9 w-9 shrink-0 flex items-center justify-center rounded-xl border border-border/20 bg-surface text-secondary/50">
                              <Hammer className="h-4 w-4" />
                            </div>
                          )}
                          <span className="inline-flex rounded-lg bg-primary/10 border border-primary/20 px-2 py-0.5 text-xs font-mono font-black text-primary truncate max-w-[85px]">
                            {f.codigo || 'S/ CÓD'}
                          </span>
                        </div>

                        {/* FERRAMENTA / DESCRIÇÃO */}
                        <div className="min-w-0 pr-2">
                          <div className="font-bold text-foreground leading-snug truncate">
                            {f.nome}
                          </div>
                          {f.observacoes && (
                            <div className="text-[11px] text-secondary line-clamp-1 italic mt-0.5 truncate">
                              "{f.observacoes}"
                            </div>
                          )}
                        </div>

                        {/* CATEGORIA */}
                        <div className="truncate">
                          <span className="rounded-lg bg-overlay/5 border border-border/20 px-2 py-0.5 text-[11px] font-bold text-secondary truncate inline-block max-w-full">
                            {f.categoria || 'GERAL'}
                          </span>
                        </div>

                        {/* LOCALIZAÇÃO */}
                        <div className="truncate">
                          {f.localizacao ? (
                            <span className="text-xs font-semibold text-foreground flex items-center gap-1 truncate">
                              <Layers className="h-3.5 w-3.5 text-secondary shrink-0" />
                              <span className="truncate">{f.localizacao}</span>
                            </span>
                          ) : (
                            <span className="text-xs text-secondary">—</span>
                          )}
                        </div>

                        {/* ESTOQUE DISP. */}
                        <div className="text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <span className={`text-base font-black tabular-nums ${semEstoque ? 'text-status-danger' : 'text-emerald-500'}`}>
                              {f.quantidade_disponivel}
                            </span>
                            <span className="text-xs text-secondary font-semibold">/ {f.quantidade_total}</span>
                          </div>
                          {emUsoQtd > 0 && (
                            <span className="inline-block mt-0.5 text-[10px] font-black text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                              {emUsoQtd} EM USO
                            </span>
                          )}
                        </div>

                        {/* AÇÕES */}
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            type="button"
                            size="md"
                            disabled={semEstoque}
                            onClick={() => {
                              setFerramentaSelecionadaParaRetirada(f)
                              setModalRetiradaAberto(true)
                            }}
                            className="!h-8 !px-3 !text-xs gap-1 uppercase font-bold"
                          >
                            <ArrowUpRight className="h-3.5 w-3.5" />
                            RETIRAR
                          </Button>
                          <button
                            type="button"
                            onClick={() => {
                              setFerramentaEditando(f)
                              setModalFerramentaAberto(true)
                            }}
                            className="rounded-lg p-1.5 text-secondary hover:bg-overlay/10 hover:text-foreground transition-colors cursor-pointer"
                            title="EDITAR FERRAMENTA"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExcluirFerramenta(f)}
                            className="rounded-lg p-1.5 text-secondary hover:bg-status-danger/10 hover:text-status-danger transition-colors cursor-pointer"
                            title="EXCLUIR FERRAMENTA"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Mobile: Lista Compacta e Fluida */}
              <div className="md:hidden space-y-2.5">
                {ferramentasFiltradas.map((f) => {
                  const emUsoQtd = (f.quantidade_total || 0) - (f.quantidade_disponivel || 0)
                  const semEstoque = (f.quantidade_disponivel || 0) <= 0

                  return (
                    <div
                      key={f.id}
                      className="rounded-2xl border border-border/30 bg-surface/70 p-3.5 space-y-2.5 transition-all shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded-lg bg-primary/10 border border-primary/20 px-2 py-0.5 text-[11px] font-mono font-black text-primary">
                            {f.codigo || 'S/ CÓD'}
                          </span>
                          <span className="rounded-lg bg-overlay/5 border border-border/20 px-2 py-0.5 text-[11px] font-bold text-secondary">
                            {f.categoria || 'GERAL'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setFerramentaEditando(f)
                              setModalFerramentaAberto(true)
                            }}
                            className="p-1.5 text-secondary hover:text-foreground cursor-pointer"
                            title="EDITAR"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExcluirFerramenta(f)}
                            className="p-1.5 text-secondary hover:text-status-danger cursor-pointer"
                            title="EXCLUIR"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        {f.foto_url ? (
                          <button
                            type="button"
                            onClick={() => setFotoModalUrl({ url: f.foto_url!, titulo: f.nome })}
                            className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-primary/30 bg-surface shadow-sm cursor-pointer"
                          >
                            <img
                              src={f.foto_url}
                              alt={f.nome}
                              className="h-full w-full object-cover"
                            />
                          </button>
                        ) : null}

                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-black text-foreground uppercase">{f.nome}</h4>
                          {f.localizacao && (
                            <p className="text-xs text-secondary font-medium mt-0.5">
                              LOCAL: <strong className="text-foreground">{f.localizacao}</strong>
                            </p>
                          )}
                          {f.observacoes && (
                            <p className="text-[11px] text-secondary/80 italic mt-0.5 line-clamp-1">
                              "{f.observacoes}"
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-border/10">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-base font-black ${semEstoque ? 'text-status-danger' : 'text-emerald-500'}`}>
                            {f.quantidade_disponivel}
                          </span>
                          <span className="text-xs text-secondary font-semibold">/ {f.quantidade_total} DISP.</span>
                          {emUsoQtd > 0 && (
                            <span className="text-[10px] font-black text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded ml-1 border border-amber-500/20">
                              {emUsoQtd} EM USO
                            </span>
                          )}
                        </div>
                        <Button
                          type="button"
                          size="md"
                          disabled={semEstoque}
                          onClick={() => {
                            setFerramentaSelecionadaParaRetirada(f)
                            setModalRetiradaAberto(true)
                          }}
                          className="!h-8 !px-3 !text-xs gap-1 uppercase font-bold"
                        >
                          <ArrowUpRight className="h-3.5 w-3.5" />
                          RETIRAR
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {ferramentasFiltradas.map((f) => {
                const emUsoQtd = (f.quantidade_total || 0) - (f.quantidade_disponivel || 0)
                const semEstoque = (f.quantidade_disponivel || 0) <= 0

                return (
                  <Card
                    key={f.id}
                    className="group relative flex flex-col justify-between overflow-hidden p-5 transition-all duration-200 hover:border-primary/40 hover:shadow-xl uppercase"
                  >
                    <div>
                      {/* Foto no Card Grid */}
                      {f.foto_url && (
                        <div
                          onClick={() => setFotoModalUrl({ url: f.foto_url!, titulo: f.nome })}
                          className="group/img relative mb-3 h-36 w-full overflow-hidden rounded-2xl border border-border/20 bg-background/80 cursor-pointer"
                        >
                          <img
                            src={f.foto_url}
                            alt={f.nome}
                            className="h-full w-full object-cover group-hover/img:scale-105 transition-transform duration-300"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 flex items-center justify-center gap-1.5 text-white text-xs font-bold transition-opacity">
                            <Eye className="h-4 w-4" />
                            <span>AMPLIAR FOTO</span>
                          </div>
                        </div>
                      )}

                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="rounded-lg bg-primary/10 px-2 py-0.5 text-[11px] font-mono font-bold text-primary">
                            {f.codigo || 'S/ CÓD'}
                          </span>
                          <span className="rounded-lg bg-overlay/5 px-2 py-0.5 text-[11px] font-semibold text-secondary uppercase">
                            {f.categoria || 'GERAL'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={() => {
                              setFerramentaEditando(f)
                              setModalFerramentaAberto(true)
                            }}
                            className="rounded-lg p-1.5 text-secondary hover:bg-overlay/10 hover:text-foreground transition-colors cursor-pointer"
                            aria-label="EDITAR"
                            title="EDITAR FERRAMENTA"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExcluirFerramenta(f)}
                            className="rounded-lg p-1.5 text-secondary hover:bg-status-danger/10 hover:text-status-danger transition-colors cursor-pointer"
                            aria-label="EXCLUIR"
                            title="EXCLUIR FERRAMENTA"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      <h3 className="mt-2.5 text-base font-bold text-foreground leading-snug uppercase">
                        {f.nome}
                      </h3>

                      {f.localizacao && (
                        <p className="mt-1 flex items-center gap-1 text-xs text-secondary uppercase font-medium">
                          <Layers className="h-3 w-3 text-secondary" />
                          <span>LOCAL: <strong className="text-foreground">{f.localizacao}</strong></span>
                        </p>
                      )}

                      {f.observacoes && (
                        <p className="mt-2 text-xs text-secondary line-clamp-2 italic uppercase">
                          "{f.observacoes}"
                        </p>
                      )}
                    </div>

                    <div className="mt-4 pt-4 border-t border-border/10 flex items-center justify-between">
                      <div>
                        <div className="flex items-baseline gap-1.5">
                          <span className={`text-xl font-bold tabular-nums ${semEstoque ? 'text-status-danger' : 'text-emerald-500'}`}>
                            {f.quantidade_disponivel}
                          </span>
                          <span className="text-xs text-secondary uppercase font-medium">/ {f.quantidade_total} DISP.</span>
                        </div>
                        {emUsoQtd > 0 && (
                          <p className="text-[11px] text-amber-500 font-bold uppercase">
                            {emUsoQtd} EM USO
                          </p>
                        )}
                      </div>

                      <Button
                        type="button"
                        size="md"
                        disabled={semEstoque}
                        onClick={() => {
                          setFerramentaSelecionadaParaRetirada(f)
                          setModalRetiradaAberto(true)
                        }}
                        className="gap-1.5 text-xs h-9 px-3 uppercase font-bold"
                      >
                        <ArrowUpRight className="h-3.5 w-3.5" />
                        RETIRAR
                      </Button>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ==================== ABA 2: EM USO NO MOMENTO ==================== */}
      {abaAtiva === 'em_uso' && (
        <div className="space-y-4 uppercase">
          {loadingRetiradas ? (
            <div className="flex min-h-[30vh] items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-secondary/30 border-t-primary" />
            </div>
          ) : retiradasAtivas.length === 0 ? (
            <Card className="p-12 text-center uppercase">
              <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-500" />
              <p className="text-base font-bold text-foreground">NENHUMA FERRAMENTA EM USO NO MOMENTO</p>
              <p className="mt-1 text-sm text-secondary font-medium">
                TODAS AS FERRAMENTAS ESTÃO DISPONÍVEIS NO ESTOQUE.
              </p>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {retiradasAtivas.map((r) => {
                const dataFormatada = format(new Date(r.data_hora_retirada), "dd/MM/yyyy 'ÀS' HH:mm", { locale: ptBR })

                return (
                  <Card key={r.id} className="p-5 border-amber-500/30 flex flex-col justify-between uppercase">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-1 rounded-lg bg-primary/20 px-2.5 py-1 text-xs font-mono font-bold text-primary">
                            <Truck className="h-3.5 w-3.5" />
                            {r.placa}
                          </span>
                          <Badge tone="warning" className="text-[11px] uppercase font-bold">
                            {r.quantidade} UN.
                          </Badge>
                        </div>
                        <span className="text-[11px] text-secondary flex items-center gap-1 uppercase font-medium">
                          <Clock className="h-3 w-3" />
                          {dataFormatada}
                        </span>
                      </div>

                      <h3 className="mt-3 text-base font-bold text-foreground uppercase">
                        {r.ferramenta?.nome || 'FERRAMENTA'}
                      </h3>

                      <div className="mt-2 flex items-center gap-2">
                        {(r.foto_responsavel_url || r.foto_url) ? (
                          <button
                            type="button"
                            onClick={() =>
                              setFotoModalUrl({
                                url: r.foto_responsavel_url || r.foto_url || '',
                                titulo: `Foto do Responsável: ${r.responsavel}`,
                              })
                            }
                            className="relative group shrink-0"
                            title="Clique para ver a foto ampliada"
                          >
                            <img
                              src={r.foto_responsavel_url || r.foto_url || ''}
                              alt={r.responsavel}
                              className="h-9 w-9 rounded-full object-cover border-2 border-primary/40 group-hover:border-primary transition-all shadow-sm"
                            />
                            <div className="absolute inset-0 rounded-full bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                              <Eye className="h-3.5 w-3.5 text-white" />
                            </div>
                          </button>
                        ) : (
                          <div className="h-9 w-9 rounded-full bg-surface border border-border/30 flex items-center justify-center text-xs font-black text-secondary shrink-0">
                            {r.responsavel.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <p className="text-xs text-secondary uppercase font-medium">
                          RESPONSÁVEL: <strong className="text-foreground font-bold">{r.responsavel}</strong>
                        </p>
                      </div>

                      {r.observacoes_retirada && (
                        <p className="mt-2 text-xs text-secondary italic bg-background/50 p-2 rounded-lg uppercase">
                          "{r.observacoes_retirada}"
                        </p>
                      )}
                    </div>

                    <div className="mt-4 pt-4 border-t border-border/10 flex justify-end">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          setRetiradaParaDevolver(r)
                          setModalDevolucaoAberto(true)
                        }}
                        className="gap-1.5 text-xs border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10 hover:border-emerald-500 uppercase font-bold"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        REGISTRAR DEVOLUÇÃO
                      </Button>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ==================== ABA 3: HISTÓRICO GERAL ==================== */}
      {abaAtiva === 'historico' && (
        <Card className="overflow-hidden uppercase">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm uppercase">
              <thead className="border-b border-border/10 bg-overlay/5 text-[11px] font-bold uppercase tracking-wider text-secondary">
                <tr>
                  <th className="px-4 py-3">FERRAMENTA</th>
                  <th className="px-4 py-3">PLACA / CAMINHÃO</th>
                  <th className="px-4 py-3">RESPONSÁVEL</th>
                  <th className="px-4 py-3">QTD</th>
                  <th className="px-4 py-3">DATA RETIRADA</th>
                  <th className="px-4 py-3">DATA DEVOLUÇÃO</th>
                  <th className="px-4 py-3">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/5">
                {retiradas.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-secondary font-medium uppercase">
                      NENHUM HISTÓRICO REGISTRADO AINDA.
                    </td>
                  </tr>
                ) : (
                  retiradas.map((r) => {
                    const dataRet = format(new Date(r.data_hora_retirada), "dd/MM/yyyy HH:mm", { locale: ptBR })
                    const dataDev = r.data_hora_devolucao
                      ? format(new Date(r.data_hora_devolucao), "dd/MM/yyyy HH:mm", { locale: ptBR })
                      : '—'

                    return (
                      <tr key={r.id} className="hover:bg-overlay/[0.02] transition-colors uppercase">
                        <td className="px-4 py-3">
                          <p className="font-bold text-foreground uppercase">{r.ferramenta?.nome || 'FERRAMENTA'}</p>
                          {r.ferramenta?.codigo && (
                            <span className="text-[10px] font-mono text-secondary font-semibold">{r.ferramenta.codigo}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono font-bold text-primary">{r.placa}</span>
                        </td>
                        <td className="px-4 py-3 text-secondary font-medium">
                          <div className="flex items-center gap-2">
                            {(r.foto_responsavel_url || r.foto_url) && (
                              <button
                                type="button"
                                onClick={() =>
                                  setFotoModalUrl({
                                    url: r.foto_responsavel_url || r.foto_url || '',
                                    titulo: `Foto do Responsável: ${r.responsavel}`,
                                  })
                                }
                                className="shrink-0"
                                title="Ver foto do responsável"
                              >
                                <img
                                  src={r.foto_responsavel_url || r.foto_url || ''}
                                  alt={r.responsavel}
                                  className="h-6 w-6 rounded-full object-cover border border-primary/40 hover:scale-110 transition-transform"
                                />
                              </button>
                            )}
                            <span>{r.responsavel}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-bold text-foreground">{r.quantidade}</td>
                        <td className="px-4 py-3 text-xs text-secondary font-medium">{dataRet}</td>
                        <td className="px-4 py-3 text-xs text-secondary font-medium">{dataDev}</td>
                        <td className="px-4 py-3">
                          {r.status === 'em_uso' && (
                            <Badge tone="warning" className="text-[11px] uppercase font-bold">
                              EM USO
                            </Badge>
                          )}
                          {r.status === 'devolvido' && (
                            <Badge tone="success" className="text-[11px] uppercase font-bold">
                              DEVOLVIDO
                            </Badge>
                          )}
                          {r.status === 'avaria_perda' && (
                            <Badge tone="danger" className="text-[11px] uppercase font-bold">
                              AVARIA / PERDA
                            </Badge>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ==================== ABA 4: CAIXAS DE FERRAMENTAS ==================== */}
      {abaAtiva === 'caixas' && (
        <div className="space-y-4 uppercase">
          {/* Barra de Filtros e Busca de Caixas */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary" />
              <input
                value={buscaCaixas}
                onChange={(e) => setBuscaCaixas(e.target.value)}
                placeholder="BUSCAR CAIXA POR NOME, CÓDIGO OU PLACA..."
                className="h-10 w-full rounded-xl border border-border/10 bg-surface pl-9 pr-4 text-sm text-foreground placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary uppercase"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 bg-overlay/5 p-1 rounded-xl">
                {(['TODOS', 'disponivel', 'em_uso', 'manutencao'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFiltroCaixas(st)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors uppercase cursor-pointer ${
                      statusFiltroCaixas === st
                        ? 'bg-primary text-white shadow-sm'
                        : 'text-secondary hover:text-foreground'
                    }`}
                  >
                    {st === 'TODOS'
                      ? 'TODAS'
                      : st === 'disponivel'
                      ? 'DISPONÍVEIS'
                      : st === 'em_uso'
                      ? 'EM USO'
                      : 'MANUTENÇÃO'}
                  </button>
                ))}
              </div>

              <Button
                type="button"
                onClick={() => {
                  setCaixaEditando(null)
                  setModalCaixaAberto(true)
                }}
                className="gap-2 text-xs font-bold uppercase shadow-md shadow-primary/20"
              >
                <Plus className="h-4 w-4" />
                NOVA CAIXA
              </Button>
            </div>
          </div>

          {/* Grid de Cards de Caixas de Ferramentas */}
          {caixasFiltradas.length === 0 ? (
            <Card className="p-8 text-center text-sm text-secondary font-medium">
              NENHUMA CAIXA DE FERRAMENTAS ENCONTRADA.
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {caixasFiltradas.map((caixa) => {
                const totalItensNaCaixa = caixa.itens.reduce((acc, it) => acc + (it.quantidade || 1), 0)
                return (
                  <Card
                    key={caixa.id}
                    className="p-5 flex flex-col justify-between border border-border/20 hover:border-primary/40 transition-all shadow-md group relative overflow-hidden bg-surface"
                  >
                    <div>
                      {/* Topo do Card com Foto ou Ícone + Status */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3">
                          {caixa.foto_url ? (
                            <button
                              type="button"
                              onClick={() => setFotoModalUrl({ url: caixa.foto_url!, titulo: caixa.nome })}
                              className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-primary/20 hover:border-primary transition-all group/foto cursor-pointer"
                            >
                              <img
                                src={caixa.foto_url}
                                alt={caixa.nome}
                                className="h-full w-full object-cover"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/foto:opacity-100 flex items-center justify-center transition-opacity text-white">
                                <Eye className="h-4 w-4" />
                              </div>
                            </button>
                          ) : (
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 font-bold text-xl">
                              🧰
                            </div>
                          )}

                          <div className="min-w-0">
                            <h3 className="font-bold text-foreground text-sm leading-tight uppercase group-hover:text-primary transition-colors">
                              {caixa.nome}
                            </h3>
                            <div className="flex items-center gap-2 mt-1">
                              {caixa.codigo && (
                                <span className="font-mono text-[11px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                                  {caixa.codigo}
                                </span>
                              )}
                              {caixa.localizacao && (
                                <span className="text-[10px] text-secondary font-medium">
                                  📍 {caixa.localizacao}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div>
                          {caixa.status === 'disponivel' && (
                            <Badge tone="success" className="text-[10px] font-bold">
                              DISPONÍVEL
                            </Badge>
                          )}
                          {caixa.status === 'em_uso' && (
                            <Badge tone="warning" className="text-[10px] font-bold">
                              EM USO
                            </Badge>
                          )}
                          {caixa.status === 'manutencao' && (
                            <Badge tone="danger" className="text-[10px] font-bold">
                              MANUTENÇÃO
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Informações de Uso (Se estiver em uso) */}
                      {caixa.status === 'em_uso' && (
                        <div className="mb-3 rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-secondary font-semibold">CAMINHÃO / PLACA:</span>
                            <span className="font-mono font-bold text-primary">{caixa.placa || 'NÃO INFORMADA'}</span>
                          </div>
                          {caixa.responsavel && (
                            <div className="flex items-center justify-between">
                              <span className="text-secondary font-semibold">RESPONSÁVEL:</span>
                              <span className="font-bold text-foreground">{caixa.responsavel}</span>
                            </div>
                          )}
                          {caixa.data_retirada && (
                            <div className="flex items-center justify-between text-[11px] text-secondary pt-0.5">
                              <span>RETIRADA EM:</span>
                              <span>{format(new Date(caixa.data_retirada), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Lista de Ferramentas dentro da Caixa */}
                      <div className="mt-3 border-t border-border/10 pt-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[11px] font-bold text-secondary uppercase">
                            FERRAMENTAS INCLUSAS ({totalItensNaCaixa} ITENS):
                          </span>
                        </div>
                        <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                          {caixa.itens.map((it) => (
                            <div
                              key={it.id}
                              className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-background/60 border border-border/5"
                            >
                              <span className="text-foreground font-medium truncate pr-2">
                                • {it.nome}
                              </span>
                              <span className="font-bold text-primary shrink-0 text-[11px]">
                                {it.quantidade}x
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {caixa.observacoes && (
                        <p className="mt-2 text-[11px] text-secondary italic line-clamp-2">
                          "{caixa.observacoes}"
                        </p>
                      )}
                    </div>

                    {/* Botões de Ação do Card */}
                    <div className="mt-4 pt-3 border-t border-border/10 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setCaixaEditando(caixa)
                            setModalCaixaAberto(true)
                          }}
                          className="h-8 w-8 text-secondary hover:text-foreground"
                          title="Editar Caixa"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm(`Excluir a caixa "${caixa.nome}"?`)) {
                              salvarCaixas(caixas.filter((c) => c.id !== caixa.id))
                            }
                          }}
                          className="h-8 w-8 text-secondary hover:text-status-danger"
                          title="Excluir Caixa"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="flex items-center gap-2">
                        {caixa.status === 'disponivel' ? (
                          <Button
                            type="button"
                            size="md"
                            onClick={() => {
                              setCaixaParaRetirar(caixa)
                              setModalRetiradaCaixaAberto(true)
                            }}
                            className="!h-8 px-3 text-xs uppercase font-bold gap-1.5 shadow-sm"
                          >
                            <ArrowUpRight className="h-3.5 w-3.5" />
                            RETIRAR CAIXA
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="secondary"
                            size="md"
                            onClick={() => {
                              salvarCaixas(
                                caixas.map((c) =>
                                  c.id === caixa.id
                                    ? { ...c, status: 'disponivel', placa: undefined, responsavel: undefined, data_retirada: undefined }
                                    : c,
                                ),
                              )
                            }}
                            className="!h-8 px-3 text-xs uppercase font-bold gap-1.5 border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            DEVOLVER
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ==================== MODAL: NOVA / EDITAR FERRAMENTA ==================== */}
      {modalFerramentaAberto && (
        <ModalFerramenta
          ferramenta={ferramentaEditando}
          onClose={() => setModalFerramentaAberto(false)}
          onSalvo={async () => {
            setModalFerramentaAberto(false)
            await recarregarDados()
          }}
        />
      )}

      {/* ==================== MODAL: RETIRAR FERRAMENTA (VINCULAR AO CAMINHÃO) ==================== */}
      {modalRetiradaAberto && (
        <ModalRetirada
          ferramentaPreSelecionada={ferramentaSelecionadaParaRetirada}
          ferramentasDisponiveis={ferramentas.filter((f) => f.quantidade_disponivel > 0)}
          veiculos={veiculosLista}
          onClose={() => setModalRetiradaAberto(false)}
          onSucesso={async () => {
            setModalRetiradaAberto(false)
            await recarregarDados()
          }}
        />
      )}

      {/* ==================== MODAL: REGISTRAR DEVOLUÇÃO ==================== */}
      {modalDevolucaoAberto && retiradaParaDevolver && (
        <ModalDevolucao
          retirada={retiradaParaDevolver}
          onClose={() => setModalDevolucaoAberto(false)}
          onSucesso={async () => {
            setModalDevolucaoAberto(false)
            await recarregarDados()
          }}
        />
      )}

      {/* ==================== MODAL: NOVA / EDITAR CAIXA DE FERRAMENTAS ==================== */}
      {modalCaixaAberto && (
        <ModalCaixaFerramenta
          caixa={caixaEditando}
          ferramentasDisponiveis={ferramentas}
          onClose={() => setModalCaixaAberto(false)}
          onSalvo={async (novaCaixa) => {
            if (caixaEditando) {
              salvarCaixas(caixas.map((c) => (c.id === novaCaixa.id ? novaCaixa : c)))
            } else {
              salvarCaixas([novaCaixa, ...caixas])
            }
            setModalCaixaAberto(false)
          }}
        />
      )}

      {/* ==================== MODAL: RETIRAR CAIXA DE FERRAMENTAS ==================== */}
      {modalRetiradaCaixaAberto && caixaParaRetirar && (
        <ModalRetiradaCaixa
          caixa={caixaParaRetirar}
          veiculos={veiculosLista}
          onClose={() => setModalRetiradaCaixaAberto(false)}
          onSucesso={async (dadosRetirada) => {
            salvarCaixas(
              caixas.map((c) =>
                c.id === caixaParaRetirar.id
                  ? {
                      ...c,
                      status: 'em_uso',
                      placa: dadosRetirada.placa,
                      responsavel: dadosRetirada.responsavel,
                      data_retirada: new Date().toISOString(),
                    }
                  : c,
              ),
            )
            setModalRetiradaCaixaAberto(false)
          }}
        />
      )}

      {/* ==================== MODAL: VISUALIZADOR DE FOTO AMPLIADA ==================== */}
      {fotoModalUrl && (
        <div
          onClick={() => setFotoModalUrl(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-fade-in cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-h-[85vh] max-w-lg w-full overflow-hidden rounded-3xl border border-border/20 bg-surface shadow-2xl animate-scale-in"
          >
            <div className="flex items-center justify-between border-b border-border/10 p-4 bg-overlay/5">
              <h3 className="font-bold text-foreground truncate pr-2 uppercase text-sm">
                {fotoModalUrl.titulo}
              </h3>
              <button
                type="button"
                onClick={() => setFotoModalUrl(null)}
                className="rounded-xl p-1.5 text-secondary hover:bg-overlay/10 hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 flex items-center justify-center bg-background/60">
              <img
                src={fotoModalUrl.url}
                alt={fotoModalUrl.titulo}
                className="max-h-[65vh] w-auto rounded-2xl object-contain shadow-md"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ----------------------------------------------------------------------------------
// Subcomponente: Modal de Cadastro / Edição de Ferramenta
// ----------------------------------------------------------------------------------
function ModalFerramenta({
  ferramenta,
  onClose,
  onSalvo,
}: {
  ferramenta: Ferramenta | null
  onClose: () => void
  onSalvo: () => Promise<void>
}) {
  const [nome, setNome] = useState(ferramenta?.nome || '')
  const [codigo, setCodigo] = useState(ferramenta?.codigo || '')
  const [categoria, setCategoria] = useState(ferramenta?.categoria || 'GERAL')
  const [quantidadeTotal, setQuantidadeTotal] = useState(String(ferramenta?.quantidade_total || 1))
  const [localizacao, setLocalizacao] = useState(ferramenta?.localizacao || '')
  const [observacoes, setObservacoes] = useState(ferramenta?.observacoes || '')
  
  // Foto da Ferramenta
  const [fotoUrl, setFotoUrl] = useState(ferramenta?.foto_url || '')
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [processandoFoto, setProcessandoFoto] = useState(false)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galeriaInputRef = useRef<HTMLInputElement>(null)

  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const handleFotoSelecionada = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setProcessandoFoto(true)
    setErro(null)
    try {
      const comprimida = await comprimirImagem(file)
      setFotoFile(comprimida)
      setFotoUrl(URL.createObjectURL(comprimida))
    } catch (err) {
      console.error('Erro ao processar imagem:', err)
      setErro('NÃO FOI POSSÍVEL PROCESSAR A FOTO.')
    } finally {
      setProcessandoFoto(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome.trim()) {
      setErro('INFORME O NOME DA FERRAMENTA.')
      return
    }

    setSalvando(true)
    setErro(null)

    try {
      let finalFotoUrl: string | null = fotoUrl || null
      if (fotoFile) {
        finalFotoUrl = await uploadFotoFerramenta(fotoFile)
      }

      if (ferramenta) {
        await atualizarFerramenta(ferramenta.id, {
          nome: nome.toUpperCase(),
          codigo: codigo.toUpperCase(),
          categoria: categoria.toUpperCase(),
          quantidade_total: Number(quantidadeTotal) || 1,
          localizacao: localizacao.toUpperCase(),
          observacoes: observacoes.toUpperCase(),
          foto_url: finalFotoUrl,
        })
      } else {
        await criarFerramenta({
          nome: nome.toUpperCase(),
          codigo: codigo.toUpperCase(),
          categoria: categoria.toUpperCase(),
          quantidade_total: Number(quantidadeTotal) || 1,
          localizacao: localizacao.toUpperCase(),
          observacoes: observacoes.toUpperCase(),
          foto_url: finalFotoUrl,
        })
      }
      await onSalvo()
    } catch (err) {
      setErro(err instanceof Error ? err.message.toUpperCase() : 'ERRO AO SALVAR FERRAMENTA.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 uppercase backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl border border-border/10 bg-surface p-6 shadow-2xl animate-scale-in">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Hammer className="h-5 w-5" />
            </div>
            <h2 className="text-base font-bold text-foreground uppercase">
              {ferramenta ? 'EDITAR FERRAMENTA' : 'NOVA FERRAMENTA'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-secondary hover:bg-overlay/10 hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {erro && <p className="mb-4 text-sm text-status-danger uppercase font-bold">{erro}</p>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="nome" className="uppercase font-bold">NOME DA FERRAMENTA *</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="EX: CHAVE DE IMPACTO 1/2, TORQUÍMETRO, SCANNER..."
              required
              className="uppercase font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="codigo" className="uppercase font-bold">CÓDIGO / PATRIMÔNIO</Label>
              <Input
                id="codigo"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="EX: FER-012"
                className="uppercase font-medium"
              />
            </div>
            <div>
              <Label htmlFor="categoria" className="uppercase font-bold">CATEGORIA</Label>
              <Input
                id="categoria"
                list="lista-categorias-sugeridas"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                placeholder="EX: INSUMOS, PNEUMÁTICA..."
                className="uppercase font-medium"
              />
              <datalist id="lista-categorias-sugeridas">
                {CATEGORIAS_SUGERIDAS.filter((c) => c !== 'TODAS').map((cat) => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="qtd" className="uppercase font-bold">QUANTIDADE TOTAL</Label>
              <Input
                id="qtd"
                type="number"
                min="1"
                value={quantidadeTotal}
                onChange={(e) => setQuantidadeTotal(e.target.value)}
                required
                className="font-medium"
              />
            </div>
            <div>
              <Label htmlFor="local" className="uppercase font-bold">LOCALIZAÇÃO / GAVETA</Label>
              <Input
                id="local"
                value={localizacao}
                onChange={(e) => setLocalizacao(e.target.value)}
                placeholder="EX: ARMÁRIO 02"
                className="uppercase font-medium"
              />
            </div>
          </div>

          {/* FOTO DA FERRAMENTA */}
          <div className="space-y-2 rounded-2xl border border-border/20 bg-background/40 p-3.5">
            <Label className="uppercase font-bold text-xs text-secondary flex items-center justify-between">
              <span>FOTO DA FERRAMENTA</span>
              {fotoUrl && <span className="text-[10px] text-emerald-400 font-black">FOTO SELECIONADA</span>}
            </Label>

            {/* Inputs Ocultos de Arquivo */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFotoSelecionada}
            />
            <input
              ref={galeriaInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFotoSelecionada}
            />

            {fotoUrl ? (
              <div className="relative flex items-center gap-3 rounded-xl border border-border/30 bg-surface/80 p-2.5">
                <img
                  src={fotoUrl}
                  alt="Foto da Ferramenta"
                  className="h-16 w-16 rounded-xl object-cover border border-border/30 bg-background shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-foreground truncate">IMAGEM ANEXADA</p>
                  <p className="text-[10px] text-secondary mt-0.5">
                    {fotoFile ? `${(fotoFile.size / 1024).toFixed(0)} KB (Pronta p/ salvar)` : 'Imagem vinculada'}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="text-[10px] font-bold text-primary hover:underline"
                    >
                      Trocar foto
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFotoUrl('')
                    setFotoFile(null)
                  }}
                  className="rounded-xl p-2 text-secondary hover:bg-status-danger/10 hover:text-status-danger transition-colors cursor-pointer"
                  title="Remover foto"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={processandoFoto}
                  onClick={() => cameraInputRef.current?.click()}
                  className="gap-2 text-xs font-bold border-border/30 hover:border-primary/40 text-foreground"
                >
                  {processandoFoto ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : (
                    <Camera className="h-4 w-4 text-primary" />
                  )}
                  <span>CÂMERA</span>
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  disabled={processandoFoto}
                  onClick={() => galeriaInputRef.current?.click()}
                  className="gap-2 text-xs font-bold border-border/30 hover:border-primary/40 text-foreground"
                >
                  {processandoFoto ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : (
                    <ImageIcon className="h-4 w-4 text-primary" />
                  )}
                  <span>GALERIA</span>
                </Button>
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="obs" className="uppercase font-bold">OBSERVAÇÕES</Label>
            <Input
              id="obs"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="MARCA, ESTADO DE CONSERVAÇÃO, ETC."
              className="uppercase font-medium"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border/10">
            <Button type="button" variant="secondary" onClick={onClose} disabled={salvando} className="uppercase font-semibold">
              CANCELAR
            </Button>
            <Button type="submit" disabled={salvando} className="uppercase font-bold">
              {salvando ? 'SALVANDO...' : ferramenta ? 'SALVAR ALTERAÇÕES' : 'CADASTRAR'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------------------------
// Subcomponente: Modal de Retirada de Ferramenta (Wizard 3 Passos com Múltiplas Ferramentas)
// ----------------------------------------------------------------------------------
interface ItemRetirada {
  ferramenta: Ferramenta
  quantidade: number
}

function ModalRetirada({
  ferramentaPreSelecionada,
  ferramentasDisponiveis,
  veiculos,
  onClose,
  onSucesso,
}: {
  ferramentaPreSelecionada: Ferramenta | null
  ferramentasDisponiveis: Ferramenta[]
  veiculos: { id: string; placa: string }[]
  onClose: () => void
  onSucesso: () => Promise<void>
}) {
  const [step, setStep] = useState(1)
  const [itensSelecionados, setItensSelecionados] = useState<ItemRetirada[]>(() => {
    if (ferramentaPreSelecionada) {
      return [{ ferramenta: ferramentaPreSelecionada, quantidade: 1 }]
    }
    return []
  })
  const [placasSelecionadas, setPlacasSelecionadas] = useState<string[]>([])
  const [responsavel, setResponsavel] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [fotoUrl, setFotoUrl] = useState<string | null>(null)
  const [processandoFoto, setProcessandoFoto] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const cameraInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function adicionarItem(f: Ferramenta) {
    setItensSelecionados((prev) => {
      const jaExiste = prev.find((item) => item.ferramenta.id === f.id)
      if (jaExiste) {
        return prev.map((item) =>
          item.ferramenta.id === f.id
            ? { ...item, quantidade: Math.min(f.quantidade_disponivel, item.quantidade + 1) }
            : item
        )
      }
      return [...prev, { ferramenta: f, quantidade: 1 }]
    })
    setErro(null)
  }

  function removerItem(ferramentaId: string) {
    setItensSelecionados((prev) => prev.filter((item) => item.ferramenta.id !== ferramentaId))
  }

  function ajustarQtdItem(ferramentaId: string, delta: number) {
    setItensSelecionados((prev) =>
      prev.map((item) => {
        if (item.ferramenta.id === ferramentaId) {
          const maxQtd = item.ferramenta.quantidade_disponivel || 1
          return { ...item, quantidade: Math.max(1, Math.min(maxQtd, item.quantidade + delta)) }
        }
        return item
      })
    )
  }

  async function handleFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setProcessandoFoto(true)
    setErro(null)
    try {
      const comprimida = await comprimirImagem(file)
      setFotoFile(comprimida)
      setFotoUrl(URL.createObjectURL(comprimida))
    } catch (err) {
      console.error('Erro ao processar foto:', err)
      setErro('Não foi possível processar a foto.')
    } finally {
      setProcessandoFoto(false)
    }
  }

  function removerFoto() {
    setFotoFile(null)
    setFotoUrl(null)
    if (cameraInputRef.current) cameraInputRef.current.value = ''
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = async () => {
    if (itensSelecionados.length === 0) {
      setErro('Selecione ao menos uma ferramenta.')
      return
    }
    if (!responsavel.trim()) {
      setErro('Informe o nome do responsável.')
      return
    }
    setSalvando(true)
    setErro(null)
    try {
      let finalFotoUrl: string | null = null
      if (fotoFile) {
        finalFotoUrl = await uploadFotoFerramenta(fotoFile)
      }

      const veiculoEncontrado = veiculos.find((v) => placasSelecionadas.includes(v.placa.toUpperCase()))
      const placaString = placasSelecionadas.join(' / ')
      const respUpper = responsavel.toUpperCase()
      const obsUpper = observacoes ? observacoes.toUpperCase() : undefined

      await Promise.all(
        itensSelecionados.map((item) =>
          registrarRetiradaFerramenta({
            ferramenta_id: item.ferramenta.id,
            veiculo_id: veiculoEncontrado?.id || null,
            placa: placaString,
            responsavel: respUpper,
            quantidade: item.quantidade,
            observacoes_retirada: obsUpper,
            foto_responsavel_url: finalFotoUrl,
            foto_url: finalFotoUrl,
          })
        )
      )
      await onSucesso()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao registrar retirada.')
    } finally {
      setSalvando(false)
    }
  }

  // estados para campo de placa manual
  const [placaInput, setPlacaInput] = useState('')

  function adicionarPlaca(p: string) {
    const limpa = p.trim().toUpperCase()
    if (!limpa) return
    const partes = limpa.split(/[,;/ ]+/).map((s) => s.trim().toUpperCase()).filter(Boolean)
    setPlacasSelecionadas((prev) => Array.from(new Set([...prev, ...partes])))
    setPlacaInput('')
  }

  function removerPlaca(p: string) {
    setPlacasSelecionadas((prev) => prev.filter((item) => item !== p))
  }

  function handleKeyDownPlaca(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',' || e.key === ';') {
      e.preventDefault()
      adicionarPlaca(placaInput)
    }
  }

  // Etapa inicial
  const stepInicial = 1

  function avancar() {
    setErro(null)
    if (step === 1 && itensSelecionados.length === 0) {
      setErro('Selecione ao menos uma ferramenta.')
      return
    }
    if (step === 2) {
      const finalPlacas = [...placasSelecionadas]
      if (placaInput.trim()) adicionarPlaca(placaInput)
      if (finalPlacas.length === 0 && !placaInput.trim()) {
        setErro('Selecione ao menos um caminhão.')
        return
      }
    }
    setStep((s) => s + 1)
  }

  const [buscaFerramenta, setBuscaFerramenta] = useState('')

  const ferramentasFiltradas = useMemo(() => {
    if (!buscaFerramenta.trim()) return []
    const termo = buscaFerramenta.trim().toLowerCase()
    return ferramentasDisponiveis.filter(
      (f) =>
        f.nome.toLowerCase().includes(termo) ||
        (f.codigo && f.codigo.toLowerCase().includes(termo))
    )
  }, [ferramentasDisponiveis, buscaFerramenta])

  const STEP_LABELS = ['Ferramentas', 'Caminhão', 'Finalizar']
  const stepLabel = (i: number) => i + 1

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-border/15 bg-surface shadow-2xl flex flex-col overflow-hidden" style={{ maxHeight: '90vh' }}>

        {/* ── Cabeçalho + barra de progresso ── */}
        <div className="px-6 pt-5 pb-4 border-b border-border/10 shrink-0">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-secondary mb-0.5">
                Etapa {step} de {STEP_LABELS.length}
              </p>
              <h2 className="text-xl font-black text-foreground leading-tight">
                {step === 1 && 'Quais ferramentas?'}
                {step === 2 && 'Para qual caminhão?'}
                {step === 3 && 'Quem está retirando?'}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-xl text-secondary hover:bg-background hover:text-foreground transition-colors shrink-0 mt-0.5"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Barra de progresso segmentada */}
          <div className="flex gap-1.5">
            {STEP_LABELS.map((label, i) => {
              const s = stepLabel(i)
              return (
                <div key={label} className="flex-1 space-y-1">
                  <div className={`h-1 rounded-full transition-all duration-500 ${
                    step > s ? 'bg-primary' : step === s ? 'bg-primary/50' : 'bg-border/25'
                  }`} />
                  <p className={`text-[9px] font-bold uppercase tracking-wider leading-none ${
                    step === s ? 'text-primary' : step > s ? 'text-secondary/60' : 'text-secondary/30'
                  }`}>{label}</p>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Conteúdo da etapa ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {erro && (
            <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/30 px-3 py-2.5 text-xs font-semibold text-red-400 flex items-center gap-2">
              <X className="h-3.5 w-3.5 shrink-0" />{erro}
            </div>
          )}

          {/* ETAPA 1 — Múltiplas Ferramentas com busca */}
          {step === 1 && (
            <div className="space-y-4">
              {/* Campo de Busca */}
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary pointer-events-none" />
                <Input
                  value={buscaFerramenta}
                  onChange={(e) => setBuscaFerramenta(e.target.value)}
                  placeholder="Buscar ferramenta para adicionar..."
                  className="pl-10 pr-9 py-2.5 text-sm bg-background border-border/30 rounded-xl"
                  autoFocus
                />
                {buscaFerramenta && (
                  <button
                    type="button"
                    onClick={() => setBuscaFerramenta('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary hover:text-foreground p-1"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Ferramentas Selecionadas */}
              {itensSelecionados.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase tracking-widest text-secondary">
                      Selecionadas ({itensSelecionados.length})
                    </p>
                    <span className="text-[10px] font-bold text-primary">
                      {itensSelecionados.reduce((acc, it) => acc + it.quantidade, 0)} unidade(s) total
                    </span>
                  </div>

                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {itensSelecionados.map(({ ferramenta, quantidade }) => (
                      <div
                        key={ferramenta.id}
                        className="rounded-xl border border-primary/40 bg-primary/10 p-3 flex items-center justify-between gap-3 shadow-sm"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-foreground truncate">{ferramenta.nome}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {ferramenta.codigo && (
                              <span className="text-[10px] text-secondary font-mono">[{ferramenta.codigo}]</span>
                            )}
                            <span className="text-[10px] text-secondary">
                              · máx: {ferramenta.quantidade_disponivel} disp.
                            </span>
                          </div>
                        </div>

                        {/* Stepper de Quantidade individual */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => ajustarQtdItem(ferramenta.id, -1)}
                            disabled={quantidade <= 1}
                            className="h-7 w-7 rounded-lg bg-surface border border-border/30 flex items-center justify-center text-sm font-bold text-foreground hover:bg-surface/80 disabled:opacity-30 transition-all"
                          >
                            −
                          </button>
                          <span className="w-6 text-center font-mono text-sm font-black text-foreground">
                            {quantidade}
                          </span>
                          <button
                            type="button"
                            onClick={() => ajustarQtdItem(ferramenta.id, 1)}
                            disabled={quantidade >= (ferramenta.quantidade_disponivel || 1)}
                            className="h-7 w-7 rounded-lg bg-surface border border-border/30 flex items-center justify-center text-sm font-bold text-foreground hover:bg-surface/80 disabled:opacity-30 transition-all"
                          >
                            +
                          </button>

                          <button
                            type="button"
                            onClick={() => removerItem(ferramenta.id)}
                            className="h-7 w-7 ml-1 rounded-lg text-secondary hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center transition-all"
                            title="Remover ferramenta"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Resultados da busca */}
              {buscaFerramenta.trim() !== '' && (
                <div className="space-y-2 pt-1 border-t border-border/10">
                  <p className="text-[10px] font-black uppercase tracking-widest text-secondary">
                    Resultados ({ferramentasFiltradas.length})
                  </p>
                  {ferramentasFiltradas.length > 0 ? (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {ferramentasFiltradas.map((f) => {
                        const jaSelecionada = itensSelecionados.some((it) => it.ferramenta.id === f.id)
                        return (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => {
                              adicionarItem(f)
                              setBuscaFerramenta('')
                            }}
                            className={`w-full flex items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-left transition-all border ${
                              jaSelecionada
                                ? 'bg-primary/15 border-primary/50 text-foreground'
                                : 'bg-background/60 border-border/20 text-secondary hover:border-border/50 hover:text-foreground'
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold truncate">{f.nome}</p>
                              {f.codigo && <p className="text-[10px] text-secondary font-mono mt-0.5">[{f.codigo}]</p>}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs font-black font-mono text-secondary">
                                {f.quantidade_disponivel}x disp.
                              </span>
                              <span className="text-[10px] font-bold uppercase bg-primary/20 text-primary px-2 py-0.5 rounded-md">
                                {jaSelecionada ? '+ Mais 1' : '+ Adicionar'}
                              </span>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="py-6 text-center text-xs text-secondary bg-background/30 rounded-xl border border-dashed border-border/20">
                      Nenhuma ferramenta encontrada com esse termo.
                    </div>
                  )}
                </div>
              )}

              {/* Mensagem quando nenhuma ferramenta foi selecionada e nada foi buscado */}
              {buscaFerramenta.trim() === '' && itensSelecionados.length === 0 && (
                <div className="py-8 text-center text-xs text-secondary bg-background/20 rounded-xl border border-dashed border-border/20 px-4">
                  🔍 Digite no campo acima para pesquisar e adicionar as ferramentas que deseja retirar.
                </div>
              )}
            </div>
          )}

          {/* ETAPA 2 — Caminhão */}
          {step === 2 && (
            <div className="space-y-4">
              {/* Campo de Busca / Digitação de Placa */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black uppercase tracking-widest text-secondary">
                  Buscar ou Digitar Placa *
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary pointer-events-none" />
                    <Input
                      value={placaInput}
                      onChange={(e) => setPlacaInput(e.target.value.toUpperCase())}
                      onKeyDown={handleKeyDownPlaca}
                      placeholder="Digite a placa (ex: ABC1D23)..."
                      className="pl-10 pr-9 py-2.5 font-mono text-sm uppercase bg-background border-border/30 rounded-xl"
                      autoFocus
                    />
                    {placaInput && (
                      <button
                        type="button"
                        onClick={() => setPlacaInput('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary hover:text-foreground p-1"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={() => adicionarPlaca(placaInput)}
                    disabled={!placaInput.trim()}
                    className="shrink-0 !h-10 px-4 text-xs font-bold"
                  >
                    + Adicionar
                  </Button>
                </div>
              </div>

              {/* Placas Selecionadas */}
              {placasSelecionadas.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-secondary">
                    Placa(s) Selecionada(s) ({placasSelecionadas.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {placasSelecionadas.map((p) => (
                      <span
                        key={p}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/15 border border-primary/40 text-primary font-mono text-xs font-bold shadow-sm"
                      >
                        🚛 {p}
                        <button
                          type="button"
                          onClick={() => removerPlaca(p)}
                          className="hover:text-red-400 p-0.5 rounded transition-colors"
                          title="Remover placa"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Sugestões baseadas na digitação */}
              {placaInput.trim() !== '' && (
                <div className="space-y-2 pt-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-secondary">
                    Sugestões encontradas
                  </p>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {veiculos
                      .filter((v) => v.placa.toUpperCase().includes(placaInput.trim()))
                      .map((v) => {
                        const sel = placasSelecionadas.includes(v.placa.toUpperCase())
                        return (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => {
                              if (sel) {
                                removerPlaca(v.placa.toUpperCase())
                              } else {
                                adicionarPlaca(v.placa.toUpperCase())
                              }
                            }}
                            className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border transition-all text-left ${
                              sel
                                ? 'bg-primary/15 border-primary/50 text-primary'
                                : 'bg-background/60 border-border/20 text-secondary hover:border-border/50 hover:text-foreground'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <Truck className={`h-4 w-4 shrink-0 ${sel ? 'text-primary' : 'text-secondary/50'}`} />
                              <span className="font-mono text-xs font-bold">{v.placa}</span>
                            </div>
                            <span className="text-[10px] font-bold uppercase">
                              {sel ? '✓ Selecionado' : '+ Selecionar'}
                            </span>
                          </button>
                        )
                      })}

                    {/* Opção de adicionar como nova placa se não for correspondência exata */}
                    {!veiculos.some((v) => v.placa.toUpperCase() === placaInput.trim()) && (
                      <button
                        type="button"
                        onClick={() => adicionarPlaca(placaInput)}
                        className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border border-dashed border-primary/40 bg-primary/5 text-primary hover:bg-primary/10 transition-all text-left"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-xs">➕</span>
                          <span className="font-mono text-xs font-bold">Usar placa: {placaInput.trim()}</span>
                        </div>
                        <span className="text-[10px] font-bold uppercase">+ Adicionar</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Mensagem quando não digitou nada e ainda não selecionou */}
              {placaInput.trim() === '' && placasSelecionadas.length === 0 && (
                <div className="py-8 text-center text-xs text-secondary bg-background/20 rounded-xl border border-dashed border-border/20 px-4">
                  🚛 Digite a placa do caminhão no campo acima para pesquisar ou adicionar.
                </div>
              )}
            </div>
          )}

          {/* ETAPA 3 — Responsável + Foto + Resumo de Múltiplos Itens + Observações */}
          {step === 3 && (
            <div className="space-y-4">
              {/* Resumo compacto de Itens e Caminhões */}
              <div className="rounded-xl bg-background/50 border border-border/20 px-4 py-3 space-y-2.5">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-secondary">
                      Ferramentas a retirar ({itensSelecionados.length})
                    </span>
                    <span className="text-[10px] font-bold text-primary">
                      Total: {itensSelecionados.reduce((acc, it) => acc + it.quantidade, 0)} un.
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                    {itensSelecionados.map(({ ferramenta, quantidade }) => (
                      <span
                        key={ferramenta.id}
                        className="inline-flex items-center gap-1 text-[11px] font-bold bg-primary/15 text-primary px-2 py-0.5 rounded-lg border border-primary/30"
                      >
                        🔧 {ferramenta.nome} ({quantidade}x)
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-border/10">
                  <span className="text-[10px] font-black uppercase tracking-widest text-secondary block mb-1">
                    Caminhão(ões)
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {placasSelecionadas.map((p) => (
                      <span key={p} className="font-mono text-[11px] font-bold text-foreground bg-surface px-2 py-0.5 rounded border border-border/20">
                        🚛 {p}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Responsável */}
              <div>
                <label htmlFor="resp" className="block text-[11px] font-black text-secondary uppercase tracking-widest mb-1.5">
                  Nome do Responsável *
                </label>
                <Input
                  id="resp"
                  value={responsavel}
                  onChange={(e) => setResponsavel(e.target.value)}
                  placeholder="Mecânico ou motorista que está retirando..."
                  autoFocus
                  className="text-sm"
                />
              </div>

              {/* Foto da Pessoa / Responsável */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-black text-secondary uppercase tracking-widest">
                  Foto da Pessoa / Responsável
                </label>

                {/* Inputs de arquivo ocultos */}
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="user"
                  onChange={handleFotoChange}
                  className="hidden"
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFotoChange}
                  className="hidden"
                />

                {processandoFoto ? (
                  <div className="flex items-center justify-center gap-2 p-4 rounded-xl border border-dashed border-primary/40 bg-primary/5 text-primary text-xs font-semibold">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processando foto...
                  </div>
                ) : fotoUrl ? (
                  <div className="relative flex items-center gap-3 p-3 rounded-xl border border-primary/40 bg-primary/10">
                    <img
                      src={fotoUrl}
                      alt="Responsável"
                      className="h-16 w-16 rounded-xl object-cover border border-primary/30 shadow-sm shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] font-black uppercase text-primary tracking-wider bg-primary/20 px-2 py-0.5 rounded">
                        FOTO ANEXADA ✓
                      </span>
                      <p className="text-xs text-secondary truncate mt-1">Foto capturada com sucesso</p>
                      <div className="flex gap-2 mt-1.5">
                        <button
                          type="button"
                          onClick={() => cameraInputRef.current?.click()}
                          className="text-[11px] text-primary hover:underline font-semibold"
                        >
                          Tirar outra
                        </button>
                        <span className="text-secondary">·</span>
                        <button
                          type="button"
                          onClick={removerFoto}
                          className="text-[11px] text-red-400 hover:underline font-semibold"
                        >
                          Remover
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="flex items-center justify-center gap-2 py-3 px-3 rounded-xl border border-dashed border-border/30 bg-background/60 hover:bg-primary/10 hover:border-primary/50 text-foreground transition-all group active:scale-98"
                    >
                      <Camera className="h-4 w-4 text-primary group-hover:scale-110 transition-transform" />
                      <span className="text-xs font-bold">Tirar Foto</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center justify-center gap-2 py-3 px-3 rounded-xl border border-dashed border-border/30 bg-background/60 hover:bg-primary/10 hover:border-primary/50 text-foreground transition-all group active:scale-98"
                    >
                      <ImageIcon className="h-4 w-4 text-secondary group-hover:text-primary transition-colors" />
                      <span className="text-xs font-bold">Galeria</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Observações */}
              <div>
                <label htmlFor="obs" className="block text-[11px] font-black text-secondary uppercase tracking-widest mb-1.5">
                  Observações <span className="font-normal normal-case text-secondary/40">(opcional)</span>
                </label>
                <Input
                  id="obs"
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Ex: manutenção preventiva, troca de pneu..."
                  className="text-sm"
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Rodapé com navegação ── */}
        <div className="shrink-0 px-6 py-4 border-t border-border/10 flex gap-3">
          {step > stepInicial ? (
            <button
              type="button"
              onClick={() => { setErro(null); setStep((s) => s - 1) }}
              disabled={salvando}
              className="h-11 px-5 rounded-xl border border-border/30 bg-background text-sm font-semibold text-secondary hover:text-foreground hover:border-border/60 disabled:opacity-40 transition-all"
            >
              ← Voltar
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="h-11 px-5 rounded-xl border border-border/30 bg-background text-sm font-semibold text-secondary hover:text-foreground hover:border-border/60 transition-all"
            >
              Cancelar
            </button>
          )}

          {step < 3 ? (
            <button
              type="button"
              onClick={avancar}
              className="flex-1 h-11 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-sm transition-all"
            >
              Próximo →
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={salvando || !responsavel.trim() || itensSelecionados.length === 0}
              className="flex-1 h-11 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm transition-all flex items-center justify-center gap-2"
            >
              {salvando
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Registrando...</>
                : <><ArrowUpRight className="h-4 w-4" /> Confirmar Retirada ({itensSelecionados.length})</>
              }
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------------------------
// Subcomponente: Modal de Devolução de Ferramenta
// ----------------------------------------------------------------------------------
function ModalDevolucao({
  retirada,
  onClose,
  onSucesso,
}: {
  retirada: FerramentaRetirada
  onClose: () => void
  onSucesso: () => Promise<void>
}) {
  const [statusDevolucao, setStatusDevolucao] = useState<'devolvido' | 'avaria_perda'>('devolvido')
  const [observacoes, setObservacoes] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSalvando(true)
    setErro(null)

    try {
      await registrarDevolucaoFerramenta({
        retiradaId: retirada.id,
        status: statusDevolucao,
        observacoes_devolucao: observacoes.toUpperCase(),
      })
      await onSucesso()
    } catch (err) {
      setErro(err instanceof Error ? err.message.toUpperCase() : 'ERRO AO REGISTRAR DEVOLUÇÃO.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 uppercase">
      <div className="w-full max-w-md rounded-2xl border border-border/10 bg-surface p-6 shadow-2xl animate-scale-in">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-500">
              <RotateCcw className="h-4 w-4" />
            </div>
            <h2 className="text-base font-bold text-foreground uppercase">REGISTRAR DEVOLUÇÃO</h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-secondary hover:bg-overlay/10 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {erro && <p className="mb-4 text-sm text-status-danger uppercase font-bold">{erro}</p>}

        {/* Resumo da Retirada */}
        <div className="mb-4 rounded-xl border border-border/10 bg-background p-3.5 space-y-1.5 text-xs text-secondary uppercase font-medium">
          <p>
            FERRAMENTA: <strong className="text-foreground font-bold">{retirada.ferramenta?.nome?.toUpperCase() || 'FERRAMENTA'}</strong>
          </p>
          <p>
            PLACA DO CAMINHÃO: <strong className="text-primary font-mono font-bold">{retirada.placa}</strong>
          </p>
          <p>
            RESPONSÁVEL: <strong className="text-foreground font-bold">{retirada.responsavel}</strong> ({retirada.quantidade} UN.)
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="condicao" className="uppercase font-bold">CONDIÇÃO DA DEVOLUÇÃO</Label>
            <select
              id="condicao"
              value={statusDevolucao}
              onChange={(e) => setStatusDevolucao(e.target.value as 'devolvido' | 'avaria_perda')}
              className="h-10 w-full rounded-xl border border-border/10 bg-background px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary uppercase font-medium"
            >
              <option value="devolvido">DEVOLVIDA EM BOM ESTADO (RETORNA AO ESTOQUE)</option>
              <option value="avaria_perda">COM AVARIA / PERDA / DESGASTE (BAIXA DO ESTOQUE)</option>
            </select>
          </div>

          <div>
            <Label htmlFor="obsDev" className="uppercase font-bold">OBSERVAÇÕES DA DEVOLUÇÃO</Label>
            <Input
              id="obsDev"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="EX: DEVOLVIDO LIMPO, SEM DANOS..."
              className="uppercase"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={salvando} className="uppercase font-semibold">
              CANCELAR
            </Button>
            <Button type="submit" disabled={salvando} className="bg-emerald-600 hover:bg-emerald-500 uppercase font-bold">
              {salvando ? 'SALVANDO...' : 'CONFIRMAR DEVOLUÇÃO'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------------------------
// Subcomponente: Modal de Cadastro / Edição de Caixa de Ferramentas
// ----------------------------------------------------------------------------------
function ModalCaixaFerramenta({
  caixa,
  ferramentasDisponiveis,
  onClose,
  onSalvo,
}: {
  caixa: CaixaFerramenta | null
  ferramentasDisponiveis: Ferramenta[]
  onClose: () => void
  onSalvo: (caixa: CaixaFerramenta) => Promise<void>
}) {
  const [nome, setNome] = useState(caixa?.nome || '')
  const [codigo, setCodigo] = useState(caixa?.codigo || '')
  const [localizacao, setLocalizacao] = useState(caixa?.localizacao || '')
  const [status, setStatus] = useState<'disponivel' | 'em_uso' | 'manutencao'>(caixa?.status || 'disponivel')
  const [observacoes, setObservacoes] = useState(caixa?.observacoes || '')
  const [itens, setItens] = useState<ItemCaixa[]>(
    caixa?.itens || [
      { id: '1', nome: 'Jogo de Chaves Combinadas', quantidade: 1 },
      { id: '2', nome: 'Alicate de Pressão', quantidade: 1 },
    ],
  )

  // Novo item para adicionar
  const [novoItemNome, setNovoItemNome] = useState('')
  const [novoItemQtd, setNovoItemQtd] = useState('1')

  // Foto da Caixa
  const [fotoUrl, setFotoUrl] = useState(caixa?.foto_url || '')
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [processandoFoto, setProcessandoFoto] = useState(false)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galeriaInputRef = useRef<HTMLInputElement>(null)

  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const handleFotoSelecionada = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setProcessandoFoto(true)
    setErro(null)
    try {
      const comprimida = await comprimirImagem(file)
      setFotoFile(comprimida)
      setFotoUrl(URL.createObjectURL(comprimida))
    } catch (err) {
      console.error('Erro ao processar imagem:', err)
      setErro('Não foi possível processar a foto.')
    } finally {
      setProcessandoFoto(false)
    }
  }

  function adicionarItemNaCaixa() {
    if (!novoItemNome.trim()) return
    const novoItem: ItemCaixa = {
      id: String(Date.now()),
      nome: novoItemNome.trim().toUpperCase(),
      quantidade: Math.max(1, Number(novoItemQtd) || 1),
    }
    setItens((prev) => [...prev, novoItem])
    setNovoItemNome('')
    setNovoItemQtd('1')
  }

  function removerItemDaCaixa(id: string) {
    setItens((prev) => prev.filter((it) => it.id !== id))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome.trim()) {
      setErro('Informe o nome da caixa de ferramentas.')
      return
    }

    setSalvando(true)
    setErro(null)

    try {
      let finalFotoUrl: string | null = fotoUrl || null
      if (fotoFile) {
        finalFotoUrl = await uploadFotoFerramenta(fotoFile)
      }

      const dadosSalvar: CaixaFerramenta = {
        id: caixa?.id || `caixa_${Date.now()}`,
        nome: nome.trim().toUpperCase(),
        codigo: codigo.trim().toUpperCase() || undefined,
        localizacao: localizacao.trim().toUpperCase() || undefined,
        status: status,
        foto_url: finalFotoUrl,
        itens: itens,
        observacoes: observacoes.trim() || undefined,
        responsavel: caixa?.responsavel,
        placa: caixa?.placa,
        data_retirada: caixa?.data_retirada,
        created_at: caixa?.created_at || new Date().toISOString(),
      }

      await onSalvo(dadosSalvar)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar caixa de ferramentas.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl max-h-[90vh] flex flex-col rounded-2xl border border-border/30 bg-surface p-6 shadow-2xl animate-scale-in">
        {/* Cabeçalho */}
        <div className="mb-4 flex items-center justify-between border-b border-border/20 pb-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary border border-primary/20 text-xl">
              🧰
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">
                {caixa ? 'Editar Caixa de Ferramentas' : 'Nova Caixa de Ferramentas'}
              </h2>
              <p className="text-xs text-secondary">Monte e organize kits e caixas completas da oficina</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-secondary hover:bg-background hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {erro && (
          <div className="mb-3 rounded-xl bg-status-danger/10 border border-status-danger/30 p-3 text-xs font-semibold text-status-danger shrink-0">
            {erro}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto pr-1 flex-1">
          {/* Nome e Código */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label htmlFor="nomeCaixa" className="block text-xs font-bold text-foreground uppercase tracking-wide mb-1">
                Nome da Caixa / Kit *
              </label>
              <Input
                id="nomeCaixa"
                value={nome}
                onChange={(e) => setNome(e.target.value.toUpperCase())}
                placeholder="Ex: CAIXA 01 - MECÂNICA PESADA"
                required
                className="uppercase"
              />
            </div>
            <div>
              <label htmlFor="codCaixa" className="block text-xs font-bold text-foreground uppercase tracking-wide mb-1">
                Código / Tag
              </label>
              <Input
                id="codCaixa"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                placeholder="Ex: CX-001"
                className="uppercase font-mono"
              />
            </div>
          </div>

          {/* Localização e Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="locCaixa" className="block text-xs font-bold text-foreground uppercase tracking-wide mb-1">
                Localização na Oficina
              </label>
              <Input
                id="locCaixa"
                value={localizacao}
                onChange={(e) => setLocalizacao(e.target.value.toUpperCase())}
                placeholder="Ex: ARMÁRIO A1 / BANCADA 02"
                className="uppercase"
              />
            </div>
            <div>
              <label htmlFor="stCaixa" className="block text-xs font-bold text-foreground uppercase tracking-wide mb-1">
                Status Inicial
              </label>
              <select
                id="stCaixa"
                value={status}
                onChange={(e) => setStatus(e.target.value as 'disponivel' | 'em_uso' | 'manutencao')}
                className="h-10 w-full rounded-xl border border-border/40 bg-background px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="disponivel">🟢 DISPONÍVEL NA OFICINA</option>
                <option value="em_uso">🟡 EM USO NO CAMINHÃO</option>
                <option value="manutencao">🔴 EM MANUTENÇÃO / REVISÃO</option>
              </select>
            </div>
          </div>

          {/* Foto da Caixa */}
          <div>
            <label className="block text-xs font-bold text-foreground uppercase tracking-wide mb-1.5">
              Foto da Caixa de Ferramentas
            </label>

            <input
              type="file"
              ref={cameraInputRef}
              accept="image/*"
              capture="environment"
              onChange={handleFotoSelecionada}
              className="hidden"
            />
            <input
              type="file"
              ref={galeriaInputRef}
              accept="image/*"
              onChange={handleFotoSelecionada}
              className="hidden"
            />

            <div className="flex items-center gap-3">
              {fotoUrl ? (
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-primary/40 bg-background group">
                  <img src={fotoUrl} alt="Preview" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => {
                      setFotoUrl('')
                      setFotoFile(null)
                    }}
                    className="absolute inset-0 bg-black/60 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-dashed border-border/40 bg-background/50 text-secondary">
                  <ImageIcon className="h-6 w-6 opacity-40" />
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={processandoFoto}
                  className="!h-9 text-xs font-bold gap-1.5 uppercase"
                >
                  <Camera className="h-4 w-4 text-primary" />
                  Câmera
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => galeriaInputRef.current?.click()}
                  disabled={processandoFoto}
                  className="!h-9 text-xs font-bold gap-1.5 uppercase"
                >
                  <ImageIcon className="h-4 w-4 text-primary" />
                  Galeria
                </Button>
                {processandoFoto && <span className="text-xs text-secondary flex items-center gap-1"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Otimizando...</span>}
              </div>
            </div>
          </div>

          {/* Gerenciador de Ferramentas Inclusas */}
          <div className="border-t border-border/20 pt-3">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-foreground uppercase tracking-wide">
                Ferramentas Inclusas na Caixa ({itens.length})
              </label>
              <span className="text-[11px] text-secondary">monte o inventário deste kit</span>
            </div>

            {/* Input para adicionar nova ferramenta */}
            <div className="flex gap-2 mb-2">
              <div className="flex-1">
                <Input
                  list="sugestoes-itens-caixa"
                  value={novoItemNome}
                  onChange={(e) => setNovoItemNome(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      adicionarItemNaCaixa()
                    }
                  }}
                  placeholder="Nome do item (ex: Alicate Universal Gedore)..."
                  className="text-xs uppercase"
                />
                <datalist id="sugestoes-itens-caixa">
                  {ferramentasDisponiveis.map((f) => (
                    <option key={f.id} value={f.nome} />
                  ))}
                </datalist>
              </div>

              <div className="w-20 shrink-0">
                <Input
                  type="number"
                  min="1"
                  value={novoItemQtd}
                  onChange={(e) => setNovoItemQtd(e.target.value)}
                  placeholder="Qtd"
                  className="text-xs text-center font-bold"
                />
              </div>

              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={adicionarItemNaCaixa}
                disabled={!novoItemNome.trim()}
                className="shrink-0 !h-10 px-3 text-xs font-bold uppercase"
              >
                + Adicionar
              </Button>
            </div>

            {/* Lista dos Itens Já Adicionados */}
            <div className="max-h-36 overflow-y-auto space-y-1 rounded-xl bg-background/50 border border-border/20 p-2">
              {itens.length === 0 ? (
                <p className="text-xs text-secondary text-center py-2">Nenhum item adicionado à caixa ainda.</p>
              ) : (
                itens.map((it) => (
                  <div
                    key={it.id}
                    className="flex items-center justify-between py-1 px-2.5 rounded-lg bg-surface border border-border/10 text-xs"
                  >
                    <span className="text-foreground font-medium truncate pr-2">• {it.nome}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-bold text-primary text-[11px] bg-primary/10 px-2 py-0.5 rounded">
                        {it.quantidade} un.
                      </span>
                      <button
                        type="button"
                        onClick={() => removerItemDaCaixa(it.id)}
                        className="text-secondary hover:text-status-danger transition-colors p-0.5 rounded"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Observações */}
          <div>
            <label htmlFor="obsCaixa" className="block text-xs font-bold text-foreground uppercase tracking-wide mb-1">
              Observações / Instruções
            </label>
            <Input
              id="obsCaixa"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Ex: Verificar calibragem do torquímetro mensalmente..."
              className="text-xs"
            />
          </div>

          {/* Rodapé do Modal */}
          <div className="flex justify-end gap-2.5 pt-3 border-t border-border/20 shrink-0">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={salvando}
              className="!h-10 px-5 rounded-xl text-xs font-semibold"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={salvando}
              className="!h-10 px-6 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20"
            >
              {salvando ? 'Salvando...' : 'Salvar Caixa de Ferramentas'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------------------------
// Subcomponente: Modal de Retirada de Caixa de Ferramentas (Vinculação ao Caminhão)
// ----------------------------------------------------------------------------------
function ModalRetiradaCaixa({
  caixa,
  veiculos,
  onClose,
  onSucesso,
}: {
  caixa: CaixaFerramenta
  veiculos: { id: string; placa: string }[]
  onClose: () => void
  onSucesso: (dados: { placa: string; responsavel: string; observacoes?: string }) => Promise<void>
}) {
  const [placasSelecionadas, setPlacasSelecionadas] = useState<string[]>([])
  const [placaInput, setPlacaInput] = useState('')
  const [responsavel, setResponsavel] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  function adicionarPlaca(p: string) {
    const limpa = p.trim().toUpperCase()
    if (!limpa) return
    const partes = limpa.split(/[,;/ ]+/).map((s) => s.trim().toUpperCase()).filter(Boolean)
    setPlacasSelecionadas((prev) => Array.from(new Set([...prev, ...partes])))
    setPlacaInput('')
  }

  function removerPlaca(p: string) {
    setPlacasSelecionadas((prev) => prev.filter((item) => item !== p))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    let listaFinalPlacas = [...placasSelecionadas]
    if (placaInput.trim()) {
      const partes = placaInput.split(/[,;/ ]+/).map((s) => s.trim().toUpperCase()).filter(Boolean)
      listaFinalPlacas = Array.from(new Set([...listaFinalPlacas, ...partes]))
    }

    if (listaFinalPlacas.length === 0) {
      setErro('Informe ao menos uma placa de caminhão.')
      return
    }
    if (!responsavel.trim()) {
      setErro('Informe o nome do responsável.')
      return
    }

    setSalvando(true)
    setErro(null)
    try {
      await onSucesso({
        placa: placasSelecionadas.join(' / '),
        responsavel: responsavel.trim().toUpperCase(),
        observacoes: observacoes.trim() || undefined,
      })
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao registrar retirada.')
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-border/30 bg-surface p-6 shadow-2xl animate-scale-in">
        {/* Cabeçalho */}
        <div className="mb-4 flex items-center justify-between border-b border-border/20 pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary border border-primary/20">
              <ArrowUpRight className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Retirar Caixa de Ferramentas</h2>
              <p className="text-xs text-secondary">{caixa.nome}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-secondary hover:bg-background hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {erro && (
          <div className="mb-4 rounded-xl bg-status-danger/10 border border-status-danger/30 p-3 text-xs font-semibold text-status-danger">
            {erro}
          </div>
        )}

        {/* Resumo dos Itens na Caixa */}
        <div className="mb-4 rounded-xl border border-border/20 bg-background/60 p-3 text-xs space-y-1">
          <span className="font-bold text-secondary uppercase block mb-1">
            📦 Itens Inclusos nesta Caixa ({caixa.itens.length}):
          </span>
          <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
            {caixa.itens.map((it) => (
              <span key={it.id} className="text-[11px] bg-surface px-2 py-0.5 rounded border border-border/10 text-foreground">
                {it.nome} ({it.quantidade}x)
              </span>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Placa(s) do Caminhão */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="placaCaixa" className="text-xs font-bold text-foreground uppercase tracking-wide">
                Placa(s) do Caminhão *
              </label>
              <span className="text-[11px] text-secondary">pode adicionar mais de uma</span>
            </div>

            {placasSelecionadas.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {placasSelecionadas.map((p) => (
                  <span
                    key={p}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/30 text-primary font-mono text-xs font-bold"
                  >
                    🚛 {p}
                    <button type="button" onClick={() => removerPlaca(p)} className="hover:text-status-danger">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Input
                id="placaCaixa"
                list="placas-sugestoes-caixa"
                value={placaInput}
                onChange={(e) => setPlacaInput(e.target.value.toUpperCase())}
                placeholder="Digite a placa (ex: ABC1D23)..."
                className="flex-1 font-mono uppercase text-sm"
              />
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => adicionarPlaca(placaInput)}
                disabled={!placaInput.trim()}
                className="shrink-0 !h-10 px-3.5 text-xs font-bold uppercase"
              >
                + Adicionar
              </Button>
            </div>
            <datalist id="placas-sugestoes-caixa">
              {veiculos.map((v) => (
                <option key={v.id} value={v.placa} />
              ))}
            </datalist>

            {veiculos.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] uppercase font-bold text-secondary mr-1">Rápidos:</span>
                {veiculos.slice(0, 6).map((v) => {
                  const jaAdd = placasSelecionadas.includes(v.placa.toUpperCase())
                  return (
                    <button
                      type="button"
                      key={v.id}
                      onClick={() => (jaAdd ? removerPlaca(v.placa.toUpperCase()) : adicionarPlaca(v.placa.toUpperCase()))}
                      className={`text-[11px] px-2.5 py-0.5 rounded-full font-mono font-medium border transition-all ${
                        jaAdd
                          ? 'bg-primary/20 border-primary text-primary'
                          : 'bg-background/60 border-border/30 text-secondary hover:text-foreground hover:border-primary/50'
                      }`}
                    >
                      {jaAdd ? `✓ ${v.placa}` : `+ ${v.placa}`}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Responsável */}
          <div>
            <label htmlFor="respCaixa" className="block text-xs font-bold text-foreground uppercase tracking-wide mb-1.5">
              Responsável (Mecânico / Motorista) *
            </label>
            <Input
              id="respCaixa"
              value={responsavel}
              onChange={(e) => setResponsavel(e.target.value)}
              placeholder="Nome de quem está retirando a caixa..."
              required
              className="text-sm"
            />
          </div>

          {/* Observações */}
          <div>
            <label htmlFor="obsRetCaixa" className="block text-xs font-bold text-foreground uppercase tracking-wide mb-1.5">
              Observações / Motivo <span className="text-secondary font-normal lowercase">(opcional)</span>
            </label>
            <Input
              id="obsRetCaixa"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Ex: Atendimento de socorro, manutenção na estrada..."
              className="text-sm"
            />
          </div>

          {/* Rodapé */}
          <div className="flex justify-end gap-2.5 pt-3 border-t border-border/20">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={salvando}
              className="!h-10 px-5 rounded-xl text-xs font-semibold"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={salvando}
              className="!h-10 px-6 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20"
            >
              {salvando ? 'Registrando...' : 'Confirmar Retirada'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
