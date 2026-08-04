import { supabase, FOTOS_BUCKET, ASSINATURAS_BUCKET } from '@/lib/supabase'
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

export async function salvarInspecao(state: InspecaoWizardState) {
  const veiculo = await upsertVeiculo({
    placa: state.placa,
    marcaId: state.marcaId,
    modeloId: state.modeloId,
    clienteId: state.clienteId,
    tipo: state.tipo,
  })

  let assinaturaUrl: string | null = null
  if (state.assinaturaDataUrl) {
    const blob = dataUrlToBlob(state.assinaturaDataUrl)
    const path = `${state.id}.png`
    const { error } = await supabase.storage.from(ASSINATURAS_BUCKET).upload(path, blob, {
      contentType: 'image/png',
      upsert: true,
    })
    if (!error) {
      assinaturaUrl = supabase.storage.from(ASSINATURAS_BUCKET).getPublicUrl(path).data.publicUrl
    }
  }

  const secoes = getChecklistParaTipo(state.tipo)
  const itensParaSalvar: {
    secao: string
    item: string
    status: StatusChecklist
    observacao: string | null
    foto_url: string | null
  }[] = []

  for (const secao of secoes) {
    for (const item of secao.itens) {
      const key = itemKey(secao.id, item.id)
      const itemState = state.itens[key]
      if (!itemState?.status) continue

      let fotoUrl: string | null = null
      if (itemState.fotoFile) {
        const ext = itemState.fotoFile.type === 'image/png' ? 'png' : 'jpg'
        const path = `${state.id}/${key}.${ext}`
        const { error } = await supabase.storage.from(FOTOS_BUCKET).upload(path, itemState.fotoFile, {
          contentType: itemState.fotoFile.type,
          upsert: true,
        })
        if (!error) {
          fotoUrl = supabase.storage.from(FOTOS_BUCKET).getPublicUrl(path).data.publicUrl
        }
      }

      itensParaSalvar.push({
        secao: secao.nome,
        item: item.label,
        status: itemState.status,
        observacao: itemState.observacao || null,
        foto_url: fotoUrl,
      })
    }
  }

  const statusGeral: StatusChecklist = itensParaSalvar.some((i) => i.status === 'nao_conforme')
    ? 'nao_conforme'
    : itensParaSalvar.some((i) => i.status === 'pendente')
      ? 'pendente'
      : 'conforme'

  const { error: inspecaoError } = await supabase.from('inspecoes').insert({
    id: state.id,
    veiculo_id: veiculo.id,
    cliente_id: state.clienteId,
    inspetor: state.inspetor,
    km: state.km ?? null,
    data_hora: state.dataHora,
    assinatura_url: assinaturaUrl,
    responsavel_nome: state.responsavelNome || null,
    responsavel_cargo: state.responsavelCargo || null,
    status_geral: statusGeral,
  })
  if (inspecaoError) throw inspecaoError

  if (itensParaSalvar.length > 0) {
    const { error: itensError } = await supabase
      .from('inspecao_itens')
      .insert(itensParaSalvar.map((i) => ({ ...i, inspecao_id: state.id })))
    if (itensError) throw itensError
  }

  return { inspecaoId: state.id, veiculo, statusGeral, itens: itensParaSalvar }
}
