import type { UseFormRegisterReturn } from 'react-hook-form'

interface Props {
  /** Retorno de `register('situacao')`. */
  registro: UseFormRegisterReturn
  /** Mostra a opção "Sinistro" (hoje só na Localiza). */
  comSinistro?: boolean
}

const OPCOES = [
  { valor: 'operante', rotulo: 'Operante', cor: 'peer-checked:border-status-success peer-checked:bg-status-success/10' },
  { valor: 'inoperante', rotulo: 'Inoperante', cor: 'peer-checked:border-status-danger peer-checked:bg-status-danger/10' },
  { valor: 'sinistro', rotulo: 'Sinistro', cor: 'peer-checked:border-status-warning peer-checked:bg-status-warning/10' },
] as const

/** Escolha da situação do veículo — ver src/lib/situacaoVeiculo.ts. */
export function SituacaoVeiculoRadios({ registro, comSinistro = false }: Props) {
  return (
    <div className="flex gap-3">
      {OPCOES.filter((o) => comSinistro || o.valor !== 'sinistro').map((o) => (
        <label key={o.valor} className="flex-1">
          <input type="radio" value={o.valor} className="peer sr-only" {...registro} />
          <div
            className={`h-12 flex items-center justify-center rounded-xl border border-secondary/30 text-secondary peer-checked:text-foreground cursor-pointer ${o.cor}`}
          >
            {o.rotulo}
          </div>
        </label>
      ))}
    </div>
  )
}
