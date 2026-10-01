import { supabase, FOTOS_BUCKET, ASSINATURAS_BUCKET } from '@/lib/supabase'
import { upsertVeiculo } from './useVeiculos'
import { getChecklist } from '@/data/checklistSchema'
import { fotosDoItem, itemKey, type InspecaoWizardState } from '@/pages/inspecao/types'
import { up } from '@/lib/text'
import { dataUrlParaBlob } from '@/lib/imagem'
import { comPrefixoEmpresa } from '@/lib/tenant'
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
    const path = comPrefixoEmpresa(`${state.id}.png`)
    const { error } = await supabase.storage.from(ASSINATURAS_BUCKET).upload(path, blob, {
      contentType: 'image/png',
      upsert: true,
    })
    if (!error) {
      assinaturaUrl = supabase.storage.from(ASSINATURAS_BUCKET).getPublicUrl(path).data.publicUrl
    }
  }

  // Liberação: assinatura do encarregado no envio (a de cima é a do aprovador).
  let assinaturaEncarregadoUrl: string | null = null
  if (state.assinaturaEncarregadoUrl) {
    const blob = dataUrlParaBlob(state.assinaturaEncarregadoUrl)
    const path = comPrefixoEmpresa(`${state.id}-encarregado.png`)
    const { error } = await supabase.storage.from(ASSINATURAS_BUCKET).upload(path, blob, {
      contentType: 'image/png',
      upsert: true,
    })
    if (error) throw error
    assinaturaEncarregadoUrl = supabase.storage.from(ASSINATURAS_BUCKET).getPublicUrl(path).data.publicUrl
  }

  const secoes = getChecklist(state.modelo, state.tipo)
  // Itens de registro fotográfico não têm status: entram como 'conforme' quando têm foto.
  // Item com várias fotos (ex.: "Demais pneus") vira uma linha por foto, já que
  // inspecao_itens guarda uma foto por linha.
  const itensComStatus = secoes.flatMap((secao) =>
    secao.itens.flatMap((item) => {
      const itemState = state.itens[itemKey(secao.id, item.id)]
      const status = item.foto && itemState?.fotoFile ? ('conforme' as const) : itemState?.status
      if (!status) return []
      const fotos = fotosDoItem(itemState)
      if (!item.multiplasFotos || fotos.length <= 1) {
        return [{ secao, item, label: item.label, status, observacao: itemState?.observacao, foto: itemState?.fotoFile, sufixo: '' }]
      }
      return fotos.map((f, i) => ({
        secao,
        item,
        label: `${item.label} — foto ${i + 1}`,
        status,
        observacao: i === 0 ? itemState?.observacao : undefined,
        foto: f.file,
        sufixo: `-${i + 1}`,
      }))
    }),
  )

  // Sobe todas as fotos dos itens em paralelo (antes ia uma de cada vez, o que
  // deixava salvar uma inspeção com vários itens fotografados bem lento). A foto
  // é só evidência opcional do item — se uma falhar, não trava o resto da inspeção.
  const itensParaSalvar = await Promise.all(
    itensComStatus.map(async ({ secao, item, label, status, observacao, foto, sufixo }) => {
      let fotoUrl: string | null = null
      if (foto) {
        try {
          const ext = foto.type === 'image/png' ? 'png' : 'jpg'
          const path = comPrefixoEmpresa(`${state.id}/${itemKey(secao.id, item.id)}${sufixo}.${ext}`)
          const { error } = await supabase.storage.from(FOTOS_BUCKET).upload(path, foto, {
            contentType: foto.type,
            upsert: true,
          })
          if (!error) {
            fotoUrl = supabase.storage.from(FOTOS_BUCKET).getPublicUrl(path).data.publicUrl
          }
        } catch (err) {
          console.warn(`Falha ao enviar foto do item "${label}":`, err)
        }
      }

      return {
        secao: secao.nome,
        item: label,
        status,
        observacao: up(observacao),
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
    // Colunas da migration 0085 — só enviadas na liberação, pra vistoria seguir
    // funcionando mesmo antes da migration rodar.
    ...(state.modelo === 'liberacao'
      ? {
          modelo: state.modelo,
          numero_os: up(state.numeroOS),
          horimetro: state.horimetro ?? null,
          status_liberacao: state.statusLiberacao ?? null,
          observacoes: up(state.observacoes),
          encarregado_nome: up(state.encarregado),
          ...(assinaturaEncarregadoUrl ? { assinatura_encarregado_url: assinaturaEncarregadoUrl } : {}),
        }
      : {}),
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
