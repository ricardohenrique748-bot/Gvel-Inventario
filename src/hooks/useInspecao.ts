import { apiPost } from '@/lib/api'
import { upsertVeiculo } from './useVeiculos'
import { getChecklistParaTipo } from '@/data/checklistSchema'
import { itemKey, type InspecaoWizardState } from '@/pages/inspecao/types'
import type { StatusChecklist } from '@/lib/types'

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, base64] = dataUrl.split(',')
  const mime = meta.match(/:(.*?);/)?.[1] ?? 'image/png'
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

interface SalvarInspecaoResponse {
  inspecaoId: string
  veiculo: Awaited<ReturnType<typeof upsertVeiculo>>
  statusGeral: StatusChecklist
  itens: {
    secao: string
    item: string
    status: StatusChecklist
    observacao: string | null
    foto_url: string | null
  }[]
}

export async function salvarInspecao(state: InspecaoWizardState) {
  const form = new FormData()
  form.set('id', state.id)
  form.set(
    'veiculo',
    JSON.stringify({
      placa: state.placa,
      marcaId: state.marcaId,
      modeloId: state.modeloId,
      clienteId: state.clienteId,
      tipo: state.tipo,
    }),
  )
  form.set('clienteId', state.clienteId)
  form.set('inspetor', state.inspetor)
  if (state.km != null) form.set('km', String(state.km))
  form.set('dataHora', state.dataHora)
  if (state.responsavelNome) form.set('responsavelNome', state.responsavelNome)
  if (state.responsavelCargo) form.set('responsavelCargo', state.responsavelCargo)

  if (state.assinaturaDataUrl) {
    form.set('assinatura', dataUrlToBlob(state.assinaturaDataUrl), 'assinatura.png')
  }

  const secoes = getChecklistParaTipo(state.tipo)
  const itensParaEnviar: { key: string; secao: string; item: string; status: StatusChecklist; observacao?: string }[] =
    []

  for (const secao of secoes) {
    for (const item of secao.itens) {
      const key = itemKey(secao.id, item.id)
      const itemState = state.itens[key]
      if (!itemState?.status) continue

      itensParaEnviar.push({
        key,
        secao: secao.nome,
        item: item.label,
        status: itemState.status,
        observacao: itemState.observacao || undefined,
      })

      if (itemState.fotoFile) {
        form.set(`foto_${key}`, itemState.fotoFile)
      }
    }
  }
  form.set('itens', JSON.stringify(itensParaEnviar))

  const { data, error } = await apiPost<SalvarInspecaoResponse>('/inspecoes', form)
  if (error || !data) throw new Error(error?.message ?? 'Erro ao salvar inspeção.')

  return data
}
