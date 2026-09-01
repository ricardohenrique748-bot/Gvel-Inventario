/**
 * Cálculo de minutos "úteis" entre dois instantes, usado tanto no card de
 * checklist quanto no Indicador de Performance — mantém as duas telas
 * sempre batendo com a mesma regra.
 */

const HORA_INICIO_EXPEDIENTE = 8
const HORA_FIM_EXPEDIENTE = 18

/** Domingo (0) e sábado (6) — a oficina não trabalha no fim de semana. */
export function ehFimDeSemana(data: Date): boolean {
  const dia = data.getDay()
  return dia === 0 || dia === 6
}

/**
 * Soma os minutos entre duas datas contando só o tempo dentro do
 * expediente (08h–18h) em dias úteis. Uma atividade apontada como "em
 * andamento" que fica esquecida por vários dias sem ser pausada ou
 * finalizada não deve virar dezenas de horas de trabalho — só a janela de
 * expediente realmente disponível em cada dia útil do intervalo é contada.
 */
export function minutosUteis(inicio: Date, fim: Date): number {
  if (fim <= inicio) return 0
  let totalMs = 0

  let cursor = new Date(inicio)
  cursor.setHours(0, 0, 0, 0)
  while (cursor < fim) {
    const proximoDia = new Date(cursor)
    proximoDia.setDate(proximoDia.getDate() + 1)

    if (!ehFimDeSemana(cursor)) {
      const expedienteInicio = new Date(cursor)
      expedienteInicio.setHours(HORA_INICIO_EXPEDIENTE, 0, 0, 0)
      const expedienteFim = new Date(cursor)
      expedienteFim.setHours(HORA_FIM_EXPEDIENTE, 0, 0, 0)

      const inicioSobreposicao = inicio > expedienteInicio ? inicio : expedienteInicio
      const fimSobreposicao = fim < expedienteFim ? fim : expedienteFim

      if (fimSobreposicao > inicioSobreposicao) {
        totalMs += fimSobreposicao.getTime() - inicioSobreposicao.getTime()
      }
    }

    cursor = proximoDia
  }

  return Math.max(0, Math.round(totalMs / 60000))
}
