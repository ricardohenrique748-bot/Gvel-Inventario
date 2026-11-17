import { FotoInput } from '@/components/FotoInput'
import { Label } from '@/components/ui/Input'
import { ANGULOS_FOTO, angulosObrigatoriosSaida, type AnguloFoto } from '@/lib/fotos'
import type { TipoVeiculo } from '@/lib/types'

export type FotosSelecionadas = Partial<Record<AnguloFoto, { file: File; previewUrl: string }>>

/** Mensagem de erro com as fotos que faltam, ou null se estão todas lá. */
export function fotosFaltando(tipo: TipoVeiculo | null | undefined, fotos: FotosSelecionadas): string | null {
  const faltando = angulosObrigatoriosSaida(tipo).filter((campo) => !fotos[campo])
  if (faltando.length === 0) return null
  const nomes = ANGULOS_FOTO.filter((a) => faltando.includes(a.campo)).map((a) => a.label.toLowerCase())
  return `Tire as fotos do veículo: ${nomes.join(', ')}.`
}

interface Props {
  titulo: string
  tipo: TipoVeiculo | null | undefined
  fotos: FotosSelecionadas
  onChange: (fotos: FotosSelecionadas) => void
  /** Texto no lugar de "(obrigatório)" quando as fotos não são exigidas. */
  avisoOpcional?: string
}

/** Fotos obrigatórias do veículo (frente, laterais, traseira e painel — carreta sem painel). */
export function FotosObrigatoriasVeiculo({ titulo, tipo, fotos, onChange, avisoOpcional }: Props) {
  const obrigatorios = angulosObrigatoriosSaida(tipo)
  return (
    <div>
      <Label>
        {titulo}
        {avisoOpcional ? (
          <span className="ml-1.5 text-xs text-secondary font-semibold normal-case">({avisoOpcional})</span>
        ) : (
          <span className="ml-1.5 text-xs text-status-danger font-semibold normal-case">(obrigatório)</span>
        )}
      </Label>
      <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ANGULOS_FOTO.filter(({ campo }) => obrigatorios.includes(campo)).map(({ campo, label }) => (
          <FotoInput
            key={campo}
            label={label}
            previewUrl={fotos[campo]?.previewUrl}
            onSelect={(file, previewUrl) => onChange({ ...fotos, [campo]: { file, previewUrl } })}
            onRemove={() => {
              const next = { ...fotos }
              delete next[campo]
              onChange(next)
            }}
          />
        ))}
      </div>
    </div>
  )
}
