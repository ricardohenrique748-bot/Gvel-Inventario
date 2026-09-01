import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Truck, LogIn, LogOut, Clock, FileSpreadsheet, AlertTriangle, Settings, X } from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  LabelList,
} from 'recharts'
import { format, isSameDay, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { PageHeader } from '@/components/layout/Header'
import { FiltersBar, type FiltersValue } from '@/components/FiltersBar'
import { StatCard } from '@/components/ui/StatCard'
import { Select } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { StatusManutencaoBadge } from '@/components/StatusManutencaoBadge'
import { useTheme } from '@/contexts/ThemeContext'
import { useAuth } from '@/contexts/AuthContext'
import { isAdminUsuario } from '@/lib/permissoes'
import { useMovimentacoes, registrarSaida } from '@/hooks/useMovimentacoes'
import { useStatusManutencao } from '@/hooks/useStatusManutencao'
import { useOSStatusBatch } from '@/hooks/useOSStatusBatch'
import { useEtapasNoPeriodo } from '@/hooks/useHistoricoMovimentacao'
import { permanenciaEmMinutos, formatMinutosParaTexto, formatDate, formatDateTime } from '@/lib/format'
import { CHART_ENTRADA, CHART_SAIDA, CHART_CATEGORICAL, CHART_OTHER } from '@/lib/chartColors'
import { urlMiniatura, aoFalharMiniatura, primeiraFotoMovimentacao } from '@/lib/thumb'

// Sinaliza veículos com mais de uma movimentação "no pátio" ao mesmo tempo —
// normalmente causado por reenvio automático de rascunho de entrada com
// internet fraca antes da correção de idempotência em registrarEntrada().
type GrupoDuplicado = ReturnType<typeof useMovimentacoes>['movimentacoes']

function useDuplicatasNoPatio(ativo: boolean) {
  const { movimentacoes: todasNoPatio, refetch } = useMovimentacoes(ativo ? { status: 'no_patio' } : {})

  const duplicatas = useMemo(() => {
    if (!ativo) return []
    const porVeiculo = new Map<string, GrupoDuplicado>()
    for (const m of todasNoPatio) {
      if (!m.veiculo_id) continue
      if (!porVeiculo.has(m.veiculo_id)) porVeiculo.set(m.veiculo_id, [])
      porVeiculo.get(m.veiculo_id)!.push(m)
    }
    return [...porVeiculo.values()]
      .filter((lista) => lista.length > 1)
      .map((lista) => [...lista].sort((a, b) => new Date(b.data_hora_entrada).getTime() - new Date(a.data_hora_entrada).getTime()))
  }, [ativo, todasNoPatio])

  return { duplicatas, refetch }
}

// Deixa o admin decidir qual registro duplicado fechar (marcar como saída) —
// fica escondido atrás do ícone de engrenagem pra não poluir o Dashboard.
function DuplicatasNoPatioModal({
  duplicatas,
  onFechar,
  onAtualizar,
}: {
  duplicatas: GrupoDuplicado[]
  onFechar: () => void
  onAtualizar: () => void | Promise<void>
}) {
  const [processandoId, setProcessandoId] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  async function handleMarcarSaida(movId: string) {
    if (
      !confirm(
        'Marcar esta movimentação como SAÍDA agora? Use isso pra fechar o registro duplicado, mantendo só o correto como "no pátio".',
      )
    ) {
      return
    }
    setErro(null)
    setProcessandoId(movId)
    try {
      await registrarSaida(movId)
      await onAtualizar()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível fechar a movimentação.')
    } finally {
      setProcessandoId(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onFechar}>
      <div
        className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl bg-surface p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-amber-400">
            <AlertTriangle className="h-4 w-4" />
            {duplicatas.length} veículo(s) com movimentação "no pátio" duplicada
          </h3>
          <button
            type="button"
            onClick={onFechar}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-secondary hover:bg-background hover:text-foreground"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {duplicatas.length === 0 ? (
          <p className="text-sm text-secondary">Nenhuma duplicata encontrada no momento. 🎉</p>
        ) : (
          <>
            <p className="text-sm text-secondary">
              Esses veículos têm mais de uma entrada ativa ao mesmo tempo (geralmente reenvio automático com
              internet fraca). Escolha qual registro está errado e marque como saída — mantenha só o correto.
            </p>
            {erro && <p className="text-sm text-status-danger">{erro}</p>}
            <div className="space-y-4">
              {duplicatas.map((grupo) => (
                <div key={grupo[0].veiculo_id} className="rounded-xl bg-background p-3 space-y-2">
                  <p className="text-foreground font-medium">{grupo[0].veiculo?.placa}</p>
                  {grupo.map((m) => (
                    <div
                      key={m.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface px-3 py-2"
                    >
                      <span className="text-sm text-secondary">
                        Entrada: {formatDateTime(m.data_hora_entrada)} · Pátio: {m.patio?.nome || '—'}
                      </span>
                      <Button
                        type="button"
                        variant="secondary"
                        size="md"
                        onClick={() => handleMarcarSaida(m.id)}
                        disabled={processandoId === m.id}
                        className="!h-8 !text-xs"
                      >
                        {processandoId === m.id ? 'Fechando…' : 'Marcar esta como saída'}
                      </Button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export function Dashboard() {
  const { theme } = useTheme()
  const { perfil, user } = useAuth()
  const isAdmin = isAdminUsuario(perfil, user?.email)
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

  const filtroInicial = useMemo(() => ({
    dataInicio: format(new Date(), 'yyyy-MM-dd'),
    dataFim: format(new Date(), 'yyyy-MM-dd'),
  }), [])

  // Filtros ficam sincronizados com a URL (?search=...&patioId=...) para que o botão
  // "voltar" do navegador restaure o dashboard como estava, em vez de resetar tudo —
  // sem isso, sair para outra página e voltar remonta o componente com os filtros padrão.
  const [searchParams, setSearchParams] = useSearchParams()

  const [filters, setFilters] = useState<FiltersValue>(() => ({
    search: searchParams.get('search') || undefined,
    dataInicio: searchParams.get('dataInicio') || filtroInicial.dataInicio,
    dataFim: searchParams.get('dataFim') || filtroInicial.dataFim,
    clienteId: searchParams.get('clienteId') || undefined,
    marcaId: searchParams.get('marcaId') || undefined,
    modeloId: searchParams.get('modeloId') || undefined,
    patioId: searchParams.get('patioId') || undefined,
  }))
  const [statusFiltro, setStatusFiltro] = useState(() => searchParams.get('statusFiltro') || '')
  const { statusManutencao } = useStatusManutencao()

  useEffect(() => {
    const params = new URLSearchParams()
    if (filters.search) params.set('search', filters.search)
    if (filters.dataInicio) params.set('dataInicio', filters.dataInicio)
    if (filters.dataFim) params.set('dataFim', filters.dataFim)
    if (filters.clienteId) params.set('clienteId', filters.clienteId)
    if (filters.marcaId) params.set('marcaId', filters.marcaId)
    if (filters.modeloId) params.set('modeloId', filters.modeloId)
    if (filters.patioId) params.set('patioId', filters.patioId)
    if (statusFiltro) params.set('statusFiltro', statusFiltro)
    setSearchParams(params, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, statusFiltro])

  const { movimentacoes: noPatioBruto, loading: loadingNoPatio } = useMovimentacoes({
    status: 'no_patio',
    search: filters.search,
    clienteId: filters.clienteId,
    marcaId: filters.marcaId,
    modeloId: filters.modeloId,
    patioId: filters.patioId,
  })

  // Já vem filtrado por "no_patio" (nunca inclui veículos com status SAIU) —
  // aqui só restringe ao setor/oficina escolhido (pesada, leve, funilaria, estética...).
  const noPatio = useMemo(
    () => (statusFiltro ? noPatioBruto.filter((m) => m.status_id === statusFiltro) : noPatioBruto),
    [noPatioBruto, statusFiltro],
  )

  const { movimentacoes: periodo, loading: loadingPeriodo } = useMovimentacoes({
    dataInicio: filters.dataInicio ? `${filters.dataInicio}T00:00:00` : undefined,
    dataFim: filters.dataFim ? `${filters.dataFim}T23:59:59` : undefined,
    search: filters.search,
    clienteId: filters.clienteId,
    marcaId: filters.marcaId,
    modeloId: filters.modeloId,
    patioId: filters.patioId,
  })

  // Mudanças de etapa (setor/trajeto) registradas dentro do mesmo período —
  // mostradas separadamente das entradas novas no pátio.
  const { etapas: etapasPeriodo, loading: loadingEtapas } = useEtapasNoPeriodo(
    filters.dataInicio ? `${filters.dataInicio}T00:00:00` : undefined,
    filters.dataFim ? `${filters.dataFim}T23:59:59` : undefined,
  )

  // Determina se o filtro representa um único dia ou um intervalo
  const umDiaSelecionado =
    filters.dataInicio && filters.dataFim && filters.dataInicio === filters.dataFim
      ? parseISO(filters.dataInicio)
      : null

  // Label dinâmico dos cards de entrada/saída
  const labelEntradas = umDiaSelecionado
    ? `Entradas em ${format(umDiaSelecionado, "dd/MM", { locale: ptBR })}`
    : 'Entradas no período'
  const labelSaidas = umDiaSelecionado
    ? `Saídas em ${format(umDiaSelecionado, "dd/MM", { locale: ptBR })}`
    : 'Saídas no período'

  const stats = useMemo(() => {
    const entradasFiltradas = umDiaSelecionado
      ? periodo.filter((m) => isSameDay(new Date(m.data_hora_entrada), umDiaSelecionado))
      : periodo
    const saidasFiltradas = umDiaSelecionado
      ? periodo.filter((m) => m.data_hora_saida && isSameDay(new Date(m.data_hora_saida), umDiaSelecionado))
      : periodo.filter((m) => m.data_hora_saida)

    const entradasHoje = entradasFiltradas.length
    const saidasHoje = saidasFiltradas.length
    const finalizadas = periodo.filter((m) => m.data_hora_saida)
    const tempoMedio =
      finalizadas.length > 0
        ? Math.round(
            finalizadas.reduce((acc, m) => acc + permanenciaEmMinutos(m.data_hora_entrada, m.data_hora_saida), 0) /
              finalizadas.length,
          )
        : 0

    return { entradasHoje, saidasHoje, tempoMedio, entradasFiltradas, saidasFiltradas }
  }, [periodo, umDiaSelecionado])

  const porDia = useMemo(() => {
    if (!filters.dataInicio || !filters.dataFim) return []
    const inicio = new Date(`${filters.dataInicio}T00:00:00`)
    const fim = new Date(`${filters.dataFim}T00:00:00`)
    const dias: { key: string; dia: string; Entradas: number; Saídas: number }[] = []
    for (let d = new Date(inicio); d <= fim; d.setDate(d.getDate() + 1)) {
      dias.push({ key: format(d, 'yyyy-MM-dd'), dia: format(d, 'dd/MM'), Entradas: 0, Saídas: 0 })
    }
    const byKey = new Map(dias.map((d) => [d.key, d]))
    for (const m of periodo) {
      const entradaKey = format(new Date(m.data_hora_entrada), 'yyyy-MM-dd')
      const bucket = byKey.get(entradaKey)
      if (bucket) bucket.Entradas += 1
      if (m.data_hora_saida) {
        const saidaKey = format(new Date(m.data_hora_saida), 'yyyy-MM-dd')
        const bucketSaida = byKey.get(saidaKey)
        if (bucketSaida) bucketSaida.Saídas += 1
      }
    }
    return dias
  }, [periodo, filters.dataInicio, filters.dataFim])

  const porMarca = useMemo(() => {
    const counts = new Map<string, number>()
    for (const m of noPatio) {
      const nome = m.veiculo?.marca?.nome ?? 'Sem marca'
      counts.set(nome, (counts.get(nome) ?? 0) + 1)
    }
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
    const top = sorted.slice(0, 5).map(([name, value]) => ({ name, value }))
    const outras = sorted.slice(5).reduce((acc, [, v]) => acc + v, 0)
    if (outras > 0) top.push({ name: 'Outras', value: outras })
    return top
  }, [noPatio])

  const rankingPatios = useMemo(() => {
    const counts = new Map<string, number>()
    for (const m of periodo) {
      const nome = m.patio?.nome ?? 'Sem pátio'
      counts.set(nome, (counts.get(nome) ?? 0) + 1)
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, value]) => ({ name, value }))
  }, [periodo])

  const entradasHojeAgrupadas = useMemo(() => {
    const lista = stats.entradasFiltradas
    const porCliente = new Map<string, typeof lista>()
    for (const m of lista) {
      const nome = m.veiculo?.cliente?.nome ?? 'Sem cliente'
      if (!porCliente.has(nome)) porCliente.set(nome, [])
      porCliente.get(nome)!.push(m)
    }
    return [...porCliente.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [stats.entradasFiltradas])

  const saidasHojeAgrupadas = useMemo(() => {
    const lista = stats.saidasFiltradas
    const porCliente = new Map<string, typeof lista>()
    for (const m of lista) {
      const nome = m.veiculo?.cliente?.nome ?? 'Sem cliente'
      if (!porCliente.has(nome)) porCliente.set(nome, [])
      porCliente.get(nome)!.push(m)
    }
    return [...porCliente.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [stats.saidasFiltradas])

  // Uma linha por veículo (mantém só a etapa mais recente do dia, caso tenha
  // mudado de setor mais de uma vez), agrupado por cliente igual às entradas.
  const etapasHojeAgrupadas = useMemo(() => {
    const porVeiculo = new Map<string, (typeof etapasPeriodo)[number]>()
    for (const e of etapasPeriodo) {
      const atual = porVeiculo.get(e.movimentacao_id)
      if (!atual || new Date(e.data_hora).getTime() > new Date(atual.data_hora).getTime()) {
        porVeiculo.set(e.movimentacao_id, e)
      }
    }
    const lista = [...porVeiculo.values()]
    const porCliente = new Map<string, typeof lista>()
    for (const e of lista) {
      const nome = e.movimentacao.veiculo?.cliente?.nome ?? 'Sem cliente'
      if (!porCliente.has(nome)) porCliente.set(nome, [])
      porCliente.get(nome)!.push(e)
    }
    return [...porCliente.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [etapasPeriodo])

  const totalEtapasHoje = etapasHojeAgrupadas.reduce((acc, [, l]) => acc + l.length, 0)

  const [painelAberto, setPainelAberto] = useState<'no_patio' | 'entradas_hoje' | 'saidas_hoje' | null>(null)
  const [duplicatasAbertas, setDuplicatasAbertas] = useState(false)
  const { duplicatas, refetch: refetchDuplicatas } = useDuplicatasNoPatio(isAdmin)

  const loading = loadingNoPatio || loadingPeriodo

  // Mecânico(s) apontados no checklist de manutenção de cada veículo no pátio —
  // usado só na exportação em Excel (mesma fonte do card "Mecânico(s) e atividades").
  const movimentacaoIdsNoPatio = useMemo(() => noPatio.map((m) => m.id), [noPatio])
  const { getStatus: getStatusOS } = useOSStatusBatch(movimentacaoIdsNoPatio)

  // Exporta a lista de veículos no pátio (respeitando os filtros ativos, incluindo
  // setor/oficina) com quantos dias cada um já está parado — só admin vê o botão.
  // Gera CSV (abre direto no Excel) em vez de puxar uma lib de .xlsx: evita
  // dependência com CVE conhecida no pacote npm e não precisamos de formatação.
  function handleExportarExcel() {
    const cabecalho = ['Placa', 'Marca/Modelo', 'Cliente', 'Pátio', 'Setor/Oficina', 'Data de entrada', 'Dias na oficina', 'Mecânico(s)']
    const linhas = noPatio.map((m) => [
      m.veiculo?.placa ?? '',
      `${m.veiculo?.marca?.nome ?? ''} ${m.veiculo?.modelo?.nome ?? ''}`.trim(),
      m.veiculo?.cliente?.nome ?? '',
      m.patio?.nome ?? '',
      m.status_manutencao?.nome ?? '',
      formatDate(m.data_hora_entrada),
      String(Math.floor(permanenciaEmMinutos(m.data_hora_entrada) / 1440)),
      getStatusOS(m.id).mecanico ?? '',
    ])

    const escapar = (valor: string) => `"${valor.replace(/"/g, '""')}"`
    const csv = [cabecalho, ...linhas].map((linha) => linha.map((v) => escapar(v)).join(';')).join('\r\n')

    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `patio_${format(new Date(), 'yyyy-MM-dd')}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Visão geral do pátio"
        actions={
          isAdmin && (
            <>
              <Button
                variant="secondary"
                size="icon"
                onClick={() => setDuplicatasAbertas(true)}
                aria-label="Movimentações duplicadas"
                title="Movimentações duplicadas"
                className="relative"
              >
                <Settings className="h-4 w-4" />
                {duplicatas.length > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-black">
                    {duplicatas.length}
                  </span>
                )}
              </Button>
              <Button variant="secondary" onClick={handleExportarExcel} disabled={loadingNoPatio || noPatio.length === 0}>
                <FileSpreadsheet className="h-4 w-4" />
                Exportar Excel
              </Button>
            </>
          )
        }
      />

      {isAdmin && duplicatasAbertas && (
        <DuplicatasNoPatioModal
          duplicatas={duplicatas}
          onFechar={() => setDuplicatasAbertas(false)}
          onAtualizar={refetchDuplicatas}
        />
      )}

      <div className="mb-6 space-y-3">
        <FiltersBar
          value={filters}
          onChange={setFilters}
          showSearch
          onClear={() => {
            setFilters(filtroInicial)
            setStatusFiltro('')
          }}
        />

        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-secondary">
            Setor / oficina:
          </span>
          <div className="w-full sm:w-64">
            <Select value={statusFiltro} onChange={(e) => setStatusFiltro(e.target.value)}>
              <option value="">Todos os setores</option>
              {statusManutencao.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-6">
        <StatCard
          icon={Truck}
          label="No pátio agora"
          value={String(noPatio.length)}
          active={painelAberto === 'no_patio'}
          onClick={() => setPainelAberto((p) => (p === 'no_patio' ? null : 'no_patio'))}
        />
        <StatCard
          icon={LogIn}
          label={labelEntradas}
          value={String(stats.entradasHoje)}
          active={painelAberto === 'entradas_hoje'}
          onClick={() => setPainelAberto((p) => (p === 'entradas_hoje' ? null : 'entradas_hoje'))}
        />
        <StatCard
          icon={LogOut}
          label={labelSaidas}
          value={String(stats.saidasHoje)}
          active={painelAberto === 'saidas_hoje'}
          onClick={() => setPainelAberto((p) => (p === 'saidas_hoje' ? null : 'saidas_hoje'))}
        />
        <StatCard
          icon={Clock}
          label="Tempo médio de permanência"
          value={stats.tempoMedio > 0 ? formatMinutosParaTexto(stats.tempoMedio) : '—'}
        />
      </div>

      {painelAberto === 'no_patio' && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{loadingNoPatio ? 'Carregando…' : `${noPatio.length} veículo(s) no pátio agora`}</CardTitle>
          </CardHeader>
          <CardContent>
            {!loadingNoPatio && noPatio.length === 0 ? (
              <p className="text-sm text-secondary">Nenhum veículo no pátio no momento.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {noPatio.map((m) => (
                  <Link
                    key={m.id}
                    to={`/veiculos/${m.veiculo_id}`}
                    className="flex items-center gap-3 rounded-xl bg-background px-4 py-3 transition-colors hover:bg-background/70"
                  >
                    {primeiraFotoMovimentacao(m) ? (
                      <img
                        src={urlMiniatura(primeiraFotoMovimentacao(m)!, 112)}
                        onError={aoFalharMiniatura(primeiraFotoMovimentacao(m)!)}
                        alt={`Foto — ${m.veiculo?.placa}`}
                        loading="lazy"
                        decoding="async"
                        width={56}
                        height={56}
                        className="h-14 w-14 shrink-0 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-surface text-secondary">
                        <Truck className="h-6 w-6" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-foreground font-medium">{m.veiculo?.placa}</p>
                      <p className="text-sm text-secondary">
                        {m.veiculo?.marca?.nome} {m.veiculo?.modelo?.nome}
                      </p>
                      <p className="text-sm text-secondary">{m.veiculo?.cliente?.nome}</p>
                      <p className="text-sm text-secondary">Pátio: {m.patio?.nome || '—'}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {painelAberto === 'entradas_hoje' && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{loadingPeriodo ? 'Carregando…' : `${stats.entradasHoje} entrada(s) — ${labelEntradas.toLowerCase()}`}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-secondary">
                Novas entradas no pátio ({stats.entradasHoje})
              </p>
              {!loadingPeriodo && entradasHojeAgrupadas.length === 0 ? (
                <p className="text-sm text-secondary">Nenhuma entrada nova registrada no período selecionado.</p>
              ) : (
                <div className="space-y-4">
                  {entradasHojeAgrupadas.map(([cliente, movs]) => (
                    <div key={cliente}>
                      <p className="mb-2 text-sm font-medium text-secondary">{cliente}</p>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {movs.map((m) => (
                          <Link
                            key={m.id}
                            to={`/veiculos/${m.veiculo_id}`}
                            className="flex items-center gap-3 rounded-xl bg-background px-4 py-3 transition-colors hover:bg-background/70"
                          >
                            {primeiraFotoMovimentacao(m) ? (
                              <img
                                src={urlMiniatura(primeiraFotoMovimentacao(m)!, 112)}
                                onError={aoFalharMiniatura(primeiraFotoMovimentacao(m)!)}
                                alt={`Foto — ${m.veiculo?.placa}`}
                                loading="lazy"
                                decoding="async"
                                width={56}
                                height={56}
                                className="h-14 w-14 shrink-0 rounded-lg object-cover"
                              />
                            ) : (
                              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-surface text-secondary">
                                <Truck className="h-6 w-6" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-foreground font-medium">{m.veiculo?.placa}</p>
                              <p className="text-sm text-secondary">
                                {m.veiculo?.marca?.nome} {m.veiculo?.modelo?.nome}
                              </p>
                              <p className="text-sm text-secondary">Pátio: {m.patio?.nome || '—'}</p>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-border/10 pt-5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-secondary">
                Mudança de etapa ({totalEtapasHoje})
              </p>
              {!loadingEtapas && etapasHojeAgrupadas.length === 0 ? (
                <p className="text-sm text-secondary">Nenhuma mudança de etapa registrada no período selecionado.</p>
              ) : (
                <div className="space-y-4">
                  {etapasHojeAgrupadas.map(([cliente, etapas]) => (
                    <div key={cliente}>
                      <p className="mb-2 text-sm font-medium text-secondary">{cliente}</p>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {etapas.map((e) => (
                          <Link
                            key={e.id}
                            to={`/veiculos/${e.movimentacao.veiculo_id}`}
                            className="flex items-center gap-3 rounded-xl bg-background px-4 py-3 transition-colors hover:bg-background/70"
                          >
                            {primeiraFotoMovimentacao(e.movimentacao) ? (
                              <img
                                src={urlMiniatura(primeiraFotoMovimentacao(e.movimentacao)!, 112)}
                                onError={aoFalharMiniatura(primeiraFotoMovimentacao(e.movimentacao)!)}
                                alt={`Foto — ${e.movimentacao.veiculo?.placa}`}
                                loading="lazy"
                                decoding="async"
                                width={56}
                                height={56}
                                className="h-14 w-14 shrink-0 rounded-lg object-cover"
                              />
                            ) : (
                              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-surface text-secondary">
                                <Truck className="h-6 w-6" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-foreground font-medium">{e.movimentacao.veiculo?.placa}</p>
                              <p className="text-sm text-secondary">
                                {e.movimentacao.veiculo?.marca?.nome} {e.movimentacao.veiculo?.modelo?.nome}
                              </p>
                              <p className="text-sm text-secondary truncate">Etapa: {e.descricao}</p>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {painelAberto === 'saidas_hoje' && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{loadingPeriodo ? 'Carregando…' : `${stats.saidasHoje} saída(s) — ${labelSaidas.toLowerCase()}`}</CardTitle>
          </CardHeader>
          <CardContent>
            {!loadingPeriodo && saidasHojeAgrupadas.length === 0 ? (
              <p className="text-sm text-secondary">Nenhuma saída registrada no período selecionado.</p>
            ) : (
              <div className="space-y-4">
                {saidasHojeAgrupadas.map(([cliente, movs]) => (
                  <div key={cliente}>
                    <p className="mb-2 text-sm font-medium text-secondary">{cliente}</p>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {movs.map((m) => (
                        <Link
                          key={m.id}
                          to={`/veiculos/${m.veiculo_id}`}
                          className="flex items-center gap-3 rounded-xl bg-background px-4 py-3 transition-colors hover:bg-background/70"
                        >
                          {primeiraFotoMovimentacao(m) ? (
                            <img
                              src={urlMiniatura(primeiraFotoMovimentacao(m)!, 112)}
                              onError={aoFalharMiniatura(primeiraFotoMovimentacao(m)!)}
                              alt={`Foto — ${m.veiculo?.placa}`}
                              loading="lazy"
                              decoding="async"
                              width={56}
                              height={56}
                              className="h-14 w-14 shrink-0 rounded-lg object-cover"
                            />
                          ) : (
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-surface text-secondary">
                              <Truck className="h-6 w-6" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-foreground font-medium">{m.veiculo?.placa}</p>
                            <p className="text-sm text-secondary">
                              {m.veiculo?.marca?.nome} {m.veiculo?.modelo?.nome}
                            </p>
                            <p className="text-sm text-secondary">Pátio: {m.patio?.nome || '—'}</p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {filters.clienteId && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>
              {loadingNoPatio ? 'Carregando…' : `${noPatio.length} caminhão(ões) no pátio deste cliente`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!loadingNoPatio && noPatio.length === 0 ? (
              <p className="text-sm text-secondary">Nenhum caminhão deste cliente está no pátio no momento.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {noPatio.map((m) => (
                  <Link
                    key={m.id}
                    to={`/veiculos/${m.veiculo_id}`}
                    className="flex items-center gap-3 rounded-xl bg-background px-4 py-3 transition-colors hover:bg-background/70"
                  >
                    {primeiraFotoMovimentacao(m) ? (
                      <img
                        src={urlMiniatura(primeiraFotoMovimentacao(m)!, 112)}
                        onError={aoFalharMiniatura(primeiraFotoMovimentacao(m)!)}
                        alt={`Foto — ${m.veiculo?.placa}`}
                        loading="lazy"
                        decoding="async"
                        width={56}
                        height={56}
                        className="h-14 w-14 shrink-0 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-surface text-secondary">
                        <Truck className="h-6 w-6" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-foreground font-medium">{m.veiculo?.placa}</p>
                      <p className="text-sm text-secondary">
                        {m.veiculo?.marca?.nome} {m.veiculo?.modelo?.nome}
                      </p>
                      <p className="text-sm text-secondary">Pátio: {m.patio?.nome || '—'}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge tone="success">No pátio</Badge>
                        <StatusManutencaoBadge status={m.status_manutencao} />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!loading && periodo.length === 0 && noPatio.length === 0 && (
        <Card className="p-6 mb-6 text-center text-secondary text-sm">
          Nenhuma movimentação encontrada. Assim que houver entradas/saídas registradas, os gráficos aparecem aqui.
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Entradas x Saídas por dia</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart key={theme} data={porDia} barGap={4}>
                  <CartesianGrid vertical={false} stroke={gridColor} strokeDasharray="3 3" />
                  <XAxis dataKey="dia" stroke={textColor} tick={{ fill: textColor, fontSize: 12, fontWeight: 600 }} tickLine={false} axisLine={{ stroke: axisLineColor }} />
                  <YAxis
                    allowDecimals={false}
                    stroke={textColor}
                    tick={{ fill: textColor, fontSize: 12, fontWeight: 600 }}
                    tickLine={false}
                    axisLine={false}
                    width={28}
                  />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }} />
                  <Legend wrapperStyle={{ fontSize: 12, color: textColor }} />
                  <Bar dataKey="Entradas" fill={CHART_ENTRADA} radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="Saídas" fill={CHART_SAIDA} radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Distribuição por marca (no pátio)</CardTitle>
          </CardHeader>
          <CardContent>
            {porMarca.length === 0 ? (
              <div className="flex h-72 items-center justify-center text-sm text-secondary">Sem dados</div>
            ) : (
              (() => {
                const total = porMarca.reduce((acc, m) => acc + m.value, 0)
                const corDe = (entry: (typeof porMarca)[number], i: number) =>
                  entry.name === 'Outras' ? CHART_OTHER : CHART_CATEGORICAL[i % CHART_CATEGORICAL.length]
                return (
                  <>
                    <div className="h-52">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart key={theme}>
                          <Pie data={porMarca} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={2}>
                            {porMarca.map((entry, i) => (
                              <Cell key={entry.name} fill={corDe(entry, i)} stroke={isDark ? '#1c1c1c' : '#ffffff'} strokeWidth={2} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={tooltipStyle}
                            itemStyle={{ color: textColor }}
                            formatter={(value, name) => [
                              `${value} (${Math.round((Number(value) / total) * 100)}%)`,
                              name,
                            ]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-2">
                      {porMarca.map((entry, i) => {
                        const percent = Math.round((entry.value / total) * 100)
                        return (
                          <div key={entry.name} className="flex items-center gap-1.5 text-xs">
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: corDe(entry, i) }}
                            />
                            <span className="text-foreground font-bold">{entry.name}</span>
                            <span className="text-secondary font-medium">{percent}%</span>
                          </div>
                        )
                      })}
                    </div>
                  </>
                )
              })()
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Ranking de pátios com mais veículos no período</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              {rankingPatios.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-secondary">Sem dados</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart key={theme} data={rankingPatios} layout="vertical" margin={{ left: 8, right: 35 }}>
                    <CartesianGrid horizontal={false} stroke={gridColor} strokeDasharray="3 3" />
                    <XAxis type="number" allowDecimals={false} stroke={textColor} tick={{ fill: textColor, fontSize: 12, fontWeight: 600 }} tickLine={false} axisLine={{ stroke: axisLineColor }} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      stroke={textColor}
                      tick={{ fill: textColor, fontSize: 12, fontWeight: 600 }}
                      tickLine={false}
                      axisLine={false}
                      width={120}
                    />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }} />
                    <Bar dataKey="value" name="Veículos" fill={CHART_SAIDA} radius={[0, 4, 4, 0]} maxBarSize={22}>
                      <LabelList dataKey="value" position="right" fill={textColor} fontSize={12} fontWeight={700} offset={6} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
