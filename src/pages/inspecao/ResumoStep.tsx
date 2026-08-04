import { useMemo, useState } from 'react'
import type { jsPDF } from 'jspdf'
import { FileDown, Share2, CheckCircle2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useMarcas, useModelos } from '@/hooks/useMarcasModelos'
import { useClientes } from '@/hooks/useClientes'
import { salvarInspecao } from '@/hooks/useInspecao'
import { getChecklistParaTipo } from '@/data/checklistSchema'
import { generatePdfFromHtml } from '@/lib/pdf'
import { sharePdf } from '@/lib/share'
import { formatDateTime } from '@/lib/format'
import { buildInspecaoReportHtml } from './reportHtml'
import { itemKey, type InspecaoWizardState } from './types'
import type { VeiculoComRelacoes } from '@/lib/types'

interface Props {
  state: InspecaoWizardState
  onBack: () => void
  onFinalizado: () => void
}

export function ResumoStep({ state, onBack, onFinalizado }: Props) {
  const { marcas } = useMarcas()
  const { modelos } = useModelos(state.marcaId)
  const { clientes } = useClientes()

  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [pdfDoc, setPdfDoc] = useState<jsPDF | null>(null)

  const marca = marcas.find((m) => m.id === state.marcaId)
  const modelo = modelos.find((m) => m.id === state.modeloId)
  const cliente = clientes.find((c) => c.id === state.clienteId)
  const numero = state.id.slice(0, 8).toUpperCase()
  const filename = `vistoria-${state.placa || 'veiculo'}-${numero}.pdf`

  const secoes = useMemo(() => getChecklistParaTipo(state.tipo), [state.tipo])
  const itensRespondidos = secoes.flatMap((secao) =>
    secao.itens.map((item) => ({ secao, item, itemState: state.itens[itemKey(secao.id, item.id)] })),
  )
  const contadores = {
    conforme: itensRespondidos.filter((i) => i.itemState?.status === 'conforme').length,
    nao_conforme: itensRespondidos.filter((i) => i.itemState?.status === 'nao_conforme').length,
    pendente: itensRespondidos.filter((i) => i.itemState?.status === 'pendente').length,
  }
  const naoConformes = itensRespondidos.filter((i) => i.itemState?.status === 'nao_conforme')

  async function ensureSalvo() {
    if (salvo) return
    setSalvando(true)
    setErro(null)
    try {
      await salvarInspecao(state)
      setSalvo(true)
    } finally {
      setSalvando(false)
    }
  }

  async function ensurePdf(): Promise<jsPDF> {
    if (pdfDoc) return pdfDoc
    const veiculoParaRelatorio: VeiculoComRelacoes = {
      id: '',
      placa: state.placa,
      marca_id: state.marcaId,
      modelo_id: state.modeloId,
      cliente_id: state.clienteId,
      tipo: state.tipo,
      cor: null,
      ano: null,
      chassi: null,
      created_at: '',
      marca,
      modelo,
      cliente,
    }
    const html = buildInspecaoReportHtml({ state, veiculo: veiculoParaRelatorio, cliente, numero })
    const doc = await generatePdfFromHtml(html)
    setPdfDoc(doc)
    return doc
  }

  async function handleGerarPdf() {
    setErro(null)
    try {
      await ensureSalvo()
      const doc = await ensurePdf()
      doc.save(filename)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível gerar o PDF.')
    }
  }

  async function handleCompartilhar() {
    setErro(null)
    try {
      await ensureSalvo()
      const doc = await ensurePdf()
      await sharePdf(doc, filename, `Vistoria ${state.placa}`)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível compartilhar o PDF.')
    }
  }

  return (
    <div className="max-w-3xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Resumo da inspeção</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <SummaryRow label="Veículo" value={`${state.placa} — ${marca?.nome ?? ''} ${modelo?.nome ?? ''}`} />
          <SummaryRow label="Tipo" value={state.tipo === 'pesado' ? 'Pesado' : 'Leve'} />
          <SummaryRow label="Cliente" value={cliente?.nome ?? '—'} />
          <SummaryRow label="Motorista" value={state.motorista || '—'} />
          <SummaryRow label="KM" value={state.km ? String(state.km) : '—'} />
          <SummaryRow label="Inspetor" value={state.inspetor} />
          <SummaryRow label="Data/hora" value={formatDateTime(state.dataHora)} />
          <SummaryRow label="Responsável" value={`${state.responsavelNome ?? ''} ${state.responsavelCargo ? `(${state.responsavelCargo})` : ''}`} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Resultado do checklist</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Badge tone="success">{contadores.conforme} conforme</Badge>
            <Badge tone="danger">{contadores.nao_conforme} não conforme</Badge>
            <Badge tone="warning">{contadores.pendente} pendente</Badge>
          </div>

          {naoConformes.length > 0 && (
            <div className="rounded-xl border border-status-danger/30 bg-status-danger/10 p-4">
              <p className="text-sm font-semibold text-status-danger mb-2">Itens não conformes</p>
              <ul className="space-y-1 text-sm text-white">
                {naoConformes.map((i) => (
                  <li key={itemKey(i.secao.id, i.item.id)}>
                    <span className="font-medium">{i.item.label}</span>
                    <span className="text-secondary"> ({i.secao.nome})</span>
                    {i.itemState?.observacao && <span className="text-secondary"> — {i.itemState.observacao}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {state.assinaturaDataUrl && (
        <Card>
          <CardHeader>
            <CardTitle>Assinatura</CardTitle>
          </CardHeader>
          <CardContent>
            <img src={state.assinaturaDataUrl} alt="Assinatura do responsável" className="h-20 rounded-lg bg-white p-2" />
          </CardContent>
        </Card>
      )}

      {salvo && (
        <div className="flex items-center gap-2 rounded-xl border border-status-success/30 bg-status-success/10 px-4 py-3 text-sm text-status-success">
          <CheckCircle2 className="h-4 w-4" />
          Inspeção salva com sucesso.
        </div>
      )}

      {erro && <p className="text-sm text-status-danger">{erro}</p>}

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onBack}>
          Voltar
        </Button>
        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="secondary" onClick={handleGerarPdf} disabled={salvando}>
            <FileDown className="h-4 w-4" />
            {salvando ? 'Salvando…' : 'Gerar PDF'}
          </Button>
          <Button type="button" onClick={handleCompartilhar} disabled={salvando}>
            <Share2 className="h-4 w-4" />
            Compartilhar
          </Button>
          {salvo && (
            <Button type="button" variant="success" onClick={onFinalizado}>
              Nova inspeção
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-white/5 py-1.5 last:border-0">
      <span className="text-secondary">{label}</span>
      <span className="text-white font-medium">{value}</span>
    </div>
  )
}
