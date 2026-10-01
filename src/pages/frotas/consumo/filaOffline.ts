import { useCallback, useEffect, useState } from 'react'
import {
  registrarAbastecimento,
  type NovoAbastecimentoInput,
} from '@/hooks/useConsumoCombustivel'
import type { ConfigConsumo, MetaVeiculo } from './dominio'
import { erroConsumo } from './erros'
import { getErrorMessage } from '@/lib/erros'

// Abastecimento registrado sem internet fica salvo no aparelho com status
// "pendente de sincronização" e sobe sozinho quando a conexão volta. O `id`
// é gerado no aparelho e o envio é idempotente por ele (upsert + checagem
// prévia), então reenviar nunca duplica. A validação roda de novo na hora
// de sincronizar, contra o estado atual do banco.

const STORAGE_KEY = 'gvel_abastecimentos_pendentes_v1'

export interface ItemFilaOffline {
  input: NovoAbastecimentoInput
  criadoEm: string
  /** Erro definitivo (ex.: odômetro bloqueado) — fica parado até alguém resolver. */
  erro?: string
}

function ler(): ItemFilaOffline[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as ItemFilaOffline[]) : []
  } catch {
    return []
  }
}

function gravar(itens: ItemFilaOffline[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(itens))
  } catch (err) {
    // Sem espaço (fotos grandes): tenta de novo sem as fotos, pra não perder o registro.
    console.warn('Fila offline sem espaço, salvando sem fotos:', err)
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(itens.map((i) => ({ ...i, input: { ...i.input, fotoCupom: undefined, fotoPainel: undefined } }))),
    )
  }
  window.dispatchEvent(new Event('consumo_fila_offline_updated'))
}

export function enfileirarAbastecimento(input: NovoAbastecimentoInput) {
  const itens = ler().filter((i) => i.input.id !== input.id)
  itens.push({ input, criadoEm: new Date().toISOString() })
  gravar(itens)
}

export function removerDaFila(id: string) {
  gravar(ler().filter((i) => i.input.id !== id))
}

/** Erro de rede (sem internet / servidor inacessível), em oposição a erro de validação. */
export function isErroDeRede(err: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true
  const msg = getErrorMessage(err, '')
  return /failed to fetch|network|load failed|timeout|fetch/i.test(msg)
}

let sincronizando = false

export async function sincronizarFila(
  metaDaPlaca: (placa: string) => MetaVeiculo | undefined,
  config: ConfigConsumo,
): Promise<{ enviados: number; comErro: number }> {
  if (sincronizando || (typeof navigator !== 'undefined' && !navigator.onLine)) return { enviados: 0, comErro: 0 }
  sincronizando = true
  let enviados = 0
  let comErro = 0
  try {
    for (const item of ler()) {
      if (item.erro) {
        comErro++
        continue
      }
      try {
        await registrarAbastecimento(item.input, metaDaPlaca(item.input.placa), config)
        removerDaFila(item.input.id)
        enviados++
      } catch (err) {
        if (isErroDeRede(err)) break
        comErro++
        const msg = erroConsumo(err, 'Falha ao enviar.')
        gravar(ler().map((i) => (i.input.id === item.input.id ? { ...i, erro: msg } : i)))
      }
    }
  } finally {
    sincronizando = false
  }
  return { enviados, comErro }
}

export function useFilaOffline(metaDaPlaca: (placa: string) => MetaVeiculo | undefined, config: ConfigConsumo) {
  const [itens, setItens] = useState<ItemFilaOffline[]>(() => ler())

  const sincronizar = useCallback(() => sincronizarFila(metaDaPlaca, config), [metaDaPlaca, config])

  useEffect(() => {
    const atualizar = () => setItens(ler())
    const online = () => {
      sincronizar()
    }
    window.addEventListener('consumo_fila_offline_updated', atualizar)
    window.addEventListener('online', online)
    // Tenta subir o que ficou pendente assim que a tela abre.
    sincronizar()
    return () => {
      window.removeEventListener('consumo_fila_offline_updated', atualizar)
      window.removeEventListener('online', online)
    }
  }, [sincronizar])

  return { itens, sincronizar, remover: removerDaFila }
}
