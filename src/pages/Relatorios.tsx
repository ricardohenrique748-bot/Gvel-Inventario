import { useMemo, useState } from 'react'
import { format, subDays } from 'date-fns'
import { FileDown } from 'lucide-react'
import { PageHeader } from '@/components/layout/Header'
import { FiltersBar, type FiltersValue } from '@/components/FiltersBar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useMovimentacoes } from '@/hooks/useMovimentacoes'
import { useVeiculosPorCliente } from '@/hooks/useVeiculos'
import { permanenciaEmMinutos, formatMinutosParaTexto, formatDate, formatDateTime } from '@/lib/format'
import { generatePdfFromHtml, reportHeaderHtml, reportFooterHtml } from '@/lib/pdf'

export function Relatorios() {
  const [filters, setFilters] = useState<FiltersValue>({
    dataInicio: format(subDays(new Date(), 29), 'yyyy-MM-dd'),
    dataFim: format(new Date(), 'yyyy-MM-dd'),
  })
  const [exporting, setExporting] = useState(false)

  const { movimentacoes, loading } = useMovimentacoes({
    clienteId: filters.clienteId,
    marcaId: filters.marcaId,
    modeloId: filters.modeloId,
    patioId: filters.patioId,
    dataInicio: filters.dataInicio ? `${filters.dataInicio}T00:00:00` : undefined,
    dataFim: filters.dataFim ? `${filters.dataFim}T23:59:59` : undefined,
  })

  const { veiculos: frotaCliente, loading: loadingFrota } = useVeiculosPorCliente(filters.clienteId)

  const resumo = useMemo(() => {
    const entradas = movimentacoes.length
    const saidas = movimentacoes.filter((m) => m.status === 'saiu').length
    const finalizadas = movimentacoes.filter((m) => m.data_hora_saida)
    const tempoMedio =
      finalizadas.length > 0
        ? Math.round(
            finalizadas.reduce((acc, m) => acc + permanenciaEmMinutos(m.data_hora_entrada, m.data_hora_saida), 0) /
              finalizadas.length,
          )
        : 0
    return { entradas, saidas, tempoMedio }
  }, [movimentacoes])

  async function handleExportarPdf() {
    setExporting(true)
    try {
      const periodo = `${filters.dataInicio ? formatDate(`${filters.dataInicio}T00:00:00`) : '—'} a ${
        filters.dataFim ? formatDate(`${filters.dataFim}T00:00:00`) : '—'
      }`

      const linhas = movimentacoes
        .map(
          (m) => `
            <tr>
              <td style="padding:6px 8px;border-bottom:1px solid #eee;">${m.veiculo?.placa ?? ''}</td>
              <td style="padding:6px 8px;border-bottom:1px solid #eee;">${m.veiculo?.marca?.nome ?? ''} ${m.veiculo?.modelo?.nome ?? ''}</td>
              <td style="padding:6px 8px;border-bottom:1px solid #eee;">${m.veiculo?.cliente?.nome ?? ''}</td>
              <td style="padding:6px 8px;border-bottom:1px solid #eee;">${m.patio?.nome ?? ''}</td>
              <td style="padding:6px 8px;border-bottom:1px solid #eee;">${formatDateTime(m.data_hora_entrada)}</td>
              <td style="padding:6px 8px;border-bottom:1px solid #eee;">${m.data_hora_saida ? formatDateTime(m.data_hora_saida) : '—'}</td>
              <td style="padding:6px 8px;border-bottom:1px solid #eee;">${m.status === 'no_patio' ? 'No pátio' : 'Saiu'}</td>
            </tr>
          `,
        )
        .join('')

      const html = `
        <div style="font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;padding:16px;">
          ${reportHeaderHtml('Relatório de Movimentações')}
          <p style="font-size:12px;color:#555;margin:0 0 12px;">Período: ${periodo}</p>
          <div style="display:flex;gap:12px;margin-bottom:16px;">
            <div style="flex:1;border:1px solid #eee;border-radius:8px;padding:10px;">
              <div style="font-size:10px;color:#777;">Entradas</div>
              <div style="font-size:20px;font-weight:bold;color:#2B2B2B;">${resumo.entradas}</div>
            </div>
            <div style="flex:1;border:1px solid #eee;border-radius:8px;padding:10px;">
              <div style="font-size:10px;color:#777;">Saídas</div>
              <div style="font-size:20px;font-weight:bold;color:#2B2B2B;">${resumo.saidas}</div>
            </div>
            <div style="flex:1;border:1px solid #eee;border-radius:8px;padding:10px;">
              <div style="font-size:10px;color:#777;">Tempo médio de permanência</div>
              <div style="font-size:20px;font-weight:bold;color:#2B2B2B;">${resumo.tempoMedio > 0 ? formatMinutosParaTexto(resumo.tempoMedio) : '—'}</div>
            </div>
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:11px;">
            <thead>
              <tr style="background:#2B2B2B;color:#fff;text-align:left;">
                <th style="padding:6px 8px;">Placa</th>
                <th style="padding:6px 8px;">Marca/Modelo</th>
                <th style="padding:6px 8px;">Cliente</th>
                <th style="padding:6px 8px;">Pátio</th>
                <th style="padding:6px 8px;">Entrada</th>
                <th style="padding:6px 8px;">Saída</th>
                <th style="padding:6px 8px;">Status</th>
              </tr>
            </thead>
            <tbody>${linhas || '<tr><td colspan="7" style="padding:10px;color:#999;">Nenhuma movimentação no período.</td></tr>'}</tbody>
          </table>
          ${reportFooterHtml(formatDateTime(new Date().toISOString()))}
        </div>
      `

      const doc = await generatePdfFromHtml(html)
      doc.save(`relatorio-movimentacoes-${format(new Date(), 'yyyy-MM-dd-HHmm')}.pdf`)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Relatórios"
        subtitle="Resumo de entradas e saídas"
        actions={
          <Button onClick={handleExportarPdf} disabled={exporting || loading}>
            <FileDown className="h-4 w-4" />
            {exporting ? 'Gerando…' : 'Exportar PDF'}
          </Button>
        }
      />

      <div className="mb-6">
        <FiltersBar value={filters} onChange={setFilters} />
      </div>

      {filters.clienteId && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Frota cadastrada do cliente</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingFrota ? (
              <p className="text-sm text-secondary">Carregando…</p>
            ) : frotaCliente.length === 0 ? (
              <p className="text-sm text-secondary">Nenhum veículo cadastrado para este cliente.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {frotaCliente.map((v) => (
                  <div key={v.id} className="rounded-xl bg-background px-4 py-3">
                    <p className="text-white font-medium">{v.placa}</p>
                    <p className="text-sm text-secondary">
                      {v.marca?.nome} {v.modelo?.nome} {v.ano ? `· ${v.ano}` : ''}
                    </p>
                    <p className="text-sm text-secondary">{v.cor || 'Sem cor'}</p>
                    <Badge tone="neutral" className="mt-2">
                      {v.tipo === 'pesado' ? 'Pesado' : 'Leve'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card className="p-5">
          <p className="text-sm text-secondary">Entradas</p>
          <p className="mt-1 text-3xl font-semibold text-white">{resumo.entradas}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-secondary">Saídas</p>
          <p className="mt-1 text-3xl font-semibold text-white">{resumo.saidas}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-secondary">Tempo médio de permanência</p>
          <p className="mt-1 text-3xl font-semibold text-white">
            {resumo.tempoMedio > 0 ? formatMinutosParaTexto(resumo.tempoMedio) : '—'}
          </p>
        </Card>
      </div>

      <Card className="p-4">
        <p className="text-sm text-secondary mb-2">
          {loading ? 'Carregando…' : `${movimentacoes.length} movimentações no período selecionado.`}
        </p>
      </Card>
    </div>
  )
}
