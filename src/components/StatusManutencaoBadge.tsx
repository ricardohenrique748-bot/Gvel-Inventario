import { Badge } from '@/components/ui/Badge'

export function StatusManutencaoBadge({ status }: { status: { nome: string } | null | undefined }) {
  if (!status) return null
  const nome = status.nome.toLowerCase()
  const tone = nome.includes('corretiva') ? 'danger' : nome.includes('preventiva') ? 'warning' : 'neutral'
  return <Badge tone={tone}>{status.nome}</Badge>
}
