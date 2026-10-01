import { test } from 'node:test'
import assert from 'node:assert/strict'
import { consumirDosTambores, estoqueDisponivel, tamborTravado } from './tambores.ts'

const oleo = { capacidade_maxima: 200, numero_tambor_atual: 1, quantidade_tambores: 4 }

test('baixa que zera o tambor abre o próximo cheio', () => {
  assert.deepEqual(consumirDosTambores({ ...oleo, quantidade_atual: 30 }, 30), {
    quantidade_atual: 200,
    numero_tambor_atual: 2,
    quantidade_tambores: 3,
  })
})

test('baixa maior que o tambor desconta o excedente do próximo', () => {
  assert.deepEqual(consumirDosTambores({ ...oleo, quantidade_atual: 30 }, 50), {
    quantidade_atual: 180,
    numero_tambor_atual: 2,
    quantidade_tambores: 3,
  })
})

test('baixa atravessando mais de um tambor', () => {
  assert.deepEqual(consumirDosTambores({ ...oleo, quantidade_atual: 10 }, 420), {
    quantidade_atual: 190,
    numero_tambor_atual: 4,
    quantidade_tambores: 1,
  })
})

test('tambor travado em zero (caso do GV 1) destrava com consumo 0', () => {
  const travado = { ...oleo, quantidade_atual: 0 }
  assert.ok(tamborTravado(travado))
  assert.deepEqual(consumirDosTambores(travado, 0), { quantidade_atual: 200, numero_tambor_atual: 2, quantidade_tambores: 3 })
})

test('sem reserva para em zero e não inventa estoque', () => {
  assert.deepEqual(consumirDosTambores({ ...oleo, quantidade_tambores: 0, quantidade_atual: 20 }, 50), {
    quantidade_atual: 0,
    numero_tambor_atual: 1,
    quantidade_tambores: 0,
  })
})

test('estoque disponível soma tambor aberto e reserva', () => {
  assert.equal(estoqueDisponivel({ ...oleo, quantidade_atual: 0 }), 800)
  assert.equal(estoqueDisponivel({ quantidade_atual: 12, capacidade_maxima: null }), 12)
})
