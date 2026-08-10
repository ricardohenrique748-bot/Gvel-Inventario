import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { format, subDays } from 'date-fns'
import { FileDown, Share2, Check, X, Truck } from 'lucide-react'
import { PageHeader } from '@/components/layout/Header'
import { FiltersBar, type FiltersValue } from '@/components/FiltersBar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { StatusManutencaoBadge } from '@/components/StatusManutencaoBadge'
import { useMovimentacoes } from '@/hooks/useMovimentacoes'
import { useVeiculosPorCliente } from '@/hooks/useVeiculos'
import { obterLinkPublico } from '@/hooks/useClientes'
import { permanenciaEmMinutos, formatMinutosParaTexto, formatDate, formatDateTime } from '@/lib/format'
import { generatePdfFromHtml, reportHeaderHtml, reportFooterHtml } from '@/lib/pdf'
import { urlMiniatura, aoFalharMiniatura } from '@/lib/thumb'

function FotoVeiculoMiniatura({ url, placa }: { url: string | null; placa: string | undefined }) {
  if (!url) {
    return (
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-surface text-secondary">
        <Truck className="h-5 w-5" />
      </div>
    )
  }
  return (
    <img
      src={urlMiniatura(url, 96)}
      onError={aoFalharMiniatura(url)}
      alt={`Frente — ${placa ?? ''}`}
      loading="lazy"
      decoding="async"
      width={48}
      height={48}
      className="h-12 w-12 shrink-0 rounded-lg object-cover"
    />
  )
}

export function Relatorios() {
  const [filters, setFilters] = useState<FiltersValue>({
    dataInicio: format(subDays(new Date(), 29), 'yyyy-MM-dd'),
    dataFim: format(new Date(), 'yyyy-MM-dd'),
  })
  const [exporting, setExporting] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)
  const [copied, setCopied] = useState(false)

  const { movimentacoes, loading } = useMovimentacoes({
    clienteId: filters.clienteId,
    marcaId: filters.marcaId,
    modeloId: filters.modeloId,
    patioId: filters.patioId,
    dataInicio: filters.dataInicio ? `${filters.dataInicio}T00:00:00` : undefined,
    dataFim: filters.dataFim ? `${filters.dataFim}T23:59:59` : undefined,
  })

  const { veiculos: frotaCliente, loading: loadingFrota } = useVeiculosPorCliente(filters.clienteId)

  const { movimentacoes: movimentacoesClienteTudo, loading: loadingSituacao } = useMovimentacoes({
    clienteId: filters.clienteId,
  })

  const situacaoFrota = useMemo(() => {
    const porVeiculo = new Map<string, (typeof movimentacoesClienteTudo)[number]>()
    for (const m of movimentacoesClienteTudo) {
      const atual = porVeiculo.get(m.veiculo_id)
      if (!atual || new Date(m.data_hora_entrada) > new Date(atual.data_hora_entrada)) {
        porVeiculo.set(m.veiculo_id, m)
      }
    }

    const noPatio = [...porVeiculo.values()].filter((m) => m.status === 'no_patio')
    const jaSaiu = [...porVeiculo.values()].filter((m) => m.status === 'saiu')

    const porPatio = new Map<string, { nome: string; veiculos: typeof noPatio }>()
    for (const m of noPatio) {
      const key = m.patio_id ?? 'sem-patio'
      const nome = m.patio?.nome ?? 'Sem pátio'
      if (!porPatio.has(key)) porPatio.set(key, { nome, veiculos: [] })
      porPatio.get(key)!.veiculos.push(m)
    }

    return {
      porPatio: [...porPatio.values()].sort((a, b) => a.nome.localeCompare(b.nome)),
      jaSaiu: jaSaiu.sort((a, b) => new Date(b.data_hora_saida ?? 0).getTime() - new Date(a.data_hora_saida ?? 0).getTime()),
    }
  }, [movimentacoesClienteTudo])

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

  async function handleCompartilhar() {
    if (!filters.clienteId) return
    setSharing(true)
    setCopied(false)
    try {
      const url = await obterLinkPublico(filters.clienteId)
      setShareUrl(url)
    } finally {
      setSharing(false)
    }
  }

  async function handleCopiarLink() {
    if (!shareUrl) return
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
  }

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
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={handleCompartilhar}
              disabled={!filters.clienteId || sharing}
              title={!filters.clienteId ? 'Selecione um cliente para compartilhar' : undefined}
            >
              <Share2 className="h-4 w-4" />
              {sharing ? 'Gerando…' : 'Compartilhar'}
            </Button>
            <Button onClick={handleExportarPdf} disabled={exporting || loading}>
              <FileDown className="h-4 w-4" />
              {exporting ? 'Gerando…' : 'Exportar PDF'}
            </Button>
          </div>
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
                    <p className="text-foreground font-medium">{v.placa}</p>
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

      {filters.clienteId && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Situação atual da frota</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingSituacao ? (
              <p className="text-sm text-secondary">Carregando…</p>
            ) : situacaoFrota.porPatio.length === 0 && situacaoFrota.jaSaiu.length === 0 ? (
              <p className="text-sm text-secondary">Nenhuma movimentação registrada para este cliente.</p>
            ) : (
              <div className="space-y-6">
                {situacaoFrota.porPatio.length > 0 && (
                  <div>
                    <div className="mb-3 flex flex-wrap gap-2">
                      {situacaoFrota.porPatio.map((p) => (
                        <Badge key={p.nome} tone="success">
                          {p.nome}: {p.veiculos.length} {p.veiculos.length === 1 ? 'caminhão' : 'caminhões'}
                        </Badge>
                      ))}
                    </div>
                    <div className="space-y-4">
                      {situacaoFrota.porPatio.map((p) => (
                        <div key={p.nome}>
                          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-secondary">
                            {p.nome}
                          </p>
                          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {p.veiculos.map((m) => (
                              <Link
                                key={m.id}
                                to={`/veiculos/${m.veiculo_id}`}
                                className="flex items-center justify-between gap-2 rounded-xl bg-background px-4 py-3 hover:bg-surface-hover"
                              >
                                <div className="flex items-center gap-3">
                                  <FotoVeiculoMiniatura url={m.foto_frente_url} placa={m.veiculo?.placa} />
                                  <div>
                                    <p className="text-foreground font-medium">{m.veiculo?.placa}</p>
                                    <p className="text-sm text-secondary">
                                      {m.veiculo?.marca?.nome} {m.veiculo?.modelo?.nome}
                                    </p>
                                  </div>
                                </div>
                                <StatusManutencaoBadge status={m.status_manutencao} />
                              </Link>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {situacaoFrota.jaSaiu.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-secondary">
                      Fora do pátio ({situacaoFrota.jaSaiu.length})
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {situacaoFrota.jaSaiu.map((m) => (
                        <Link
                          key={m.id}
                          to={`/veiculos/${m.veiculo_id}`}
                          className="flex items-center gap-3 rounded-xl bg-background px-4 py-3 hover:bg-surface-hover"
                        >
                          <FotoVeiculoMiniatura url={m.foto_frente_url} placa={m.veiculo?.placa} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-foreground font-medium">{m.veiculo?.placa}</p>
                              <Badge tone="neutral">Saiu</Badge>
                            </div>
                            <p className="text-sm text-secondary">
                              {m.veiculo?.marca?.nome} {m.veiculo?.modelo?.nome}
                            </p>
                            <p className="text-xs text-secondary mt-1">
                              Saída: {m.data_hora_saida ? formatDateTime(m.data_hora_saida) : '—'}
                            </p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card className="p-5">
          <p className="text-sm text-secondary">Entradas</p>
          <p className="mt-1 text-3xl font-semibold text-foreground">{resumo.entradas}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-secondary">Saídas</p>
          <p className="mt-1 text-3xl font-semibold text-foreground">{resumo.saidas}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-secondary">Tempo médio de permanência</p>
          <p className="mt-1 text-3xl font-semibold text-foreground">
            {resumo.tempoMedio > 0 ? formatMinutosParaTexto(resumo.tempoMedio) : '—'}
          </p>
        </Card>
      </div>

      <Card className="p-4">
        <p className="text-sm text-secondary mb-2">
          {loading ? 'Carregando…' : `${movimentacoes.length} movimentações no período selecionado.`}
        </p>
      </Card>

      {shareUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setShareUrl(null)}
        >
          <Card className="w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold text-foreground">Link público de acompanhamento</h3>
              <button
                type="button"
                onClick={() => setShareUrl(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-secondary hover:text-foreground"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-3 text-sm text-secondary">
              Qualquer pessoa com este link vê a situação atual da frota deste cliente, sem precisar fazer login.
            </p>
            <div className="flex gap-2">
              <Input value={shareUrl} readOnly onFocus={(e) => e.target.select()} />
              <Button type="button" onClick={handleCopiarLink} variant={copied ? 'success' : 'primary'}>
                {copied ? <Check className="h-4 w-4" /> : 'Copiar'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
