import type { FotosEntrada, RegistrarEntradaInput } from '@/hooks/useMovimentacoes'

// Guarda localmente (IndexedDB, sobrevive a fechar o app) uma entrada que não
// conseguiu ser enviada por falha de conexão — incluindo os arquivos de foto —
// pra poder tentar de novo depois sem o usuário ter que preencher tudo de novo
// nem tirar as fotos outra vez.

const DB_NAME = 'gvel_rascunhos_db'
const DB_VERSION = 1
const STORE_NAME = 'entradas'

export interface RascunhoEntrada {
  id: string
  criadoEm: string
  resumo: string
  input: RegistrarEntradaInput
  fotos: FotosEntrada
  ultimoErro?: string
}

function abrirBanco(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB não disponível neste ambiente.'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function salvarRascunhoEntrada(
  input: RegistrarEntradaInput,
  fotos: FotosEntrada,
  resumo: string,
  ultimoErro?: string,
): Promise<string> {
  const db = await abrirBanco()
  const id = `rascunho_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const registro: RascunhoEntrada = { id, criadoEm: new Date().toISOString(), resumo, input, fotos, ultimoErro }
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(registro)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
  return id
}

export async function listarRascunhosEntrada(): Promise<RascunhoEntrada[]> {
  const db = await abrirBanco()
  const registros = await new Promise<RascunhoEntrada[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).getAll()
    req.onsuccess = () => resolve(req.result || [])
    req.onerror = () => reject(req.error)
  })
  db.close()
  return registros.sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime())
}

export async function removerRascunhoEntrada(id: string): Promise<void> {
  const db = await abrirBanco()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export async function atualizarErroRascunhoEntrada(id: string, erro: string): Promise<void> {
  const db = await abrirBanco()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const getReq = store.get(id)
    getReq.onsuccess = () => {
      const registro = getReq.result as RascunhoEntrada | undefined
      if (registro) {
        registro.ultimoErro = erro
        store.put(registro)
      }
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export async function contarRascunhosEntrada(): Promise<number> {
  try {
    const registros = await listarRascunhosEntrada()
    return registros.length
  } catch {
    return 0
  }
}
