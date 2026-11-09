import { BarraPilula } from '@/components/charts/BarraPilula'
import { empresaUsaClientes } from '@/lib/empresasEspeciais'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Truck, LogIn, LogOut, Clock, FileSpreadsheet } from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  LabelList,
} from 'recharts'
import { format, isSameDay, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { PageHeader } from '@/components/layout/Header'
import { ChartTooltip } from '@/components/charts/ChartTooltip'
import { cn } from '@/lib/cn'
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
import { useMovimentacoes } from '@/hooks/useMovimentacoes'
import { useStatusManutencao } from '@/hooks/useStatusManutencao'
import { useOSStatusBatch } from '@/hooks/useOSStatusBatch'
import { useEtapasNoPeriodo } from '@/hooks/useHistoricoMovimentacao'
import { permanenciaEmMinutos, formatMinutosParaTexto, formatDate } from '@/lib/format'
import { CHART_ENTRADA, CHART_SAIDA, CHART_CATEGORICAL, CHART_OTHER } from '@/lib/chartColors'
import { urlMiniatura, aoFalharMiniatura, primeiraFotoMovimentacao } from '@/lib/thumb'

export function Dashboard() {
  const { theme } = useTheme()
  const { perfil, user, empresa } = useAuth()
  const isAdmin = isAdminUsuario(perfil, user?.email)
  // Empresa sem clientes (Localiza): os grupos do dia são por pátio.
  const usaClientes = empresaUsaClientes(empresa)
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

  const totaisPorDia = useMemo(
    () => porDia.reduce((acc, d) => ({ entradas: acc.entradas + d.Entradas, saidas: acc.saidas + d['Saídas'] }), { entradas: 0, saidas: 0 }),
    [porDia],
  )

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
      const nome = usaClientes ? (m.veiculo?.cliente?.nome ?? 'Sem cliente') : (m.patio?.nome ?? 'Sem pátio')
      if (!porCliente.has(nome)) porCliente.set(nome, [])
      porCliente.get(nome)!.push(m)
    }
    return [...porCliente.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [stats.entradasFiltradas, usaClientes])

  const saidasHojeAgrupadas = useMemo(() => {
    const lista = stats.saidasFiltradas
    const porCliente = new Map<string, typeof lista>()
    for (const m of lista) {
      const nome = usaClientes ? (m.veiculo?.cliente?.nome ?? 'Sem cliente') : (m.patio?.nome ?? 'Sem pátio')
      if (!porCliente.has(nome)) porCliente.set(nome, [])
      porCliente.get(nome)!.push(m)
    }
    return [...porCliente.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [stats.saidasFiltradas, usaClientes])

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
      const nome = usaClientes
        ? (e.movimentacao.veiculo?.cliente?.nome ?? 'Sem cliente')
        : (e.movimentacao.patio?.nome ?? 'Sem pátio')
      if (!porCliente.has(nome)) porCliente.set(nome, [])
      porCliente.get(nome)!.push(e)
    }
    return [...porCliente.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [etapasPeriodo, usaClientes])

  const totalEtapasHoje = etapasHojeAgrupadas.reduce((acc, [, l]) => acc + l.length, 0)

  const [painelAberto, setPainelAberto] = useState<'no_patio' | 'entradas_hoje' | 'saidas_hoje' | null>(null)

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
              <Button variant="secondary" onClick={handleExportarExcel} disabled={loadingNoPatio || noPatio.length === 0}>
                <FileSpreadsheet className="h-4 w-4" />
                Exportar Excel
              </Button>
            </>
          )
        }
      />

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
          <CardHeader className="flex flex-wrap items-start justify-between gap-3">
            <CardTitle>Entradas x Saídas por dia</CardTitle>
            {/* Totais do período — servem também de legenda (bolinha = cor da série) */}
            <div className="flex items-center gap-4">
              {[
                { nome: 'Entradas', valor: totaisPorDia.entradas, cor: CHART_ENTRADA },
                { nome: 'Saídas', valor: totaisPorDia.saidas, cor: CHART_SAIDA },
              ].map((s) => (
                <div key={s.nome} className="text-right">
                  <p className="flex items-center justify-end gap-1.5 text-[10px] font-bold uppercase tracking-wider text-secondary">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.cor }} />
                    {s.nome}
                  </p>
                  <p className="text-lg font-black tabular-nums text-foreground leading-tight">{s.valor}</p>
                </div>
              ))}
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-wider text-secondary">Saldo</p>
                <p className="text-lg font-black tabular-nums text-foreground leading-tight">
                  {totaisPorDia.entradas - totaisPorDia.saidas > 0 ? '+' : ''}
                  {totaisPorDia.entradas - totaisPorDia.saidas}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  key={theme}
                  data={porDia}
                  barGap={6}
                  barCategoryGap={porDia.length <= 3 ? '35%' : '22%'}
                  margin={{ top: 22, right: 4, left: 0, bottom: 0 }}
                >
                  <CartesianGrid vertical={false} stroke={gridColor} />
                  <XAxis
                    dataKey="dia"
                    tick={{ fill: textColor, fontSize: 11, fontWeight: 600 }}
                    tickLine={false}
                    axisLine={{ stroke: axisLineColor }}
                    interval="preserveStartEnd"
                    minTickGap={12}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: isDark ? '#9a9a9a' : '#6b7280', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    width={28}
                  />
                  <Tooltip
                    content={<ChartTooltip />}
                    cursor={{ fill: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', radius: 8 }}
                  />
                  <Bar isAnimationActive={false} dataKey="Entradas" fill={CHART_ENTRADA} shape={<BarraPilula />} maxBarSize={44}>
                    {porDia.length <= 10 && (
                      <LabelList dataKey="Entradas" position="top" fill={textColor} fontSize={11} fontWeight={700} offset={6} formatter={(v: unknown) => (Number(v) > 0 ? String(v) : '')} />
                    )}
                  </Bar>
                  <Bar isAnimationActive={false} dataKey="Saídas" fill={CHART_SAIDA} shape={<BarraPilula />} maxBarSize={44}>
                    {porDia.length <= 10 && (
                      <LabelList dataKey="Saídas" position="top" fill={textColor} fontSize={11} fontWeight={700} offset={6} formatter={(v: unknown) => (Number(v) > 0 ? String(v) : '')} />
                    )}
                  </Bar>
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
                  <div className="flex flex-col items-center gap-5 sm:flex-row sm:gap-6">
                    <div className="relative h-52 w-52 shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart key={theme}>
                          <Pie
                            data={porMarca}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={66}
                            outerRadius={96}
                            paddingAngle={2}
                            cornerRadius={4}
                            startAngle={90}
                            endAngle={-270}
                          >
                            {porMarca.map((entry, i) => (
                              <Cell key={entry.name} fill={corDe(entry, i)} stroke={isDark ? '#1c1c1c' : '#ffffff'} strokeWidth={2} />
                            ))}
                          </Pie>
                          <Tooltip
                            content={<ChartTooltip titleFromName formatValue={(v) => `${v} (${Math.round((v / total) * 100)}%)`} />}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      {/* Total no centro da rosca */}
                      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-3xl font-black tabular-nums text-foreground leading-none">{total}</span>
                        <span className="mt-1 text-[10px] font-bold uppercase tracking-wider text-secondary">veículos</span>
                      </div>
                    </div>
                    <ul className="w-full min-w-0 flex-1 space-y-2">
                      {porMarca.map((entry, i) => {
                        const percent = Math.round((entry.value / total) * 100)
                        return (
                          <li key={entry.name} className="flex items-center gap-2.5 text-xs">
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: corDe(entry, i) }} />
                            <span className="min-w-0 flex-1 truncate font-bold uppercase text-foreground">{entry.name}</span>
                            <span className="tabular-nums font-bold text-foreground">{entry.value}</span>
                            <span className="w-9 text-right tabular-nums text-secondary">{percent}%</span>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
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
            {rankingPatios.length === 0 ? (
              <div className="flex h-40 items-center justify-center text-sm text-secondary">Sem dados</div>
            ) : (
              (() => {
                const maior = rankingPatios[0].value || 1
                const totalPatios = rankingPatios.reduce((acc, p) => acc + p.value, 0)
                return (
                  <ol className="space-y-3">
                    {rankingPatios.map((p, i) => (
                      <li
                        key={p.name}
                        className="grid grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 sm:grid-cols-[1.75rem_12rem_minmax(0,1fr)_auto]"
                      >
                        <span
                          className={cn(
                            'flex h-7 w-7 items-center justify-center rounded-lg text-xs font-black tabular-nums',
                            i === 0 ? 'bg-primary/15 text-primary' : 'bg-overlay/[0.06] text-secondary',
                          )}
                        >
                          {i + 1}
                        </span>
                        <span className="truncate text-xs font-bold uppercase text-foreground" title={p.name}>
                          {p.name}
                        </span>
                        <span className="text-right text-xs tabular-nums sm:order-last">
                          <span className="font-black text-foreground">{p.value}</span>
                          <span className="ml-1.5 text-secondary">{Math.round((p.value / totalPatios) * 100)}%</span>
                        </span>
                        <div className="col-span-3 col-start-1 h-2.5 overflow-hidden rounded-full bg-overlay/[0.06] sm:col-span-1 sm:col-start-auto">
                          <div
                            className="ranking-barra h-full rounded-full"
                            style={{ width: `${(p.value / maior) * 100}%`, backgroundColor: CHART_ENTRADA, animationDelay: `${i * 80}ms` }}
                          />
                        </div>
                      </li>
                    ))}
                  </ol>
                )
              })()
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
