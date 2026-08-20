import { useMemo, useState, useEffect } from 'react'
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
} from '@/hooks/useFerramentas'
import { supabase } from '@/lib/supabase'
import type { Ferramenta, FerramentaRetirada } from '@/lib/types'

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
  const [abaAtiva, setAbaAtiva] = useState<'estoque' | 'em_uso' | 'historico'>('estoque')
  const [busca, setBusca] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState('TODAS')
  const [modoVisualizacao, setModoVisualizacao] = useState<'lista' | 'grid'>('lista')

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
                        {/* CÓDIGO */}
                        <div className="truncate">
                          <span className="inline-flex rounded-lg bg-primary/10 border border-primary/20 px-2 py-0.5 text-xs font-mono font-black text-primary truncate max-w-full">
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

                      <div>
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

                      <p className="mt-1 text-xs text-secondary uppercase font-medium">
                        RESPONSÁVEL: <strong className="text-foreground font-bold">{r.responsavel}</strong>
                      </p>

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
                        <td className="px-4 py-3 text-secondary font-medium">{r.responsavel}</td>
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
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome.trim()) {
      setErro('INFORME O NOME DA FERRAMENTA.')
      return
    }

    setSalvando(true)
    setErro(null)

    try {
      if (ferramenta) {
        await atualizarFerramenta(ferramenta.id, {
          nome: nome.toUpperCase(),
          codigo: codigo.toUpperCase(),
          categoria: categoria.toUpperCase(),
          quantidade_total: Number(quantidadeTotal) || 1,
          localizacao: localizacao.toUpperCase(),
          observacoes: observacoes.toUpperCase(),
        })
      } else {
        await criarFerramenta({
          nome: nome.toUpperCase(),
          codigo: codigo.toUpperCase(),
          categoria: categoria.toUpperCase(),
          quantidade_total: Number(quantidadeTotal) || 1,
          localizacao: localizacao.toUpperCase(),
          observacoes: observacoes.toUpperCase(),
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 uppercase">
      <div className="w-full max-w-md rounded-2xl border border-border/10 bg-surface p-6 shadow-2xl animate-scale-in">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-foreground uppercase">
            {ferramenta ? 'EDITAR FERRAMENTA' : 'NOVA FERRAMENTA'}
          </h2>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-secondary hover:bg-overlay/10 hover:text-foreground"
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
              className="uppercase"
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
                className="uppercase"
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
                className="uppercase"
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
              />
            </div>
            <div>
              <Label htmlFor="local" className="uppercase font-bold">LOCALIZAÇÃO / GAVETA</Label>
              <Input
                id="local"
                value={localizacao}
                onChange={(e) => setLocalizacao(e.target.value)}
                placeholder="EX: ARMÁRIO 02"
                className="uppercase"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="obs" className="uppercase font-bold">OBSERVAÇÕES</Label>
            <Input
              id="obs"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="MARCA, ESTADO DE CONSERVAÇÃO, ETC."
              className="uppercase"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
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
// Subcomponente: Modal de Retirada de Ferramenta (Vinculação com Placa do Caminhão)
// ----------------------------------------------------------------------------------
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
  const [ferramentaId, setFerramentaId] = useState(ferramentaPreSelecionada?.id || ferramentasDisponiveis[0]?.id || '')
  const [placa, setPlaca] = useState('')
  const [responsavel, setResponsavel] = useState('')
  const [quantidade, setQuantidade] = useState('1')
  const [observacoes, setObservacoes] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const ferramentaAtual = useMemo(() => {
    return ferramentasDisponiveis.find((f) => f.id === ferramentaId) || ferramentaPreSelecionada
  }, [ferramentasDisponiveis, ferramentaId, ferramentaPreSelecionada])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ferramentaId) {
      setErro('SELECIONE UMA FERRAMENTA.')
      return
    }
    if (!placa.trim()) {
      setErro('INFORME A PLACA DO CAMINHÃO.')
      return
    }
    if (!responsavel.trim()) {
      setErro('INFORME O NOME DO RESPONSÁVEL (MECÂNICO/MOTORISTA).')
      return
    }

    const qtdNum = Number(quantidade) || 1
    if (ferramentaAtual && qtdNum > ferramentaAtual.quantidade_disponivel) {
      setErro(`QUANTIDADE MÁXIMA DISPONÍVEL: ${ferramentaAtual.quantidade_disponivel}`)
      return
    }

    setSalvando(true)
    setErro(null)

    try {
      const veiculoEncontrado = veiculos.find((v) => v.placa.toUpperCase() === placa.trim().toUpperCase())

      await registrarRetiradaFerramenta({
        ferramenta_id: ferramentaId,
        veiculo_id: veiculoEncontrado?.id || null,
        placa: placa.toUpperCase(),
        responsavel: responsavel.toUpperCase(),
        quantidade: qtdNum,
        observacoes_retirada: observacoes.toUpperCase(),
      })

      await onSucesso()
    } catch (err) {
      setErro(err instanceof Error ? err.message.toUpperCase() : 'ERRO AO REGISTRAR RETIRADA.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 uppercase">
      <div className="w-full max-w-md rounded-2xl border border-border/10 bg-surface p-6 shadow-2xl animate-scale-in">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 text-primary">
              <ArrowUpRight className="h-4 w-4" />
            </div>
            <h2 className="text-base font-bold text-foreground uppercase">RETIRAR FERRAMENTA</h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-secondary hover:bg-overlay/10 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {erro && <p className="mb-4 text-sm text-status-danger uppercase font-bold">{erro}</p>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="ferramenta" className="uppercase font-bold">FERRAMENTA *</Label>
            <select
              id="ferramenta"
              value={ferramentaId}
              onChange={(e) => setFerramentaId(e.target.value)}
              className="h-10 w-full rounded-xl border border-border/10 bg-background px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary uppercase"
              required
            >
              {ferramentasDisponiveis.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome.toUpperCase()} ({f.quantidade_disponivel} DISP.) {f.codigo ? `- [${f.codigo}]` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="placa" className="uppercase font-bold">PLACA DO CAMINHÃO *</Label>
              <Input
                id="placa"
                list="placas-sugestoes"
                value={placa}
                onChange={(e) => setPlaca(e.target.value.toUpperCase())}
                placeholder="EX: ABC1D23"
                required
                className="uppercase"
              />
              <datalist id="placas-sugestoes">
                {veiculos.map((v) => (
                  <option key={v.id} value={v.placa} />
                ))}
              </datalist>
            </div>

            <div>
              <Label htmlFor="qtd" className="uppercase font-bold">QUANTIDADE *</Label>
              <Input
                id="qtd"
                type="number"
                min="1"
                max={ferramentaAtual?.quantidade_disponivel || 1}
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="resp" className="uppercase font-bold">RESPONSÁVEL (MECÂNICO / MOTORISTA) *</Label>
            <Input
              id="resp"
              value={responsavel}
              onChange={(e) => setResponsavel(e.target.value)}
              placeholder="QUEM ESTÁ RETIRANDO A FERRAMENTA..."
              required
              className="uppercase"
            />
          </div>

          <div>
            <Label htmlFor="obs" className="uppercase font-bold">OBSERVAÇÕES / MOTIVO</Label>
            <Input
              id="obs"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="EX: MANUTENÇÃO NO FREIO, TROCA DE ÓLEO..."
              className="uppercase"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={salvando} className="uppercase font-semibold">
              CANCELAR
            </Button>
            <Button type="submit" disabled={salvando} className="uppercase font-bold">
              {salvando ? 'REGISTRANDO...' : 'CONFIRMAR RETIRADA'}
            </Button>
          </div>
        </form>
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
