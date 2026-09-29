import type { jsPDF } from 'jspdf'
import { generatePdfFromHtml } from '@/lib/pdf'
import { CHECKLIST_LIBERACAO } from '@/data/checklistSchema'
import { carregarItensInspecao, type LiberacaoComVeiculo } from '@/hooks/useLiberacoes'
import type { VeiculoComRelacoes } from '@/lib/types'
import { buildInspecaoReportHtml } from './reportHtml'
import { itemKey, type ChecklistItemState, type InspecaoWizardState } from './types'

export function nomeArquivoLiberacao(l: LiberacaoComVeiculo) {
  return `liberacao-${l.veiculo?.placa || 'veiculo'}-${l.id.slice(0, 8).toUpperCase()}.pdf`
}

/**
 * Gera de novo o PDF de uma liberação já salva, reaproveitando o mesmo
 * relatório da finalização: remonta o estado do wizard a partir das linhas
 * de inspecao_itens (fotos entram pela URL pública do storage).
 */
export async function gerarPdfLiberacaoSalva(l: LiberacaoComVeiculo): Promise<jsPDF> {
  const linhas = await carregarItensInspecao(l.id)

  const itens: Record<string, ChecklistItemState> = {}
  for (const linha of linhas) {
    const secao = CHECKLIST_LIBERACAO.find((s) => s.nome === linha.secao)
    // Itens com várias fotos foram salvos como "Label — foto N".
    const labelBase = linha.item.split(' — foto ')[0]
    const item = secao?.itens.find((i) => i.label.toUpperCase() === labelBase.toUpperCase())
    if (!secao || !item) continue

    const key = itemKey(secao.id, item.id)
    const atual = itens[key]
    if (!atual) {
      itens[key] = {
        // Item só de foto não tem status no wizard (foi salvo como 'conforme'); sem isso entraria na tabela.
        status: item.foto ? undefined : linha.status,
        observacao: linha.observacao ?? undefined,
        fotoPreviewUrl: linha.foto_url ?? undefined,
      }
    } else if (linha.foto_url) {
      if (!atual.fotoPreviewUrl) atual.fotoPreviewUrl = linha.foto_url
      else atual.fotosExtras = [...(atual.fotosExtras ?? []), { previewUrl: linha.foto_url }]
    }
  }

  const veiculo = l.veiculo
  const state: InspecaoWizardState = {
    id: l.id,
    modelo: 'liberacao',
    tipo: veiculo?.tipo ?? 'pesado',
    placa: veiculo?.placa ?? '',
    marcaId: veiculo?.marca_id ?? '',
    modeloId: veiculo?.modelo_id ?? '',
    clienteId: l.cliente_id,
    km: l.km ?? undefined,
    dataHora: l.data_hora,
    inspetor: l.inspetor,
    itens,
    assinaturaDataUrl: l.assinatura_url ?? undefined,
    responsavelNome: l.responsavel_nome ?? undefined,
    responsavelCargo: l.responsavel_cargo ?? undefined,
    numeroOS: l.numero_os ?? undefined,
    horimetro: l.horimetro ?? undefined,
    statusLiberacao: l.status_liberacao ?? undefined,
    observacoes: l.observacoes ?? undefined,
  }

  const html = buildInspecaoReportHtml({
    state,
    veiculo: (veiculo ?? { placa: state.placa }) as VeiculoComRelacoes,
    cliente: veiculo?.cliente,
    numero: l.id.slice(0, 8).toUpperCase(),
  })
  return generatePdfFromHtml(html)
}
