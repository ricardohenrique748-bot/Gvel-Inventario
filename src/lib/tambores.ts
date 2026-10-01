// Regra única de troca de tambor dos insumos (óleo, aditivos...) em barril.
// Toda alteração de estoque passa por aqui: quando o tambor aberto esvazia
// e existe tambor de reserva, o próximo entra sozinho (numeração +1, reserva
// −1) e o que faltou na baixa sai dele. Código puro, testado com `npm test`.

interface EstadoTambores {
  quantidade_atual: number
  capacidade_maxima?: number | null
  quantidade_tambores?: number | null
  numero_tambor_atual?: number | null
}

export interface CamposTambores {
  quantidade_atual: number
  numero_tambor_atual?: number
  quantidade_tambores?: number
}

const arredondar3 = (v: number) => Math.round(v * 1000) / 1000

/** Item controlado por tambor (tem capacidade por recipiente). */
export function usaTambores(item: EstadoTambores): boolean {
  return Boolean(item.capacidade_maxima && item.capacidade_maxima > 0)
}

/** Tudo o que dá pra baixar: tambor aberto + tambores cheios da reserva. */
export function estoqueDisponivel(item: EstadoTambores): number {
  const reserva = usaTambores(item) ? (item.quantidade_tambores || 0) * item.capacidade_maxima! : 0
  return arredondar3(Math.max(0, item.quantidade_atual) + reserva)
}

/**
 * Desconta `consumo` (pode ser 0, só pra destravar um tambor zerado) e abre
 * quantos tambores de reserva forem necessários. Sem reserva, para em zero.
 */
export function consumirDosTambores(item: EstadoTambores, consumo: number): CamposTambores {
  let atual = arredondar3(item.quantidade_atual - consumo)
  if (!usaTambores(item)) return { quantidade_atual: Math.max(0, atual) }

  const capacidade = item.capacidade_maxima!
  let numero = item.numero_tambor_atual || 1
  let reserva = item.quantidade_tambores || 0
  while (atual <= 0 && reserva > 0) {
    atual = arredondar3(atual + capacidade)
    numero++
    reserva--
  }
  return { quantidade_atual: Math.max(0, atual), numero_tambor_atual: numero, quantidade_tambores: reserva }
}

/** Tambor aberto vazio com reserva parada — estado que não deveria existir. */
export function tamborTravado(item: EstadoTambores): boolean {
  return usaTambores(item) && item.quantidade_atual <= 0 && (item.quantidade_tambores || 0) > 0
}
