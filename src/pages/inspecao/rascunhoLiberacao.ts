import type { ChecklistItemState, FotoAnexada, InspecaoWizardState } from './types'

/**
 * Rascunho da liberação em andamento, pra quem fecha o app no meio do
 * checklist voltar de onde parou. Fica no IndexedDB do aparelho (não no
 * localStorage) porque as fotos são `File` — o IndexedDB guarda o arquivo
 * em si, e o localStorage só aceitaria texto (e estouraria o limite).
 *
 * As `previewUrl` do tipo blob: morrem quando o app fecha, então não são
 * salvas: ao restaurar, cada uma é recriada a partir do arquivo guardado.
 */

const DB_NOME = 'gvel_rascunhos'
const STORE = 'liberacao'

export interface RascunhoLiberacao {
  state: InspecaoWizardState
  step: number
  salvoEm: string
}

function abrirDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NOME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function comStore<T>(modo: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await abrirDb()
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = fn(db.transaction(STORE, modo).objectStore(STORE))
      req.onsuccess = () => resolve(req.result as T)
      req.onerror = () => reject(req.error)
    })
  } finally {
    db.close()
  }
}

/** Um rascunho por usuário no aparelho. */
function chave(usuario: string | null | undefined) {
  return `liberacao:${(usuario || 'anonimo').toLowerCase().trim()}`
}

const semBlob = (url?: string) => (url && !url.startsWith('blob:') ? url : undefined)

function paraGuardar(state: InspecaoWizardState): InspecaoWizardState {
  const itens: Record<string, ChecklistItemState> = {}
  for (const [k, item] of Object.entries(state.itens)) {
    itens[k] = {
      ...item,
      fotoPreviewUrl: semBlob(item.fotoPreviewUrl),
      fotosExtras: item.fotosExtras?.map((f) => ({ ...f, previewUrl: semBlob(f.previewUrl) ?? '' })),
    }
  }
  return { ...state, itens }
}

function previewDe(file: File | undefined, urlGuardada: string | undefined) {
  return file ? URL.createObjectURL(file) : urlGuardada
}

function aoRestaurar(state: InspecaoWizardState): InspecaoWizardState {
  const itens: Record<string, ChecklistItemState> = {}
  for (const [k, item] of Object.entries(state.itens)) {
    itens[k] = {
      ...item,
      fotoPreviewUrl: previewDe(item.fotoFile, item.fotoPreviewUrl),
      fotosExtras: item.fotosExtras
        ?.map((f): FotoAnexada => ({ ...f, previewUrl: previewDe(f.file, f.previewUrl) ?? '' }))
        .filter((f) => f.previewUrl),
    }
  }
  return { ...state, itens }
}

/** Só vale guardar quando já tem algo preenchido além do estado inicial. */
export function temConteudo(state: InspecaoWizardState) {
  return Boolean(
    state.placa.trim() ||
      state.clienteId ||
      state.numeroOS?.trim() ||
      state.inspetor.trim() ||
      Object.keys(state.itens).length > 0,
  )
}

export async function salvarRascunhoLiberacao(usuario: string | null | undefined, state: InspecaoWizardState, step: number) {
  const rascunho: RascunhoLiberacao = { state: paraGuardar(state), step, salvoEm: new Date().toISOString() }
  await comStore('readwrite', (s) => s.put(rascunho, chave(usuario)))
  return rascunho.salvoEm
}

export async function carregarRascunhoLiberacao(usuario: string | null | undefined): Promise<RascunhoLiberacao | null> {
  const r = await comStore<RascunhoLiberacao | undefined>('readonly', (s) => s.get(chave(usuario)))
  return r ? { ...r, state: aoRestaurar(r.state) } : null
}

export async function apagarRascunhoLiberacao(usuario: string | null | undefined) {
  await comStore('readwrite', (s) => s.delete(chave(usuario)))
}
