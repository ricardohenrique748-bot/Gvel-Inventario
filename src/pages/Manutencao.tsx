import { useMemo, useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Truck,
  ExternalLink,
  FileCheck,
  ArrowLeft,
  ClipboardCheck,
  Clock,
} from 'lucide-react'
import { format, isSameDay, parseISO } from 'date-fns'
import { PageHeader } from '@/components/layout/Header'
import { FiltersBar, type FiltersValue } from '@/components/FiltersBar'
import { Card } from '@/components/ui/Card'
import { StatCard } from '@/components/ui/StatCard'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { StatusManutencaoBadge } from '@/components/StatusManutencaoBadge'
import { ChecklistManutencaoCard } from '@/components/ChecklistManutencaoCard'
import { useMovimentacoes } from '@/hooks/useMovimentacoes'
import { useStatusManutencao } from '@/hooks/useStatusManutencao'
import { usePatios } from '@/hooks/usePatios'
import { urlMiniatura, aoFalharMiniatura } from '@/lib/thumb'

function getOSStatus(movId: string) {
  const info = localStorage.getItem(`checklist_info_${movId}`)
  if (info) {
    try {
      const parsed = JSON.parse(info)
      const mec = (parsed.mecanico || '').trim().toUpperCase()
      const fech = Boolean(parsed.dataHoraFechamento)
      const dtAb = (parsed.dataHoraAbertura || '').trim()

      // A O.S SÓ É CONSIDERADA INICIADA QUANDO O NOME DO RESPONSÁVEL ESTIVER PREENCHIDO
      if (mec && mec !== '—' && mec !== '-' && mec !== 'SEM NOME' && mec !== 'OPCIONAL' && mec.length > 0) {
        return {
          iniciada: true,
          mecanico: mec,
          dataHoraAbertura: dtAb || null,
          fechada: fech,
        }
      }
    } catch {}
  }
  return { iniciada: false, mecanico: null, dataHoraAbertura: null, fechada: false }
}

export function Manutencao() {
  const filtroInicial: FiltersValue = {
    dataInicio: '',
    dataFim: '',
  }

  const [filters, setFilters] = useState<FiltersValue>(filtroInicial)
  const [statusFiltro, setStatusFiltro] = useState('')
  const [osFiltro, setOsFiltro] = useState<'todos' | 'em_andamento' | 'finalizada' | 'aguardando'>('todos')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [abaMobile, setAbaMobile] = useState<'lista' | 'checklist'>('lista')
  const [osUpdateTrigger, setOsUpdateTrigger] = useState(0)
  const { statusManutencao } = useStatusManutencao()
  const { patios } = usePatios()

  useEffect(() => {
    const handleUpdate = () => setOsUpdateTrigger((c) => c + 1)
    window.addEventListener('checklist_updated', handleUpdate)
    window.addEventListener('storage', handleUpdate)
    return () => {
      window.removeEventListener('checklist_updated', handleUpdate)
      window.removeEventListener('storage', handleUpdate)
    }
  }, [])

  // Determina se o filtro representa um único dia ou um intervalo
  const umDiaSelecionado =
    filters.dataInicio && filters.dataFim && filters.dataInicio === filters.dataFim
      ? parseISO(filters.dataInicio)
      : null

  // Busca movimentações com base nos filtros — busca todos os veículos atualmente no pátio
  const {
    movimentacoes: periodo,
    loading,
    refetch,
  } = useMovimentacoes({
    status: 'no_patio',
    dataInicio: filters.dataInicio ? `${filters.dataInicio}T00:00:00` : undefined,
    dataFim: filters.dataFim ? `${filters.dataFim}T23:59:59` : undefined,
    search: filters.search,
    clienteId: filters.clienteId,
    marcaId: filters.marcaId,
    modeloId: filters.modeloId,
    patioId: filters.patioId,
  })

  // Veículos ativos no pátio para contagens
  const veiculosNoPatio = useMemo(() => {
    return periodo.filter((m) => m.status === 'no_patio')
  }, [periodo])

  const osEmAndamentoCount = useMemo(() => {
    return veiculosNoPatio.filter((m) => {
      const st = getOSStatus(m.id)
      return st.iniciada && !st.fechada
    }).length
  }, [veiculosNoPatio, osUpdateTrigger])

  const osFinalizadasCount = useMemo(() => {
    return veiculosNoPatio.filter((m) => {
      const st = getOSStatus(m.id)
      return st.iniciada && st.fechada
    }).length
  }, [veiculosNoPatio, osUpdateTrigger])

  const osAguardandoCount = useMemo(() => {
    return veiculosNoPatio.filter((m) => !getOSStatus(m.id).iniciada).length
  }, [veiculosNoPatio, osUpdateTrigger])

  const osIniciadasCount = osEmAndamentoCount + osFinalizadasCount

  // Filtra as movimentações com base em todos os critérios
  const entradas = useMemo(() => {
    return periodo.filter((m) => {
      // Garante que só exibe veículos presentes no pátio
      if (m.status === 'saiu') return false

      // Filtro de OS
      if (osFiltro !== 'todos') {
        const st = getOSStatus(m.id)
        if (osFiltro === 'em_andamento' && (!st.iniciada || st.fechada)) return false
        if (osFiltro === 'finalizada' && (!st.iniciada || !st.fechada)) return false
        if (osFiltro === 'aguardando' && st.iniciada) return false
      }

      // Verifica se a data de entrada bate com o dia/período se informado
      if (umDiaSelecionado) {
        if (!isSameDay(new Date(m.data_hora_entrada), umDiaSelecionado)) return false
      }

      // Filtro de status de manutenção
      if (statusFiltro) {
        if (statusFiltro === '__sem_status__' && m.status_id) return false
        if (statusFiltro !== '__sem_status__' && m.status_id !== statusFiltro) return false
      }

      return true
    })
  }, [periodo, umDiaSelecionado, statusFiltro, osFiltro])

  // Seleciona a primeira entrada automaticamente se nenhuma estiver selecionada
  useEffect(() => {
    if (entradas.length > 0) {
      if (!selectedId || !entradas.some((m) => m.id === selectedId)) {
        setSelectedId(entradas[0].id)
      }
    } else {
      setSelectedId(null)
    }
  }, [entradas, selectedId])

  const selecionado = useMemo(() => {
    return entradas.find((m) => m.id === selectedId) || null
  }, [entradas, selectedId])

  function handleSelecionarEntrada(id: string) {
    setSelectedId(id)
    setAbaMobile('checklist')
  }

  return (
    <div className="space-y-6 uppercase">
      <PageHeader
        title="MANUTENÇÃO"
        subtitle="VEÍCULOS NO PÁTIO, OFICINA LEVE, OFICINA PESADA E INSPEÇÃO DE CHECKLIST"
      />

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={Truck}
          label="VEÍCULOS NO PÁTIO"
          value={String(veiculosNoPatio.length)}
        />

        <StatCard
          icon={ClipboardCheck}
          label="O.S INICIADAS / PREENCHIDAS"
          value={String(osIniciadasCount)}
        />

        <StatCard
          icon={Clock}
          label="AGUARDANDO O.S"
          value={String(osAguardandoCount)}
        />
      </div>

      {/* Barra de Filtros */}
      <Card className="p-4 space-y-3">
        <FiltersBar
          value={filters}
          onChange={setFilters}
          showSearch
          showPeriod
          onClear={() => {
            setFilters(filtroInicial)
            setStatusFiltro('')
            setOsFiltro('todos')
          }}
        />

        {/* Filtro Rápido de Status da OS */}
        <div className="pt-2 border-t border-border/20 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-secondary">
            STATUS DA O.S:
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setOsFiltro('todos')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-1.5 ${
                osFiltro === 'todos'
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-surface text-secondary hover:text-foreground border border-border/30'
              }`}
            >
              TODOS ({veiculosNoPatio.length})
            </button>
            <button
              type="button"
              onClick={() => setOsFiltro('em_andamento')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-1.5 ${
                osFiltro === 'em_andamento'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-surface text-emerald-400 hover:text-emerald-300 border border-emerald-500/30'
              }`}
            >
              <span>🟢 EM ANDAMENTO ({osEmAndamentoCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setOsFiltro('finalizada')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-1.5 ${
                osFiltro === 'finalizada'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-surface text-blue-400 hover:text-blue-300 border border-blue-500/30'
              }`}
            >
              <span>🏁 FINALIZADAS ({osFinalizadasCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setOsFiltro('aguardando')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-1.5 ${
                osFiltro === 'aguardando'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-surface text-amber-400 hover:text-amber-300 border border-amber-500/30'
              }`}
            >
              <span>⏳ AGUARDANDO ({osAguardandoCount})</span>
            </button>
          </div>
        </div>

        {/* Filtro Rápido de Pátio / Oficina */}
        {patios.length > 0 && (
          <div className="pt-2 border-t border-border/20 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-secondary">
              PÁTIO / OFICINA:
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setFilters((prev) => ({ ...prev, patioId: undefined }))}
                className={`px-3 py-1 rounded-lg text-xs font-bold uppercase transition-all ${
                  !filters.patioId
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-surface text-secondary hover:text-foreground border border-border/30'
                }`}
              >
                TODOS ({veiculosNoPatio.length})
              </button>
              {patios.map((p) => {
                const count = veiculosNoPatio.filter((m) => m.patio_id === p.id).length
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setFilters((prev) => ({ ...prev, patioId: p.id }))}
                    className={`px-3 py-1 rounded-lg text-xs font-bold uppercase transition-all ${
                      filters.patioId === p.id
                        ? 'bg-primary text-white shadow-sm'
                        : 'bg-surface text-secondary hover:text-foreground border border-border/30'
                    }`}
                  >
                    {p.nome.toUpperCase()} ({count})
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div className="pt-2 border-t border-border/20 flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-secondary">
            STATUS DE MANUTENÇÃO:
          </span>
          <div className="w-full sm:w-64">
            <Select
              value={statusFiltro}
              onChange={(e) => setStatusFiltro(e.target.value)}
              className="!h-9 !text-sm uppercase"
            >
              <option value="">TODOS OS STATUS</option>
              <option value="__sem_status__">SEM STATUS DEFINIDO</option>
              {statusManutencao.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome.toUpperCase()}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </Card>

      {/* Seletor de visualização Mobile (Lista / Checklist) */}
      {!loading && entradas.length > 0 && (
        <div className="flex lg:hidden rounded-2xl bg-surface p-1.5 border border-border/20 shadow-md">
          <button
            type="button"
            onClick={() => setAbaMobile('lista')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all uppercase flex items-center justify-center gap-2 ${
              abaMobile === 'lista'
                ? 'bg-primary text-white shadow-lg shadow-primary/30'
                : 'text-secondary hover:text-foreground'
            }`}
          >
            <Truck className="h-4 w-4" />
            <span>LISTA ({entradas.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setAbaMobile('checklist')}
            disabled={!selecionado}
            className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all uppercase flex items-center justify-center gap-2 ${
              abaMobile === 'checklist'
                ? 'bg-primary text-white shadow-lg shadow-primary/30'
                : 'text-secondary hover:text-foreground disabled:opacity-40'
            }`}
          >
            <FileCheck className="h-4 w-4" />
            <span>CHECKLIST {selecionado ? `(${selecionado.veiculo?.placa})` : ''}</span>
          </button>
        </div>
      )}

      {/* Conteúdo Principal: Lista de Entradas + Checklist */}
      {loading ? (
        <Card className="p-12 text-center">
          <div className="flex flex-col items-center justify-center gap-3 text-secondary">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-secondary/30 border-t-primary" />
            <p className="text-sm font-semibold uppercase">CARREGANDO VEÍCULOS DO PÁTIO…</p>
          </div>
        </Card>
      ) : entradas.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="flex flex-col items-center justify-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary/10 text-secondary">
              <Truck className="h-7 w-7" />
            </div>
            <p className="text-base font-bold text-foreground uppercase">NENHUM VEÍCULO ENCONTRADO</p>
            <p className="text-sm text-secondary max-w-md uppercase">
              NENHUM VEÍCULO CORRESPONDE AOS FILTROS SELECIONADOS.
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Coluna Esquerda: Lista de Veículos que deram Entrada */}
          <div
            className={`lg:col-span-5 xl:col-span-4 space-y-3 ${
              abaMobile === 'checklist' ? 'hidden lg:block' : 'block'
            }`}
          >
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-secondary">
                VEÍCULOS ({entradas.length}) — TOQUE PARA ABRIR
              </span>
            </div>

            <div className="space-y-2.5 max-h-[750px] overflow-y-auto pr-1">
              {entradas.map((m) => {
                const isSelected = m.id === selectedId
                const osStatus = getOSStatus(m.id)

                return (
                  <div
                    key={m.id}
                    onClick={() => handleSelecionarEntrada(m.id)}
                    className={`cursor-pointer rounded-xl border p-3.5 transition-all text-left flex items-start gap-3.5 ${
                      isSelected
                        ? 'border-primary bg-primary/10 shadow-md ring-2 ring-primary/40'
                        : 'border-border/40 bg-card hover:border-border hover:bg-overlay/5 active:scale-[0.99]'
                    }`}
                  >
                    {/* Foto da Frente ou Ícone */}
                    {m.foto_frente_url ? (
                      <img
                        src={urlMiniatura(m.foto_frente_url, 112)}
                        onError={aoFalharMiniatura(m.foto_frente_url)}
                        alt={`Frente — ${m.veiculo?.placa}`}
                        loading="lazy"
                        decoding="async"
                        width={56}
                        height={56}
                        className="h-14 w-14 shrink-0 rounded-lg object-cover border border-border/20"
                      />
                    ) : (
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-surface text-secondary border border-border/20">
                        <Truck className="h-6 w-6" />
                      </div>
                    )}

                    {/* Informações da Entrada */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1.5 mb-1">
                        <span className="font-black text-foreground tracking-wide font-mono text-base">
                          {m.veiculo?.placa}
                        </span>
                        <StatusManutencaoBadge status={m.status_manutencao} />
                      </div>

                      {/* Badge de Status da OS / Preenchimento */}
                      <div className="mb-1.5 flex items-center gap-1.5 flex-wrap">
                        {osStatus.iniciada ? (
                          osStatus.fechada ? (
                            <Badge tone="neutral" className="!text-[10px] !py-0.5 !px-2 uppercase font-black tracking-wide bg-blue-500/20 text-blue-300 border border-blue-500/40">
                              🏁 O.S FINALIZADA {osStatus.mecanico ? `· ${osStatus.mecanico}` : ''}
                            </Badge>
                          ) : (
                            <Badge tone="success" className="!text-[10px] !py-0.5 !px-2 uppercase font-black tracking-wide">
                              🟢 EM ANDAMENTO {osStatus.mecanico ? `· ${osStatus.mecanico}` : ''}
                            </Badge>
                          )
                        ) : (
                          <Badge tone="neutral" className="!text-[10px] !py-0.5 !px-2 uppercase font-bold tracking-wide text-secondary border border-border/40">
                            ⏳ AGUARDANDO O.S
                          </Badge>
                        )}
                      </div>

                      <p className="text-xs font-bold text-foreground truncate uppercase">
                        {[m.veiculo?.marca?.nome, m.veiculo?.modelo?.nome].filter(Boolean).join(' ') ||
                          'VEÍCULO'}
                      </p>

                      <p className="text-xs text-primary font-bold truncate mt-0.5 uppercase">
                        PÁTIO: {m.patio?.nome || '—'}
                      </p>

                      <div className="mt-2 flex items-center justify-between text-[11px] text-secondary/80 border-t border-border/20 pt-1.5 uppercase font-bold">
                        <span>ENTRADA: {format(new Date(m.data_hora_entrada), 'dd/MM HH:mm')}</span>
                        <span className="text-primary font-bold">
                          {isSelected ? '✓ ABERTO' : 'PREENCHER →'}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Coluna Direita: Detalhes do Veículo e Checklist */}
          <div
            className={`lg:col-span-7 xl:col-span-8 space-y-4 ${
              abaMobile === 'lista' ? 'hidden lg:block' : 'block'
            }`}
          >
            {selecionado ? (
              <>
                {/* Botão de Retorno para a Lista no Mobile */}
                <div className="flex lg:hidden items-center justify-between pb-1">
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={() => setAbaMobile('lista')}
                    className="!h-8 !px-3 gap-1.5 text-xs uppercase font-bold"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    VER OUTROS VEÍCULOS
                  </Button>
                  <span className="text-xs font-black text-primary uppercase font-mono px-2 py-1 rounded-lg bg-primary/10 border border-primary/30">
                    {selecionado.veiculo?.placa}
                  </span>
                </div>

                {/* Resumo do Veículo Selecionado */}
                <Card className="p-4 bg-background border-border/60 uppercase shadow-lg">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3.5">
                      {selecionado.foto_frente_url ? (
                        <img
                          src={urlMiniatura(selecionado.foto_frente_url, 128)}
                          onError={aoFalharMiniatura(selecionado.foto_frente_url)}
                          alt={`Frente — ${selecionado.veiculo?.placa}`}
                          width={64}
                          height={64}
                          className="h-16 w-16 shrink-0 rounded-xl object-cover border border-border/30"
                        />
                      ) : (
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-surface text-secondary border border-border/20">
                          <Truck className="h-8 w-8" />
                        </div>
                      )}

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-2xl font-black tracking-wider text-foreground font-mono">
                            {selecionado.veiculo?.placa}
                          </h2>
                          <Badge tone={selecionado.veiculo?.operante ? 'success' : 'danger'} className="uppercase font-bold">
                            {selecionado.veiculo?.operante ? 'OPERANTE' : 'INOPERANTE'}
                          </Badge>
                          <StatusManutencaoBadge status={selecionado.status_manutencao} />
                        </div>
                        <p className="text-sm text-secondary uppercase font-medium">
                          {[
                            selecionado.veiculo?.marca?.nome,
                            selecionado.veiculo?.modelo?.nome,
                            selecionado.veiculo?.ano,
                          ]
                            .filter(Boolean)
                            .join(' · ')}{' '}
                          — {selecionado.veiculo?.cliente?.nome || 'CLIENTE NÃO INFORMADO'}
                        </p>
                        <p className="text-xs text-primary font-bold uppercase">
                          LOCAL ATUAL: {selecionado.patio?.nome || 'PÁTIO NÃO INFORMADO'}
                        </p>
                      </div>
                    </div>

                    <Link
                      to={`/veiculos/${selecionado.veiculo_id}`}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline self-start sm:self-center uppercase"
                    >
                      VER CADASTRO COMPLETO
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </Card>

                {/* Checklist de Inspeção do Veículo */}
                <ChecklistManutencaoCard
                  key={selecionado.id}
                  movimentacao={selecionado}
                  onStatusChange={async () => {
                    await refetch()
                  }}
                />
              </>
            ) : (
              <Card className="p-12 text-center uppercase">
                <p className="text-sm text-secondary font-medium">SELECIONE UMA ENTRADA PARA VISUALIZAR E PREENCHER O CHECKLIST.</p>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
