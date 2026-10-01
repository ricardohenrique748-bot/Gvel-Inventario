import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extrairDadosComprovante } from './comprovante.ts'

// Texto real de um comprovante Pix Sicredi (como o pdfjs extrai, uma linha por item).
const PIX_SICREDI = `Comprovante de Pagamento Pix
COMBUSTÍVEL PLACA CUL2E24
Valor: R$ 4.964,44
Realizado em: 01/10/2026 - 14:22:09
Solicitante: VANESSA VEZENFATI DA SILVA
Cooperativa e conta origem: 3003/86339-4
Nome do destinatário: AUTO POSTO ITAMARATI LIBERTY LTDA.
CNPJ do destinatário: 08.942.538/0001-27
Instituição do destinatário: BCO DO BRASIL S.A.
Nome do pagador: Gv Transportes E Serviços Ltda
CNPJ do pagador: 60.787.820/0001-05
ID da transação: E0306504620261001172010s56qDV2fx
Emitido em: 01/10/2026 - 14:27:11`

test('comprovante Pix: placa, valor, data/hora, posto e CNPJ do destinatário', () => {
  const d = extrairDadosComprovante(PIX_SICREDI)
  assert.equal(d.tipo, 'pix')
  assert.equal(d.placa, 'CUL2E24')
  assert.equal(d.valorTotal, 4964.44)
  assert.equal(d.dataHora?.getDate(), 1)
  assert.equal(d.dataHora?.getMonth(), 9)
  assert.equal(d.dataHora?.getHours(), 14)
  assert.equal(d.dataHora?.getMinutes(), 22) // "Realizado em", não "Emitido em"
  assert.equal(d.postoNome, 'AUTO POSTO ITAMARATI LIBERTY LTDA')
  assert.equal(d.postoCnpj, '08.942.538/0001-27') // destinatário, não o pagador
  assert.equal(d.identificador, 'E0306504620261001172010s56qDV2fx')
  // Pix não traz litros: não pode inventar.
  assert.equal(d.litros, undefined)
  assert.equal(d.valorLitro, undefined)
})

test('cupom de posto: litros, preço unitário e produto', () => {
  const d = extrairDadosComprovante(`POSTO EXEMPLO LTDA
CNPJ: 12.345.678/0001-90
Documento Auxiliar da Nota Fiscal de Consumidor Eletrônica
OLEO DIESEL B S10  812,450 L  Vl. Unit 6,110
Valor a pagar R$ 4.964,07
Emissão: 01/10/2026 14:20:01`)
  assert.equal(d.tipo, 'cupom')
  assert.equal(d.litros, 812.45)
  assert.equal(d.valorLitro, 6.11)
  assert.equal(d.combustivel, 'DIESEL S10')
  assert.equal(d.valorTotal, 4964.07)
  assert.equal(d.postoNome, 'POSTO EXEMPLO LTDA')
})
