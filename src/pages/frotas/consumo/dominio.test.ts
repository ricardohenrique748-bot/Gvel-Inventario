// Testes do serviço de domínio do consumo. Rodar com: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  calcularCiclos,
  consolidar,
  validarAbastecimento,
  detectarQuedaContinua,
  CONFIG_PADRAO,
  type AbastecimentoDominio,
  type Ciclo,
} from './dominio.ts'

let seq = 0
function ab(p: Partial<AbastecimentoDominio> & { odometro: number; litros: number; dia: number }): AbastecimentoDominio {
  const { dia, ...resto } = p
  seq++
  return {
    id: `a${String(seq).padStart(4, '0')}`,
    placa: 'ABC1234',
    dataHora: new Date(Date.UTC(2026, 8, dia, 12)).toISOString(),
    valorTotal: p.litros * 6,
    valorLitro: 6,
    tanqueCheio: false,
    combustivel: 'DIESEL S10',
    status: 'valido',
    ...resto,
  }
}

const perto = (a: number | undefined, b: number, casas = 2) =>
  assert.ok(a != null && Math.abs(a - b) < 10 ** -casas, `esperado ${b}, veio ${a}`)

test('1. ciclo simples tanque cheio → tanque cheio', () => {
  const ciclos = calcularCiclos([
    ab({ dia: 1, odometro: 100_000, litros: 300, tanqueCheio: true }),
    ab({ dia: 3, odometro: 100_600, litros: 310, tanqueCheio: true }),
  ])
  const fechado = ciclos.find((c) => c.status === 'fechado')!
  assert.equal(fechado.km, 600)
  assert.equal(fechado.litros, 310) // o tanque cheio inicial NÃO entra
  perto(fechado.kmL, 600 / 310)
})

test('2. ciclo com abastecimentos parciais (exemplo da especificação)', () => {
  const ciclos = calcularCiclos([
    ab({ dia: 1, odometro: 100_000, litros: 300, tanqueCheio: true }),
    ab({ dia: 2, odometro: 100_400, litros: 150 }),
    ab({ dia: 3, odometro: 100_850, litros: 180 }),
    ab({ dia: 4, odometro: 101_200, litros: 300, tanqueCheio: true }),
  ])
  const c = ciclos[0]
  assert.equal(c.status, 'fechado')
  assert.equal(c.km, 1200)
  assert.equal(c.litros, 630)
  perto(c.kmL, 1.9047, 3)
})

test('3. vários abastecimentos parciais entram todos', () => {
  const ciclos = calcularCiclos([
    ab({ dia: 1, odometro: 50_000, litros: 400, tanqueCheio: true }),
    ab({ dia: 2, odometro: 50_350, litros: 200 }),
    ab({ dia: 3, odometro: 50_700, litros: 150 }),
    ab({ dia: 4, odometro: 51_050, litros: 180 }),
    ab({ dia: 5, odometro: 51_600, litros: 300, tanqueCheio: true }),
  ])
  assert.equal(ciclos[0].litros, 830)
  assert.equal(ciclos[0].km, 1600)
})

test('4. ciclo aberto não vira média oficial', () => {
  const ciclos = calcularCiclos([
    ab({ dia: 1, odometro: 10_000, litros: 300, tanqueCheio: true }),
    ab({ dia: 2, odometro: 10_400, litros: 150 }),
    ab({ dia: 3, odometro: 10_800, litros: 150 }),
  ])
  assert.equal(ciclos.length, 1)
  assert.equal(ciclos[0].status, 'aberto')
  assert.equal(ciclos[0].kmL, undefined)
  assert.ok(ciclos[0].kmLEstimado != null)
  assert.equal(consolidar(ciclos).kmL, undefined)
})

test('5. odômetro menor que o último bloqueia', () => {
  const existentes = [ab({ dia: 1, odometro: 100_000, litros: 300, tanqueCheio: true })]
  const r = validarAbastecimento(
    { id: 'novo', placa: 'ABC1234', dataHora: new Date(Date.UTC(2026, 8, 2)).toISOString(), odometro: 99_000, litros: 100, tanqueCheio: false, combustivel: 'DIESEL S10' },
    existentes,
    undefined,
    CONFIG_PADRAO,
  )
  assert.equal(r.bloqueios.length, 1)
})

test('6. litros acima da capacidade vai pra revisão', () => {
  const r = validarAbastecimento(
    { id: 'novo', placa: 'ABC1234', dataHora: new Date().toISOString(), odometro: 1000, litros: 530, tanqueCheio: true, combustivel: 'DIESEL S10' },
    [],
    { capacidadeTanque: 500 },
    CONFIG_PADRAO,
  )
  assert.ok(r.revisao.some((x) => x.tipo === 'LITROS_ACIMA_CAPACIDADE'))
  const dentro = validarAbastecimento(
    { id: 'novo2', placa: 'ABC1234', dataHora: new Date().toISOString(), odometro: 1000, litros: 520, tanqueCheio: true, combustivel: 'DIESEL S10' },
    [],
    { capacidadeTanque: 500 },
    CONFIG_PADRAO,
  )
  assert.ok(!dentro.revisao.some((x) => x.tipo === 'LITROS_ACIMA_CAPACIDADE'))
})

test('7. horímetro inconsistente', () => {
  const existentes = [ab({ dia: 1, odometro: 100_000, horimetro: 5_000, litros: 300, tanqueCheio: true })]
  const base = { id: 'novo', placa: 'ABC1234', dataHora: new Date(Date.UTC(2026, 8, 2)).toISOString(), litros: 100, tanqueCheio: false, combustivel: 'DIESEL S10' }
  const menor = validarAbastecimento({ ...base, odometro: 100_300, horimetro: 4_990 }, existentes, undefined, CONFIG_PADRAO)
  assert.ok(menor.revisao.some((x) => x.tipo === 'HORIMETRO_INCONSISTENTE'))
  const rapido = validarAbastecimento({ ...base, odometro: 101_000, horimetro: 5_002 }, existentes, undefined, CONFIG_PADRAO)
  assert.ok(rapido.revisao.some((x) => x.tipo === 'HORIMETRO_INCONSISTENTE'))
  const ok = validarAbastecimento({ ...base, odometro: 100_400, horimetro: 5_010 }, existentes, undefined, CONFIG_PADRAO)
  assert.ok(!ok.revisao.some((x) => x.tipo === 'HORIMETRO_INCONSISTENTE'))
})

test('8. consumo abaixo da meta gera anomalia', () => {
  const ciclos = calcularCiclos(
    [
      ab({ dia: 1, odometro: 0, litros: 300, tanqueCheio: true }),
      ab({ dia: 2, odometro: 500, litros: 330, tanqueCheio: true }), // 1,52 km/L
    ],
    { meta: { metaKmL: 2 } },
  )
  assert.ok(ciclos[0].anomalias.includes('CONSUMO_ABAIXO_META'))
  assert.equal(ciclos[0].semaforo, 'vermelho')
})

test('9. consumo acima da meta (suspeita de erro) gera anomalia', () => {
  const ciclos = calcularCiclos(
    [
      ab({ dia: 1, odometro: 0, litros: 300, tanqueCheio: true }),
      ab({ dia: 2, odometro: 1000, litros: 300, tanqueCheio: true }), // 3,33 km/L
    ],
    { meta: { metaKmL: 2 } },
  )
  assert.ok(ciclos[0].anomalias.includes('CONSUMO_ACIMA_META'))
})

test('10. queda contínua em três ciclos', () => {
  const ciclos = calcularCiclos([
    ab({ dia: 1, odometro: 0, litros: 300, tanqueCheio: true }),
    ab({ dia: 2, odometro: 615, litros: 300, tanqueCheio: true }), // 2,05
    ab({ dia: 3, odometro: 1188, litros: 300, tanqueCheio: true }), // 1,91
    ab({ dia: 4, odometro: 1716, litros: 300, tanqueCheio: true }), // 1,76
  ])
  assert.ok(detectarQuedaContinua(ciclos, 3))
  assert.ok(ciclos[2].anomalias.includes('QUEDA_CONTINUA'))
  assert.ok(!ciclos[1].anomalias.includes('QUEDA_CONTINUA'))
})

test('11. duplicidade: mesma placa, mesmos litros, até 10 minutos', () => {
  const t = Date.UTC(2026, 8, 5, 10, 0)
  const existentes: AbastecimentoDominio[] = [
    { ...ab({ dia: 5, odometro: 1000, litros: 250 }), dataHora: new Date(t).toISOString() },
  ]
  const base = { id: 'novo', placa: 'ABC-1234', odometro: 1000, litros: 250, tanqueCheio: false, combustivel: 'DIESEL S10' }
  const dup = validarAbastecimento({ ...base, dataHora: new Date(t + 6 * 60_000).toISOString() }, existentes, undefined, CONFIG_PADRAO)
  assert.ok(dup.revisao.some((x) => x.tipo === 'POSSIVEL_DUPLICIDADE'))
  const longe = validarAbastecimento({ ...base, dataHora: new Date(t + 30 * 60_000).toISOString() }, existentes, undefined, CONFIG_PADRAO)
  assert.ok(!longe.revisao.some((x) => x.tipo === 'POSSIVEL_DUPLICIDADE'))
})

test('12. ARLA 32 não entra no cálculo de km/L', () => {
  const ciclos = calcularCiclos([
    ab({ dia: 1, odometro: 100_000, litros: 300, tanqueCheio: true }),
    ab({ dia: 2, odometro: 100_400, litros: 40, combustivel: 'ARLA 32', tanqueCheio: true }),
    ab({ dia: 3, odometro: 101_200, litros: 630, tanqueCheio: true }),
  ])
  assert.equal(ciclos[0].litros, 630)
  assert.equal(ciclos[0].km, 1200)
})

test('13. consolidado de vários ciclos usa km total / litros total', () => {
  const ciclos = calcularCiclos([
    ab({ dia: 1, odometro: 0, litros: 300, tanqueCheio: true }),
    ab({ dia: 2, odometro: 1000, litros: 500, tanqueCheio: true }), // 2,0
    ab({ dia: 3, odometro: 1300, litros: 100, tanqueCheio: true }), // 3,0
  ])
  const cons = consolidar(ciclos)
  assert.equal(cons.km, 1300)
  assert.equal(cons.litros, 600)
  perto(cons.kmL, 1300 / 600) // 2,1667 — não (2 + 3) / 2 = 2,5
})

test('14. média da frota é km total / litros total, nunca média das médias', () => {
  const v1 = calcularCiclos([
    ab({ placa: 'AAA1111', dia: 1, odometro: 0, litros: 100, tanqueCheio: true }),
    ab({ placa: 'AAA1111', dia: 2, odometro: 1800, litros: 1000, tanqueCheio: true }), // 1,8
  ])
  const v2 = calcularCiclos([
    ab({ placa: 'BBB2222', dia: 1, odometro: 0, litros: 100, tanqueCheio: true }),
    ab({ placa: 'BBB2222', dia: 2, odometro: 220, litros: 100, tanqueCheio: true }), // 2,2
  ])
  const frota = consolidar([...v1, ...v2] as Ciclo[])
  perto(frota.kmL, 2020 / 1100) // 1,836
  assert.notEqual(Number(frota.kmL!.toFixed(2)), 2.0)
})
