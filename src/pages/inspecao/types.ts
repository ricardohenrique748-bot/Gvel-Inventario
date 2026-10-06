import type { ModeloInspecao, StatusChecklist, StatusLiberacao, TipoVeiculo } from '@/lib/types'
import type { ChecklistItemDef } from '@/data/checklistSchema'

export interface ChecklistItemState {
  status?: StatusChecklist
  observacao?: string
  fotoFile?: File
  fotoPreviewUrl?: string
  /** Fotos além da primeira, em itens com `multiplasFotos`. */
  fotosExtras?: FotoAnexada[]
}

export interface FotoAnexada {
  /** Ausente quando a foto veio de uma liberação já salva (só tem a URL). */
  file?: File
  previewUrl: string
}

/** Todas as fotos do item, na ordem: a principal e depois as extras. */
export function fotosDoItem(state: ChecklistItemState | undefined): FotoAnexada[] {
  if (!state?.fotoPreviewUrl) return []
  return [{ file: state.fotoFile, previewUrl: state.fotoPreviewUrl }, ...(state.fotosExtras ?? [])]
}

export interface InspecaoWizardState {
  id: string
  modelo: ModeloInspecao
  tipo: TipoVeiculo
  placa: string
  marcaId: string
  modeloId: string
  clienteId: string
  motorista?: string
  km?: number
  dataHora: string
  /** Na liberação, é o responsável pela manutenção. */
  inspetor: string
  itens: Record<string, ChecklistItemState>
  assinaturaDataUrl?: string
  /** Na liberação, é o responsável pela liberação. */
  responsavelNome?: string
  responsavelCargo?: string
  // Só no modelo 'liberacao'
  /** Encarregado que assina o envio (pessoa diferente do responsável pela manutenção). */
  encarregado?: string
  numeroOS?: string
  horimetro?: number
  statusLiberacao?: StatusLiberacao
  observacoes?: string
  /** Assinatura do encarregado ao enviar (dataURL no wizard, URL quando vem do banco). */
  assinaturaEncarregadoUrl?: string
}

/**
 * Único usuário que dá o OK final da liberação (define o status e assina).
 * A mesma regra está no banco (trigger da migration 0086) — mudar nos dois lugares.
 */
export const APROVADOR_LIBERACAO_EMAIL = 'mariaclara@gveldiesel.com'

export function podeAprovarLiberacao(email: string | null | undefined) {
  return (email ?? '').trim().toLowerCase() === APROVADOR_LIBERACAO_EMAIL
}

export const STATUS_LIBERACAO_LABEL: Record<StatusLiberacao, string> = {
  liberado: 'Liberado',
  liberado_restricao: 'Liberado com restrição',
  nao_liberado: 'Não liberado',
}

export const STATUS_LIBERACAO_COR: Record<StatusLiberacao, string> = {
  liberado: '#2E7D32',
  liberado_restricao: '#B87400',
  nao_liberado: '#E23B2E',
}

/**
 * PNG da assinatura, recortado. Se o recorte falhar (bug conhecido do
 * trim-canvas em alguns builds), usa o canvas inteiro em vez de travar o envio.
 */
export function capturarAssinatura(sig: { getTrimmedCanvas: () => HTMLCanvasElement; toDataURL: (type?: string) => string }) {
  try {
    return sig.getTrimmedCanvas().toDataURL('image/png')
  } catch {
    return sig.toDataURL('image/png')
  }
}

export function itemKey(secaoId: string, itemId: string) {
  return `${secaoId}::${itemId}`
}

/** Na liberação, item marcado como "Não Conforme" só vale com foto anexada. */
export function exigeFotoNaoConforme(modelo: ModeloInspecao) {
  return modelo === 'liberacao'
}

export function faltaFotoNaoConforme(modelo: ModeloInspecao, state: ChecklistItemState | undefined) {
  return exigeFotoNaoConforme(modelo) && state?.status === 'nao_conforme' && !state.fotoFile
}

/** Item de foto conta como respondido com a foto (ou sempre, se opcional); os demais, com o status. */
export function itemRespondido(modelo: ModeloInspecao, def: ChecklistItemDef, state: ChecklistItemState | undefined) {
  if (def.foto) return def.foto === 'opcional' || fotosDoItem(state).length >= (def.minFotos ?? 1)
  return Boolean(state?.status) && !faltaFotoNaoConforme(modelo, state)
}

export function criarEstadoInicial(modelo: ModeloInspecao = 'vistoria'): InspecaoWizardState {
  return {
    id: crypto.randomUUID(),
    modelo,
    tipo: 'pesado',
    placa: '',
    marcaId: '',
    modeloId: '',
    clienteId: '',
    dataHora: new Date().toISOString(),
    inspetor: '',
    itens: {},
  }
}
