import { useMemo, useState } from 'react'
import type { jsPDF } from 'jspdf'
import { FileDown, Share2, CheckCircle2, Send } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useMarcas, useModelos } from '@/hooks/useMarcasModelos'
import { useClientes } from '@/hooks/useClientes'
import { salvarInspecao } from '@/hooks/useInspecao'
import { getChecklist } from '@/data/checklistSchema'
import { generatePdfFromHtml } from '@/lib/pdf'
import { sharePdf } from '@/lib/share'
import { tipoVeiculoLabel } from '@/lib/tipoVeiculo'
import { formatDateTime } from '@/lib/format'
import { buildInspecaoReportHtml } from './reportHtml'
import { fotosDoItem, itemKey, STATUS_LIBERACAO_COR, STATUS_LIBERACAO_LABEL, type InspecaoWizardState } from './types'
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
  const liberacao = state.modelo === 'liberacao'
  // Liberação enviada por quem não é o aprovador: sem status ainda.
  const aguardandoAprovacao = liberacao && !state.statusLiberacao
  const filename = `${liberacao ? 'liberacao' : 'vistoria'}-${state.placa || 'veiculo'}-${numero}.pdf`

  const secoes = useMemo(() => getChecklist(state.modelo, state.tipo), [state.modelo, state.tipo])
  const itensRespondidos = secoes.flatMap((secao) =>
    secao.itens.map((item) => ({ secao, item, itemState: state.itens[itemKey(secao.id, item.id)] })),
  )
  const contadores = {
    conforme: itensRespondidos.filter((i) => i.itemState?.status === 'conforme').length,
    nao_conforme: itensRespondidos.filter((i) => i.itemState?.status === 'nao_conforme').length,
    pendente: itensRespondidos.filter((i) => i.itemState?.status === 'pendente').length,
  }
  const naoConformes = itensRespondidos.filter((i) => i.itemState?.status === 'nao_conforme')
  const totalFotos = itensRespondidos.reduce((acc, i) => acc + fotosDoItem(i.itemState).length, 0)

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
      operante: true,
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

  async function handleEnviar() {
    setErro(null)
    try {
      await ensureSalvo()
    } catch (err) {
      setErro(mensagemErro(err, 'Não foi possível enviar para aprovação.'))
    }
  }

  async function handleGerarPdf() {
    setErro(null)
    try {
      await ensureSalvo()
      const doc = await ensurePdf()
      doc.save(filename)
    } catch (err) {
      setErro(mensagemErro(err, 'Não foi possível gerar o PDF.'))
    }
  }

  async function handleCompartilhar() {
    setErro(null)
    try {
      await ensureSalvo()
      const doc = await ensurePdf()
      await sharePdf(doc, filename, `${liberacao ? 'Liberação' : 'Vistoria'} ${state.placa}`)
    } catch (err) {
      setErro(mensagemErro(err, 'Não foi possível compartilhar o PDF.'))
    }
  }

  return (
    <div className="max-w-3xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{liberacao ? 'Resumo da liberação' : 'Resumo da inspeção'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <SummaryRow label="Veículo" value={`${state.placa} — ${marca?.nome ?? ''} ${modelo?.nome ?? ''}`} />
          <SummaryRow label="Tipo" value={tipoVeiculoLabel(state.tipo)} />
          <SummaryRow label="Cliente" value={cliente?.nome ?? '—'} />
          {liberacao && <SummaryRow label="Nº da OS" value={state.numeroOS || '—'} />}
          {!liberacao && <SummaryRow label="Motorista" value={state.motorista || '—'} />}
          <SummaryRow label="KM" value={state.km ? String(state.km) : '—'} />
          {liberacao && <SummaryRow label="Horímetro" value={state.horimetro != null ? String(state.horimetro) : '—'} />}
          <SummaryRow label={liberacao ? 'Resp. manutenção' : 'Inspetor'} value={state.inspetor} />
          {liberacao && <SummaryRow label="Encarregado" value={state.encarregado || '—'} />}
          <SummaryRow label="Data/hora" value={formatDateTime(state.dataHora)} />
          <SummaryRow
            label={liberacao ? 'Resp. liberação' : 'Responsável'}
            value={
              aguardandoAprovacao
                ? 'Aguardando aprovação'
                : `${state.responsavelNome ?? ''} ${state.responsavelCargo ? `(${state.responsavelCargo})` : ''}`
            }
          />
        </CardContent>
      </Card>

      {aguardandoAprovacao && state.observacoes && (
        <Card>
          <CardContent className="pt-6 text-sm">
            <span className="text-secondary">Observações para a aprovação: </span>
            <span className="whitespace-pre-wrap text-foreground">{state.observacoes}</span>
          </CardContent>
        </Card>
      )}

      {liberacao && state.statusLiberacao && (
        <Card>
          <CardHeader>
            <CardTitle>Resultado da liberação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <span
              className="inline-block rounded-full px-3 py-1 text-sm font-bold text-white"
              style={{ background: STATUS_LIBERACAO_COR[state.statusLiberacao] }}
            >
              {STATUS_LIBERACAO_LABEL[state.statusLiberacao].toUpperCase()}
            </span>
            {state.observacoes && (
              <p className="whitespace-pre-wrap text-foreground">
                <span className="text-secondary">Observações / Pendências: </span>
                {state.observacoes}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {liberacao ? (
        <Card>
          <CardContent className="pt-6 text-sm text-secondary">
            {totalFotos} foto{totalFotos === 1 ? '' : 's'} anexada{totalFotos === 1 ? '' : 's'} no checklist.
          </CardContent>
        </Card>
      ) : (
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
                <ul className="space-y-1 text-sm text-foreground">
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
      )}

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
          {aguardandoAprovacao
            ? 'Enviado! Aguardando aprovação da Maria Clara.'
            : liberacao
              ? 'Liberação salva com sucesso.'
              : 'Inspeção salva com sucesso.'}
        </div>
      )}

      {erro && <p className="text-sm text-status-danger">{erro}</p>}

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onBack} disabled={salvo}>
          Voltar
        </Button>
        {aguardandoAprovacao ? (
          // Sem aprovação ainda não tem PDF: só envia. O PDF sai depois, na aba Finalizadas.
          <div className="flex flex-wrap gap-3">
            {!salvo && (
              <Button type="button" onClick={handleEnviar} disabled={salvando}>
                <Send className="h-4 w-4" />
                {salvando ? 'Enviando…' : 'Enviar para aprovação'}
              </Button>
            )}
            {salvo && (
              <Button type="button" variant="success" onClick={onFinalizado}>
                Nova liberação
              </Button>
            )}
          </div>
        ) : (
        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="secondary" onClick={handleGerarPdf} disabled={salvando}>
            <FileDown className="h-4 w-4" />
            {salvando ? 'Salvando…' : 'Gerar PDF'}
          </Button>
          <Button type="button" onClick={handleCompartilhar} disabled={salvando}>
            <Share2 className="h-4 w-4" />
            {liberacao ? 'Compartilhar no WhatsApp' : 'Compartilhar'}
          </Button>
          {salvo && (
            <Button type="button" variant="success" onClick={onFinalizado}>
              {liberacao ? 'Nova liberação' : 'Nova inspeção'}
            </Button>
          )}
        </div>
        )}
      </div>
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/5 py-1.5 last:border-0">
      <span className="text-secondary">{label}</span>
      <span className="text-foreground font-medium">{value}</span>
    </div>
  )
}

// Erro do Supabase (PostgrestError) é objeto comum, não `Error` — sem isso a
// mensagem real (ex.: coluna faltando) sumia atrás do texto genérico.
function mensagemErro(err: unknown, padrao: string) {
  if (err instanceof Error) return err.message
  if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
    return `${padrao} (${err.message})`
  }
  return padrao
}
