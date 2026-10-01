import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import type { Semaforo, StatusCiclo } from './dominio'
import type { StatusAbastecimento } from './dominio'

export interface VeiculoConsumo {
  id: string
  /** normalizada (ABC1234) */
  placa: string
  nome: string
}

/** Aceita "1.234,5" e "1234.5". */
export function parseDecimal(v: string): number | undefined {
  let s = v.trim().replace(/[^\d,.-]/g, '')
  if (!s) return undefined
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  const n = Number(s)
  return Number.isFinite(n) ? n : undefined
}

export const fmtNum =(v: number | undefined, casas = 0) =>
  v == null || !Number.isFinite(v) ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })

export const fmtKmL = (v: number | undefined) => (v == null ? '—' : `${fmtNum(v, 2)} km/L`)
export const fmtMoeda = (v: number | undefined) =>
  v == null || !Number.isFinite(v) ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
export const fmtPct = (v: number | undefined) => (v == null ? '—' : `${v > 0 ? '+' : ''}${fmtNum(v, 1)}%`)

export function fmtDataHora(iso: string | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function fmtData(iso: string | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR')
}

// Semáforo sempre com ícone + texto (nunca só cor).
const SEMAFORO: Record<Semaforo, { tone: 'success' | 'warning' | 'danger'; label: string; Icon: typeof CheckCircle2 }> = {
  verde: { tone: 'success', label: 'Na meta', Icon: CheckCircle2 },
  amarelo: { tone: 'warning', label: 'Atenção', Icon: AlertTriangle },
  vermelho: { tone: 'danger', label: 'Fora da meta', Icon: XCircle },
}

export function SemaforoBadge({ semaforo }: { semaforo?: Semaforo }) {
  if (!semaforo) return <span className="text-xs text-secondary">Sem meta</span>
  const s = SEMAFORO[semaforo]
  return (
    <Badge tone={s.tone} className="whitespace-nowrap">
      <s.Icon className="h-3 w-3" /> {s.label}
    </Badge>
  )
}

const STATUS_CICLO: Record<StatusCiclo, { tone: 'success' | 'warning' | 'neutral' | 'danger'; label: string }> = {
  fechado: { tone: 'success', label: 'Fechado' },
  aberto: { tone: 'neutral', label: 'Aberto' },
  invalidado: { tone: 'danger', label: 'Invalidado' },
}

export function StatusCicloBadge({ status }: { status: StatusCiclo }) {
  const s = STATUS_CICLO[status]
  return <Badge tone={s.tone}>{s.label}</Badge>
}

const STATUS_ABAST: Record<StatusAbastecimento, { tone: 'success' | 'warning' | 'danger'; label: string }> = {
  valido: { tone: 'success', label: 'Válido' },
  pendente_revisao: { tone: 'warning', label: 'Revisão' },
  invalidado: { tone: 'danger', label: 'Invalidado' },
}

export function StatusAbastecimentoBadge({ status }: { status: StatusAbastecimento }) {
  const s = STATUS_ABAST[status]
  return <Badge tone={s.tone}>{s.label}</Badge>
}

export type PeriodoPreset = 'mes' | '30' | '90' | '180' | '365' | 'personalizado'

export interface Periodo {
  inicio: string
  fim: string
}

export function periodoDoPreset(preset: PeriodoPreset, personalizado?: Periodo): Periodo {
  const fim = new Date()
  fim.setHours(23, 59, 59, 999)
  if (preset === 'personalizado' && personalizado) return personalizado
  const inicio = new Date()
  inicio.setHours(0, 0, 0, 0)
  if (preset === 'mes') inicio.setDate(1)
  else inicio.setDate(inicio.getDate() - Number(preset === 'personalizado' ? 30 : preset))
  return { inicio: inicio.toISOString(), fim: fim.toISOString() }
}

export const PERIODO_LABEL: Record<PeriodoPreset, string> = {
  mes: 'Mês atual',
  '30': 'Últimos 30 dias',
  '90': 'Últimos 90 dias',
  '180': 'Últimos 6 meses',
  '365': 'Últimos 12 meses',
  personalizado: 'Personalizado',
}

export function dentroDoPeriodo(iso: string | undefined, p: Periodo) {
  if (!iso) return false
  const t = new Date(iso).getTime()
  return t >= new Date(p.inicio).getTime() && t <= new Date(p.fim).getTime()
}

/** Cabeçalho de seção padrão das sub-abas. */
export function SecaoTitulo({ titulo, descricao, acoes }: { titulo: string; descricao?: string; acoes?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-sm font-black uppercase tracking-wide text-foreground">{titulo}</h2>
        {descricao && <p className="mt-0.5 text-xs normal-case text-secondary">{descricao}</p>}
      </div>
      {acoes}
    </div>
  )
}
