import { reportHeaderHtml, reportFooterHtml } from '@/lib/pdf'
import { formatDateTime } from '@/lib/format'
import { getChecklistParaTipo } from '@/data/checklistSchema'
import { tipoVeiculoLabel } from '@/lib/tipoVeiculo'
import { itemKey, type InspecaoWizardState } from './types'
import type { VeiculoComRelacoes, Cliente } from '@/lib/types'

const STATUS_LABEL: Record<string, string> = {
  conforme: 'Conforme',
  nao_conforme: 'Não Conforme',
  pendente: 'Pendente',
}

const STATUS_COLOR: Record<string, string> = {
  conforme: '#2E7D32',
  nao_conforme: '#E23B2E',
  pendente: '#B87400',
}

interface BuildParams {
  state: InspecaoWizardState
  veiculo: VeiculoComRelacoes
  cliente: Cliente | undefined
  numero: string
}

export function buildInspecaoReportHtml({ state, veiculo, cliente, numero }: BuildParams) {
  const secoes = getChecklistParaTipo(state.tipo)

  const linhasItens = secoes
    .flatMap((secao) =>
      secao.itens.map((item) => {
        const itemState = state.itens[itemKey(secao.id, item.id)]
        if (!itemState?.status) return ''
        const cor = STATUS_COLOR[itemState.status]
        return `
          <tr>
            <td style="padding:5px 8px;border-bottom:1px solid #eee;font-size:10px;color:#777;">${secao.nome}</td>
            <td style="padding:5px 8px;border-bottom:1px solid #eee;">${item.label}</td>
            <td style="padding:5px 8px;border-bottom:1px solid #eee;">
              <span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:bold;color:#fff;background:${cor};">
                ${STATUS_LABEL[itemState.status]}
              </span>
            </td>
            <td style="padding:5px 8px;border-bottom:1px solid #eee;font-size:10px;color:#555;">${itemState.observacao ?? ''}</td>
          </tr>
        `
      }),
    )
    .join('')

  const naoConformes = secoes
    .flatMap((secao) =>
      secao.itens
        .map((item) => ({ secao: secao.nome, item, state: state.itens[itemKey(secao.id, item.id)] }))
        .filter((x) => x.state?.status === 'nao_conforme'),
    )
    .map(
      (x) => `
        <li style="margin-bottom:4px;">
          <strong>${x.item.label}</strong> (${x.secao})${x.state?.observacao ? ` — ${x.state.observacao}` : ''}
        </li>
      `,
    )
    .join('')

  const fotos = secoes
    .flatMap((secao) =>
      secao.itens
        .map((item) => ({ item, state: state.itens[itemKey(secao.id, item.id)] }))
        .filter((x) => x.state?.fotoPreviewUrl),
    )
    .map(
      (x) => `
        <div style="display:inline-block;width:120px;margin:4px;text-align:center;vertical-align:top;">
          <img src="${x.state?.fotoPreviewUrl}" style="width:120px;height:120px;object-fit:cover;border-radius:8px;border:1px solid #ddd;" />
          <div style="font-size:9px;color:#777;margin-top:2px;">${x.item.label}</div>
        </div>
      `,
    )
    .join('')

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;padding:16px;">
      ${reportHeaderHtml('Relatório de Vistoria', numero)}

      <table style="width:100%;font-size:11px;margin-bottom:14px;border-collapse:collapse;">
        <tr>
          <td style="padding:3px 0;color:#777;width:110px;">Veículo</td>
          <td style="padding:3px 0;font-weight:bold;">${veiculo.placa} — ${veiculo.marca?.nome ?? ''} ${veiculo.modelo?.nome ?? ''}</td>
          <td style="padding:3px 0;color:#777;width:80px;">Tipo</td>
          <td style="padding:3px 0;">${tipoVeiculoLabel(state.tipo)}</td>
        </tr>
        <tr>
          <td style="padding:3px 0;color:#777;">Cliente</td>
          <td style="padding:3px 0;">${cliente?.nome ?? ''}</td>
          <td style="padding:3px 0;color:#777;">Cor</td>
          <td style="padding:3px 0;">${veiculo.cor || '—'}</td>
        </tr>
        <tr>
          <td style="padding:3px 0;color:#777;">Motorista</td>
          <td style="padding:3px 0;">${state.motorista || '—'}</td>
          <td style="padding:3px 0;color:#777;">KM</td>
          <td style="padding:3px 0;">${state.km ?? '—'}</td>
        </tr>
        <tr>
          <td style="padding:3px 0;color:#777;">Inspetor</td>
          <td style="padding:3px 0;">${state.inspetor}</td>
          <td style="padding:3px 0;color:#777;">Data/hora</td>
          <td style="padding:3px 0;">${formatDateTime(state.dataHora)}</td>
        </tr>
      </table>

      ${
        naoConformes
          ? `<div style="border:1px solid #E23B2E33;background:#E23B2E0d;border-radius:8px;padding:10px 14px;margin-bottom:14px;">
              <div style="font-weight:bold;color:#E23B2E;font-size:12px;margin-bottom:6px;">Itens não conformes</div>
              <ul style="margin:0;padding-left:16px;font-size:11px;">${naoConformes}</ul>
            </div>`
          : ''
      }

      <table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:14px;">
        <thead>
          <tr style="background:#2B2B2B;color:#fff;text-align:left;">
            <th style="padding:6px 8px;">Seção</th>
            <th style="padding:6px 8px;">Item</th>
            <th style="padding:6px 8px;">Status</th>
            <th style="padding:6px 8px;">Observação</th>
          </tr>
        </thead>
        <tbody>${linhasItens}</tbody>
      </table>

      ${fotos ? `<div style="margin-bottom:14px;"><div style="font-weight:bold;font-size:12px;margin-bottom:6px;">Fotos</div>${fotos}</div>` : ''}

      <table style="width:100%;margin-top:20px;font-size:11px;">
        <tr>
          <td style="width:50%;vertical-align:bottom;">
            ${
              state.assinaturaDataUrl
                ? `<img src="${state.assinaturaDataUrl}" style="height:60px;" />`
                : ''
            }
            <div style="border-top:1px solid #999;padding-top:4px;margin-top:4px;">
              ${state.responsavelNome ?? ''}${state.responsavelCargo ? ` — ${state.responsavelCargo}` : ''}
            </div>
          </td>
          <td style="width:50%;vertical-align:bottom;text-align:right;color:#777;">
            Inspetor: ${state.inspetor}<br />
            ${formatDateTime(state.dataHora)}
          </td>
        </tr>
      </table>

      ${reportFooterHtml(formatDateTime(new Date().toISOString()))}
    </div>
  `
}
