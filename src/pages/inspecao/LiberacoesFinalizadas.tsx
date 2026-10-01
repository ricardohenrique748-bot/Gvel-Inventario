import { useEffect, useMemo, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { createPortal } from 'react-dom'
import { ChevronDown, Eye, FileDown, RefreshCw, Search, Share2, ShieldCheck, Trash2, X } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { isAdminUsuario } from '@/lib/permissoes'
import { AssinaturaForm } from './AssinaturaForm'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { sharePdf } from '@/lib/share'
import { gerarPdfLiberacaoSalva, montarHtmlLiberacaoSalva, nomeArquivoLiberacao } from './pdfLiberacaoSalva'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/cn'
import { formatDateTime } from '@/lib/format'
import { CHECKLIST_LIBERACAO } from '@/data/checklistSchema'
import {
  aprovarLiberacao,
  carregarItensInspecao,
  excluirLiberacao,
  useLiberacoes,
  type LiberacaoComVeiculo,
} from '@/hooks/useLiberacoes'
import type { InspecaoItem, StatusLiberacao } from '@/lib/types'
import { podeAprovarLiberacao, STATUS_LIBERACAO_COR, STATUS_LIBERACAO_LABEL } from './types'

type Filtro = 'todos' | 'aguardando' | StatusLiberacao

const FILTROS: { value: Filtro; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'aguardando', label: 'Aguardando aprovação' },
  { value: 'liberado', label: 'Liberados' },
  { value: 'liberado_restricao', label: 'Com restrição' },
  { value: 'nao_liberado', label: 'Não liberados' },
]

export function LiberacoesFinalizadas() {
  const { liberacoes, loading, erro, refetch } = useLiberacoes()
  const { user, perfil } = useAuth()
  const aprovador = podeAprovarLiberacao(user?.email)
  const admin = isAdminUsuario(perfil, user?.email)
  const [busca, setBusca] = useState('')
  // A Maria Clara já abre direto no que falta ela aprovar.
  const [filtro, setFiltro] = useState<Filtro>(aprovador ? 'aguardando' : 'todos')
  const [abertaId, setAbertaId] = useState<string | null>(null)
  const qtdAguardando = liberacoes.filter((l) => !l.status_liberacao).length

  const filtradas = useMemo(() => {
    const q = busca.trim().toUpperCase()
    return liberacoes.filter((l) => {
      if (filtro === 'aguardando' && l.status_liberacao) return false
      if (filtro !== 'todos' && filtro !== 'aguardando' && l.status_liberacao !== filtro) return false
      if (!q) return true
      return [l.veiculo?.placa, l.numero_os, l.veiculo?.cliente?.nome, l.inspetor, l.encarregado_nome, l.responsavel_nome].some((v) =>
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
            {f.value === 'aguardando' && qtdAguardando > 0 && ` (${qtdAguardando})`}
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
            aprovador={aprovador}
            admin={admin}
            onAprovada={refetch}
            onExcluida={refetch}
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
  aprovador,
  admin,
  onAprovada,
  onExcluida,
  aberta,
  onToggle,
}: {
  liberacao: LiberacaoComVeiculo
  aprovador: boolean
  admin: boolean
  onAprovada: () => void
  onExcluida: () => void
  aberta: boolean
  onToggle: () => void
}) {
  const status = l.status_liberacao
  const cor = status ? STATUS_LIBERACAO_COR[status] : COR_AGUARDANDO
  const [aprovando, setAprovando] = useState(false)
  const [excluindo, setExcluindo] = useState(false)
  const [erroExcluir, setErroExcluir] = useState<string | null>(null)

  async function excluir() {
    if (!admin) return
    const placa = l.veiculo?.placa ?? ''
    if (!confirm(`Excluir a liberação ${placa}${l.numero_os ? ` (OS ${l.numero_os})` : ''}? Essa ação não pode ser desfeita.`)) return
    setExcluindo(true)
    setErroExcluir(null)
    try {
      await excluirLiberacao(l.id)
      onExcluida()
    } catch (err) {
      console.error('[excluirLiberacao]', err)
      setErroExcluir(err instanceof Error ? err.message : 'Não foi possível excluir.')
      setExcluindo(false)
    }
  }

  return (
    <Card className="overflow-hidden">
      {/* Faixa colorida à esquerda = status (cinza aguardando, verde/amarelo/vermelho aprovado). */}
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-3 border-l-4 p-4 text-left"
        style={{ borderLeftColor: cor }}
      >
        <div className="min-w-0 flex-1 space-y-1">
          <span
            className="inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white"
            style={{ background: cor }}
          >
            {status ? STATUS_LIBERACAO_LABEL[status] : 'Aguardando aprovação'}
          </span>
          <p className="text-xl font-bold tracking-wide text-foreground">{l.veiculo?.placa ?? '—'}</p>
          <p className="text-sm font-medium text-foreground/80">
            {[l.veiculo?.marca?.nome, l.veiculo?.modelo?.nome].filter(Boolean).join(' ') || '—'}
          </p>
          <p className="text-sm text-secondary">{l.veiculo?.cliente?.nome ?? '—'}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-xs text-secondary">
            {l.numero_os && (
              <span>
                OS <strong className="text-foreground">{l.numero_os}</strong>
              </span>
            )}
            <span>{formatDateTime(l.data_hora)}</span>
          </div>
        </div>
        <ChevronDown className={cn('mt-1 h-5 w-5 shrink-0 text-secondary transition-transform', aberta && 'rotate-180')} />
      </button>

      {status ? (
        <AcoesPdf liberacao={l} />
      ) : aprovador ? (
        <div className="px-4 pb-4">
          {aprovando ? (
            <div className="rounded-xl border border-secondary/20 p-4">
              <p className="mb-4 text-sm font-semibold text-foreground">Aprovação da liberação</p>
              <AprovarLiberacao
                liberacao={l}
                onCancelar={() => setAprovando(false)}
                onAprovada={() => {
                  setAprovando(false)
                  onAprovada()
                }}
              />
            </div>
          ) : (
            <div className="flex gap-2">
              <Button type="button" size="md" className="flex-1" onClick={() => setAprovando(true)}>
                <ShieldCheck className="h-4 w-4" />
                Aprovar liberação
              </Button>
              <BotaoVerPdf liberacao={l} />
            </div>
          )}
        </div>
      ) : (
        <div className="mx-4 mb-4 space-y-2">
          <p className="rounded-lg bg-background px-3 py-2 text-sm text-secondary">
            ⏳ Aguardando aprovação da <strong className="text-foreground">Maria Clara</strong>. Compartilhar fica disponível depois.
          </p>
          <BotaoVerPdf liberacao={l} className="w-full" />
        </div>
      )}

      {admin && (
        <div className="-mt-2 flex flex-col items-end px-4 pb-3">
          <button
            type="button"
            onClick={excluir}
            disabled={excluindo}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-status-danger hover:bg-status-danger/10 disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {excluindo ? 'Excluindo…' : 'Excluir liberação'}
          </button>
          {erroExcluir && <p className="mt-1 text-xs text-status-danger">{erroExcluir}</p>}
        </div>
      )}

      {aberta && <LiberacaoDetalhe liberacao={l} />}
    </Card>
  )
}

const COR_AGUARDANDO = '#6B7280'

/** Largura do relatório no PDF (A4 em px, ver generatePdfFromHtml). */
const LARGURA_RELATORIO = 794

function BotaoVerPdf({ liberacao: l, className }: { liberacao: LiberacaoComVeiculo; className?: string }) {
  const [html, setHtml] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function abrir() {
    setCarregando(true)
    setErro(null)
    try {
      setHtml(await montarHtmlLiberacaoSalva(l))
    } catch (err) {
      console.error('[BotaoVerPdf]', err)
      setErro('Não foi possível montar a prévia.')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <>
      <Button type="button" size="md" variant="secondary" onClick={abrir} disabled={carregando} className={className}>
        <Eye className="h-4 w-4" />
        {carregando ? 'Abrindo…' : 'Ver PDF'}
      </Button>
      {erro && <p className="mt-1 text-xs text-status-danger">{erro}</p>}
      {html && <PreviewRelatorio html={html} titulo={`Liberação ${l.veiculo?.placa ?? ''}`} onFechar={() => setHtml(null)} />}
    </>
  )
}

/**
 * Prévia do relatório na tela, com o mesmo HTML que vira PDF. Não abre o PDF em si
 * porque o WebView do app Android não mostra PDF embutido.
 */
function PreviewRelatorio({ html, titulo, onFechar }: { html: string; titulo: string; onFechar: () => void }) {
  const [escala, setEscala] = useState(1)

  useEffect(() => {
    // Encolhe a folha A4 pra caber na largura do celular.
    const ajustar = () => setEscala(Math.min(1, (window.innerWidth - 24) / LARGURA_RELATORIO))
    ajustar()
    window.addEventListener('resize', ajustar)
    const fecharNoEsc = (e: KeyboardEvent) => e.key === 'Escape' && onFechar()
    window.addEventListener('keydown', fecharNoEsc)
    return () => {
      window.removeEventListener('resize', ajustar)
      window.removeEventListener('keydown', fecharNoEsc)
    }
  }, [onFechar])

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/85">
      <div className="flex items-center justify-between gap-3 px-4 py-3 text-white">
        <p className="truncate text-sm font-semibold">Prévia do PDF · {titulo}</p>
        <button
          type="button"
          onClick={onFechar}
          aria-label="Fechar prévia"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="flex-1 overflow-auto px-3 pb-6">
        <div
          className="mx-auto bg-white shadow-2xl"
          style={{ width: LARGURA_RELATORIO, zoom: escala }}
          // HTML montado por buildInspecaoReportHtml, com os textos de usuário escapados.
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>,
    document.body,
  )
}

function AprovarLiberacao({
  liberacao: l,
  onCancelar,
  onAprovada,
}: {
  liberacao: LiberacaoComVeiculo
  onCancelar: () => void
  onAprovada: () => void
}) {
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  return (
    <>
      <AssinaturaForm
        comStatus
        labelNome="Responsável pela liberação"
        textoDeclaracao="Declaro que conferi o checklist e as fotos desta liberação."
        inicial={{ observacoes: l.observacoes ?? undefined }}
        labelVoltar="Cancelar"
        labelConfirmar="Aprovar"
        confirmando={salvando}
        onVoltar={onCancelar}
        onConfirmar={async (dados) => {
          setSalvando(true)
          setErro(null)
          try {
            await aprovarLiberacao(l.id, dados)
            onAprovada()
          } catch (err) {
            console.error('[AprovarLiberacao]', err)
            const msg = err && typeof err === 'object' && 'message' in err ? String(err.message) : ''
            setErro(`Não foi possível aprovar.${msg ? ` (${msg})` : ''}`)
          } finally {
            setSalvando(false)
          }
        }}
      />
      {erro && <p className="mt-2 text-xs text-status-danger">{erro}</p>}
    </>
  )
}

function AcoesPdf({ liberacao: l }: { liberacao: LiberacaoComVeiculo }) {
  const [gerando, setGerando] = useState<'compartilhar' | 'baixar' | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const nativo = Capacitor.isNativePlatform()

  async function executar(acao: 'compartilhar' | 'baixar') {
    setGerando(acao)
    setErro(null)
    try {
      const doc = await gerarPdfLiberacaoSalva(l)
      const nome = nomeArquivoLiberacao(l)
      if (acao === 'baixar') doc.save(nome)
      else await sharePdf(doc, nome, `Liberação ${l.veiculo?.placa ?? ''}`.trim())
    } catch (err) {
      console.error('[AcoesPdf]', err)
      setErro(err instanceof Error ? err.message : 'Não foi possível gerar o PDF.')
    } finally {
      setGerando(null)
    }
  }

  return (
    <div className="px-4 pb-4">
      <div className="flex gap-2">
        <button
          type="button"
          className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 text-sm font-medium text-white transition-colors hover:bg-[#1ebe5b] disabled:opacity-50"
          onClick={() => executar('compartilhar')}
          disabled={gerando !== null}
        >
          <Share2 className="h-4 w-4" />
          {gerando === 'compartilhar' ? 'Gerando PDF…' : 'Compartilhar no WhatsApp'}
        </button>
        <BotaoVerPdf liberacao={l} />
        {!nativo && (
          <Button
            type="button"
            size="md"
            variant="secondary"
            onClick={() => executar('baixar')}
            disabled={gerando !== null}
            title="Baixar PDF"
          >
            <FileDown className="h-4 w-4" />
            <span className="hidden sm:inline">{gerando === 'baixar' ? 'Gerando…' : 'Baixar PDF'}</span>
          </Button>
        )}
      </div>
      {erro && <p className="mt-2 text-xs text-status-danger">{erro}</p>}
    </div>
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

  // Item de foto é salvo como 'conforme' + foto. Linhas de status "de verdade" só existem
  // em liberações antigas (antes do checklist virar só fotos).
  const itensStatus = itens?.filter((i) => !i.foto_url || i.status !== 'conforme') ?? []
  const fotos = itens?.filter((i) => i.foto_url) ?? []
  const problemas = itensStatus.filter((i) => i.status !== 'conforme')

  return (
    <div className="space-y-5 border-t border-border/10 p-4 text-sm">
      <dl className="grid grid-cols-2 gap-2">
        <Info label="KM" value={l.km != null ? l.km.toLocaleString('pt-BR') : '—'} />
        <Info label="Horímetro" value={l.horimetro != null ? l.horimetro.toLocaleString('pt-BR') : '—'} />
        <Info label="Resp. manutenção" value={l.inspetor || '—'} />
        <Info label="Encarregado" value={l.encarregado_nome || l.inspetor || '—'} />
        <Info
          label="Resp. liberação"
          value={l.responsavel_nome ? `${l.responsavel_nome}${l.responsavel_cargo ? ` (${l.responsavel_cargo})` : ''}` : 'Aguardando'}
        />
      </dl>

      {l.observacoes && (
        <div className="rounded-lg bg-background p-3">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-secondary">Observações / Pendências</p>
          <p className="whitespace-pre-wrap text-sm text-foreground">{l.observacoes}</p>
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

          {itensStatus.length > 0 && (
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
          )}

          {fotos.length > 0 && (
            <div className="space-y-4">
              <p className="text-base font-bold text-foreground">Fotos <span className="text-sm font-medium text-secondary">({fotos.length})</span></p>
              {/* Agrupadas por seção, na ordem do checklist, com o nome inteiro do item. */}
              {agruparPorSecao(fotos).map(([secao, fotosSecao]) => (
                <div key={secao}>
                  <p className="mb-2 border-b border-border/10 pb-1 text-xs font-bold uppercase tracking-wide text-primary">
                    {secao}
                  </p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {fotosSecao.map((i) => (
                      <a key={i.id} href={i.foto_url!} target="_blank" rel="noreferrer" className="block">
                        <img
                          src={i.foto_url!}
                          alt={i.item}
                          loading="lazy"
                          className="aspect-square w-full rounded-lg object-cover"
                        />
                        <p className="mt-1.5 text-sm leading-snug text-foreground">{nomeFoto(i.item)}</p>
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {(l.assinatura_encarregado_url || l.assinatura_url) && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {l.assinatura_encarregado_url && (
            <Assinatura
              titulo="Encarregado"
              url={l.assinatura_encarregado_url}
              nome={l.encarregado_nome || l.inspetor}
              quando={l.data_hora}
            />
          )}
          {l.assinatura_url && (
            <Assinatura
              titulo="Liberação"
              url={l.assinatura_url}
              nome={l.responsavel_nome ?? ''}
              quando={l.aprovado_em ?? l.data_hora}
            />
          )}
        </div>
      )}
    </div>
  )
}

function Assinatura({ titulo, url, nome, quando }: { titulo: string; url: string; nome: string; quando: string }) {
  return (
    <div>
      <p className="mb-1 text-xs text-secondary">Assinatura — {titulo}</p>
      <img src={url} alt={`Assinatura ${titulo}`} className="h-16 rounded-lg bg-white p-2" />
      <p className="mt-1 text-xs text-foreground">{nome}</p>
      <p className="text-[11px] text-secondary">{formatDateTime(quando)}</p>
    </div>
  )
}

function agruparPorSecao(itens: InspecaoItem[]): [string, InspecaoItem[]][] {
  const grupos = new Map<string, InspecaoItem[]>()
  for (const i of itens) grupos.set(i.secao, [...(grupos.get(i.secao) ?? []), i])
  return [...grupos.entries()]
}

/** "Pneus — foto 3" → "Pneus (3)"; o resto fica como está. */
function nomeFoto(item: string) {
  const [base, n] = item.split(' — foto ')
  return n ? `${base} (${n})` : base
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-background px-3 py-2">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-secondary">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-semibold text-foreground">{value}</dd>
    </div>
  )
}
