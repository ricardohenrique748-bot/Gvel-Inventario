import { supabase, FOTOS_BUCKET, ASSINATURAS_BUCKET } from '@/lib/supabase'
import { upsertVeiculo } from './useVeiculos'
import { getChecklistParaTipo } from '@/data/checklistSchema'
import { itemKey, type InspecaoWizardState } from '@/pages/inspecao/types'
import { up } from '@/lib/text'
import { dataUrlParaBlob } from '@/lib/imagem'
import type { StatusChecklist } from '@/lib/types'

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
    const blob = dataUrlParaBlob(state.assinaturaDataUrl)
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
  const itensComStatus = secoes.flatMap((secao) =>
    secao.itens
      .map((item) => ({ secao, item, itemState: state.itens[itemKey(secao.id, item.id)] }))
      .filter((x) => x.itemState?.status),
  )

  // Sobe todas as fotos dos itens em paralelo (antes ia uma de cada vez, o que
  // deixava salvar uma inspeção com vários itens fotografados bem lento). A foto
  // é só evidência opcional do item — se uma falhar, não trava o resto da inspeção.
  const itensParaSalvar = await Promise.all(
    itensComStatus.map(async ({ secao, item, itemState }) => {
      let fotoUrl: string | null = null
      if (itemState!.fotoFile) {
        try {
          const ext = itemState!.fotoFile.type === 'image/png' ? 'png' : 'jpg'
          const path = `${state.id}/${itemKey(secao.id, item.id)}.${ext}`
          const { error } = await supabase.storage.from(FOTOS_BUCKET).upload(path, itemState!.fotoFile, {
            contentType: itemState!.fotoFile.type,
            upsert: true,
          })
          if (!error) {
            fotoUrl = supabase.storage.from(FOTOS_BUCKET).getPublicUrl(path).data.publicUrl
          }
        } catch (err) {
          console.warn(`Falha ao enviar foto do item "${item.label}":`, err)
        }
      }

      return {
        secao: secao.nome,
        item: item.label,
        status: itemState!.status!,
        observacao: up(itemState!.observacao),
        foto_url: fotoUrl,
      }
    }),
  )

  const statusGeral: StatusChecklist = itensParaSalvar.some((i) => i.status === 'nao_conforme')
    ? 'nao_conforme'
    : itensParaSalvar.some((i) => i.status === 'pendente')
      ? 'pendente'
      : 'conforme'

  const { error: inspecaoError } = await supabase.from('inspecoes').insert({
    id: state.id,
    veiculo_id: veiculo.id,
    cliente_id: state.clienteId,
    inspetor: up(state.inspetor),
    km: state.km ?? null,
    data_hora: state.dataHora,
    assinatura_url: assinaturaUrl,
    responsavel_nome: up(state.responsavelNome),
    responsavel_cargo: up(state.responsavelCargo),
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
