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
// Subcomponente: Modal de Retirada de Ferramenta (Vinculação com Placa(s) do Caminhão)
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
  const [placasSelecionadas, setPlacasSelecionadas] = useState<string[]>([])
  const [placaInput, setPlacaInput] = useState('')
  const [responsavel, setResponsavel] = useState('')
  const [quantidade, setQuantidade] = useState('1')
  const [observacoes, setObservacoes] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const ferramentaAtual = useMemo(() => {
    return ferramentasDisponiveis.find((f) => f.id === ferramentaId) || ferramentaPreSelecionada
  }, [ferramentasDisponiveis, ferramentaId, ferramentaPreSelecionada])

  function adicionarPlaca(p: string) {
    const limpa = p.trim().toUpperCase()
    if (!limpa) return
    const partes = limpa.split(/[,;/ ]+/).map((s) => s.trim().toUpperCase()).filter(Boolean)
    setPlacasSelecionadas((prev) => {
      const set = new Set([...prev, ...partes])
      return Array.from(set)
    })
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

  const maxQtd = ferramentaAtual?.quantidade_disponivel || 1

  function ajustarQtd(delta: number) {
    const atual = Number(quantidade) || 1
    const nova = Math.max(1, Math.min(maxQtd, atual + delta))
    setQuantidade(String(nova))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ferramentaId) {
      setErro('Selecione uma ferramenta.')
      return
    }

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

    const qtdNum = Number(quantidade) || 1
    if (ferramentaAtual && qtdNum > ferramentaAtual.quantidade_disponivel) {
      setErro(`Quantidade máxima disponível: ${ferramentaAtual.quantidade_disponivel}`)
      return
    }

    setSalvando(true)
    setErro(null)

    try {
      const placaFinalFormatada = listaFinalPlacas.join(' / ')
      const veiculoEncontrado = veiculos.find((v) => listaFinalPlacas.includes(v.placa.toUpperCase()))

      await registrarRetiradaFerramenta({
        ferramenta_id: ferramentaId,
        veiculo_id: veiculoEncontrado?.id || null,
        placa: placaFinalFormatada,
        responsavel: responsavel.toUpperCase(),
        quantidade: qtdNum,
        observacoes_retirada: observacoes.toUpperCase(),
      })

      await onSucesso()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao registrar retirada.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-border/30 bg-surface p-6 shadow-2xl animate-scale-in">
        {/* Cabeçalho Clean */}
        <div className="mb-5 flex items-center justify-between border-b border-border/20 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary border border-primary/20">
              <ArrowUpRight className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Retirar Ferramenta</h2>
              <p className="text-xs text-secondary">Vincule a ferramenta ao caminhão e ao responsável</p>
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

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Campo: Ferramenta */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="ferramenta" className="text-xs font-bold text-foreground uppercase tracking-wide">
                Ferramenta *
              </label>
              {ferramentaAtual && (
                <span className="text-[11px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                  {ferramentaAtual.quantidade_disponivel} disponível(is)
                </span>
              )}
            </div>
            <select
              id="ferramenta"
              value={ferramentaId}
              onChange={(e) => setFerramentaId(e.target.value)}
              className="h-10 w-full rounded-xl border border-border/40 bg-background px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
              required
            >
              {ferramentasDisponiveis.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome} ({f.quantidade_disponivel} disp.) {f.codigo ? `— [${f.codigo}]` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Campo: Placas dos Caminhões */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="placa" className="text-xs font-bold text-foreground uppercase tracking-wide">
                Placa(s) do Caminhão *
              </label>
              <span className="text-[11px] text-secondary">pode adicionar mais de uma</span>
            </div>

            {/* Tags de Placas Selecionadas */}
            {placasSelecionadas.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {placasSelecionadas.map((p) => (
                  <span
                    key={p}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/30 text-primary font-mono text-xs font-bold shadow-sm"
                  >
                    🚛 {p}
                    <button
                      type="button"
                      onClick={() => removerPlaca(p)}
                      className="hover:text-status-danger transition-colors p-0.5 rounded"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Input
                id="placa"
                list="placas-sugestoes"
                value={placaInput}
                onChange={(e) => setPlacaInput(e.target.value.toUpperCase())}
                onKeyDown={handleKeyDownPlaca}
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
            <datalist id="placas-sugestoes">
              {veiculos.map((v) => (
                <option key={v.id} value={v.placa} />
              ))}
            </datalist>

            {/* Sugestões rápidas e limpas */}
            {veiculos.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] uppercase font-bold text-secondary mr-1">Rápidos:</span>
                {veiculos.slice(0, 6).map((v) => {
                  const jaAdd = placasSelecionadas.includes(v.placa.toUpperCase())
                  return (
                    <button
                      type="button"
                      key={v.id}
                      onClick={() => jaAdd ? removerPlaca(v.placa.toUpperCase()) : adicionarPlaca(v.placa.toUpperCase())}
                      className={`text-[11px] px-2.5 py-0.5 rounded-full font-mono font-medium border transition-all ${
                        jaAdd
                          ? 'bg-primary/20 border-primary text-primary shadow-sm'
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

          {/* Grid de 2 Colunas: Quantidade & Responsável */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="qtd" className="block text-xs font-bold text-foreground uppercase tracking-wide mb-1.5">
                Quantidade *
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => ajustarQtd(-1)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/40 bg-background text-foreground hover:bg-surface font-bold text-base transition-colors"
                >
                  -
                </button>
                <Input
                  id="qtd"
                  type="number"
                  min="1"
                  max={maxQtd}
                  value={quantidade}
                  onChange={(e) => setQuantidade(e.target.value)}
                  required
                  className="text-center font-bold text-sm"
                />
                <button
                  type="button"
                  onClick={() => ajustarQtd(1)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/40 bg-background text-foreground hover:bg-surface font-bold text-base transition-colors"
                >
                  +
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="resp" className="block text-xs font-bold text-foreground uppercase tracking-wide mb-1.5">
                Responsável *
              </label>
              <Input
                id="resp"
                value={responsavel}
                onChange={(e) => setResponsavel(e.target.value)}
                placeholder="Nome do mecânico ou motorista..."
                required
                className="text-sm"
              />
            </div>
          </div>

          {/* Campo: Observações */}
          <div>
            <label htmlFor="obs" className="block text-xs font-bold text-foreground uppercase tracking-wide mb-1.5">
              Observações / Motivo <span className="text-secondary font-normal lowercase">(opcional)</span>
            </label>
            <Input
              id="obs"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Ex: Manutenção preventiva no freio, troca de óleo..."
              className="text-sm"
            />
          </div>

          {/* Ações do Rodapé */}
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
