import { useEffect, useMemo, useState } from 'react'
import { CalendarRange, Loader2, Search, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { criarLancamentosFluxoCaixaEmLote, somarMeses } from '@/hooks/useFluxoCaixaLancamentos'

// Fluxo de caixa (campos estendidos): repete as entradas dos clientes de um mês
// no mês seguinte — todos marcados de uma vez, com valor, veículos e
// descrição editáveis — em vez de lançar cliente por cliente (ou um lançamento
// único com o total). Cliente que já tem entrada no mês de destino vem
// desmarcado, para não duplicar.

interface Props {
  usuarioNome?: string
  onClose: () => void
}

interface Linha {
  origemId: string
  clienteId: string
  clienteNome: string
  data: string
  descricao: string
  valor: string
  quantidadeVeiculos: string
  dataVencimento?: string
  formaPagamento?: string
  marcada: boolean
  jaLancado: boolean
}

const MESES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']

const mesDe = (dataIso: string) => dataIso.slice(0, 7)
const rotuloMes = (mes: string) => `${MESES[Number(mes.slice(5, 7)) - 1]}/${mes.slice(0, 4)}`
const fimDoMes = (mes: string) => somarMeses(`${mes}-01`, 1).slice(0, 7) + '-01'
const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtDataCurta = (iso?: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '—')
const paraNumero = (texto: string) => Number(texto.replace(/\./g, '').replace(',', '.')) || 0
const paraTexto = (v: number) => v.toFixed(2).replace('.', ',')

export function RepetirMesClientesModal({ usuarioNome, onClose }: Props) {
  const [mesOrigem, setMesOrigem] = useState('')
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [busca, setBusca] = useState('')

  const mesDestino = mesOrigem ? mesDe(somarMeses(`${mesOrigem}-01`, 1)) : ''

  // Começa pelo último mês que tem entrada de cliente.
  useEffect(() => {
    supabase
      .from('fluxo_caixa_lancamentos')
      .select('data')
      .eq('movimentacao', 'entrada')
      .not('cliente_id', 'is', null)
      .order('data', { ascending: false })
      .limit(1)
      .then(({ data, error }) => {
        if (error) setErro(error.message)
        setMesOrigem(data?.[0]?.data ? mesDe(data[0].data) : mesDe(new Date().toISOString()))
      })
  }, [])

  useEffect(() => {
    if (!mesOrigem) return
    let cancelado = false
    setCarregando(true)
    setErro(null)
    setAviso(null)
    const destino = mesDe(somarMeses(`${mesOrigem}-01`, 1))
    const doMes = (mes: string) =>
      supabase
        .from('fluxo_caixa_lancamentos')
        .select('id, data, descricao, valor, cliente_id, quantidade_veiculos, data_vencimento, forma_pagamento, cliente:clientes(nome)')
        .eq('movimentacao', 'entrada')
        .not('cliente_id', 'is', null)
        .gte('data', `${mes}-01`)
        .lt('data', fimDoMes(mes))
        .order('data')
    Promise.all([doMes(mesOrigem), doMes(destino)]).then(([origem, jaNoDestino]) => {
      if (cancelado) return
      const falha = origem.error || jaNoDestino.error
      if (falha) {
        setErro(falha.message)
        setLinhas([])
      } else {
        const clientesNoDestino = new Set((jaNoDestino.data ?? []).map((r: any) => r.cliente_id as string))
        setLinhas(
          (origem.data ?? [])
            .map((r: any): Linha => {
              const jaLancado = clientesNoDestino.has(r.cliente_id)
              return {
                origemId: r.id,
                clienteId: r.cliente_id,
                clienteNome: r.cliente?.nome || '—',
                data: somarMeses(r.data, 1),
                descricao: r.descricao,
                valor: paraTexto(Number(r.valor) || 0),
                quantidadeVeiculos: r.quantidade_veiculos != null ? String(r.quantidade_veiculos) : '',
                dataVencimento: r.data_vencimento ? somarMeses(r.data_vencimento, 1) : undefined,
                formaPagamento: r.forma_pagamento || undefined,
                marcada: !jaLancado,
                jaLancado,
              }
            })
            .sort((a, b) => a.clienteNome.localeCompare(b.clienteNome)),
        )
      }
      setCarregando(false)
    })
    return () => {
      cancelado = true
    }
  }, [mesOrigem])

  const termo = busca.trim().toUpperCase()
  const visiveis = useMemo(
    () => linhas.filter((l) => !termo || l.clienteNome.toUpperCase().includes(termo) || l.descricao.toUpperCase().includes(termo)),
    [linhas, termo],
  )
  const marcadas = linhas.filter((l) => l.marcada)
  const total = marcadas.reduce((s, l) => s + paraNumero(l.valor), 0)
  const todasVisiveisMarcadas = visiveis.length > 0 && visiveis.every((l) => l.marcada)

  function alterar(origemId: string, campos: Partial<Linha>) {
    setLinhas((prev) => prev.map((l) => (l.origemId === origemId ? { ...l, ...campos } : l)))
  }

  function marcarVisiveis(marcar: boolean) {
    const ids = new Set(visiveis.map((l) => l.origemId))
    setLinhas((prev) => prev.map((l) => (ids.has(l.origemId) ? { ...l, marcada: marcar } : l)))
  }

  async function gerar() {
    setErro(null)
    if (marcadas.length === 0) return setErro('Marque pelo menos um cliente.')
    const semValor = marcadas.find((l) => paraNumero(l.valor) <= 0)
    if (semValor) return setErro(`Informe o valor de ${semValor.clienteNome}.`)
    const repetidos = marcadas.filter((l) => l.jaLancado).length
    if (repetidos > 0 && !confirm(`${repetidos} cliente(s) marcado(s) já têm entrada em ${rotuloMes(mesDestino)}. Lançar mesmo assim?`)) return

    setSalvando(true)
    try {
      await criarLancamentosFluxoCaixaEmLote(
        marcadas.map((l) => ({
          data: l.data,
          movimentacao: 'entrada',
          descricao: l.descricao.trim().toUpperCase(),
          valor: paraNumero(l.valor),
          usuarioNome,
          clienteId: l.clienteId,
          quantidadeVeiculos: l.quantidadeVeiculos.trim() ? Number(l.quantidadeVeiculos) : undefined,
          dataVencimento: l.dataVencimento,
          formaPagamento: l.formaPagamento,
          // PGT em branco: é preenchido à mão conforme cada cliente paga.
          statusPagamento: '',
        })),
      )
      setAviso(`${marcadas.length} lançamento(s) criados em ${rotuloMes(mesDestino)} — total ${fmtBRL(total)}.`)
      // Os clientes lançados agora contam como "já lançado" no destino.
      setLinhas((prev) => prev.map((l) => (l.marcada ? { ...l, marcada: false, jaLancado: true } : l)))
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível gerar os lançamentos.')
    } finally {
      setSalvando(false)
    }
  }

  const campo =
    'h-8 w-full rounded-lg border border-border/40 bg-background px-2 text-xs font-bold text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-fade-in" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-5xl flex-col rounded-3xl border border-border/30 bg-surface shadow-2xl animate-scale-in"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border/20 p-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <CalendarRange className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase text-foreground">REPETIR MÊS DOS CLIENTES</h3>
              <p className="text-xs font-medium normal-case text-secondary">
                Copia as entradas de cada cliente para o mês seguinte. Desmarque quem não vai cobrar e ajuste os valores antes de gerar.
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-secondary hover:bg-background hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-end gap-3 border-b border-border/20 px-5 py-3">
          <div>
            <label className="mb-1 block text-[10px] font-black text-secondary">COPIAR DE</label>
            <input type="month" value={mesOrigem} onChange={(e) => e.target.value && setMesOrigem(e.target.value)} className={`${campo} w-40`} />
          </div>
          <div className="pb-1.5 text-xs font-black text-secondary">→</div>
          <div>
            <span className="mb-1 block text-[10px] font-black text-secondary">LANÇAR EM</span>
            <span className="flex h-8 items-center rounded-lg border border-primary/40 bg-primary/10 px-3 text-xs font-black text-primary">
              {mesDestino ? rotuloMes(mesDestino) : '—'}
            </span>
          </div>
          <div className="relative ml-auto w-full sm:w-64">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-secondary" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="BUSCAR CLIENTE" className={`${campo} pl-8`} />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {carregando ? (
            <div className="flex items-center justify-center gap-2 p-10 text-xs text-secondary">
              <Loader2 className="h-4 w-4 animate-spin" /> CARREGANDO CLIENTES...
            </div>
          ) : linhas.length === 0 ? (
            <p className="p-10 text-center text-xs normal-case text-secondary">
              Nenhuma entrada com cliente em {mesOrigem ? rotuloMes(mesOrigem) : 'nenhum mês'}. Escolha outro mês em "Copiar de".
            </p>
          ) : (
            <table className="w-full border-collapse text-left text-xs">
              <thead className="sticky top-0 z-10 bg-surface">
                <tr className="whitespace-nowrap border-b border-border/30 text-[11px] font-black uppercase text-secondary">
                  <th className="px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={todasVisiveisMarcadas}
                      onChange={(e) => marcarVisiveis(e.target.checked)}
                      aria-label="Selecionar todos"
                      className="h-4 w-4"
                    />
                  </th>
                  <th className="px-2 py-2.5">CLIENTE</th>
                  <th className="px-2 py-2.5">DESCRIÇÃO</th>
                  <th className="px-2 py-2.5 text-center">VEÍC.</th>
                  <th className="px-2 py-2.5 text-right">VALOR (R$)</th>
                  <th className="px-2 py-2.5">DATA</th>
                  <th className="px-2 py-2.5">VENC.</th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map((l) => (
                  <tr key={l.origemId} className={`border-b border-border/10 ${l.marcada ? '' : 'opacity-50'}`}>
                    <td className="px-3 py-1.5">
                      <input
                        type="checkbox"
                        checked={l.marcada}
                        onChange={(e) => alterar(l.origemId, { marcada: e.target.checked })}
                        aria-label={`Lançar ${l.clienteNome}`}
                        className="h-4 w-4"
                      />
                    </td>
                    <td className="px-2 py-1.5 font-bold text-foreground">
                      {l.clienteNome}
                      {l.jaLancado && (
                        <span className="ml-1.5 rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-black text-amber-400">JÁ LANÇADO</span>
                      )}
                    </td>
                    <td className="min-w-[200px] px-2 py-1.5">
                      <input value={l.descricao} onChange={(e) => alterar(l.origemId, { descricao: e.target.value })} className={campo} />
                    </td>
                    <td className="w-20 px-2 py-1.5">
                      <input
                        inputMode="numeric"
                        value={l.quantidadeVeiculos}
                        onChange={(e) => alterar(l.origemId, { quantidadeVeiculos: e.target.value.replace(/\D/g, '') })}
                        className={`${campo} text-center`}
                      />
                    </td>
                    <td className="w-32 px-2 py-1.5">
                      <input
                        inputMode="decimal"
                        value={l.valor}
                        onChange={(e) => alterar(l.origemId, { valor: e.target.value })}
                        className={`${campo} text-right font-mono`}
                      />
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-secondary">{fmtDataCurta(l.data)}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-secondary">{fmtDataCurta(l.dataVencimento)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="space-y-2 border-t border-border/20 p-5">
          {erro && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs normal-case text-red-400">{erro}</p>}
          {aviso && <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-xs normal-case text-emerald-400">{aviso}</p>}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-bold text-secondary">
              {marcadas.length} de {linhas.length} cliente(s) · TOTAL <span className="font-mono font-black text-emerald-400">{fmtBRL(total)}</span>
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="h-10 rounded-xl border border-border/40 px-4 text-xs font-black text-secondary hover:text-foreground"
              >
                FECHAR
              </button>
              <button
                type="button"
                onClick={gerar}
                disabled={salvando || carregando || marcadas.length === 0}
                className="flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-xs font-black text-white shadow-md shadow-primary/20 disabled:opacity-50"
              >
                {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
                GERAR {marcadas.length} LANÇAMENTO(S) EM {mesDestino ? rotuloMes(mesDestino) : '—'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
