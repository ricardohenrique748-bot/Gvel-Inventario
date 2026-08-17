import { useMemo, useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Wrench,
  Truck,
  LogIn,
  ExternalLink,
} from 'lucide-react'
import { format, isSameDay, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { PageHeader } from '@/components/layout/Header'
import { FiltersBar, type FiltersValue } from '@/components/FiltersBar'
import { Card } from '@/components/ui/Card'
import { StatCard } from '@/components/ui/StatCard'
import { Select } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { StatusManutencaoBadge } from '@/components/StatusManutencaoBadge'
import { ChecklistManutencaoCard } from '@/components/ChecklistManutencaoCard'
import { useMovimentacoes } from '@/hooks/useMovimentacoes'
import { useStatusManutencao } from '@/hooks/useStatusManutencao'
import { urlMiniatura, aoFalharMiniatura } from '@/lib/thumb'

export function Manutencao() {
  const filtroInicial: FiltersValue = {
    dataInicio: format(new Date(), 'yyyy-MM-dd'),
    dataFim: format(new Date(), 'yyyy-MM-dd'),
  }

  const [filters, setFilters] = useState<FiltersValue>(filtroInicial)
  const [statusFiltro, setStatusFiltro] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { statusManutencao } = useStatusManutencao()

  // Determina se o filtro representa um único dia ou um intervalo
  const umDiaSelecionado =
    filters.dataInicio && filters.dataFim && filters.dataInicio === filters.dataFim
      ? parseISO(filters.dataInicio)
      : null

  const labelEntradas = umDiaSelecionado
    ? `Entradas em ${format(umDiaSelecionado, 'dd/MM', { locale: ptBR })}`
    : 'Entradas no período'

  // Busca movimentações com base nos filtros
  const {
    movimentacoes: periodo,
    loading,
    refetch,
  } = useMovimentacoes({
    dataInicio: filters.dataInicio ? `${filters.dataInicio}T00:00:00` : undefined,
    dataFim: filters.dataFim ? `${filters.dataFim}T23:59:59` : undefined,
    search: filters.search,
    clienteId: filters.clienteId,
    marcaId: filters.marcaId,
    modeloId: filters.modeloId,
    patioId: filters.patioId,
  })

  // Filtra estritamente as movimentações cuja data de ENTRADA está no período selecionado
  const entradas = useMemo(() => {
    return periodo.filter((m) => {
      // Verifica se a data de entrada bate com o dia/período
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
  }, [periodo, umDiaSelecionado, statusFiltro])

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

  // Métricas
  const totalEntradas = entradas.length
  const emManutencaoCount = entradas.filter((m) => m.status_id).length
  const noPatioCount = entradas.filter((m) => m.status === 'no_patio').length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manutenção"
        subtitle="Gerenciamento de serviços, etapas e trajeto das entradas de veículos"
      />

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={LogIn}
          label={labelEntradas.toUpperCase()}
          value={String(totalEntradas)}
        />

        <StatCard
          icon={Wrench}
          label="EM MANUTENÇÃO"
          value={String(emManutencaoCount)}
        />

        <StatCard
          icon={Truck}
          label="AINDA NO PÁTIO"
          value={String(noPatioCount)}
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
          }}
        />

        <div className="pt-2 border-t border-border/20 flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-secondary">
            Status de Manutenção:
          </span>
          <div className="w-full sm:w-64">
            <Select
              value={statusFiltro}
              onChange={(e) => setStatusFiltro(e.target.value)}
              className="!h-9 !text-sm"
            >
              <option value="">Todos os status</option>
              <option value="__sem_status__">Sem status definido</option>
              {statusManutencao.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </Card>

      {/* Conteúdo Principal: Lista de Entradas + Checklist */}
      {loading ? (
        <Card className="p-12 text-center">
          <div className="flex flex-col items-center justify-center gap-3 text-secondary">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-secondary/30 border-t-primary" />
            <p className="text-sm">Carregando entradas do período…</p>
          </div>
        </Card>
      ) : entradas.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="flex flex-col items-center justify-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary/10 text-secondary">
              <Truck className="h-7 w-7" />
            </div>
            <p className="text-base font-semibold text-foreground">Nenhuma entrada encontrada</p>
            <p className="text-sm text-secondary max-w-md">
              Não foram registradas entradas para o período e filtros selecionados.
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Coluna Esquerda: Lista de Veículos que deram Entrada */}
          <div className="lg:col-span-5 xl:col-span-4 space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-secondary">
                Entradas ({entradas.length})
              </span>
            </div>

            <div className="space-y-2.5 max-h-[750px] overflow-y-auto pr-1">
              {entradas.map((m) => {
                const isSelected = m.id === selectedId
                return (
                  <div
                    key={m.id}
                    onClick={() => setSelectedId(m.id)}
                    className={`cursor-pointer rounded-xl border p-3 transition-all text-left flex items-start gap-3 ${
                      isSelected
                        ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary/30'
                        : 'border-border/40 bg-card hover:border-border hover:bg-overlay/5'
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
                      <div className="flex items-center justify-between gap-1.5 mb-0.5">
                        <span className="font-bold text-foreground tracking-wide font-mono text-base">
                          {m.veiculo?.placa}
                        </span>
                        <StatusManutencaoBadge status={m.status_manutencao} />
                      </div>

                      <p className="text-xs font-medium text-foreground truncate">
                        {[m.veiculo?.marca?.nome, m.veiculo?.modelo?.nome].filter(Boolean).join(' ') ||
                          'Veículo'}
                      </p>

                      <p className="text-xs text-secondary truncate mt-0.5">
                        Pátio: {m.patio?.nome || '—'}
                      </p>

                      <div className="mt-2 flex items-center justify-between text-[11px] text-secondary/80 border-t border-border/20 pt-1.5">
                        <span>Entrada: {format(new Date(m.data_hora_entrada), 'HH:mm')}</span>
                        <span>
                          {m.status === 'no_patio' ? (
                            <Badge tone="success" className="!text-[10px] !py-0 !px-1.5">No pátio</Badge>
                          ) : (
                            <Badge tone="neutral" className="!text-[10px] !py-0 !px-1.5">Saiu</Badge>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Coluna Direita: Detalhes do Veículo e Checklist */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-4">
            {selecionado ? (
              <>
                {/* Resumo do Veículo Selecionado */}
                <Card className="p-4 bg-background border-border/60">
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
                          <Badge tone={selecionado.veiculo?.operante ? 'success' : 'danger'}>
                            {selecionado.veiculo?.operante ? 'Operante' : 'Inoperante'}
                          </Badge>
                          <StatusManutencaoBadge status={selecionado.status_manutencao} />
                        </div>
                        <p className="text-sm text-secondary">
                          {[
                            selecionado.veiculo?.marca?.nome,
                            selecionado.veiculo?.modelo?.nome,
                            selecionado.veiculo?.ano,
                          ]
                            .filter(Boolean)
                            .join(' · ')}{' '}
                          — {selecionado.veiculo?.cliente?.nome || 'Cliente não informado'}
                        </p>
                      </div>
                    </div>

                    <Link
                      to={`/veiculos/${selecionado.veiculo_id}`}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline self-start sm:self-center"
                    >
                      Ver cadastro completo
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
              <Card className="p-12 text-center">
                <p className="text-sm text-secondary">Selecione uma entrada para visualizar e preencher o checklist.</p>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
