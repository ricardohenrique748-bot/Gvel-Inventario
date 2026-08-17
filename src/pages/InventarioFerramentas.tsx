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
  'GERAL',
]

export function InventarioFerramentas() {
  const [abaAtiva, setAbaAtiva] = useState<'estoque' | 'em_uso' | 'historico'>('estoque')
  const [busca, setBusca] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState('TODAS')

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
    if (!confirm(`Deseja realmente excluir a ferramenta "${f.nome}" do catálogo?`)) return
    try {
      setMensagemErro(null)
      await excluirFerramenta(f.id)
      await recarregarDados()
    } catch (err) {
      setMensagemErro(err instanceof Error ? err.message : 'Erro ao excluir ferramenta.')
    }
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Cabeçalho */}
      <PageHeader
        title="Inventário de Ferramentas"
        subtitle="Controle de estoque, empréstimo e vinculação com caminhões"
        actions={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setFerramentaSelecionadaParaRetirada(null)
                setModalRetiradaAberto(true)
              }}
              className="gap-2 border-primary/30 text-foreground hover:border-primary"
            >
              <ArrowUpRight className="h-4 w-4 text-primary" />
              Retirar Ferramenta
            </Button>
            <Button
              type="button"
              onClick={() => {
                setFerramentaEditando(null)
                setModalFerramentaAberto(true)
              }}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Nova Ferramenta
            </Button>
          </div>
        }
      />

      {mensagemErro && (
        <div className="rounded-xl border border-status-danger/30 bg-status-danger/10 p-4 text-sm text-status-danger flex items-center justify-between">
          <span>{mensagemErro}</span>
          <button onClick={() => setMensagemErro(null)} className="text-status-danger hover:opacity-75">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Cards de Métricas */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between text-secondary">
            <span className="text-xs font-medium uppercase tracking-wider">Catálogo</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Hammer className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl sm:text-3xl font-bold tabular-nums text-foreground">
            {loadingFerramentas ? '—' : metricas.totalTipos}
          </p>
          <p className="mt-1 text-xs text-secondary">{metricas.totalItens} unidades totais</p>
        </Card>

        <Card className="p-4 sm:p-5 border-emerald-500/20">
          <div className="flex items-center justify-between text-secondary">
            <span className="text-xs font-medium uppercase tracking-wider text-emerald-500">Disponíveis</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl sm:text-3xl font-bold tabular-nums text-foreground">
            {loadingFerramentas ? '—' : metricas.disponiveis}
          </p>
          <p className="mt-1 text-xs text-secondary">Prontas no estoque</p>
        </Card>

        <Card className="p-4 sm:p-5 border-amber-500/20">
          <div className="flex items-center justify-between text-secondary">
            <span className="text-xs font-medium uppercase tracking-wider text-amber-500">Em Uso</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
              <Truck className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl sm:text-3xl font-bold tabular-nums text-foreground">
            {loadingRetiradas ? '—' : metricas.emUso}
          </p>
          <p className="mt-1 text-xs text-secondary">{metricas.retiradasAtivasCount} retirada(s) em aberto</p>
        </Card>

        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between text-secondary">
            <span className="text-xs font-medium uppercase tracking-wider">Histórico</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-overlay/10 text-secondary">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl sm:text-3xl font-bold tabular-nums text-foreground">
            {loadingRetiradas ? '—' : metricas.totalHistorico}
          </p>
          <p className="mt-1 text-xs text-secondary">Movimentações totais</p>
        </Card>
      </div>

      {/* Abas de Navegação */}
      <div className="flex border-b border-border/10">
        <button
          type="button"
          onClick={() => setAbaAtiva('estoque')}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-medium transition-colors ${
            abaAtiva === 'estoque'
              ? 'border-primary text-foreground font-semibold'
              : 'border-transparent text-secondary hover:text-foreground'
          }`}
        >
          <Package className="h-4 w-4" />
          Estoque de Ferramentas ({ferramentas.length})
        </button>

        <button
          type="button"
          onClick={() => setAbaAtiva('em_uso')}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-medium transition-colors ${
            abaAtiva === 'em_uso'
              ? 'border-primary text-foreground font-semibold'
              : 'border-transparent text-secondary hover:text-foreground'
          }`}
        >
          <Truck className="h-4 w-4" />
          Em Uso no Momento
          {metricas.retiradasAtivasCount > 0 && (
            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-bold text-amber-500">
              {metricas.retiradasAtivasCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setAbaAtiva('historico')}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-medium transition-colors ${
            abaAtiva === 'historico'
              ? 'border-primary text-foreground font-semibold'
              : 'border-transparent text-secondary hover:text-foreground'
          }`}
        >
          <Clock className="h-4 w-4" />
          Histórico de Retiradas
        </button>
      </div>

      {/* ==================== ABA 1: ESTOQUE DE FERRAMENTAS ==================== */}
      {abaAtiva === 'estoque' && (
        <div className="space-y-4">
          {/* Filtros e Busca */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome, código ou localização..."
                className="h-10 w-full rounded-xl border border-border/10 bg-surface pl-9 pr-4 text-sm text-foreground placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Categorias */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {CATEGORIAS_SUGERIDAS.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoriaFiltro(cat)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    categoriaFiltro === cat
                      ? 'bg-primary text-white font-semibold'
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
            <Card className="p-12 text-center">
              <Hammer className="mx-auto mb-3 h-10 w-10 text-secondary" />
              <p className="text-base font-semibold text-foreground">Nenhuma ferramenta encontrada</p>
              <p className="mt-1 text-sm text-secondary">
                {busca || categoriaFiltro !== 'TODAS'
                  ? 'Tente alterar os filtros de busca.'
                  : 'Cadastre sua primeira ferramenta clicando no botão "Nova Ferramenta".'}
              </p>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {ferramentasFiltradas.map((f) => {
                const emUsoQtd = (f.quantidade_total || 0) - (f.quantidade_disponivel || 0)
                const semEstoque = (f.quantidade_disponivel || 0) <= 0

                return (
                  <Card
                    key={f.id}
                    className="group relative flex flex-col justify-between overflow-hidden p-5 transition-all duration-200 hover:border-primary/40 hover:shadow-xl"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="rounded-lg bg-primary/10 px-2 py-0.5 text-[11px] font-mono font-semibold text-primary">
                            {f.codigo || 'S/ COD'}
                          </span>
                          <span className="rounded-lg bg-overlay/5 px-2 py-0.5 text-[11px] font-medium text-secondary uppercase">
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
                            className="rounded-lg p-1.5 text-secondary hover:bg-overlay/10 hover:text-foreground transition-colors"
                            aria-label="Editar"
                            title="Editar ferramenta"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExcluirFerramenta(f)}
                            className="rounded-lg p-1.5 text-secondary hover:bg-status-danger/10 hover:text-status-danger transition-colors"
                            aria-label="Excluir"
                            title="Excluir ferramenta"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      <h3 className="mt-2.5 text-base font-semibold text-foreground leading-snug">
                        {f.nome}
                      </h3>

                      {f.localizacao && (
                        <p className="mt-1 flex items-center gap-1 text-xs text-secondary">
                          <Layers className="h-3 w-3 text-secondary" />
                          <span>Local: <strong className="text-foreground">{f.localizacao}</strong></span>
                        </p>
                      )}

                      {f.observacoes && (
                        <p className="mt-2 text-xs text-secondary line-clamp-2 italic">
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
                          <span className="text-xs text-secondary">/ {f.quantidade_total} disp.</span>
                        </div>
                        {emUsoQtd > 0 && (
                          <p className="text-[11px] text-amber-500 font-medium">
                            {emUsoQtd} em uso
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
                        className="gap-1.5 text-xs h-9 px-3"
                      >
                        <ArrowUpRight className="h-3.5 w-3.5" />
                        Retirar
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
        <div className="space-y-4">
          {loadingRetiradas ? (
            <div className="flex min-h-[30vh] items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-secondary/30 border-t-primary" />
            </div>
          ) : retiradasAtivas.length === 0 ? (
            <Card className="p-12 text-center">
              <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-500" />
              <p className="text-base font-semibold text-foreground">Nenhuma ferramenta em uso no momento</p>
              <p className="mt-1 text-sm text-secondary">
                Todas as ferramentas estão disponíveis no estoque.
              </p>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {retiradasAtivas.map((r) => {
                const dataFormatada = format(new Date(r.data_hora_retirada), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })

                return (
                  <Card key={r.id} className="p-5 border-amber-500/30 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-1 rounded-lg bg-primary/20 px-2.5 py-1 text-xs font-mono font-bold text-primary">
                            <Truck className="h-3.5 w-3.5" />
                            {r.placa}
                          </span>
                          <Badge tone="warning" className="text-[11px]">
                            {r.quantidade} un.
                          </Badge>
                        </div>
                        <span className="text-[11px] text-secondary flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {dataFormatada}
                        </span>
                      </div>

                      <h3 className="mt-3 text-base font-semibold text-foreground">
                        {r.ferramenta?.nome || 'Ferramenta'}
                      </h3>

                      <p className="mt-1 text-xs text-secondary">
                        Responsável: <strong className="text-foreground font-medium">{r.responsavel}</strong>
                      </p>

                      {r.observacoes_retirada && (
                        <p className="mt-2 text-xs text-secondary italic bg-background/50 p-2 rounded-lg">
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
                        className="gap-1.5 text-xs border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10 hover:border-emerald-500"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Registrar Devolução
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
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border/10 bg-overlay/5 text-[11px] font-semibold uppercase tracking-wider text-secondary">
                <tr>
                  <th className="px-4 py-3">Ferramenta</th>
                  <th className="px-4 py-3">Placa / Caminhão</th>
                  <th className="px-4 py-3">Responsável</th>
                  <th className="px-4 py-3">Qtd</th>
                  <th className="px-4 py-3">Data Retirada</th>
                  <th className="px-4 py-3">Data Devolução</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/5">
                {retiradas.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-secondary">
                      Nenhum histórico registrado ainda.
                    </td>
                  </tr>
                ) : (
                  retiradas.map((r) => {
                    const dataRet = format(new Date(r.data_hora_retirada), "dd/MM/yyyy HH:mm", { locale: ptBR })
                    const dataDev = r.data_hora_devolucao
                      ? format(new Date(r.data_hora_devolucao), "dd/MM/yyyy HH:mm", { locale: ptBR })
                      : '—'

                    return (
                      <tr key={r.id} className="hover:bg-overlay/[0.02] transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-foreground">{r.ferramenta?.nome || 'Ferramenta'}</p>
                          {r.ferramenta?.codigo && (
                            <span className="text-[10px] font-mono text-secondary">{r.ferramenta.codigo}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono font-semibold text-primary">{r.placa}</span>
                        </td>
                        <td className="px-4 py-3 text-secondary">{r.responsavel}</td>
                        <td className="px-4 py-3 font-semibold text-foreground">{r.quantidade}</td>
                        <td className="px-4 py-3 text-xs text-secondary">{dataRet}</td>
                        <td className="px-4 py-3 text-xs text-secondary">{dataDev}</td>
                        <td className="px-4 py-3">
                          {r.status === 'em_uso' && (
                            <Badge tone="warning" className="text-[11px]">
                              Em uso
                            </Badge>
                          )}
                          {r.status === 'devolvido' && (
                            <Badge tone="success" className="text-[11px]">
                              Devolvido
                            </Badge>
                          )}
                          {r.status === 'avaria_perda' && (
                            <Badge tone="danger" className="text-[11px]">
                              Avaria / Perda
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
      setErro('Informe o nome da ferramenta.')
      return
    }

    setSalvando(true)
    setErro(null)

    try {
      if (ferramenta) {
        await atualizarFerramenta(ferramenta.id, {
          nome,
          codigo,
          categoria,
          quantidade_total: Number(quantidadeTotal) || 1,
          localizacao,
          observacoes,
        })
      } else {
        await criarFerramenta({
          nome,
          codigo,
          categoria,
          quantidade_total: Number(quantidadeTotal) || 1,
          localizacao,
          observacoes,
        })
      }
      await onSalvo()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar ferramenta.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-md rounded-2xl border border-border/10 bg-surface p-6 shadow-2xl animate-scale-in">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">
            {ferramenta ? 'Editar Ferramenta' : 'Nova Ferramenta'}
          </h2>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-secondary hover:bg-overlay/10 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {erro && <p className="mb-4 text-sm text-status-danger">{erro}</p>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="nome">Nome da Ferramenta *</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Chave de Impacto 1/2, Torquímetro, Scanner..."
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="codigo">Código / Patrimônio</Label>
              <Input
                id="codigo"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="Ex: FER-012"
              />
            </div>
            <div>
              <Label htmlFor="categoria">Categoria</Label>
              <Input
                id="categoria"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                placeholder="Ex: Pneumática"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="qtd">Quantidade Total</Label>
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
              <Label htmlFor="local">Localização / Gaveta</Label>
              <Input
                id="local"
                value={localizacao}
                onChange={(e) => setLocalizacao(e.target.value)}
                placeholder="Ex: Armário 02"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="obs">Observações</Label>
            <Input
              id="obs"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Marca, estado de conservação, etc."
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={salvando}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando}>
              {salvando ? 'Salvando...' : ferramenta ? 'Salvar Alterações' : 'Cadastrar'}
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
      setErro('Selecione uma ferramenta.')
      return
    }
    if (!placa.trim()) {
      setErro('Informe a placa do caminhão.')
      return
    }
    if (!responsavel.trim()) {
      setErro('Informe o nome do responsável (mecânico/motorista).')
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
      const veiculoEncontrado = veiculos.find((v) => v.placa.toUpperCase() === placa.trim().toUpperCase())

      await registrarRetiradaFerramenta({
        ferramenta_id: ferramentaId,
        veiculo_id: veiculoEncontrado?.id || null,
        placa,
        responsavel,
        quantidade: qtdNum,
        observacoes_retirada: observacoes,
      })

      await onSucesso()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao registrar retirada.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-md rounded-2xl border border-border/10 bg-surface p-6 shadow-2xl animate-scale-in">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 text-primary">
              <ArrowUpRight className="h-4 w-4" />
            </div>
            <h2 className="text-base font-semibold text-foreground">Retirar Ferramenta</h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-secondary hover:bg-overlay/10 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {erro && <p className="mb-4 text-sm text-status-danger">{erro}</p>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="ferramenta">Ferramenta *</Label>
            <select
              id="ferramenta"
              value={ferramentaId}
              onChange={(e) => setFerramentaId(e.target.value)}
              className="h-10 w-full rounded-xl border border-border/10 bg-background px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              required
            >
              {ferramentasDisponiveis.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome} ({f.quantidade_disponivel} disp.) {f.codigo ? `- [${f.codigo}]` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="placa">Placa do Caminhão *</Label>
              <Input
                id="placa"
                list="placas-sugestoes"
                value={placa}
                onChange={(e) => setPlaca(e.target.value.toUpperCase())}
                placeholder="Ex: ABC1D23"
                required
              />
              <datalist id="placas-sugestoes">
                {veiculos.map((v) => (
                  <option key={v.id} value={v.placa} />
                ))}
              </datalist>
            </div>

            <div>
              <Label htmlFor="qtd">Quantidade *</Label>
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
            <Label htmlFor="resp">Responsável (Mecânico / Motorista) *</Label>
            <Input
              id="resp"
              value={responsavel}
              onChange={(e) => setResponsavel(e.target.value)}
              placeholder="Quem está retirando a ferramenta..."
              required
            />
          </div>

          <div>
            <Label htmlFor="obs">Observações / Motivo</Label>
            <Input
              id="obs"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Ex: Manutenção no freio, troca de óleo..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={salvando}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando}>
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
        observacoes_devolucao: observacoes,
      })
      await onSucesso()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao registrar devolução.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-md rounded-2xl border border-border/10 bg-surface p-6 shadow-2xl animate-scale-in">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-500">
              <RotateCcw className="h-4 w-4" />
            </div>
            <h2 className="text-base font-semibold text-foreground">Registrar Devolução</h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-secondary hover:bg-overlay/10 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {erro && <p className="mb-4 text-sm text-status-danger">{erro}</p>}

        {/* Resumo da Retirada */}
        <div className="mb-4 rounded-xl border border-border/10 bg-background p-3.5 space-y-1.5 text-xs text-secondary">
          <p>
            Ferramenta: <strong className="text-foreground font-semibold">{retirada.ferramenta?.nome || 'Ferramenta'}</strong>
          </p>
          <p>
            Placa do Caminhão: <strong className="text-primary font-mono font-bold">{retirada.placa}</strong>
          </p>
          <p>
            Responsável: <strong className="text-foreground font-medium">{retirada.responsavel}</strong> ({retirada.quantidade} un.)
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="condicao">Condição da Devolução</Label>
            <select
              id="condicao"
              value={statusDevolucao}
              onChange={(e) => setStatusDevolucao(e.target.value as 'devolvido' | 'avaria_perda')}
              className="h-10 w-full rounded-xl border border-border/10 bg-background px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="devolvido">Devolvida em bom estado (Retorna ao estoque)</option>
              <option value="avaria_perda">Com avaria / Perda / Desgaste (Baixa do estoque)</option>
            </select>
          </div>

          <div>
            <Label htmlFor="obsDev">Observações da Devolução</Label>
            <Input
              id="obsDev"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Ex: Devolvido limpo, sem danos..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={salvando}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando} className="bg-emerald-600 hover:bg-emerald-500">
              {salvando ? 'Salvando...' : 'Confirmar Devolução'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
