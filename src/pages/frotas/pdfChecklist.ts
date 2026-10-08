import { format, parseISO } from 'date-fns'
import { generatePdfFromHtml, reportFooterHtml, reportHeaderHtml, REPORT_STYLES } from '@/lib/pdf'
import type { RegistroChecklist } from '@/lib/types'

/** Só estas placas podem emitir o checklist em PDF. */
export const PLACAS_CHECKLIST_PDF = ['GDT0I01', 'GDT0H04', 'CUL2E24', 'GDT0I02', 'GDT0I03', 'ERA9G01']

export function podeEmitirPdfChecklist(placa: string): boolean {
  return PLACAS_CHECKLIST_PDF.includes(placa.toUpperCase().trim())
}

const RESULTADO: Record<RegistroChecklist['resultado'], { label: string; cor: string }> = {
  aprovado: { label: 'APROVADO', cor: '#15803d' },
  aprovado_com_ressalvas: { label: 'APROVADO COM RESSALVAS', cor: '#b45309' },
  reprovado: { label: 'REPROVADO', cor: '#b91c1c' },
}

const PREVENTIVA: Record<NonNullable<RegistroChecklist['statusPreventiva']>['status'], string> = {
  em_dia: 'EM DIA',
  proxima: 'PRÓXIMA',
  vencida: 'VENCIDA',
  sem_dados: '—',
}

const FOTOS_PADRAO: { campo: keyof NonNullable<RegistroChecklist['fotos']>; label: string }[] = [
  { campo: 'painel', label: 'PAINEL' },
  { campo: 'frente', label: 'FRENTE' },
  { campo: 'ladoEsquerdo', label: 'LADO ESQUERDO' },
  { campo: 'traseira', label: 'TRASEIRA' },
  { campo: 'ladoDireito', label: 'LADO DIREITO' },
]

function esc(v: string | number | undefined | null): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function campo(label: string, valor: string) {
  return `
    <div style="padding:8px 10px;border:1px solid #e5e5e5;border-radius:6px;">
      <div style="font-size:9px;color:#777;text-transform:uppercase;letter-spacing:0.5px;">${esc(label)}</div>
      <div style="font-size:12px;font-weight:bold;margin-top:2px;">${valor}</div>
    </div>`
}

function htmlChecklist(chk: RegistroChecklist): string {
  const data = format(parseISO(chk.dataHora), "dd/MM/yyyy 'às' HH:mm")
  const resultado = RESULTADO[chk.resultado]
  const fotos = [
    ...FOTOS_PADRAO.filter((f) => chk.fotos?.[f.campo]).map((f) => ({ url: chk.fotos![f.campo]!, label: f.label })),
    ...(chk.fotosExtras ?? []).map((f, i) => ({ url: f.url, label: f.label || `FOTO ADICIONAL ${i + 1}` })),
  ]
  const tipo = chk.tipoChecklist ? ` — ${chk.tipoChecklist === 'ida' ? 'IDA' : 'VOLTA'}` : ''

  return `
  <div style="${REPORT_STYLES} padding:24px;">
    ${reportHeaderHtml(`CHECKLIST DE VISTORIA${tipo}`, chk.id.slice(0, 8).toUpperCase())}

    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px;">
      ${campo('Placa', esc(chk.placa))}
      ${campo('Veículo', esc(chk.modeloNome || '—'))}
      ${campo('Cliente', esc(chk.clienteNome || '—'))}
      ${campo('Data / hora', esc(data))}
      ${campo('KM da vistoria', `${esc(chk.kmAtual.toLocaleString('pt-BR'))} km`)}
      ${campo('Resultado', `<span style="color:${resultado.cor};">${resultado.label}</span>`)}
      ${campo('Motorista', esc(chk.motoristaNome || 'NÃO IDENTIFICADO'))}
      ${campo('Inspetor', esc(chk.inspetorNome))}
      ${campo('Preventiva', esc(PREVENTIVA[chk.statusPreventiva?.status ?? 'sem_dados']))}
    </div>

    <div style="margin-bottom:14px;">
      <div style="font-size:11px;font-weight:bold;margin-bottom:4px;">OBSERVAÇÕES / RESSALVAS</div>
      <div style="font-size:11px;min-height:32px;padding:8px 10px;border:1px solid #e5e5e5;border-radius:6px;white-space:pre-wrap;">${
        esc(chk.observacoesGerais) || '<span style="color:#999;">Sem observações.</span>'
      }</div>
    </div>

    <div style="font-size:11px;font-weight:bold;margin-bottom:6px;">FOTOS (${fotos.length})</div>
    ${
      fotos.length
        ? `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">
            ${fotos
              .map(
                (f) => `
              <div style="border:1px solid #e5e5e5;border-radius:6px;overflow:hidden;page-break-inside:avoid;">
                <img src="${esc(f.url)}" crossorigin="anonymous" style="display:block;width:100%;height:150px;object-fit:cover;background:#f2f2f2;" />
                <div style="font-size:9px;font-weight:bold;text-align:center;padding:4px;">${esc(f.label)}</div>
              </div>`,
              )
              .join('')}
          </div>`
        : '<div style="font-size:11px;color:#999;">Nenhuma foto registrada.</div>'
    }

    <div style="display:flex;gap:40px;margin-top:40px;">
      <div style="flex:1;text-align:center;">
        <div style="border-top:1px solid #333;padding-top:4px;font-size:10px;">${esc(chk.motoristaNome || 'Motorista')}<br/><span style="color:#777;">Motorista</span></div>
      </div>
      <div style="flex:1;text-align:center;">
        <div style="border-top:1px solid #333;padding-top:4px;font-size:10px;">${esc(chk.inspetorNome)}<br/><span style="color:#777;">Inspetor</span></div>
      </div>
    </div>

    ${reportFooterHtml(format(new Date(), "dd/MM/yyyy 'às' HH:mm"))}
  </div>`
}

/** Gera e baixa o PDF do checklist (só para as placas liberadas). */
export async function baixarPdfChecklist(chk: RegistroChecklist): Promise<void> {
  if (!podeEmitirPdfChecklist(chk.placa)) throw new Error('Esta placa não está liberada para emitir o checklist em PDF.')
  const doc = await generatePdfFromHtml(htmlChecklist(chk))
  doc.save(`checklist-${chk.placa}-${format(parseISO(chk.dataHora), 'yyyy-MM-dd-HHmm')}.pdf`)
}
