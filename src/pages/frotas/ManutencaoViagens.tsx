import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Wrench,
  LayoutDashboard,
  ClipboardList,
  Fuel,
  Gauge,
  DollarSign,
  Plus,
  Pencil,
  Trash2,
  X,
  AlertTriangle,
  Clock,
  PackageSearch,
  ShieldAlert,
  ParkingSquare,
  CheckCircle2,
  Trophy,
  Download,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input, Label, Select, Textarea } from '@/components/ui/Input'
import { QuickCreateSelect } from '@/components/QuickCreateSelect'
import { exportRowsToCsv } from '@/lib/csv'
import { getErrorMessage } from '@/lib/erros'
import type { ItemFrotaCadastrada } from '@/pages/Frotas'
import type {
  OrdemServico,
  TipoOrdemServico,
  StatusOrdemServico,
  PrioridadeOrdemServico,
  Abastecimento,
} from '@/lib/types'
import {
  useOrdensServico,
  criarOS,
  atualizarOS,
  excluirOS,
  useAbastecimentos,
  criarAbastecimento,
  excluirAbastecimento,
  useLeiturasOdometro,
  criarLeituraOdometro,
  excluirLeituraOdometro,
  type SalvarOSInput,
  type SalvarAbastecimentoInput,
} from '@/hooks/useManutencaoFrota'

// Campos de valor digitados no padrão pt-BR — mesma lógica usada no resto
// do Controle de Viagens (Nova Viagem, Contas a Pagar/Receber).
function parseDecimalPtBr(valor: string): number {
  const limpo = valor.replace(/\./g, '').replace(',', '.')
  return Number(limpo) || 0
}

function fmtMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const STATUS_OS_INFO: Record<StatusOrdemServico, { label: string; tone: 'neutral' | 'warning' | 'success' | 'danger' }> = {
  solicitada: { label: 'SOLICITADA', tone: 'neutral' },
  em_andamento: { label: 'EM ANDAMENTO', tone: 'warning' },
  aguardando_peca: { label: 'AGUARDANDO PEÇA', tone: 'warning' },
  concluida: { label: 'CONCLUÍDA', tone: 'success' },
  cancelada: { label: 'CANCELADA', tone: 'danger' },
}

const PRIORIDADE_OS_INFO: Record<PrioridadeOrdemServico, { label: string; tone: 'neutral' | 'warning' | 'success' | 'danger' }> = {
  baixa: { label: 'BAIXA', tone: 'neutral' },
  normal: { label: 'NORMAL', tone: 'success' },
  alta: { label: 'ALTA', tone: 'warning' },
  critica: { label: 'CRÍTICA', tone: 'danger' },
}

const COMBUSTIVEIS = ['DIESEL S10', 'DIESEL S500', 'ARLA 32', 'GASOLINA', 'ETANOL', 'GNV']

interface CadastroSimples {
  id: string
  nome: string
}

interface ManutencaoViagensProps {
  veiculos: ItemFrotaCadastrada[]
  centrosCusto: CadastroSimples[]
  onRefetchCentrosCusto: () => Promise<void>
  onCriarCentroCusto: (nome: string) => Promise<CadastroSimples>
  fornecedores: CadastroSimples[]
  onRefetchFornecedores: () => Promise<void>
  onCriarFornecedor: (nome: string) => Promise<CadastroSimples>
  isAdmin: boolean
}

type SubAbaManutencao = 'painel' | 'os' | 'abastecimentos' | 'odometro' | 'custos'

export function ManutencaoViagens(props: ManutencaoViagensProps) {
  const { veiculos, centrosCusto, onRefetchCentrosCusto, onCriarCentroCusto, fornecedores, onRefetchFornecedores, onCriarFornecedor, isAdmin } = props

  const [subAba, setSubAba] = useState<SubAbaManutencao>('painel')

  const { ordens, loading: carregandoOS } = useOrdensServico()
  const { abastecimentos, loading: carregandoAbastecimentos } = useAbastecimentos()
  const { leituras, loading: carregandoOdometro } = useLeiturasOdometro()

  const veiculosOrdenados = useMemo(() => [...veiculos].sort((a, b) => a.placa.localeCompare(b.placa)), [veiculos])

  // ---- Custos / Painel: agregados por veículo ----
  const custosPorVeiculo = useMemo(() => {
    const mapa = new Map<string, { placa: string; maoDeObra: number; qtdOS: number }>()
    ordens.forEach((o) => {
      const atual = mapa.get(o.veiculoId) || { placa: o.placa, maoDeObra: 0, qtdOS: 0 }
      atual.maoDeObra += o.valor
      atual.qtdOS += 1
      mapa.set(o.veiculoId, atual)
    })
    return Array.from(mapa.values()).sort((a, b) => b.maoDeObra - a.maoDeObra)
  }, [ordens])

  const custoTotalManutencao = useMemo(() => ordens.reduce((acc, o) => acc + o.valor, 0), [ordens])

  const metricasPainel = useMemo(() => {
    const emManutencao = ordens.filter((o) => o.status === 'em_andamento').length
    const osAbertas = ordens.filter((o) => o.status !== 'concluida' && o.status !== 'cancelada').length
    const osUrgentes = ordens.filter(
      (o) => o.prioridade === 'critica' && o.status !== 'concluida' && o.status !== 'cancelada',
    ).length
    const aguardandoPeca = ordens.filter((o) => o.status === 'aguardando_peca').length
    const veiculosParados = new Set(ordens.filter((o) => o.status === 'em_andamento').map((o) => o.veiculoId)).size
    return { emManutencao, osAbertas, osUrgentes, aguardandoPeca, alertasAtivos: 0, veiculosParados }
  }, [ordens])

  // ---- Consumo (km/L e R$/km) entre abastecimentos consecutivos do mesmo veículo ----
  const consumoPorAbastecimento = useMemo(() => {
    const porVeiculo: Record<string, Abastecimento[]> = {}
    abastecimentos.forEach((a) => {
      if (!porVeiculo[a.veiculoId]) porVeiculo[a.veiculoId] = []
      porVeiculo[a.veiculoId].push(a)
    })
    const mapa = new Map<string, { kmL: number; custoKm: number }>()
    Object.values(porVeiculo).forEach((lista) => {
      const ordenada = [...lista].sort((a, b) => a.dataHora.localeCompare(b.dataHora))
      for (let i = 1; i < ordenada.length; i++) {
        const atual = ordenada[i]
        const anterior = ordenada[i - 1]
        if (atual.odometro != null && anterior.odometro != null && atual.odometro > anterior.odometro) {
          const kmRodado = atual.odometro - anterior.odometro
          if (atual.volume > 0 && kmRodado > 0) {
            mapa.set(atual.id, { kmL: kmRodado / atual.volume, custoKm: atual.valorTotal / kmRodado })
          }
        }
      }
    })
    return mapa
  }, [abastecimentos])

  // ---- Modais ----
  const [mostrarModalOS, setMostrarModalOS] = useState(false)
  const [osEditando, setOsEditando] = useState<OrdemServico | null>(null)
  const [mostrarModalAbastecimento, setMostrarModalAbastecimento] = useState(false)
  const [mostrarModalOdometro, setMostrarModalOdometro] = useState(false)

  async function handleExcluirOS(id: string) {
    if (!confirm('Excluir esta ordem de serviço? Essa ação não pode ser desfeita.')) return
    try {
      await excluirOS(id)
    } catch (err) {
      alert(getErrorMessage(err, 'Erro ao excluir a OS.'))
    }
  }

  async function handleExcluirAbastecimento(id: string) {
    if (!confirm('Excluir este abastecimento? Essa ação não pode ser desfeita.')) return
    try {
      await excluirAbastecimento(id)
    } catch (err) {
      alert(getErrorMessage(err, 'Erro ao excluir o abastecimento.'))
    }
  }

  async function handleExcluirLeitura(id: string) {
    if (!confirm('Excluir esta leitura de odômetro? Essa ação não pode ser desfeita.')) return
    try {
      await excluirLeituraOdometro(id)
    } catch (err) {
      alert(getErrorMessage(err, 'Erro ao excluir a leitura.'))
    }
  }

  function handleExportarCustos() {
    exportRowsToCsv(
      `custos_manutencao_${format(new Date(), 'yyyy-MM-dd')}.csv`,
      ['Veículo', 'Peças', 'Mão de Obra', 'Custo Total', 'Qtd OS'],
      custosPorVeiculo.map((c) => [c.placa, '0,00', c.maoDeObra.toFixed(2).replace('.', ','), c.maoDeObra.toFixed(2).replace('.', ','), String(c.qtdOS)]),
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
          <Wrench className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-sm font-black text-foreground uppercase">Manutenção de Frota</h2>
          <p className="text-[11px] text-secondary normal-case">
            Ordens de serviço, abastecimentos e odômetro dos veículos usados nas viagens
          </p>
        </div>
      </div>

      {/* Sub-menu interno */}
      <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-2xl bg-surface/80 border border-border/25 shadow-sm w-full sm:w-fit">
        {(
          [
            { id: 'painel', label: 'PAINEL', icon: LayoutDashboard },
            { id: 'os', label: 'ORDENS DE SERVIÇO', icon: ClipboardList },
            { id: 'abastecimentos', label: 'ABASTECIMENTOS', icon: Fuel },
            { id: 'odometro', label: 'ODÔMETRO', icon: Gauge },
            { id: 'custos', label: 'CUSTOS', icon: DollarSign },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setSubAba(id)}
            className={`flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-[11px] font-black transition-all whitespace-nowrap ${
              subAba === id
                ? 'bg-primary text-white shadow-md shadow-primary/20'
                : 'text-secondary hover:text-foreground hover:bg-surface-hover/50'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* ---- PAINEL ---- */}
      {subAba === 'painel' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {(
              [
                { label: 'EM MANUTENÇÃO', valor: metricasPainel.emManutencao, icon: Wrench, cor: 'text-amber-400', bg: 'bg-amber-500/10' },
                { label: 'OS ABERTAS', valor: metricasPainel.osAbertas, icon: Clock, cor: 'text-blue-400', bg: 'bg-blue-500/10' },
                { label: 'OS URGENTES', valor: metricasPainel.osUrgentes, icon: AlertTriangle, cor: 'text-rose-500', bg: 'bg-rose-500/10' },
                { label: 'AGUARDANDO PEÇA', valor: metricasPainel.aguardandoPeca, icon: PackageSearch, cor: 'text-violet-400', bg: 'bg-violet-500/10' },
                { label: 'ALERTAS ATIVOS', valor: metricasPainel.alertasAtivos, icon: ShieldAlert, cor: 'text-rose-500', bg: 'bg-rose-500/10' },
                { label: 'VEÍCULOS PARADOS', valor: metricasPainel.veiculosParados, icon: ParkingSquare, cor: 'text-secondary', bg: 'bg-overlay/10' },
              ] as const
            ).map((item) => (
              <Card key={item.label} className="p-4 border-border/30 bg-surface/90">
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${item.bg} ${item.cor} mb-2.5`}>
                  <item.icon className="h-4 w-4" />
                </div>
                <p className="text-2xl font-black font-mono text-foreground">{item.valor}</p>
                <p className="mt-0.5 text-[10px] text-secondary font-bold uppercase">{item.label}</p>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-4 border-border/30 bg-surface/90">
              <div className="flex items-center justify-between mb-3">
                <span className="flex items-center gap-2 text-xs font-black text-foreground uppercase">
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                  Alertas de Manutenção
                </span>
                <Badge tone="neutral" className="text-[9px] font-black">{metricasPainel.alertasAtivos}</Badge>
              </div>
              <div className="py-8 text-center">
                <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-500" />
                <p className="text-xs font-black text-foreground">NENHUM ALERTA ATIVO</p>
                <p className="mt-1 text-[11px] text-secondary normal-case">
                  Frota em dia — nenhum ponto de atenção no momento.
                </p>
              </div>
            </Card>

            <Card className="p-4 border-border/30 bg-surface/90">
              <span className="flex items-center gap-2 text-xs font-black text-foreground uppercase mb-3">
                <DollarSign className="h-4 w-4 text-emerald-500" />
                Resumo de Custos
              </span>
              <p className="text-[10px] text-secondary font-bold uppercase">Custo Total de Manutenção</p>
              <p className="text-2xl font-black font-mono text-foreground mb-2">{fmtMoeda(custoTotalManutencao)}</p>
              <div className="h-2 w-full rounded-full bg-blue-500/20 overflow-hidden mb-1.5">
                <div className="h-full bg-emerald-500" style={{ width: '100%' }} />
              </div>
              <div className="flex items-center justify-between text-[10px] font-bold text-secondary mb-3">
                <span>PEÇAS R$ 0,00</span>
                <span>MÃO DE OBRA {fmtMoeda(custoTotalManutencao)}</span>
              </div>

              <p className="text-[11px] font-black text-foreground uppercase mb-2 flex items-center gap-1.5">
                <Trophy className="h-3.5 w-3.5 text-amber-400" />
                Top Veículos por Custo
              </p>
              <div className="space-y-1.5">
                {custosPorVeiculo.slice(0, 3).map((c, i) => (
                  <div key={c.placa} className="flex items-center justify-between rounded-xl border border-border/15 bg-background/50 px-3 py-2">
                    <span className="flex items-center gap-2 text-xs font-bold text-foreground">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/15 text-amber-500 text-[10px] font-black">
                        {i + 1}
                      </span>
                      {c.placa}
                    </span>
                    <span className="text-xs font-black font-mono text-foreground">{fmtMoeda(c.maoDeObra)}</span>
                  </div>
                ))}
                {custosPorVeiculo.length === 0 && (
                  <p className="text-[11px] text-secondary normal-case text-center py-3">Nenhum custo registrado ainda.</p>
                )}
              </div>
              {custosPorVeiculo.length > 3 && (
                <button
                  type="button"
                  onClick={() => setSubAba('custos')}
                  className="mt-2 w-full text-center text-[11px] font-bold text-primary hover:underline"
                >
                  Ver ranking completo ({custosPorVeiculo.length})
                </button>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* ---- ORDENS DE SERVIÇO ---- */}
      {subAba === 'os' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button
              type="button"
              onClick={() => {
                setOsEditando(null)
                setMostrarModalOS(true)
              }}
              className="gap-1.5 text-xs font-bold shadow-md shadow-primary/20"
            >
              <Plus className="h-3.5 w-3.5" />
              NOVA OS
            </Button>
          </div>

          {carregandoOS && ordens.length === 0 ? (
            <Card className="p-10 text-center">
              <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-secondary/30 border-t-primary" />
            </Card>
          ) : ordens.length === 0 ? (
            <Card className="p-10 text-center">
              <ClipboardList className="mx-auto mb-2 h-8 w-8 text-secondary/40" />
              <p className="text-xs font-bold text-secondary">NENHUMA OS REGISTRADA</p>
            </Card>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border/25 bg-surface/80 shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm uppercase">
                  <thead className="border-b border-border/15 bg-surface/95 text-[10px] font-black text-secondary uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3">VEÍCULO</th>
                      <th className="px-4 py-3">SERVIÇO</th>
                      <th className="px-4 py-3">OFICINA</th>
                      <th className="px-4 py-3">STATUS</th>
                      <th className="px-4 py-3">PRIORIDADE</th>
                      <th className="px-4 py-3">VALOR</th>
                      <th className="px-4 py-3 text-right">AÇÕES</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/10 font-medium">
                    {ordens.map((o) => (
                      <tr key={o.id} className="hover:bg-overlay/5 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-mono font-black text-foreground">{o.placa}</p>
                          <p className="text-[10px] text-secondary normal-case">{o.tipo === 'preventiva' ? 'Preventiva' : 'Corretiva'}</p>
                        </td>
                        <td className="px-4 py-3 text-xs font-bold text-foreground normal-case max-w-[220px] truncate">{o.descricaoServico}</td>
                        <td className="px-4 py-3 text-xs text-secondary normal-case">{o.oficina}</td>
                        <td className="px-4 py-3">
                          <Badge tone={STATUS_OS_INFO[o.status].tone} className="text-[9px] font-black">
                            {STATUS_OS_INFO[o.status].label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={PRIORIDADE_OS_INFO[o.prioridade].tone} className="text-[9px] font-black">
                            {PRIORIDADE_OS_INFO[o.prioridade].label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs font-black text-foreground">{fmtMoeda(o.valor)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setOsEditando(o)
                                setMostrarModalOS(true)
                              }}
                              className="rounded-lg p-1.5 text-secondary hover:text-primary hover:bg-overlay/10 transition-colors"
                              title="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => handleExcluirOS(o.id)}
                                className="rounded-lg p-1.5 text-secondary hover:text-status-danger hover:bg-status-danger/10 transition-colors"
                                title="Excluir"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---- ABASTECIMENTOS ---- */}
      {subAba === 'abastecimentos' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button
              type="button"
              onClick={() => setMostrarModalAbastecimento(true)}
              className="gap-1.5 text-xs font-bold shadow-md shadow-primary/20"
            >
              <Plus className="h-3.5 w-3.5" />
              NOVO ABASTECIMENTO
            </Button>
          </div>

          {carregandoAbastecimentos && abastecimentos.length === 0 ? (
            <Card className="p-10 text-center">
              <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-secondary/30 border-t-primary" />
            </Card>
          ) : abastecimentos.length === 0 ? (
            <Card className="p-10 text-center">
              <Fuel className="mx-auto mb-2 h-8 w-8 text-secondary/40" />
              <p className="text-xs font-bold text-secondary">NENHUM ABASTECIMENTO REGISTRADO</p>
            </Card>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border/25 bg-surface/80 shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm uppercase">
                  <thead className="border-b border-border/15 bg-surface/95 text-[10px] font-black text-secondary uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3">DATA / VEÍCULO</th>
                      <th className="px-4 py-3">POSTO / COMBUSTÍVEL</th>
                      <th className="px-4 py-3">VOLUME</th>
                      <th className="px-4 py-3">VALOR TOTAL</th>
                      <th className="px-4 py-3">CONSUMO</th>
                      <th className="px-4 py-3">ORIGEM</th>
                      <th className="px-4 py-3">APROVAÇÃO</th>
                      <th className="px-4 py-3 text-right">AÇÕES</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/10 font-medium">
                    {abastecimentos.map((a) => {
                      const consumo = consumoPorAbastecimento.get(a.id)
                      return (
                        <tr key={a.id} className="hover:bg-overlay/5 transition-colors">
                          <td className="px-4 py-3">
                            <p className="font-mono text-xs">{format(parseISO(a.dataHora), 'dd/MM/yyyy')}</p>
                            <p className="font-mono font-black text-foreground text-xs">{a.placa}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-xs font-bold text-foreground normal-case">{a.postoFornecedor}</p>
                            <p className="text-[10px] text-secondary">{a.combustivel}</p>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs">{a.volume.toLocaleString('pt-BR')} L</td>
                          <td className="px-4 py-3 font-mono text-xs font-black text-foreground">{fmtMoeda(a.valorTotal)}</td>
                          <td className="px-4 py-3 font-mono text-[11px]">
                            {consumo ? (
                              <>
                                <p className="text-foreground font-bold">{consumo.kmL.toFixed(2)} km/l</p>
                                <p className="text-secondary">{fmtMoeda(consumo.custoKm)}/km</p>
                              </>
                            ) : (
                              <span className="text-secondary">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <Badge tone="neutral" className="text-[9px] font-black">
                              {a.origem === 'despesa_viagem' ? 'DESPESA VIAGEM' : 'MANUAL'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <Badge tone={a.aprovado ? 'success' : 'warning'} className="text-[9px] font-black">
                              {a.aprovado ? 'APROVADO' : 'PENDENTE'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              {isAdmin && (
                                <button
                                  type="button"
                                  onClick={() => handleExcluirAbastecimento(a.id)}
                                  className="rounded-lg p-1.5 text-secondary hover:text-status-danger hover:bg-status-danger/10 transition-colors"
                                  title="Excluir"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---- ODÔMETRO ---- */}
      {subAba === 'odometro' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button
              type="button"
              onClick={() => setMostrarModalOdometro(true)}
              className="gap-1.5 text-xs font-bold shadow-md shadow-primary/20"
            >
              <Plus className="h-3.5 w-3.5" />
              NOVA LEITURA
            </Button>
          </div>

          {carregandoOdometro && leituras.length === 0 ? (
            <Card className="p-10 text-center">
              <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-secondary/30 border-t-primary" />
            </Card>
          ) : leituras.length === 0 ? (
            <Card className="p-10 text-center">
              <Gauge className="mx-auto mb-2 h-8 w-8 text-secondary/40" />
              <p className="text-xs font-bold text-secondary">NENHUMA LEITURA REGISTRADA</p>
            </Card>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border/25 bg-surface/80 shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm uppercase">
                  <thead className="border-b border-border/15 bg-surface/95 text-[10px] font-black text-secondary uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3">DATA / VEÍCULO</th>
                      <th className="px-4 py-3">QUILOMETRAGEM</th>
                      <th className="px-4 py-3">HORAS MOTOR</th>
                      <th className="px-4 py-3">ORIGEM</th>
                      <th className="px-4 py-3">STATUS</th>
                      <th className="px-4 py-3 text-right">AÇÕES</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/10 font-medium">
                    {leituras.map((l) => (
                      <tr key={l.id} className="hover:bg-overlay/5 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-mono text-xs">{format(parseISO(l.dataLeitura), 'dd/MM/yyyy')}</p>
                          <p className="font-mono font-black text-foreground text-xs">{l.placa}</p>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs font-black text-foreground">
                          {l.quilometragem.toLocaleString('pt-BR')} km
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-secondary">{l.horasMotor ?? '—'}</td>
                        <td className="px-4 py-3">
                          <Badge tone="neutral" className="text-[9px] font-black">
                            {l.origem === 'abastecimento' ? 'ABASTECIMENTO' : 'MANUAL'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={l.validada ? 'success' : 'warning'} className="text-[9px] font-black">
                            {l.validada ? 'VALIDADA' : 'PENDENTE'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => handleExcluirLeitura(l.id)}
                                className="rounded-lg p-1.5 text-secondary hover:text-status-danger hover:bg-status-danger/10 transition-colors"
                                title="Excluir"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---- CUSTOS ---- */}
      {subAba === 'custos' && (
        <div className="space-y-3">
          <Card className="p-4 border-border/30 bg-surface/90 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-secondary font-bold uppercase">Custo Total de Manutenção</p>
              <p className="text-2xl font-black font-mono text-foreground">{fmtMoeda(custoTotalManutencao)}</p>
            </div>
            <Button type="button" variant="secondary" onClick={handleExportarCustos} className="gap-1.5 text-xs font-bold">
              <Download className="h-3.5 w-3.5" />
              EXPORTAR
            </Button>
          </Card>

          {custosPorVeiculo.length === 0 ? (
            <Card className="p-10 text-center">
              <DollarSign className="mx-auto mb-2 h-8 w-8 text-secondary/40" />
              <p className="text-xs font-bold text-secondary">NENHUM CUSTO REGISTRADO</p>
            </Card>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border/25 bg-surface/80 shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm uppercase">
                  <thead className="border-b border-border/15 bg-surface/95 text-[10px] font-black text-secondary uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3">VEÍCULO</th>
                      <th className="px-4 py-3">PEÇAS</th>
                      <th className="px-4 py-3">MÃO DE OBRA</th>
                      <th className="px-4 py-3">CUSTO TOTAL</th>
                      <th className="px-4 py-3">QTD OS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/10 font-medium">
                    {custosPorVeiculo.map((c) => (
                      <tr key={c.placa} className="hover:bg-overlay/5 transition-colors">
                        <td className="px-4 py-3 font-mono font-black text-foreground">{c.placa}</td>
                        <td className="px-4 py-3 font-mono text-xs text-secondary">R$ 0,00</td>
                        <td className="px-4 py-3 font-mono text-xs">{fmtMoeda(c.maoDeObra)}</td>
                        <td className="px-4 py-3 font-mono text-xs font-black text-foreground">{fmtMoeda(c.maoDeObra)}</td>
                        <td className="px-4 py-3 font-mono text-xs">{c.qtdOS}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {mostrarModalOS && createPortal(
        <ModalOrdemServico
          osEditando={osEditando}
          veiculos={veiculosOrdenados}
          centrosCusto={centrosCusto}
          onRefetchCentrosCusto={onRefetchCentrosCusto}
          onCriarCentroCusto={onCriarCentroCusto}
          fornecedores={fornecedores}
          onRefetchFornecedores={onRefetchFornecedores}
          onCriarFornecedor={onCriarFornecedor}
          onClose={() => setMostrarModalOS(false)}
        />,
        document.body,
      )}

      {mostrarModalAbastecimento && createPortal(
        <ModalAbastecimento
          veiculos={veiculosOrdenados}
          centrosCusto={centrosCusto}
          onRefetchCentrosCusto={onRefetchCentrosCusto}
          onCriarCentroCusto={onCriarCentroCusto}
          onClose={() => setMostrarModalAbastecimento(false)}
        />,
        document.body,
      )}

      {mostrarModalOdometro && createPortal(
        <ModalLeituraOdometro veiculos={veiculosOrdenados} onClose={() => setMostrarModalOdometro(false)} />,
        document.body,
      )}
    </div>
  )
}

// ----------------------------------------------------------------------------------
// Modal: Nova / Editar Ordem de Serviço
// ----------------------------------------------------------------------------------
function ModalOrdemServico({
  osEditando,
  veiculos,
  centrosCusto,
  onRefetchCentrosCusto,
  onCriarCentroCusto,
  fornecedores,
  onRefetchFornecedores,
  onCriarFornecedor,
  onClose,
}: {
  osEditando: OrdemServico | null
  veiculos: ItemFrotaCadastrada[]
  centrosCusto: CadastroSimples[]
  onRefetchCentrosCusto: () => Promise<void>
  onCriarCentroCusto: (nome: string) => Promise<CadastroSimples>
  fornecedores: CadastroSimples[]
  onRefetchFornecedores: () => Promise<void>
  onCriarFornecedor: (nome: string) => Promise<CadastroSimples>
  onClose: () => void
}) {
  const [veiculoId, setVeiculoId] = useState(osEditando?.veiculoId || '')
  const [centroCustoId, setCentroCustoId] = useState(osEditando?.centroCustoId || '')
  const [tipo, setTipo] = useState<TipoOrdemServico>(osEditando?.tipo || 'preventiva')
  const [status, setStatus] = useState<StatusOrdemServico>(osEditando?.status || 'solicitada')
  const [prioridade, setPrioridade] = useState<PrioridadeOrdemServico>(osEditando?.prioridade || 'normal')
  const [dataEntrada, setDataEntrada] = useState(osEditando?.dataEntrada || '')
  const [descricaoServico, setDescricaoServico] = useState(osEditando?.descricaoServico || '')
  const [oficina, setOficina] = useState(osEditando?.oficina || '')
  const [kmEntrada, setKmEntrada] = useState(osEditando?.kmEntrada != null ? String(osEditando.kmEntrada) : '')
  const [valor, setValor] = useState(osEditando?.valor != null ? osEditando.valor.toFixed(2).replace('.', ',') : '')
  const [fornecedorId, setFornecedorId] = useState(osEditando?.fornecedorId || '')
  const [observacoes, setObservacoes] = useState(osEditando?.observacoes || '')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const veiculosComoOpcoes = useMemo(
    () => veiculos.map((v) => ({ id: v.id, nome: `${v.placa}${v.modeloNome ? ` — ${v.modeloNome}` : ''}` })),
    [veiculos],
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const veiculo = veiculos.find((v) => v.id === veiculoId)
    if (!veiculo) {
      setErro('Selecione o veículo.')
      return
    }
    if (!centroCustoId) {
      setErro('Selecione o centro de custo.')
      return
    }
    if (!descricaoServico.trim()) {
      setErro('Informe a descrição do serviço.')
      return
    }
    if (!oficina.trim()) {
      setErro('Informe a oficina.')
      return
    }
    const centro = centrosCusto.find((c) => c.id === centroCustoId)
    const fornecedor = fornecedores.find((f) => f.id === fornecedorId)

    const input: SalvarOSInput = {
      veiculoId,
      placa: veiculo.placa,
      veiculoNome: [veiculo.marcaNome, veiculo.modeloNome].filter(Boolean).join(' ') || undefined,
      centroCustoId,
      centroCustoNome: centro?.nome,
      tipo,
      status,
      prioridade,
      dataEntrada: dataEntrada || null,
      descricaoServico: descricaoServico.trim().toUpperCase(),
      oficina: oficina.trim().toUpperCase(),
      kmEntrada: kmEntrada.trim() ? parseDecimalPtBr(kmEntrada) : null,
      valor: parseDecimalPtBr(valor),
      fornecedorId: fornecedorId || undefined,
      fornecedorNome: fornecedor?.nome,
      observacoes: observacoes.trim() ? observacoes.trim().toUpperCase() : undefined,
    }

    setSalvando(true)
    setErro(null)
    try {
      if (osEditando) {
        await atualizarOS(osEditando.id, input)
      } else {
        await criarOS(input)
      }
      onClose()
    } catch (err) {
      setErro(getErrorMessage(err, 'Erro ao salvar a OS.'))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
      <div className="w-full max-w-lg rounded-2xl border border-border/20 bg-surface shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between border-b border-border/10 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Wrench className="h-5 w-5" />
            </div>
            <h2 className="text-base font-black text-foreground uppercase">{osEditando ? 'Editar Ordem de Serviço' : 'Nova Ordem de Serviço'}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-1.5 text-secondary hover:bg-background hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 uppercase">
          {erro && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-3.5 py-2.5 text-xs font-semibold text-red-400 normal-case">{erro}</div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="osVeiculo">Veículo *</Label>
              <Select id="osVeiculo" value={veiculoId} onChange={(e) => setVeiculoId(e.target.value)} className="text-xs font-bold">
                <option value="">BUSCAR VEÍCULO...</option>
                {veiculosComoOpcoes.map((v) => (
                  <option key={v.id} value={v.id}>{v.nome}</option>
                ))}
              </Select>
            </div>
            <QuickCreateSelect
              label="Centro de Custo *"
              placeholder="Buscar centro de custo..."
              options={centrosCusto}
              value={centroCustoId}
              onChange={setCentroCustoId}
              onCreate={async (nome) => {
                const novo = await onCriarCentroCusto(nome)
                await onRefetchCentrosCusto()
                return novo
              }}
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <Label htmlFor="osTipo" className="normal-case text-[11px]">Tipo</Label>
              <Select id="osTipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoOrdemServico)} className="text-xs font-bold">
                <option value="preventiva">PREVENTIVA</option>
                <option value="corretiva">CORRETIVA</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="osStatus" className="normal-case text-[11px]">Status</Label>
              <Select id="osStatus" value={status} onChange={(e) => setStatus(e.target.value as StatusOrdemServico)} className="text-xs font-bold">
                {(Object.keys(STATUS_OS_INFO) as StatusOrdemServico[]).map((s) => (
                  <option key={s} value={s}>{STATUS_OS_INFO[s].label}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="osPrioridade" className="normal-case text-[11px]">Prioridade</Label>
              <Select id="osPrioridade" value={prioridade} onChange={(e) => setPrioridade(e.target.value as PrioridadeOrdemServico)} className="text-xs font-bold">
                {(Object.keys(PRIORIDADE_OS_INFO) as PrioridadeOrdemServico[]).map((p) => (
                  <option key={p} value={p}>{PRIORIDADE_OS_INFO[p].label}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="osDataEntrada" className="normal-case text-[11px]">Data Entrada</Label>
              <Input id="osDataEntrada" type="date" value={dataEntrada} onChange={(e) => setDataEntrada(e.target.value)} className="text-xs font-bold" />
            </div>
          </div>

          <div>
            <Label htmlFor="osDescricao">Descrição do Serviço *</Label>
            <Input
              id="osDescricao"
              placeholder="EX: TROCA DE ÓLEO E FILTROS"
              value={descricaoServico}
              onChange={(e) => setDescricaoServico(e.target.value.toUpperCase())}
              className="text-xs font-bold"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label htmlFor="osOficina" className="normal-case text-[11px]">Oficina *</Label>
              <Input id="osOficina" value={oficina} onChange={(e) => setOficina(e.target.value.toUpperCase())} className="text-xs font-bold" />
            </div>
            <div>
              <Label htmlFor="osKm" className="normal-case text-[11px]">Km Entrada</Label>
              <Input
                id="osKm"
                type="text"
                inputMode="decimal"
                value={kmEntrada}
                onChange={(e) => setKmEntrada(e.target.value.replace(/[^0-9.,]/g, ''))}
                className="text-xs font-bold font-mono"
              />
            </div>
            <div>
              <Label htmlFor="osValor" className="normal-case text-[11px]">Valor (R$)</Label>
              <Input
                id="osValor"
                type="text"
                inputMode="decimal"
                value={valor}
                onChange={(e) => setValor(e.target.value.replace(/[^0-9.,]/g, ''))}
                className="text-xs font-bold font-mono"
              />
            </div>
          </div>

          <QuickCreateSelect
            label="Fornecedor"
            placeholder="Selecione o fornecedor..."
            options={fornecedores}
            value={fornecedorId}
            onChange={setFornecedorId}
            onCreate={async (nome) => {
              const novo = await onCriarFornecedor(nome)
              await onRefetchFornecedores()
              return novo
            }}
          />

          <div>
            <Label htmlFor="osObs">Observações</Label>
            <Textarea id="osObs" value={observacoes} onChange={(e) => setObservacoes(e.target.value.toUpperCase())} className="text-xs" rows={3} />
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-border/15">
            <Button type="button" variant="secondary" onClick={onClose} disabled={salvando} className="!h-10 px-5 text-xs font-semibold">
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando} className="!h-10 px-6 text-xs font-bold bg-primary hover:bg-primary/90 text-white">
              {salvando ? 'Salvando...' : 'Criar OS'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------------------------
// Modal: Novo Abastecimento
// ----------------------------------------------------------------------------------
function isoParaDatetimeLocal(iso?: string): string {
  if (!iso) return ''
  const data = new Date(iso)
  if (Number.isNaN(data.getTime())) return ''
  const offset = data.getTimezoneOffset()
  return new Date(data.getTime() - offset * 60000).toISOString().slice(0, 16)
}

function datetimeLocalParaIso(valor: string): string | null {
  if (!valor) return null
  const data = new Date(valor)
  return Number.isNaN(data.getTime()) ? null : data.toISOString()
}

function ModalAbastecimento({
  veiculos,
  centrosCusto,
  onRefetchCentrosCusto,
  onCriarCentroCusto,
  onClose,
}: {
  veiculos: ItemFrotaCadastrada[]
  centrosCusto: CadastroSimples[]
  onRefetchCentrosCusto: () => Promise<void>
  onCriarCentroCusto: (nome: string) => Promise<CadastroSimples>
  onClose: () => void
}) {
  const [veiculoId, setVeiculoId] = useState('')
  const [centroCustoId, setCentroCustoId] = useState('')
  const [combustivel, setCombustivel] = useState(COMBUSTIVEIS[0])
  const [dataHora, setDataHora] = useState(isoParaDatetimeLocal(new Date().toISOString()))
  const [odometro, setOdometro] = useState('')
  const [horasMotor, setHorasMotor] = useState('')
  const [postoFornecedor, setPostoFornecedor] = useState('')
  const [volume, setVolume] = useState('')
  const [valorUnitario, setValorUnitario] = useState('')
  const [valorTotal, setValorTotal] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const veiculosComoOpcoes = useMemo(
    () => veiculos.map((v) => ({ id: v.id, nome: `${v.placa}${v.modeloNome ? ` — ${v.modeloNome}` : ''}` })),
    [veiculos],
  )

  function recalcularValorTotal(novoVolume: string, novoValorUnitario: string) {
    const v = parseDecimalPtBr(novoVolume)
    const vu = parseDecimalPtBr(novoValorUnitario)
    if (v > 0 && vu > 0) setValorTotal((v * vu).toFixed(2).replace('.', ','))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const veiculo = veiculos.find((v) => v.id === veiculoId)
    if (!veiculo) {
      setErro('Selecione o veículo.')
      return
    }
    if (!centroCustoId) {
      setErro('Selecione o centro de custo.')
      return
    }
    if (!postoFornecedor.trim()) {
      setErro('Informe o posto/fornecedor.')
      return
    }
    const dataIso = datetimeLocalParaIso(dataHora)
    if (!dataIso) {
      setErro('Informe a data/hora.')
      return
    }
    const centro = centrosCusto.find((c) => c.id === centroCustoId)

    const input: SalvarAbastecimentoInput = {
      veiculoId,
      placa: veiculo.placa,
      veiculoNome: [veiculo.marcaNome, veiculo.modeloNome].filter(Boolean).join(' ') || undefined,
      centroCustoId,
      centroCustoNome: centro?.nome,
      combustivel,
      dataHora: dataIso,
      odometro: odometro.trim() ? parseDecimalPtBr(odometro) : null,
      horasMotor: horasMotor.trim() ? parseDecimalPtBr(horasMotor) : null,
      postoFornecedor: postoFornecedor.trim().toUpperCase(),
      volume: parseDecimalPtBr(volume),
      valorUnitario: valorUnitario.trim() ? parseDecimalPtBr(valorUnitario) : null,
      valorTotal: parseDecimalPtBr(valorTotal),
      origem: 'manual',
      observacoes: observacoes.trim() ? observacoes.trim().toUpperCase() : undefined,
    }

    setSalvando(true)
    setErro(null)
    try {
      await criarAbastecimento(input)
      onClose()
    } catch (err) {
      setErro(getErrorMessage(err, 'Erro ao registrar o abastecimento.'))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
      <div className="w-full max-w-lg rounded-2xl border border-border/20 bg-surface shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between border-b border-border/10 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Fuel className="h-5 w-5" />
            </div>
            <h2 className="text-base font-black text-foreground uppercase">Novo Abastecimento</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-1.5 text-secondary hover:bg-background hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 uppercase">
          {erro && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-3.5 py-2.5 text-xs font-semibold text-red-400 normal-case">{erro}</div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="abVeiculo">Veículo *</Label>
              <Select id="abVeiculo" value={veiculoId} onChange={(e) => setVeiculoId(e.target.value)} className="text-xs font-bold">
                <option value="">BUSCAR VEÍCULO...</option>
                {veiculosComoOpcoes.map((v) => (
                  <option key={v.id} value={v.id}>{v.nome}</option>
                ))}
              </Select>
            </div>
            <QuickCreateSelect
              label="Centro de Custo *"
              placeholder="Buscar centro de custo..."
              options={centrosCusto}
              value={centroCustoId}
              onChange={setCentroCustoId}
              onCreate={async (nome) => {
                const novo = await onCriarCentroCusto(nome)
                await onRefetchCentrosCusto()
                return novo
              }}
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <Label htmlFor="abCombustivel" className="normal-case text-[11px]">Combustível</Label>
              <Select id="abCombustivel" value={combustivel} onChange={(e) => setCombustivel(e.target.value)} className="text-xs font-bold">
                {COMBUSTIVEIS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="abData" className="normal-case text-[11px]">Data/Hora</Label>
              <Input id="abData" type="datetime-local" value={dataHora} onChange={(e) => setDataHora(e.target.value)} className="text-xs font-bold" />
            </div>
            <div>
              <Label htmlFor="abOdometro" className="normal-case text-[11px]">Odômetro (km)</Label>
              <Input
                id="abOdometro"
                type="text"
                inputMode="decimal"
                value={odometro}
                onChange={(e) => setOdometro(e.target.value.replace(/[^0-9.,]/g, ''))}
                className="text-xs font-bold font-mono"
              />
            </div>
            <div>
              <Label htmlFor="abHoras" className="normal-case text-[11px]">Horas Motor</Label>
              <Input
                id="abHoras"
                type="text"
                inputMode="decimal"
                value={horasMotor}
                onChange={(e) => setHorasMotor(e.target.value.replace(/[^0-9.,]/g, ''))}
                className="text-xs font-bold font-mono"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="abPosto" className="normal-case text-[11px]">Posto / Fornecedor *</Label>
            <Input
              id="abPosto"
              placeholder="EX: POSTO BR - KM 120"
              value={postoFornecedor}
              onChange={(e) => setPostoFornecedor(e.target.value.toUpperCase())}
              className="text-xs font-bold"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label htmlFor="abVolume" className="normal-case text-[11px]">Volume (L)</Label>
              <Input
                id="abVolume"
                type="text"
                inputMode="decimal"
                value={volume}
                onChange={(e) => {
                  setVolume(e.target.value.replace(/[^0-9.,]/g, ''))
                  recalcularValorTotal(e.target.value.replace(/[^0-9.,]/g, ''), valorUnitario)
                }}
                className="text-xs font-bold font-mono"
              />
            </div>
            <div>
              <Label htmlFor="abValorUnit" className="normal-case text-[11px]">Valor Unitário (R$)</Label>
              <Input
                id="abValorUnit"
                type="text"
                inputMode="decimal"
                value={valorUnitario}
                onChange={(e) => {
                  setValorUnitario(e.target.value.replace(/[^0-9.,]/g, ''))
                  recalcularValorTotal(volume, e.target.value.replace(/[^0-9.,]/g, ''))
                }}
                className="text-xs font-bold font-mono"
              />
            </div>
            <div>
              <Label htmlFor="abValorTotal" className="normal-case text-[11px]">Valor Total (R$)</Label>
              <Input
                id="abValorTotal"
                type="text"
                inputMode="decimal"
                value={valorTotal}
                onChange={(e) => setValorTotal(e.target.value.replace(/[^0-9.,]/g, ''))}
                className="text-xs font-bold font-mono"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="abObs">Observações</Label>
            <Textarea id="abObs" value={observacoes} onChange={(e) => setObservacoes(e.target.value.toUpperCase())} className="text-xs" rows={2} />
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-border/15">
            <Button type="button" variant="secondary" onClick={onClose} disabled={salvando} className="!h-10 px-5 text-xs font-semibold">
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando} className="!h-10 px-6 text-xs font-bold bg-primary hover:bg-primary/90 text-white">
              {salvando ? 'Salvando...' : 'Registrar Abastecimento'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------------------------
// Modal: Nova Leitura de Odômetro
// ----------------------------------------------------------------------------------
function ModalLeituraOdometro({ veiculos, onClose }: { veiculos: ItemFrotaCadastrada[]; onClose: () => void }) {
  const [veiculoId, setVeiculoId] = useState('')
  const [dataLeitura, setDataLeitura] = useState(isoParaDatetimeLocal(new Date().toISOString()))
  const [quilometragem, setQuilometragem] = useState('')
  const [horasMotor, setHorasMotor] = useState('')
  const [justificativa, setJustificativa] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const veiculosComoOpcoes = useMemo(
    () => veiculos.map((v) => ({ id: v.id, nome: `${v.placa}${v.modeloNome ? ` — ${v.modeloNome}` : ''}` })),
    [veiculos],
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const veiculo = veiculos.find((v) => v.id === veiculoId)
    if (!veiculo) {
      setErro('Selecione o veículo.')
      return
    }
    const dataIso = datetimeLocalParaIso(dataLeitura)
    if (!dataIso) {
      setErro('Informe a data da leitura.')
      return
    }
    const km = parseDecimalPtBr(quilometragem)
    if (!quilometragem.trim() || km <= 0) {
      setErro('Informe a quilometragem.')
      return
    }

    setSalvando(true)
    setErro(null)
    try {
      await criarLeituraOdometro({
        veiculoId,
        placa: veiculo.placa,
        dataLeitura: dataIso,
        quilometragem: km,
        horasMotor: horasMotor.trim() ? parseDecimalPtBr(horasMotor) : null,
        origem: 'manual',
        justificativa: justificativa.trim() ? justificativa.trim().toUpperCase() : undefined,
      })
      onClose()
    } catch (err) {
      setErro(getErrorMessage(err, 'Erro ao registrar a leitura.'))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
      <div className="w-full max-w-md rounded-2xl border border-border/20 bg-surface shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between border-b border-border/10 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Gauge className="h-5 w-5" />
            </div>
            <h2 className="text-base font-black text-foreground uppercase">Nova Leitura de Odômetro</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-1.5 text-secondary hover:bg-background hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 uppercase">
          {erro && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-3.5 py-2.5 text-xs font-semibold text-red-400 normal-case">{erro}</div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="odVeiculo">Veículo *</Label>
              <Select id="odVeiculo" value={veiculoId} onChange={(e) => setVeiculoId(e.target.value)} className="text-xs font-bold">
                <option value="">PESQUISAR VEÍCULO...</option>
                {veiculosComoOpcoes.map((v) => (
                  <option key={v.id} value={v.id}>{v.nome}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="odData" className="normal-case text-[11px]">Data da Leitura *</Label>
              <Input id="odData" type="datetime-local" value={dataLeitura} onChange={(e) => setDataLeitura(e.target.value)} className="text-xs font-bold" required />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="odKm" className="normal-case text-[11px]">Quilometragem (km) *</Label>
              <Input
                id="odKm"
                type="text"
                inputMode="decimal"
                value={quilometragem}
                onChange={(e) => setQuilometragem(e.target.value.replace(/[^0-9.,]/g, ''))}
                className="text-xs font-bold font-mono"
              />
            </div>
            <div>
              <Label htmlFor="odHoras" className="normal-case text-[11px]">Horas de Motor</Label>
              <Input
                id="odHoras"
                type="text"
                inputMode="decimal"
                placeholder="OPCIONAL"
                value={horasMotor}
                onChange={(e) => setHorasMotor(e.target.value.replace(/[^0-9.,]/g, ''))}
                className="text-xs font-bold font-mono"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="odJustificativa">Justificativa</Label>
            <Textarea
              id="odJustificativa"
              placeholder="OPCIONAL — NECESSÁRIA PARA LEITURAS INCONSISTENTES"
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value.toUpperCase())}
              className="text-xs"
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-border/15">
            <Button type="button" variant="secondary" onClick={onClose} disabled={salvando} className="!h-10 px-5 text-xs font-semibold">
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando} className="!h-10 px-6 text-xs font-bold bg-primary hover:bg-primary/90 text-white">
              {salvando ? 'Salvando...' : 'Registrar Leitura'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
