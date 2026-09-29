import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, RefreshCw, Search } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/cn'
import { formatDateTime } from '@/lib/format'
import { CHECKLIST_LIBERACAO } from '@/data/checklistSchema'
import { carregarItensInspecao, useLiberacoes, type LiberacaoComVeiculo } from '@/hooks/useLiberacoes'
import type { InspecaoItem, StatusLiberacao } from '@/lib/types'
import { STATUS_LIBERACAO_COR, STATUS_LIBERACAO_LABEL } from './types'

type Filtro = 'todos' | StatusLiberacao

const FILTROS: { value: Filtro; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'liberado', label: 'Liberados' },
  { value: 'liberado_restricao', label: 'Com restrição' },
  { value: 'nao_liberado', label: 'Não liberados' },
]

export function LiberacoesFinalizadas() {
  const { liberacoes, loading, erro, refetch } = useLiberacoes()
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [abertaId, setAbertaId] = useState<string | null>(null)

  const filtradas = useMemo(() => {
    const q = busca.trim().toUpperCase()
    return liberacoes.filter((l) => {
      if (filtro !== 'todos' && l.status_liberacao !== filtro) return false
      if (!q) return true
      return [l.veiculo?.placa, l.numero_os, l.veiculo?.cliente?.nome, l.inspetor, l.responsavel_nome].some((v) =>
        (v ?? '').toUpperCase().includes(q),
      )
    })
  }, [liberacoes, busca, filtro])

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar placa, OS, cliente ou responsável"
            className="pl-9"
          />
        </div>
        <button
          type="button"
          onClick={refetch}
          disabled={loading}
          title="Atualizar"
          aria-label="Atualizar"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-secondary/20 text-secondary hover:text-foreground disabled:opacity-50"
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTROS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFiltro(f.value)}
            className={cn(
              'shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
              filtro === f.value
                ? 'border-primary bg-primary text-white'
                : 'border-secondary/20 text-secondary hover:text-foreground',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {erro && <p className="text-sm text-status-danger">Não foi possível carregar as liberações ({erro}).</p>}

      {!loading && !erro && filtradas.length === 0 && (
        <Card className="p-6 text-center text-sm text-secondary">
          {liberacoes.length === 0 ? 'Nenhuma liberação finalizada ainda.' : 'Nenhuma liberação encontrada com esse filtro.'}
        </Card>
      )}

      <div className="space-y-3">
        {filtradas.map((l) => (
          <LiberacaoCard
            key={l.id}
            liberacao={l}
            aberta={abertaId === l.id}
            onToggle={() => setAbertaId((id) => (id === l.id ? null : l.id))}
          />
        ))}
      </div>
    </div>
  )
}

function LiberacaoCard({
  liberacao: l,
  aberta,
  onToggle,
}: {
  liberacao: LiberacaoComVeiculo
  aberta: boolean
  onToggle: () => void
}) {
  const status = l.status_liberacao
  const cor = status ? STATUS_LIBERACAO_COR[status] : '#777'

  return (
    <Card className="overflow-hidden">
      <button type="button" onClick={onToggle} className="flex w-full items-start gap-3 p-4 text-left">
        <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: cor }} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="font-semibold text-foreground">{l.veiculo?.placa ?? '—'}</p>
            <p className="truncate text-sm text-secondary">
              {l.veiculo?.marca?.nome} {l.veiculo?.modelo?.nome}
            </p>
          </div>
          <p className="truncate text-xs text-secondary">
            {l.veiculo?.cliente?.nome ?? '—'}
            {l.numero_os ? ` · OS ${l.numero_os}` : ''}
          </p>
          <p className="text-xs text-secondary">{formatDateTime(l.data_hora)}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          {status && (
            <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase text-white" style={{ background: cor }}>
              {STATUS_LIBERACAO_LABEL[status]}
            </span>
          )}
          <ChevronDown className={cn('h-4 w-4 text-secondary transition-transform', aberta && 'rotate-180')} />
        </div>
      </button>

      {aberta && <LiberacaoDetalhe liberacao={l} />}
    </Card>
  )
}

// Ordem do checklist, pra listar os itens salvos na mesma sequência da tela.
const ORDEM_SECAO = new Map(CHECKLIST_LIBERACAO.map((s, i) => [s.nome, i]))
const ORDEM_ITEM = new Map(CHECKLIST_LIBERACAO.flatMap((s) => s.itens.map((it, i) => [`${s.nome}::${it.label}`, i] as const)))

function ordemItem(i: InspecaoItem) {
  const labelBase = i.item.split(' — foto ')[0]
  return (ORDEM_SECAO.get(i.secao) ?? 99) * 1000 + (ORDEM_ITEM.get(`${i.secao}::${labelBase}`) ?? 999)
}

const STATUS_ITEM: Record<string, { label: string; className: string }> = {
  conforme: { label: 'Conforme', className: 'text-status-success' },
  nao_conforme: { label: 'Não conforme', className: 'text-status-danger' },
  pendente: { label: 'Pendente', className: 'text-status-warning' },
}

function LiberacaoDetalhe({ liberacao: l }: { liberacao: LiberacaoComVeiculo }) {
  const [itens, setItens] = useState<InspecaoItem[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    carregarItensInspecao(l.id)
      .then((data) => !cancelado && setItens([...data].sort((a, b) => ordemItem(a) - ordemItem(b))))
      .catch((err) => !cancelado && setErro(err?.message ?? 'Erro ao carregar itens.'))
    return () => {
      cancelado = true
    }
  }, [l.id])

  const secoesFoto = new Set(['Registro fotográfico', 'Fotos dos pneus'])
  const itensStatus = itens?.filter((i) => !secoesFoto.has(i.secao)) ?? []
  const fotos = itens?.filter((i) => i.foto_url) ?? []
  const problemas = itensStatus.filter((i) => i.status !== 'conforme')

  return (
    <div className="space-y-4 border-t border-border/10 p-4 text-sm">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <Info label="KM" value={l.km != null ? String(l.km) : '—'} />
        <Info label="Horímetro" value={l.horimetro != null ? String(l.horimetro) : '—'} />
        <Info label="Resp. manutenção" value={l.inspetor} />
        <Info
          label="Resp. liberação"
          value={`${l.responsavel_nome ?? '—'}${l.responsavel_cargo ? ` (${l.responsavel_cargo})` : ''}`}
        />
      </dl>

      {l.observacoes && (
        <div className="rounded-lg bg-background p-3 text-xs">
          <p className="mb-1 text-secondary">Observações / Pendências</p>
          <p className="whitespace-pre-wrap text-foreground">{l.observacoes}</p>
        </div>
      )}

      {erro && <p className="text-xs text-status-danger">{erro}</p>}
      {!itens && !erro && <p className="text-xs text-secondary">Carregando itens…</p>}

      {itens && (
        <>
          {problemas.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold text-foreground">Itens com problema</p>
              <ul className="space-y-1 text-xs">
                {problemas.map((i) => (
                  <li key={i.id}>
                    <span className={STATUS_ITEM[i.status]?.className}>{STATUS_ITEM[i.status]?.label}</span>
                    <span className="text-foreground"> — {i.item}</span>
                    {i.observacao && <span className="text-secondary"> ({i.observacao})</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <details className="text-xs">
            <summary className="cursor-pointer text-secondary">Checklist completo ({itensStatus.length} itens)</summary>
            <ul className="mt-2 divide-y divide-border/10">
              {itensStatus.map((i) => (
                <li key={i.id} className="flex justify-between gap-3 py-1.5">
                  <span className="text-foreground">{i.item}</span>
                  <span className={cn('shrink-0', STATUS_ITEM[i.status]?.className)}>{STATUS_ITEM[i.status]?.label}</span>
                </li>
              ))}
            </ul>
          </details>

          {fotos.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold text-foreground">Fotos ({fotos.length})</p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {fotos.map((i) => (
                  <a key={i.id} href={i.foto_url!} target="_blank" rel="noreferrer" className="block">
                    <img
                      src={i.foto_url!}
                      alt={i.item}
                      loading="lazy"
                      className="aspect-square w-full rounded-lg object-cover"
                    />
                    <p className="mt-0.5 truncate text-[10px] text-secondary">{i.item}</p>
                  </a>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {l.assinatura_url && (
        <div>
          <p className="mb-1 text-xs text-secondary">Assinatura</p>
          <img src={l.assinatura_url} alt="Assinatura" className="h-16 rounded-lg bg-white p-2" />
        </div>
      )}
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-secondary">{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  )
}
