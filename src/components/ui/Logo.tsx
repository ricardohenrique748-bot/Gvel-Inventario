import { cn } from '@/lib/cn'
import logoIcon from '@/assets/logo-icon.png'
import { useEmpresa } from '@/contexts/EmpresaContext'

interface LogoProps {
  className?: string
  showText?: boolean
  size?: 'sm' | 'md' | 'lg'
  stacked?: boolean
}

const sizes = {
  sm: { icon: 'h-8 w-8', gap: 'gap-2', title: 'text-sm', subtitle: 'text-[9px]', badgeText: 'text-[11px]' },
  md: { icon: 'h-11 w-11', gap: 'gap-2.5', title: 'text-base', subtitle: 'text-[10px]', badgeText: 'text-sm' },
  lg: { icon: 'h-20 w-20', gap: 'gap-3.5', title: 'text-2xl', subtitle: 'text-xs', badgeText: 'text-2xl' },
}

// A marca "GV" vermelha/cromada é especificamente da GVEL — não faz sentido
// aparecer pra nenhuma outra empresa que ainda não subiu a própria logo.
const GVEL_COMPANY_ID = '0923c894-85ca-45c1-ba1b-3124d19b4d65'

function iniciaisEmpresa(nome: string): string {
  const palavras = nome.trim().split(/\s+/).filter(Boolean)
  if (palavras.length === 0) return '?'
  if (palavras.length === 1) return palavras[0].slice(0, 2).toUpperCase()
  return (palavras[0][0] + palavras[1][0]).toUpperCase()
}

export function Logo({ className, showText = true, size = 'md', stacked = false }: LogoProps) {
  const s = sizes[size]
  const { empresaAtiva } = useEmpresa()
  const nomeEmpresa = empresaAtiva?.nome ?? 'Gestão Multiempresa'
  const sistemaLabel = empresaAtiva?.sistemaLabel ?? 'ESTRUTURA GVEL'
  // Empresa com logo própria cadastrada usa ela. Sem logo: a GVEL usa a
  // marca padrão (é a dela mesmo); qualquer outra empresa usa um selo
  // genérico com a cor cadastrada, em vez de herdar a marca da GVEL.
  const usaMarcaPadraoGvel = !empresaAtiva || empresaAtiva.id === GVEL_COMPANY_ID

  return (
    <div className={cn(stacked ? 'flex flex-col items-center' : 'flex items-center min-w-0 w-full overflow-hidden', s.gap, className)}>
      {empresaAtiva?.logo ? (
        <img src={empresaAtiva.logo} alt={nomeEmpresa} className={cn(s.icon, 'shrink-0 object-contain rounded-lg')} />
      ) : usaMarcaPadraoGvel ? (
        <img src={logoIcon} alt={nomeEmpresa} className={cn(s.icon, 'shrink-0 object-contain')} />
      ) : (
        <div
          className={cn(s.icon, s.badgeText, 'shrink-0 flex items-center justify-center rounded-lg font-black text-white shadow-md')}
          style={{ backgroundColor: empresaAtiva.cor }}
        >
          {iniciaisEmpresa(sistemaLabel || nomeEmpresa)}
        </div>
      )}
      {showText && (
        <div className={cn('flex flex-col leading-tight min-w-0 flex-1 overflow-hidden max-w-full', stacked ? 'items-center text-center' : 'justify-center text-left')}>
          <p className={cn('font-bold tracking-wide text-foreground truncate block max-w-full', s.title)}>
            {sistemaLabel}
          </p>
          <p
            className={cn(
              'mt-0.5 font-medium uppercase tracking-wider text-secondary truncate block max-w-full',
              s.subtitle,
            )}
          >
            {nomeEmpresa}
          </p>
        </div>
      )}
    </div>
  )
}
