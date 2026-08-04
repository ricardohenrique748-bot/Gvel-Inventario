import { differenceInMinutes, format, formatDistanceStrict } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function formatDateTime(iso: string | null | undefined) {
  if (!iso) return '—'
  return format(new Date(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
}

export function formatDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return format(new Date(iso), 'dd/MM/yyyy', { locale: ptBR })
}

export function formatPermanencia(entrada: string, saida?: string | null) {
  const fim = saida ? new Date(saida) : new Date()
  return formatDistanceStrict(new Date(entrada), fim, { locale: ptBR, unit: undefined })
}

export function permanenciaEmMinutos(entrada: string, saida?: string | null) {
  const fim = saida ? new Date(saida) : new Date()
  return differenceInMinutes(fim, new Date(entrada))
}

export function formatMinutosParaTexto(minutos: number) {
  const horas = Math.floor(minutos / 60)
  const min = minutos % 60
  if (horas === 0) return `${min}min`
  const dias = Math.floor(horas / 24)
  const horasRestantes = horas % 24
  if (dias === 0) return `${horas}h ${min}min`
  return `${dias}d ${horasRestantes}h`
}

export function nowLocalInputValue() {
  return toLocalInputValue(new Date().toISOString())
}

export function toLocalInputValue(iso: string | null | undefined) {
  if (!iso) return ''
  const date = new Date(iso)
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 16)
}
