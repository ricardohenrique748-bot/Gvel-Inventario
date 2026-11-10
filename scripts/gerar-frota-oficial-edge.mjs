// Gera supabase/functions/_shared/frotaOficial.json a partir da lista oficial
// da frota (src/data/veiculosFrotaPadrao.ts), para as Edge Functions usarem.
//
// As Edge Functions rodam no Supabase (Deno) e não enxergam a pasta src/, por
// isso guardam uma cópia. Rode de novo SEMPRE que mexer na lista oficial e
// antes de publicar a função:
//
//   node scripts/gerar-frota-oficial-edge.mjs
//
// Precisa de Node 23+ (importa .ts direto).

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  FROTA_LEVE_OFICIAL,
  FROTA_PESADA_OFICIAL,
  FROTA_EMBARCADO_OFICIAL,
} from '../src/data/veiculosFrotaPadrao.ts'

const enxuto = (v, tipo) => ({
  id: v.id,
  placa: v.placa,
  tipo,
  situacao: v.situacao,
  responsavel: v.responsavel ?? null,
})

const saida = {
  leve: FROTA_LEVE_OFICIAL.map((v) => enxuto(v, 'leve')),
  pesado: FROTA_PESADA_OFICIAL.map((v) => enxuto(v, v.tipo || 'pesado')),
  embarcado: FROTA_EMBARCADO_OFICIAL.map((v) => enxuto(v, 'embarcado')),
}

const destino = fileURLToPath(new URL('../supabase/functions/_shared/frotaOficial.json', import.meta.url))
writeFileSync(destino, JSON.stringify(saida, null, 2) + '\n')
console.log(
  `frotaOficial.json gerado: ${saida.leve.length} leves, ${saida.pesado.length} rodocaçamba, ${saida.embarcado.length} embarcados.`,
)
