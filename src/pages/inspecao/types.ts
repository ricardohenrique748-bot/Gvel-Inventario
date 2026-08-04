import type { StatusChecklist, TipoVeiculo } from '@/lib/types'

export interface ChecklistItemState {
  status?: StatusChecklist
  observacao?: string
  fotoFile?: File
  fotoPreviewUrl?: string
}

export interface InspecaoWizardState {
  id: string
  tipo: TipoVeiculo
  placa: string
  marcaId: string
  modeloId: string
  clienteId: string
  motorista?: string
  km?: number
  dataHora: string
  inspetor: string
  itens: Record<string, ChecklistItemState>
  assinaturaDataUrl?: string
  responsavelNome?: string
  responsavelCargo?: string
}

export function itemKey(secaoId: string, itemId: string) {
  return `${secaoId}::${itemId}`
}

export function criarEstadoInicial(): InspecaoWizardState {
  return {
    id: crypto.randomUUID(),
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
