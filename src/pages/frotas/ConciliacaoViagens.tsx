import { useMemo, useRef, useState } from 'react'
import {
  Landmark,
  Upload,
  Search,
  ArrowDown,
  ArrowUp,
  X,
  Link2,
  Unlink,
  EyeOff,
  Download,
  FileText,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Select } from '@/components/ui/Input'
import { exportRowsToCsv } from '@/lib/csv'
import { getErrorMessage } from '@/lib/erros'
import type { ContaPagarReceber, StatusTransacaoExtrato } from '@/lib/types'
import {
  useLotesImportacao,
  useTransacoesExtrato,
  importarExtratoOFX,
  vincularTransacao,
  desvincularTransacao,
  marcarStatusTransacao,
  excluirLoteImportacao,
} from '@/hooks/useConciliacao'

function fmtMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const STATUS_INFO: Record<StatusTransacaoExtrato, { label: string; tone: 'neutral' | 'warning' | 'success' | 'danger' }> = {
  pendente: { label: 'PENDENTE', tone: 'warning' },
  conciliada: { label: 'CONCILIADA', tone: 'success' },
  divergente: { label: 'DIVERGENTE', tone: 'danger' },
  ignorada: { label: 'IGNORADA', tone: 'neutral' },
}

interface ContaBancariaSimples {
  id: string
  nome: string
}

export function ConciliacaoViagens({
  contasPR,
  contasBancarias,
}: {
  contasPR: ContaPagarReceber[]
  contasBancarias: ContaBancariaSimples[]
}) {
  const { lotes } = useLotesImportacao()
  const { transacoes, loading: carregandoTransacoes } = useTransacoesExtrato()

  const [lotesSelecionados, setLotesSelecionados] = useState<Set<string>>(new Set())
  const [filtroStatus, setFiltroStatus] = useState<'pendente' | 'conciliada' | 'divergente' | 'ignorada' | 'todas'>('pendente')
  const [buscaExtrato, setBuscaExtrato] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'creditos' | 'debitos'>('todos')
  const [transacaoSelecionadaId, setTransacaoSelecionadaId] = useState<string | null>(null)
  const [contaBancariaImportacao, setContaBancariaImportacao] = useState('')
  const [importando, setImportando] = useState(false)
  const [erroImportacao, setErroImportacao] = useState<string | null>(null)
  const [erroAcao, setErroAcao] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const transacoesDosLotesAtivos = useMemo(() => {
    if (lotesSelecionados.size === 0) return transacoes
    return transacoes.filter((t) => lotesSelecionados.has(t.loteId))
  }, [transacoes, lotesSelecionados])

  const metricas = useMemo(() => {
    const total = transacoesDosLotesAtivos.length
    const conciliadas = transacoesDosLotesAtivos.filter((t) => t.status === 'conciliada').length
    const pendentes = transacoesDosLotesAtivos.filter((t) => t.status === 'pendente').length
    const divergentes = transacoesDosLotesAtivos.filter((t) => t.status === 'divergente').length
    const ignoradas = transacoesDosLotesAtivos.filter((t) => t.status === 'ignorada').length
    const creditos = transacoesDosLotesAtivos.filter((t) => t.valor > 0)
    const debitos = transacoesDosLotesAtivos.filter((t) => t.valor < 0)
    return {
      total,
      conciliadas,
      pendentes,
      divergentes,
      ignoradas,
      totalCreditos: creditos.reduce((acc, t) => acc + t.valor, 0),
      totalDebitos: debitos.reduce((acc, t) => acc + Math.abs(t.valor), 0),
      qtdCreditos: creditos.length,
      qtdDebitos: debitos.length,
    }
  }, [transacoesDosLotesAtivos])

  const transacoesFiltradas = useMemo(() => {
    return transacoesDosLotesAtivos
      .filter((t) => {
        if (filtroStatus !== 'todas' && t.status !== filtroStatus) return false
        if (filtroTipo === 'creditos' && t.valor <= 0) return false
        if (filtroTipo === 'debitos' && t.valor >= 0) return false
        if (!buscaExtrato.trim()) return true
        const termo = buscaExtrato.toLowerCase().trim()
        return t.descricao.toLowerCase().includes(termo) || String(t.valor).includes(termo)
      })
      .sort((a, b) => b.data.localeCompare(a.data))
  }, [transacoesDosLotesAtivos, filtroStatus, filtroTipo, buscaExtrato])

  const transacaoSelecionada = transacoes.find((t) => t.id === transacaoSelecionadaId) || null

  const candidatas = useMemo(() => {
    if (!transacaoSelecionada) return []
    const tipoAlvo = transacaoSelecionada.valor < 0 ? 'despesa' : 'receita'
    return contasPR
      .filter((c) => c.tipoMovimentacao === tipoAlvo && (c.status === 'pendente' || c.status === 'atrasado'))
      .sort((a, b) => {
        const diffA = Math.abs(a.valor - Math.abs(transacaoSelecionada.valor))
        const diffB = Math.abs(b.valor - Math.abs(transacaoSelecionada.valor))
        return diffA - diffB
      })
      .slice(0, 30)
  }, [transacaoSelecionada, contasPR])

  async function handleImportarArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportando(true)
    setErroImportacao(null)
    try {
      const contaBanco = contasBancarias.find((c) => c.id === contaBancariaImportacao)
      const resultado = await importarExtratoOFX(file, contaBancariaImportacao || undefined, contaBanco?.nome)
      alert(`Importado: ${resultado.novas} transações novas${resultado.duplicadas > 0 ? `, ${resultado.duplicadas} já existiam` : ''}.`)
    } catch (err) {
      setErroImportacao(getErrorMessage(err, 'Erro ao importar o arquivo OFX.'))
    } finally {
      setImportando(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleVincular(transacaoId: string, conta: ContaPagarReceber) {
    setErroAcao(null)
    try {
      await vincularTransacao(transacaoId, conta.id, conta.descricao || conta.tipoLancamentoNome || 'LANÇAMENTO')
      setTransacaoSelecionadaId(null)
    } catch (err) {
      setErroAcao(getErrorMessage(err, 'Erro ao vincular.'))
    }
  }

  async function handleDesvincular(transacaoId: string) {
    setErroAcao(null)
    try {
      await desvincularTransacao(transacaoId)
    } catch (err) {
      setErroAcao(getErrorMessage(err, 'Erro ao desvincular.'))
    }
  }

  async function handleIgnorar(transacaoId: string) {
    setErroAcao(null)
    try {
      await marcarStatusTransacao(transacaoId, 'ignorada')
      if (transacaoSelecionadaId === transacaoId) setTransacaoSelecionadaId(null)
    } catch (err) {
      setErroAcao(getErrorMessage(err, 'Erro ao ignorar.'))
    }
  }

  async function handleExcluirLote(loteId: string) {
    if (!confirm('Excluir este lote de importação e todas as transações dele? Essa ação não pode ser desfeita.')) return
    try {
      await excluirLoteImportacao(loteId)
      setLotesSelecionados((prev) => {
        const next = new Set(prev)
        next.delete(loteId)
        return next
      })
    } catch (err) {
      alert(getErrorMessage(err, 'Erro ao excluir o lote.'))
    }
  }

  function handleExportar() {
    exportRowsToCsv(
      `conciliacao_${format(new Date(), 'yyyy-MM-dd')}.csv`,
      ['Data', 'Descrição', 'Valor', 'Status', 'Lançamento Vinculado'],
      transacoesFiltradas.map((t) => [
        format(parseISO(t.data), 'dd/MM/yyyy'),
        t.descricao,
        t.valor.toFixed(2).replace('.', ','),
        STATUS_INFO[t.status].label,
        t.contaPagarReceberDescricao || '',
      ]),
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2.5 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
            <Landmark className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-black text-foreground uppercase">Conciliação Bancária</h2>
            <p className="text-[11px] text-secondary normal-case">
              Importe o extrato (OFX) e vincule cada transação a um lançamento de Contas a Pagar/Receber
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={contaBancariaImportacao}
            onChange={(e) => setContaBancariaImportacao(e.target.value)}
            className="text-xs font-bold sm:max-w-[200px]"
          >
            <option value="">CONTA BANCÁRIA (OPCIONAL)</option>
            {contasBancarias.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </Select>
          <input ref={fileInputRef} type="file" accept=".ofx" className="hidden" onChange={handleImportarArquivo} />
          <Button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={importando}
            className="gap-1.5 text-xs font-bold shadow-md shadow-primary/20"
          >
            <Upload className="h-3.5 w-3.5" />
            {importando ? 'IMPORTANDO...' : 'IMPORTAR OFX'}
          </Button>
        </div>
      </div>

      {erroImportacao && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-3.5 py-2.5 text-xs font-semibold text-red-400 normal-case">
          {erroImportacao}
        </div>
      )}
      {erroAcao && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-3.5 py-2.5 text-xs font-semibold text-red-400 normal-case">
          {erroAcao}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-2.5">
        {[
          { label: 'TOTAL', valor: metricas.total, cor: 'text-foreground' },
          { label: 'CONCILIADAS', valor: metricas.conciliadas, cor: 'text-emerald-500' },
          { label: 'PENDENTES', valor: metricas.pendentes, cor: 'text-amber-400' },
          { label: 'CRÉDITOS', valor: metricas.qtdCreditos, cor: 'text-emerald-500' },
          { label: 'DÉBITOS', valor: metricas.qtdDebitos, cor: 'text-rose-500' },
        ].map((item) => (
          <Card key={item.label} className="p-3 border-border/30 bg-surface/90">
            <p className="text-[9px] font-black text-secondary uppercase">{item.label}</p>
            <p className={`text-lg font-black font-mono ${item.cor}`}>{item.valor}</p>
          </Card>
        ))}
        <Card className="p-3 border-emerald-500/20 bg-surface/90">
          <p className="text-[9px] font-black text-secondary uppercase">TOTAL CRÉDITOS</p>
          <p className="text-sm font-black font-mono text-emerald-500">{fmtMoeda(metricas.totalCreditos)}</p>
        </Card>
        <Card className="p-3 border-rose-500/20 bg-surface/90">
          <p className="text-[9px] font-black text-secondary uppercase">TOTAL DÉBITOS</p>
          <p className="text-sm font-black font-mono text-rose-500">{fmtMoeda(metricas.totalDebitos)}</p>
        </Card>
      </div>

      {/* Lotes de Importação */}
      {lotes.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-black text-secondary uppercase">Lotes de Importação:</span>
          {lotes.map((l) => {
            const ativo = lotesSelecionados.size === 0 || lotesSelecionados.has(l.id)
            return (
              <div
                key={l.id}
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-bold cursor-pointer transition-colors ${
                  ativo ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border/25 bg-surface text-secondary'
                }`}
                onClick={() =>
                  setLotesSelecionados((prev) => {
                    const next = new Set(prev)
                    if (next.has(l.id)) next.delete(l.id)
                    else next.add(l.id)
                    return next
                  })
                }
              >
                <FileText className="h-3 w-3" />
                {l.nomeArquivo}
                <Badge tone="neutral" className="text-[8px] font-black">{l.totalTransacoes}</Badge>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleExcluirLote(l.id)
                  }}
                  className="text-secondary hover:text-status-danger"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Status + Exportar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'pendente', label: `PENDENTES ${metricas.pendentes}` },
              { id: 'conciliada', label: `CONCILIADAS ${metricas.conciliadas}` },
              { id: 'divergente', label: `DIVERGENTES ${metricas.divergentes}` },
              { id: 'ignorada', label: `IGNORADAS ${metricas.ignoradas}` },
              { id: 'todas', label: `TODAS ${metricas.total}` },
            ] as const
          ).map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setFiltroStatus(s.id)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-colors ${
                filtroStatus === s.id ? 'bg-primary text-white' : 'bg-surface border border-border/25 text-secondary hover:text-foreground'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <Button type="button" variant="secondary" onClick={handleExportar} className="gap-1.5 text-xs font-bold">
          <Download className="h-3.5 w-3.5" />
          EXPORTAR
        </Button>
      </div>

      {/* Duas colunas: transações + candidatas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Coluna esquerda: transações do extrato */}
        <Card className="p-0 border-border/25 bg-surface/80 overflow-hidden">
          <div className="p-3 border-b border-border/15 space-y-2">
            <p className="text-xs font-black text-foreground uppercase flex items-center gap-2">
              <FileText className="h-3.5 w-3.5" />
              Transações do Extrato
            </p>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-secondary" />
              <input
                value={buscaExtrato}
                onChange={(e) => setBuscaExtrato(e.target.value)}
                placeholder="FILTRAR POR DESCRIÇÃO OU VALOR..."
                className="h-9 w-full rounded-lg border border-border/25 bg-background pl-8 pr-3 text-xs text-foreground placeholder:text-secondary/60 focus:border-primary focus:outline-none uppercase"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setFiltroTipo(filtroTipo === 'creditos' ? 'todos' : 'creditos')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black transition-colors ${
                  filtroTipo === 'creditos' ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30' : 'bg-background border border-border/25 text-secondary'
                }`}
              >
                <ArrowDown className="h-3 w-3" /> CRÉDITOS
              </button>
              <button
                type="button"
                onClick={() => setFiltroTipo(filtroTipo === 'debitos' ? 'todos' : 'debitos')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black transition-colors ${
                  filtroTipo === 'debitos' ? 'bg-rose-500/15 text-rose-500 border border-rose-500/30' : 'bg-background border border-border/25 text-secondary'
                }`}
              >
                <ArrowUp className="h-3 w-3" /> DÉBITOS
              </button>
            </div>
          </div>

          <div className="max-h-[520px] overflow-y-auto divide-y divide-border/10">
            {carregandoTransacoes && transacoesFiltradas.length === 0 ? (
              <div className="p-8 text-center">
                <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-secondary/30 border-t-primary" />
              </div>
            ) : transacoesFiltradas.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-xs font-bold text-secondary uppercase">Nenhuma transação encontrada</p>
                <p className="mt-1 text-[11px] text-secondary normal-case">Importe um arquivo OFX pra começar.</p>
              </div>
            ) : (
              transacoesFiltradas.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTransacaoSelecionadaId((prev) => (prev === t.id ? null : t.id))}
                  className={`flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition-colors ${
                    transacaoSelecionadaId === t.id ? 'bg-primary/10' : 'hover:bg-overlay/5'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-secondary">{format(parseISO(t.data), 'dd/MM/yyyy')}</span>
                      <Badge tone={STATUS_INFO[t.status].tone} className="text-[8px] font-black">{STATUS_INFO[t.status].label}</Badge>
                    </div>
                    <p className="text-xs font-bold text-foreground normal-case truncate">{t.descricao}</p>
                  </div>
                  <span className={`shrink-0 text-sm font-black font-mono ${t.valor < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                    {fmtMoeda(t.valor)}
                  </span>
                </button>
              ))
            )}
          </div>
        </Card>

        {/* Coluna direita: candidatas do financeiro */}
        <Card className="p-0 border-border/25 bg-surface/80 overflow-hidden">
          <div className="p-3 border-b border-border/15">
            <p className="text-xs font-black text-foreground uppercase flex items-center gap-2">
              <Link2 className="h-3.5 w-3.5" />
              Financeiro ({transacaoSelecionada ? (transacaoSelecionada.valor < 0 ? 'A Pagar' : 'A Receber') : '—'})
            </p>
          </div>

          {!transacaoSelecionada ? (
            <div className="p-10 text-center">
              <Link2 className="mx-auto mb-3 h-8 w-8 text-secondary/40" />
              <p className="text-xs font-black text-foreground">NENHUMA TRANSAÇÃO SELECIONADA</p>
              <p className="mt-1 text-[11px] text-secondary normal-case max-w-xs mx-auto">
                Clique em qualquer transação do extrato à esquerda para ver os lançamentos correspondentes e vincular. Clique de novo para desmarcar.
              </p>
            </div>
          ) : (
            <div className="max-h-[520px] overflow-y-auto divide-y divide-border/10">
              {transacaoSelecionada.status === 'conciliada' && transacaoSelecionada.contaPagarReceberId ? (
                <div className="p-4 space-y-3">
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                    <p className="text-[10px] font-black text-emerald-500 uppercase">Vinculada a</p>
                    <p className="text-xs font-bold text-foreground normal-case">{transacaoSelecionada.contaPagarReceberDescricao}</p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => handleDesvincular(transacaoSelecionada.id)}
                    className="gap-1.5 text-xs font-bold w-full"
                  >
                    <Unlink className="h-3.5 w-3.5" />
                    DESVINCULAR
                  </Button>
                </div>
              ) : (
                <>
                  <div className="p-3">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => handleIgnorar(transacaoSelecionada.id)}
                      className="gap-1.5 text-xs font-bold w-full"
                    >
                      <EyeOff className="h-3.5 w-3.5" />
                      IGNORAR ESSA TRANSAÇÃO
                    </Button>
                  </div>
                  {candidatas.length === 0 ? (
                    <div className="p-8 text-center">
                      <p className="text-xs font-bold text-secondary uppercase">Nenhum lançamento compatível</p>
                      <p className="mt-1 text-[11px] text-secondary normal-case">
                        Não há conta a {transacaoSelecionada.valor < 0 ? 'pagar' : 'receber'} pendente pra vincular.
                      </p>
                    </div>
                  ) : (
                    candidatas.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleVincular(transacaoSelecionada.id, c)}
                        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left hover:bg-overlay/5 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-foreground normal-case truncate">{c.descricao || c.tipoLancamentoNome}</p>
                          <p className="text-[10px] text-secondary normal-case">
                            {c.centroCustoNome} · VENCE {format(parseISO(c.dataVencimento), 'dd/MM/yyyy')}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-xs font-black font-mono text-foreground">{fmtMoeda(c.valor)}</p>
                          <p className="text-[9px] font-bold text-primary">VINCULAR</p>
                        </div>
                      </button>
                    ))
                  )}
                </>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
