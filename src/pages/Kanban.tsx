import { useState, useMemo } from 'react'
import {
  Columns3,
  List,
  RefreshCw,
  Search,
  Truck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileSpreadsheet,
  MapPin,
  Calendar,
  ExternalLink,
  X,
  Wrench,
  ChevronRight,
  Info,
  Copy,
  Check,
  ShieldAlert,
  User,
  History,
} from 'lucide-react'
import { Navigate } from 'react-router-dom'
import { PageHeader } from '@/components/layout/Header'
import { Card } from '@/components/ui/Card'
import { Input, Select } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/contexts/AuthContext'
import { isNativeApp } from '@/lib/isNativeApp'
import { isKanbanAuthorized } from '@/components/layout/nav'
import { useKanbanSheet, type KanbanItem } from '@/hooks/useKanbanSheet'

type ViewMode = 'kanban' | 'tabela'

// Definição das colunas principais do Kanban baseadas no fluxo operacional
interface ColunaConfig {
  id: string
  titulo: string
  descricao: string
  headerBg: string
  corIcone: string
  corBorda: string
  badgeBg: string
  badgeText: string
  icone: any
  matcher: (item: KanbanItem) => boolean
}

const COLUNAS: ColunaConfig[] = [
  {
    id: 'definicao',
    titulo: 'AG. DEFINIÇÃO',
    descricao: 'DIRETORIA OU MATHEUS',
    headerBg: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
    corIcone: 'text-amber-400',
    corBorda: 'hover:border-amber-500/40',
    badgeBg: 'bg-amber-500/20',
    badgeText: 'text-amber-300',
    icone: Clock,
    matcher: (item) => {
      const obs = item.obsGvel.toUpperCase()
      const prev = item.previsaoEntrega.toUpperCase()
      if (obs.includes('ENTREGUE') || prev.includes('ENTREGUE') || obs.includes('FINALIZADO') || prev.includes('FINALIZADO')) return false
      return obs.includes('DEFINIÇÃO') || obs.includes('DIRETORIA')
    },
  },
  {
    id: 'orcamento',
    titulo: 'ORÇAMENTO & REGULAGEM',
    descricao: 'LEVANTAMENTO OU OFICINA',
    headerBg: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
    corIcone: 'text-purple-400',
    corBorda: 'hover:border-purple-500/40',
    badgeBg: 'bg-purple-500/20',
    badgeText: 'text-purple-300',
    icone: Wrench,
    matcher: (item) => {
      const obs = item.obsGvel.toUpperCase()
      const prev = item.previsaoEntrega.toUpperCase()
      const orc = item.orcamento.toUpperCase()
      if (
        obs.includes('ENTREGUE') ||
        prev.includes('ENTREGUE') ||
        obs.includes('FINALIZADO') ||
        prev.includes('FINALIZADO') ||
        obs.includes('DEFINIÇÃO') ||
        obs.includes('DIRETORIA')
      )
        return false
      return (
        orc.includes('LEVANTANDO') ||
        orc.includes('REGULAGEM') ||
        obs.includes('LEVANTANDO') ||
        obs.includes('REGULAGEM')
      )
    },
  },
  {
    id: 'andamento',
    titulo: 'EM ANDAMENTO',
    descricao: 'PREPARAÇÃO ATIVA',
    headerBg: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
    corIcone: 'text-blue-400',
    corBorda: 'hover:border-blue-500/40',
    badgeBg: 'bg-blue-500/20',
    badgeText: 'text-blue-300',
    icone: Truck,
    matcher: (item) => {
      const obs = item.obsGvel.toUpperCase()
      const prev = item.previsaoEntrega.toUpperCase()
      const orc = item.orcamento.toUpperCase()
      if (
        obs.includes('ENTREGUE') ||
        prev.includes('ENTREGUE') ||
        obs.includes('TRANSPORTE') ||
        obs.includes('PRONTO') ||
        obs.includes('LIBERADO') ||
        obs.includes('FINALIZADO') ||
        prev.includes('FINALIZADO') ||
        obs.includes('DEFINIÇÃO') ||
        obs.includes('DIRETORIA')
      )
        return false
      if (orc.includes('LEVANTANDO') || orc.includes('REGULAGEM') || obs.includes('LEVANTANDO') || obs.includes('REGULAGEM'))
        return false
      return obs.includes('ANDAMENTO') || obs.includes('EXECUÇÃO') || orc.includes('OK')
    },
  },
  {
    id: 'transporte',
    titulo: 'PRONTO / TRANSPORTE',
    descricao: 'LIBERADO P/ ENVIO',
    headerBg: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400',
    corIcone: 'text-cyan-400',
    corBorda: 'hover:border-cyan-500/40',
    badgeBg: 'bg-cyan-500/20',
    badgeText: 'text-cyan-300',
    icone: MapPin,
    matcher: (item) => {
      const obs = item.obsGvel.toUpperCase()
      const prev = item.previsaoEntrega.toUpperCase()
      if (obs.includes('ENTREGUE') || prev.includes('ENTREGUE')) return false
      return (
        obs.includes('TRANSPORTE') ||
        obs.includes('PRONTO') ||
        obs.includes('LIBERADO') ||
        obs.includes('FINALIZADO') ||
        prev.includes('FINALIZADO')
      )
    },
  },
  {
    id: 'entregue',
    titulo: 'ENTREGUE',
    descricao: 'FINALIZADO',
    headerBg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
    corIcone: 'text-emerald-400',
    corBorda: 'hover:border-emerald-500/40',
    badgeBg: 'bg-emerald-500/20',
    badgeText: 'text-emerald-300',
    icone: CheckCircle2,
    matcher: (item) => {
      const obs = item.obsGvel.toUpperCase()
      const prev = item.previsaoEntrega.toUpperCase()
      return obs.includes('ENTREGUE') || prev.includes('ENTREGUE')
    },
  },
]

export function Kanban() {
  const { user, perfilLoading } = useAuth()
  const nomeUsuario =
    user?.user_metadata?.nome ||
    (user?.email === 'victor@gveldiesel.com'
      ? 'VICTOR'
      : user?.email === 'ricardo_h.16@hotmail.com'
      ? 'RICARDO'
      : user?.email?.split('@')[0]?.toUpperCase() || 'USUÁRIO')

  const {
    items,
    historico,
    loading,
    isAutoSyncing,
    autoSyncEnabled,
    setAutoSyncEnabled,
    error,
    lastSync,
    fetchSheet,
  } = useKanbanSheet(nomeUsuario)

  // Bloqueio no APK mobile
  if (isNativeApp()) {
    return <Navigate to="/" replace />
  }

  const authorized = isKanbanAuthorized(user?.email)

  if (!perfilLoading && !authorized) {
    return (
      <div className="uppercase space-y-6 animate-fade-in">
        <PageHeader title="KANBAN LOCALIZA" subtitle="FLUXO DE OPERAÇÃO E GESTÃO DE PROCESSOS" />
        <Card className="p-8 sm:p-12 text-center uppercase border-border/20 bg-surface shadow-2xl">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/10 text-red-400 shadow-inner">
            <ShieldAlert className="h-8 w-8" />
          </div>
          <p className="text-lg font-black text-foreground">ACESSO RESTRITO AO KANBAN</p>
          <p className="mt-2 text-xs sm:text-sm text-secondary font-medium max-w-md mx-auto leading-relaxed">
            ESTE MÓDULO ESTÁ DISPONÍVEL EXCLUSIVAMENTE PARA OS USUÁRIOS AUTORIZADOS PELA DIRETORIA.
          </p>
        </Card>
      </div>
    )
  }

  const [busca, setBusca] = useState('')
  const [mesFiltro, setMesFiltro] = useState('')
  const [condicaoFiltro, setCondicaoFiltro] = useState('')
  const [localFiltro, setLocalFiltro] = useState('')
  const [orcamentoFiltro, setOrcamentoFiltro] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('kanban')
  const [modalHistoricoAberto, setModalHistoricoAberto] = useState(false)

  // Modal de Detalhe
  const [selectedItem, setSelectedItem] = useState<KanbanItem | null>(null)
  const [copiedPlaca, setCopiedPlaca] = useState(false)

  // Opções para filtros
  const opcoesMes = useMemo(() => {
    const s = new Set<string>()
    items.forEach((i) => i.mes && s.add(i.mes))
    return Array.from(s).sort()
  }, [items])

  const opcoesLocais = useMemo(() => {
    const s = new Set<string>()
    items.forEach((i) => i.localAtual && s.add(i.localAtual))
    return Array.from(s).sort()
  }, [items])

  // Itens filtrados
  const itensFiltrados = useMemo(() => {
    return items.filter((item) => {
      if (busca) {
        const termo = busca.toLowerCase()
        const match =
          item.placa.toLowerCase().includes(termo) ||
          item.cliente.toLowerCase().includes(termo) ||
          item.modelo.toLowerCase().includes(termo) ||
          item.chassi.toLowerCase().includes(termo) ||
          item.obsGvel.toLowerCase().includes(termo) ||
          item.localEntrega.toLowerCase().includes(termo)
        if (!match) return false
      }
      if (mesFiltro && item.mes !== mesFiltro) return false
      if (condicaoFiltro && item.condicao !== condicaoFiltro) return false
      if (localFiltro && item.localAtual !== localFiltro) return false
      if (orcamentoFiltro && item.orcamento !== orcamentoFiltro) return false
      return true
    })
  }, [items, busca, mesFiltro, condicaoFiltro, localFiltro, orcamentoFiltro])

  // Métricas rápidas
  const metricas = useMemo(() => {
    const total = itensFiltrados.length
    const definicao = itensFiltrados.filter((i) => COLUNAS.find((c) => c.id === 'definicao')?.matcher(i)).length
    const orcamento = itensFiltrados.filter((i) => COLUNAS.find((c) => c.id === 'orcamento')?.matcher(i)).length
    const andamento = itensFiltrados.filter((i) => COLUNAS.find((c) => c.id === 'andamento')?.matcher(i)).length
    const transporte = itensFiltrados.filter((i) => COLUNAS.find((c) => c.id === 'transporte')?.matcher(i)).length
    const entregues = itensFiltrados.filter((i) => COLUNAS.find((c) => c.id === 'entregue')?.matcher(i)).length
    const inoperantes = itensFiltrados.filter((i) => i.condicao.toLowerCase().includes('inop')).length

    return { total, definicao, orcamento, andamento, transporte, entregues, inoperantes }
  }, [itensFiltrados])

  // Agrupamento por coluna
  const itensPorColuna = useMemo(() => {
    const mapa = new Map<string, KanbanItem[]>()
    COLUNAS.forEach((col) => mapa.set(col.id, []))

    itensFiltrados.forEach((item) => {
      let matched = false
      for (const col of COLUNAS) {
        if (col.matcher(item)) {
          mapa.get(col.id)!.push(item)
          matched = true
          break
        }
      }
      if (!matched) {
        mapa.get('andamento')?.push(item)
      }
    })

    return mapa
  }, [itensFiltrados])

  const temFiltroAtivo = Boolean(busca || mesFiltro || condicaoFiltro || localFiltro || orcamentoFiltro)

  function limparFiltros() {
    setBusca('')
    setMesFiltro('')
    setCondicaoFiltro('')
    setLocalFiltro('')
    setOrcamentoFiltro('')
  }

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text)
    setCopiedPlaca(true)
    setTimeout(() => setCopiedPlaca(false), 1500)
  }

  return (
    <div className="space-y-6 animate-fade-in uppercase">
      {/* Cabeçalho */}
      <PageHeader
        title="KANBAN LOCALIZA"
        subtitle="FLUXO DE OPERAÇÃO E STATUS DOS VEÍCULOS EM TEMPO REAL"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="md"
              onClick={() => setModalHistoricoAberto(true)}
              className="gap-2 font-bold hover:border-primary/50 text-foreground"
            >
              <History className="h-4 w-4 text-primary" />
              <span>HISTÓRICO</span>
            </Button>

            <Button
              variant="secondary"
              size="md"
              onClick={() => setViewMode(viewMode === 'kanban' ? 'tabela' : 'kanban')}
              className="gap-2 font-bold"
            >
              {viewMode === 'kanban' ? <List className="h-4 w-4" /> : <Columns3 className="h-4 w-4" />}
              <span>{viewMode === 'kanban' ? 'VER EM LISTA' : 'VER EM KANBAN'}</span>
            </Button>

            <Button
              variant="primary"
              size="md"
              onClick={() => fetchSheet(nomeUsuario)}
              disabled={loading}
              className="gap-2 font-bold shadow-lg shadow-primary/20"
            >
              <RefreshCw className={`h-4 w-4 ${loading || isAutoSyncing ? 'animate-spin' : ''}`} />
              <span>{loading ? 'SINCRONIZANDO…' : isAutoSyncing ? 'ATUALIZANDO AUTO…' : 'ATUALIZAR PLANILHA'}</span>
            </Button>
          </div>
        }
      />

      {/* Banner de Sincronização & Informações */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/10 bg-surface/80 px-4 py-3 text-xs font-medium text-secondary backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className={`flex h-2.5 w-2.5 rounded-full ${autoSyncEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
          <span className="font-bold text-foreground">GOOGLE SHEETS:</span>
          <span>{lastSync ? `ÚLTIMA SINCRONIZAÇÃO EM ${lastSync}` : 'PLANILHA CONECTADA'}</span>
          
          <span className="text-border/40">|</span>
          <button
            type="button"
            onClick={() => setAutoSyncEnabled(!autoSyncEnabled)}
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-bold text-[10px] uppercase transition-all cursor-pointer ${
              autoSyncEnabled
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25'
                : 'bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25'
            }`}
            title={autoSyncEnabled ? 'Clique para pausar atualização automática' : 'Clique para ativar atualização automática'}
          >
            <RefreshCw className={`h-3 w-3 ${autoSyncEnabled && isAutoSyncing ? 'animate-spin' : ''}`} />
            <span>{autoSyncEnabled ? 'AUTO-ATUALIZAÇÃO ATIVA (30S)' : 'AUTO-ATUALIZAÇÃO PAUSADA'}</span>
          </button>
        </div>

        <a
          href="https://docs.google.com/spreadsheets/d/e/2PACX-1vQA_sHIwYemwUI6KdcR7xIjXzLi6SNcGC0ZSJyUyrRQ83L1w_qLiVi_fvd8ZVcCktq-2ui2G18RNqNW/pubhtml"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-primary hover:underline font-bold"
        >
          <FileSpreadsheet className="h-4 w-4" />
          <span>ABRIR PLANILHA ORIGINAL</span>
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-2xl border border-status-danger/30 bg-status-danger/10 p-4 text-xs font-bold text-status-danger">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Cards de Métricas */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <Card className="p-4 transition-all hover:border-primary/40">
          <p className="text-[11px] font-bold text-secondary">TOTAL</p>
          <p className="mt-1 text-2xl font-black text-foreground tabular-nums">{metricas.total}</p>
        </Card>

        <Card className="p-4 transition-all hover:border-amber-500/40">
          <p className="text-[11px] font-bold text-amber-400">AG. DEFINIÇÃO</p>
          <p className="mt-1 text-2xl font-black text-amber-400 tabular-nums">{metricas.definicao}</p>
        </Card>

        <Card className="p-4 transition-all hover:border-purple-500/40">
          <p className="text-[11px] font-bold text-purple-400">ORÇAMENTOS</p>
          <p className="mt-1 text-2xl font-black text-purple-400 tabular-nums">{metricas.orcamento}</p>
        </Card>

        <Card className="p-4 transition-all hover:border-blue-500/40">
          <p className="text-[11px] font-bold text-blue-400">EM ANDAMENTO</p>
          <p className="mt-1 text-2xl font-black text-blue-400 tabular-nums">{metricas.andamento}</p>
        </Card>

        <Card className="p-4 transition-all hover:border-cyan-500/40">
          <p className="text-[11px] font-bold text-cyan-400">PRONTO / TRANSP.</p>
          <p className="mt-1 text-2xl font-black text-cyan-400 tabular-nums">{metricas.transporte}</p>
        </Card>

        <Card className="p-4 transition-all hover:border-emerald-500/40">
          <p className="text-[11px] font-bold text-emerald-400">ENTREGUES</p>
          <p className="mt-1 text-2xl font-black text-emerald-400 tabular-nums">{metricas.entregues}</p>
        </Card>

        <Card className="p-4 transition-all hover:border-red-500/40">
          <p className="text-[11px] font-bold text-status-danger">INOPERANTES</p>
          <p className="mt-1 text-2xl font-black text-status-danger tabular-nums">{metricas.inoperantes}</p>
        </Card>
      </div>

      {/* Barra de Filtros e Busca */}
      <Card className="p-4">
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {/* Campo Busca */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary" />
              <Input
                type="text"
                placeholder="BUSCAR PLACA, CLIENTE, MODELO..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-9 text-xs"
              />
            </div>

            {/* Filtro Mês */}
            <Select value={mesFiltro} onChange={(e) => setMesFiltro(e.target.value)} className="text-xs">
              <option value="">TODOS OS MESES</option>
              {opcoesMes.map((m) => (
                <option key={m} value={m}>
                  {m.toUpperCase()}
                </option>
              ))}
            </Select>

            {/* Filtro Condição */}
            <Select value={condicaoFiltro} onChange={(e) => setCondicaoFiltro(e.target.value)} className="text-xs">
              <option value="">TODAS AS CONDIÇÕES</option>
              <option value="Operante">OPERANTE</option>
              <option value="Inoperante">INOPERANTE</option>
            </Select>

            {/* Filtro Local */}
            <Select value={localFiltro} onChange={(e) => setLocalFiltro(e.target.value)} className="text-xs">
              <option value="">TODOS OS LOCAIS</option>
              {opcoesLocais.map((l) => (
                <option key={l} value={l}>
                  {l.toUpperCase()}
                </option>
              ))}
            </Select>

            {/* Filtro Orçamento */}
            <Select value={orcamentoFiltro} onChange={(e) => setOrcamentoFiltro(e.target.value)} className="text-xs">
              <option value="">STATUS DO ORÇAMENTO</option>
              <option value="ORÇAMENTO OK">ORÇAMENTO OK</option>
              <option value="LEVANTANDO ORÇAMENTO">LEVANTANDO ORÇAMENTO</option>
              <option value="AG. REGULAGEM">AG. REGULAGEM</option>
            </Select>
          </div>

          {temFiltroAtivo && (
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-secondary font-medium">
                EXIBINDO {itensFiltrados.length} DE {items.length} REGISTROS
              </span>
              <button
                type="button"
                onClick={limparFiltros}
                className="inline-flex items-center gap-1 text-xs font-bold text-status-danger hover:underline cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
                <span>LIMPAR FILTROS</span>
              </button>
            </div>
          )}
        </div>
      </Card>

      {/* MODO KANBAN - LAYOUT RESPONSIVO QUE PREENCHE QUALQUER MONITOR */}
      {viewMode === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 items-start w-full pb-6 pt-1">
          {COLUNAS.map((col) => {
            const colItens = itensPorColuna.get(col.id) || []
            const Icon = col.icone

            return (
              <div
                key={col.id}
                className="flex flex-col w-full min-w-0 rounded-2xl border border-border/10 bg-surface/40 backdrop-blur-md p-3.5 shadow-sm"
              >
                {/* Header da Coluna */}
                <div className={`rounded-xl border p-3 mb-3.5 flex items-center justify-between ${col.headerBg}`}>
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-background/50 backdrop-blur-sm">
                      <Icon className={`h-4 w-4 ${col.corIcone}`} />
                    </div>
                    <div>
                      <h3 className="text-xs font-black tracking-wide text-foreground">{col.titulo}</h3>
                      <p className="text-[10px] opacity-75 font-semibold">{col.descricao}</p>
                    </div>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-black ${col.badgeBg} ${col.badgeText}`}>
                    {colItens.length}
                  </span>
                </div>

                {/* Lista de Cards da Coluna */}
                <div className="space-y-3 max-h-[calc(100vh-320px)] overflow-y-auto pr-1 scrollbar-thin">
                  {colItens.length === 0 ? (
                    <div className="flex h-40 flex-col items-center justify-center rounded-xl border border-dashed border-border/15 p-4 text-center text-xs text-secondary/60">
                      <Info className="h-5 w-5 mb-1.5 opacity-40" />
                      <span>NENHUM VEÍCULO NESTA ETAPA</span>
                    </div>
                  ) : (
                    colItens.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => setSelectedItem(item)}
                        className={`group relative cursor-pointer rounded-2xl border border-border/10 bg-surface p-4 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:border-primary/50 ${col.corBorda}`}
                      >
                        {/* Linha 1: Placa e Condição */}
                        <div className="flex items-center justify-between gap-2 mb-2.5">
                          <span className="inline-flex items-center rounded-lg bg-primary/15 border border-primary/25 px-2.5 py-1 text-xs font-black text-primary tracking-wider">
                            {item.placa}
                          </span>

                          <div className="flex items-center gap-1.5">
                            {item.mes && (
                              <span className="text-[10px] font-bold text-secondary px-2 py-0.5 rounded bg-overlay/5">
                                {item.mes.replace(/^\d+\.\s*/, '')}
                              </span>
                            )}
                            <span
                              className={`rounded-md px-2 py-0.5 text-[10px] font-black ${
                                item.condicao.toLowerCase().includes('inop')
                                  ? 'bg-red-500/15 text-red-400 border border-red-500/20'
                                  : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                              }`}
                            >
                              {item.condicao}
                            </span>
                          </div>
                        </div>

                        {/* Linha 2: Cliente e Modelo */}
                        <div className="mb-3">
                          <h4 className="text-xs font-black text-foreground uppercase tracking-tight group-hover:text-primary transition-colors">
                            {item.cliente}
                          </h4>
                          <p className="text-[11px] text-secondary font-medium uppercase mt-0.5 leading-snug">
                            {item.modelo}
                          </p>
                        </div>

                        {/* Linha 3: Localização & Destino */}
                        <div className="rounded-xl border border-border/5 bg-background/50 p-2.5 space-y-1.5 text-[11px] mb-3">
                          <div className="flex items-center justify-between gap-1 text-secondary">
                            <span className="flex items-center gap-1 font-medium truncate">
                              <MapPin className="h-3 w-3 text-primary shrink-0" />
                              <span className="truncate">{item.localAtual}</span>
                            </span>
                            {item.localEntrega && (
                              <span className="font-bold text-foreground shrink-0 text-[10px]">
                                ➔ {item.localEntrega}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center justify-between text-secondary pt-1 border-t border-border/5">
                            <span className="flex items-center gap-1 text-[10px]">
                              <Calendar className="h-3 w-3 text-secondary shrink-0" />
                              <span>PREVISÃO:</span>
                            </span>
                            <span
                              className={`font-black text-[11px] ${
                                item.previsaoEntrega === 'ENTREGUE'
                                  ? 'text-emerald-400'
                                  : item.previsaoEntrega === 'SEM PREVISÃO'
                                  ? 'text-amber-400'
                                  : 'text-foreground'
                              }`}
                            >
                              {item.previsaoEntrega}
                            </span>
                          </div>
                        </div>

                        {/* Linha 4: Tags de Status e Orçamento */}
                        <div className="flex flex-col gap-1.5 pt-1">
                          {item.orcamento && (
                            <span
                              className={`text-[10px] font-black px-2.5 py-1 rounded-lg text-center tracking-wide border ${
                                item.orcamento.includes('OK')
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                  : item.orcamento.includes('LEVANTANDO')
                                  ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                                  : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              }`}
                            >
                              {item.orcamento}
                            </span>
                          )}

                          {item.obsGvel &&
                            item.obsGvel !== 'EM ANDAMENTO' &&
                            item.obsGvel !== 'ENTREGUE' && (
                              <div className="flex items-center justify-between rounded-lg bg-amber-500/10 border border-amber-500/20 px-2 py-1 text-[10px] font-bold text-amber-400">
                                <span className="truncate">{item.obsGvel}</span>
                                <ChevronRight className="h-3 w-3 shrink-0 opacity-60" />
                              </div>
                            )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* MODO TABELA / LISTA COMPLETA */}
      {viewMode === 'tabela' && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-border/10 bg-surface/50 text-foreground font-bold">
                  <th className="px-4 py-3.5">PLACA</th>
                  <th className="px-4 py-3.5">GRUPO ECON. / CLIENTE</th>
                  <th className="px-4 py-3.5">VEÍCULO / MODELO</th>
                  <th className="px-4 py-3.5">CONDIÇÃO</th>
                  <th className="px-4 py-3.5">LOCAL ATUAL</th>
                  <th className="px-4 py-3.5">PREVISÃO ENTREGA</th>
                  <th className="px-4 py-3.5">STATUS OPERACIONAL</th>
                  <th className="px-4 py-3.5">ORÇAMENTO</th>
                  <th className="px-4 py-3.5">DESTINO</th>
                  <th className="px-4 py-3.5">CHASSI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/5 font-medium text-secondary">
                {itensFiltrados.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => setSelectedItem(item)}
                    className="hover:bg-overlay/[0.04] transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3 whitespace-nowrap font-black text-primary">
                      {item.placa}
                    </td>
                    <td className="px-4 py-3 font-bold text-foreground max-w-[200px] truncate" title={item.cliente}>
                      {item.cliente}
                    </td>
                    <td className="px-4 py-3 max-w-[240px] truncate text-foreground/90" title={item.modelo}>
                      {item.modelo}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                          item.condicao.toLowerCase().includes('inop')
                            ? 'bg-red-500/15 text-red-400'
                            : 'bg-emerald-500/15 text-emerald-400'
                        }`}
                      >
                        {item.condicao}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{item.localAtual}</td>
                    <td className="px-4 py-3 whitespace-nowrap font-bold text-foreground">
                      {item.previsaoEntrega}
                    </td>
                    <td className="px-4 py-3 font-bold text-amber-400 max-w-[200px] truncate" title={item.obsGvel}>
                      {item.obsGvel}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                          item.orcamento.includes('OK')
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : item.orcamento.includes('LEVANTANDO')
                            ? 'bg-purple-500/15 text-purple-400'
                            : 'bg-amber-500/15 text-amber-400'
                        }`}
                      >
                        {item.orcamento || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-bold text-foreground">
                      {item.localEntrega || '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-mono text-[11px]">{item.chassi || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* MODAL DE DETALHES COMPLETOS DO VEÍCULO */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-xl rounded-3xl border border-border/20 bg-surface p-6 sm:p-8 shadow-2xl shadow-black/80 space-y-6">
            {/* Topo do Modal */}
            <div className="flex items-start justify-between border-b border-border/10 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="rounded-xl bg-primary px-3 py-1 text-sm font-black text-white tracking-wider">
                    {selectedItem.placa}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(selectedItem.placa)}
                    className="p-1.5 rounded-lg border border-border/10 bg-background/50 text-secondary hover:text-foreground cursor-pointer"
                    title="Copiar Placa"
                  >
                    {copiedPlaca ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                  <span
                    className={`rounded-lg px-2.5 py-0.5 text-xs font-black ${
                      selectedItem.condicao.toLowerCase().includes('inop')
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-emerald-500/20 text-emerald-400'
                    }`}
                  >
                    {selectedItem.condicao}
                  </span>
                </div>
                <h3 className="text-base font-black text-foreground pt-1">{selectedItem.cliente}</h3>
              </div>

              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-background/60 text-secondary hover:text-foreground cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Grid de Informações */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
              <div className="rounded-2xl border border-border/10 bg-background/50 p-3.5 space-y-1">
                <p className="text-[10px] font-bold text-secondary">MODELO DO VEÍCULO</p>
                <p className="font-black text-foreground text-sm">{selectedItem.modelo || '—'}</p>
              </div>

              <div className="rounded-2xl border border-border/10 bg-background/50 p-3.5 space-y-1">
                <p className="text-[10px] font-bold text-secondary">NÚMERO DO CHASSI</p>
                <p className="font-mono font-bold text-foreground text-xs">{selectedItem.chassi || '—'}</p>
              </div>

              <div className="rounded-2xl border border-border/10 bg-background/50 p-3.5 space-y-1">
                <p className="text-[10px] font-bold text-secondary">LOCAL ATUAL</p>
                <p className="font-bold text-foreground flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-primary" />
                  <span>{selectedItem.localAtual || '—'}</span>
                </p>
              </div>

              <div className="rounded-2xl border border-border/10 bg-background/50 p-3.5 space-y-1">
                <p className="text-[10px] font-bold text-secondary">LOCAL DE ENTREGA (DESTINO)</p>
                <p className="font-bold text-foreground flex items-center gap-1">
                  <Truck className="h-3.5 w-3.5 text-emerald-400" />
                  <span>{selectedItem.localEntrega || '—'}</span>
                </p>
              </div>

              <div className="rounded-2xl border border-border/10 bg-background/50 p-3.5 space-y-1">
                <p className="text-[10px] font-bold text-secondary">PREVISÃO DE ENTREGA</p>
                <p className="font-black text-foreground text-sm flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-amber-400" />
                  <span>{selectedItem.previsaoEntrega || '—'}</span>
                </p>
              </div>

              <div className="rounded-2xl border border-border/10 bg-background/50 p-3.5 space-y-1">
                <p className="text-[10px] font-bold text-secondary">MÊS DE PREPARAÇÃO</p>
                <p className="font-bold text-foreground">{selectedItem.mes || '—'}</p>
              </div>
            </div>

            {/* Status e Observação */}
            <div className="rounded-2xl border border-border/10 bg-background/50 p-4 space-y-3">
              <div>
                <p className="text-[10px] font-bold text-secondary mb-1">SITUAÇÃO DO ORÇAMENTO</p>
                <span
                  className={`inline-block px-3 py-1 rounded-lg font-black text-xs ${
                    selectedItem.orcamento.includes('OK')
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : selectedItem.orcamento.includes('LEVANTANDO')
                      ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                      : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  }`}
                >
                  {selectedItem.orcamento || 'NÃO INFORMADO'}
                </span>
              </div>

              <div>
                <p className="text-[10px] font-bold text-secondary mb-1">STATUS OPERACIONAL (OBS: GVEL)</p>
                <p className="text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                  {selectedItem.obsGvel || 'EM ANDAMENTO'}
                </p>
              </div>
            </div>

            {/* Botão Fechar */}
            <div className="flex justify-end pt-2">
              <Button variant="secondary" size="md" onClick={() => setSelectedItem(null)}>
                FECHAR
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal / Painel Lateral: Histórico de Versões do Google Sheets */}
      {modalHistoricoAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-fade-in">
          <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-border/20 bg-surface p-6 shadow-2xl space-y-5">
            {/* Cabeçalho */}
            <div className="flex items-center justify-between border-b border-border/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary shadow-inner">
                  <History className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground">HISTÓRICO DE VERSÕES</h3>
                  <p className="text-xs text-secondary font-medium">
                    REGISTRO DE QUEM ALTEROU A PLANILHA DO GOOGLE SHEETS
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalHistoricoAberto(false)}
                className="rounded-xl p-2 text-secondary hover:bg-white/5 hover:text-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Banner Informativo */}
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/10 bg-background/50 p-3.5 text-xs">
              <div className="flex items-center gap-2 text-secondary">
                <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-bold text-foreground">CONECTADO AO GOOGLE SHEETS</span>
              </div>
              <a
                href="https://docs.google.com/spreadsheets/d/e/2PACX-1vQA_sHIwYemwUI6KdcR7xIjXzLi6SNcGC0ZSJyUyrRQ83L1w_qLiVi_fvd8ZVcCktq-2ui2G18RNqNW/pubhtml"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 font-bold text-primary hover:underline text-[11px]"
              >
                <FileSpreadsheet className="h-4 w-4" />
                <span>ABRIR NO GOOGLE DRIVE</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            {/* Linha do Tempo das Edições */}
            <div className="space-y-3">
              <p className="text-[11px] font-black text-secondary uppercase tracking-wider">
                TODAS AS VERSÕES E ALTERAÇÕES ({historico.length})
              </p>

              <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-border/20">
                {historico.map((item, idx) => (
                  <div key={item.id || idx} className="relative group">
                    {/* Ponto na timeline */}
                    <div
                      className={`absolute -left-6 top-1.5 h-3 w-3 rounded-full border-2 transition-transform group-hover:scale-125 ${
                        item.versaoAtual
                          ? 'border-primary bg-primary shadow-lg shadow-primary/50'
                          : 'border-secondary/40 bg-surface'
                      }`}
                    />

                    {/* Card da Versão */}
                    <div
                      className={`rounded-2xl border p-4 transition-all ${
                        item.versaoAtual
                          ? 'border-primary/40 bg-primary/5 shadow-md'
                          : 'border-border/10 bg-background/40 hover:border-border/20'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-foreground">
                            {item.dataHora}
                          </span>
                          {item.versaoAtual && (
                            <span className="rounded-md bg-primary/20 border border-primary/30 px-2 py-0.5 text-[10px] font-black text-primary uppercase">
                              VERSÃO ATUAL
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 text-xs font-bold text-primary bg-primary/10 border border-primary/20 px-2.5 py-0.5 rounded-lg">
                          <User className="h-3 w-3" />
                          <span>{item.usuario}</span>
                        </div>
                      </div>

                      <p className="mt-2 text-xs text-secondary font-medium leading-relaxed">
                        {item.detalhes}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Rodapé */}
            <div className="flex items-center justify-between border-t border-border/10 pt-4">
              <Button
                variant="primary"
                size="md"
                disabled={loading}
                onClick={() => fetchSheet(nomeUsuario)}
                className="gap-2 text-xs font-bold"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                <span>SINCRONIZAR AGORA</span>
              </Button>

              <Button variant="secondary" size="md" onClick={() => setModalHistoricoAberto(false)}>
                FECHAR
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
