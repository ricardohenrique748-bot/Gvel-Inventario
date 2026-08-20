import { useState, useEffect, useMemo } from 'react'
import {
  Wrench,
  Zap,
  Hammer,
  Palette,
  Sparkles,
  Check,
  CheckCircle2,
  RotateCcw,
  Timer,
  User,
  FileCheck,
  Save,
  Plus,
  Trash2,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Label, Select } from '@/components/ui/Input'
import { useStatusManutencao } from '@/hooks/useStatusManutencao'
import { atualizarStatusMovimentacao } from '@/hooks/useMovimentacoes'
import { useChecklistOS } from '@/hooks/useChecklistOS'
import type { ItemRow } from '@/hooks/useChecklistOS'
import {
  formatMinutosParaTexto,
  permanenciaEmMinutos,
  nowLocalInputValue,
} from '@/lib/format'
import { differenceInMinutes } from 'date-fns'
import type { MovimentacaoComVeiculo } from '@/lib/types'
import { EQUIPE_GVEL, FUNCOES_EQUIPE, buscarFuncaoPorNome } from '@/constants/equipe'

// ─── Tipos exportados (usados pelo hook de migração) ─────────────────────────

export interface ItemChecklist {
  id: string
  label: string
  isCustom?: boolean
}

export interface SecaoChecklist {
  id: string
  titulo: string
  icone: typeof Wrench
  cor: string
  itens: ItemChecklist[]
}

/** @deprecated Mantido apenas para compatibilidade com a migração do localStorage */
export interface ItemChecklistData {
  checked: boolean
  horaInicio?: string
  horaFim?: string
  mecanico?: string
  historicoId?: string
}

export const SECOES_PADRAO: SecaoChecklist[] = [
  {
    id: 'mecanica',
    titulo: 'MECÂNICA',
    icone: Wrench,
    cor: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
    itens: [
      { id: 'mec_motor_transmissao', label: 'MOTOR E TRANSMISSÃO' },
      { id: 'mec_freios_suspensao', label: 'FREIOS E SUSPENSÃO' },
      { id: 'mec_vazamentos_fluidos', label: 'VAZAMENTOS E NÍVEIS DE FLUIDOS' },
    ],
  },
  {
    id: 'eletrica',
    titulo: 'ELÉTRICA',
    icone: Zap,
    cor: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
    itens: [
      { id: 'ele_bateria_carga', label: 'BATERIA E SISTEMA DE CARGA' },
      { id: 'ele_iluminacao_sinalizacao', label: 'ILUMINAÇÃO E SINALIZAÇÃO' },
      { id: 'ele_painel_eletricos', label: 'PAINEL E COMPONENTES ELÉTRICOS' },
    ],
  },
  {
    id: 'funilaria',
    titulo: 'FUNILARIA',
    icone: Hammer,
    cor: 'text-orange-500 bg-orange-500/10 border-orange-500/20',
    itens: [
      { id: 'fun_lataria_amassados', label: 'LATARIA E AMASSADOS' },
      { id: 'fun_portas_capo_tampas', label: 'PORTAS, CAPÔ E TAMPAS' },
      { id: 'fun_parachoques_acabamentos', label: 'PARA-CHOQUES E ACABAMENTOS' },
    ],
  },
  {
    id: 'pintura',
    titulo: 'PINTURA',
    icone: Palette,
    cor: 'text-purple-500 bg-purple-500/10 border-purple-500/20',
    itens: [
      { id: 'pin_riscos_arranhoes', label: 'RISCOS E ARRANHÕES' },
      { id: 'pin_descascados_manchas', label: 'DESCASCADOS E MANCHAS' },
      { id: 'pin_diferenca_tonalidade', label: 'DIFERENÇA DE TONALIDADE' },
    ],
  },
  {
    id: 'estetica',
    titulo: 'ESTÉTICA',
    icone: Sparkles,
    cor: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
    itens: [
      { id: 'est_limpeza_interna', label: 'LIMPEZA INTERNA' },
      { id: 'est_limpeza_externa', label: 'LIMPEZA EXTERNA' },
      { id: 'est_bancos_painel_revestimentos', label: 'BANCOS, PAINEL E REVESTIMENTOS' },
    ],
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nowTimeString() {
  const now = new Date()
  return now.toTimeString().slice(0, 5)
}

function nowDateString() {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function calcularDuracaoHorasMin(
  inicio?: string,
  fim?: string,
  dataInicio?: string,
  dataFim?: string,
): { minutos: number; texto: string; emAndamento?: boolean } | null {
  if (!inicio) return null

  // Se tem início apontado mas não tem fim, a atividade está em andamento!
  if (!fim) {
    return { minutos: 0, texto: 'EM ANDAMENTO', emAndamento: true }
  }

  if (dataInicio && dataFim) {
    const d1 = new Date(`${dataInicio}T${inicio}:00`)
    const d2 = new Date(`${dataFim}T${fim}:00`)
    if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
      const diff = Math.round((d2.getTime() - d1.getTime()) / 60000)
      if (diff >= 0) return { minutos: diff, texto: formatMinutosParaTexto(diff).toUpperCase(), emAndamento: false }
    }
  }

  const [h1, m1] = inicio.split(':').map(Number)
  const [h2, m2] = fim.split(':').map(Number)
  if (isNaN(h1) || isNaN(m1) || isNaN(h2) || isNaN(m2)) return null
  let min = h2 * 60 + m2 - (h1 * 60 + m1)
  if (min < 0) min += 24 * 60
  return { minutos: min, texto: formatMinutosParaTexto(min).toUpperCase(), emAndamento: false }
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface ChecklistManutencaoCardProps {
  movimentacao: MovimentacaoComVeiculo
  onStatusChange?: () => void | Promise<void>
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function ChecklistManutencaoCard({ movimentacao, onStatusChange }: ChecklistManutencaoCardProps) {
  const { statusManutencao } = useStatusManutencao()

  // ── Dados do Supabase (O.S + itens) ────────────────────────────────────────
  const {
    osData,
    items: itemsDB,
    loading,
    salvarOS,
    salvarItem,
    removerItem,
    limparTodos,
  } = useChecklistOS(movimentacao.id)

  // ── Estado local de UI ──────────────────────────────────────────────────────
  // Campos gerais do formulário (espelham osData com edição local antes de salvar)
  const [mecanico, setMecanico] = useState('')
  const [funcao, setFuncao] = useState('')
  const [setor, setSetor] = useState('')
  const [statusOS, setStatusOS] = useState('EM ANDAMENTO')
  const [dataHoraAbertura, setDataHoraAbertura] = useState('')
  const [dataHoraFechamento, setDataHoraFechamento] = useState('')

  // Sincroniza os campos locais quando o banco carrega/atualiza (Realtime)
  useEffect(() => {
    setMecanico(osData.mecanico)
    setFuncao(osData.funcao)
    setSetor(osData.setor)
    setStatusOS(osData.statusOS || 'EM ANDAMENTO')
    setDataHoraAbertura(osData.dataHoraAbertura)
    setDataHoraFechamento(osData.dataHoraFechamento)
  }, [osData])

  // Seções (padrão + customizadas vindas do banco)
  const [secoes, setSecoes] = useState<SecaoChecklist[]>(SECOES_PADRAO)

  // Reconstrói as seções quando os itens do banco mudam (inclui itens customizados)
  useEffect(() => {
    const customPorSecao: Record<string, ItemChecklist[]> = {}
    for (const row of Object.values(itemsDB)) {
      if (row.is_custom) {
        if (!customPorSecao[row.secao_id]) customPorSecao[row.secao_id] = []
        customPorSecao[row.secao_id].push({ id: row.item_id, label: row.label, isCustom: true })
      }
    }
    setSecoes(
      SECOES_PADRAO.map((sec) => ({
        ...sec,
        itens: [...sec.itens, ...(customPorSecao[sec.id] ?? [])],
      })),
    )
  }, [itemsDB])

  const [adicionandoEmSecao, setAdicionandoEmSecao] = useState<string | null>(null)
  const [novoItemNome, setNovoItemNome] = useState('')
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({})
  const [salvandoDados, setSalvandoDados] = useState(false)
  const [salvandoStatus, setSalvandoStatus] = useState(false)
  const [sucessoSalvar, setSucessoSalvar] = useState(false)
  const [salvoItemId, setSalvoItemId] = useState<string | null>(null)

  // ── Cálculos ────────────────────────────────────────────────────────────────

  const totalItens = useMemo(() => secoes.reduce((acc, sec) => acc + sec.itens.length, 0), [secoes])

  const itensConcluidos = useMemo(
    () => Object.values(itemsDB).filter((d) => d.checked).length,
    [itemsDB],
  )

  const porcentagem = totalItens > 0 ? Math.round((itensConcluidos / totalItens) * 100) : 0

  const totalMinutosAtividades = useMemo(() => {
    let soma = 0
    for (const data of Object.values(itemsDB)) {
      if (data.hora_inicio && data.hora_fim) {
        const dur = calcularDuracaoHorasMin(data.hora_inicio, data.hora_fim, data.data_inicio || data.data, data.data_fim)
        if (dur) soma += dur.minutos
      }
    }
    return soma
  }, [itemsDB])

  const calculoHorasGeral = useMemo(() => {
    if (!dataHoraAbertura) return { texto: 'AGUARDANDO ABERTURA', minutos: 0, status: 'pendente' as const }
    const dInicio = new Date(dataHoraAbertura)
    if (dataHoraFechamento) {
      const dFim = new Date(dataHoraFechamento)
      const minutos = differenceInMinutes(dFim, dInicio)
      if (minutos < 0) return { texto: 'DATA DE FECHAMENTO ANTERIOR À ABERTURA', minutos: 0, status: 'erro' as const }
      return { texto: formatMinutosParaTexto(minutos).toUpperCase(), minutos, status: 'fechado' as const }
    }
    const minutos = permanenciaEmMinutos(dInicio.toISOString())
    return { texto: `${formatMinutosParaTexto(minutos).toUpperCase()} (EM ANDAMENTO)`, minutos, status: 'em_andamento' as const }
  }, [dataHoraAbertura, dataHoraFechamento])

  // ── Handlers de O.S ─────────────────────────────────────────────────────────

  function handleMecanicoChange(val: string) {
    const valUpper = val.toUpperCase()
    setMecanico(valUpper)
    let dtAbertura = dataHoraAbertura
    if (valUpper.trim().length > 0 && !dtAbertura) {
      dtAbertura = nowLocalInputValue()
      setDataHoraAbertura(dtAbertura)
    }
    const funcAuto = buscarFuncaoPorNome(valUpper)
    if (funcAuto) {
      setFuncao(funcAuto)
      salvarOS({ mecanico: valUpper, funcao: funcAuto, dataHoraAbertura: dtAbertura })
    } else {
      salvarOS({ mecanico: valUpper, dataHoraAbertura: dtAbertura })
    }
  }

  function handleFuncaoChange(val: string) {
    const valUpper = val.toUpperCase()
    setFuncao(valUpper)
    salvarOS({ funcao: valUpper })
  }

  function handleDataHoraAberturaChange(val: string) {
    setDataHoraAbertura(val)
    salvarOS({ dataHoraAbertura: val })
  }

  function handleDataHoraFechamentoChange(val: string) {
    setDataHoraFechamento(val)
    salvarOS({ dataHoraFechamento: val })
  }

  function handleFinalizarOS() {
    const resp = mecanico.trim() || Object.values(itemsDB).find((i) => i.mecanico)?.mecanico || ''
    if (!resp) {
      alert('POR FAVOR, INFORME O NOME DO RESPONSÁVEL / MECÂNICO ANTES DE FINALIZAR A O.S.')
      return
    }
    const dtAgora = nowLocalInputValue()
    setDataHoraFechamento(dtAgora)
    salvarOS({
      mecanico: resp,
      dataHoraFechamento: dtAgora,
      dataHoraAbertura: dataHoraAbertura || dtAgora,
      statusOS: 'CONCLUÍDO',
    })
    setSucessoSalvar(true)
    setTimeout(() => setSucessoSalvar(false), 3000)
  }

  function handleStatusOSChange(val: string) {
    setStatusOS(val)
    salvarOS({ statusOS: val })
  }

  function handleReabrirOS() {
    setDataHoraFechamento('')
    salvarOS({ dataHoraFechamento: '' })
    setSucessoSalvar(true)
    setTimeout(() => setSucessoSalvar(false), 3000)
  }

  async function salvarDadosServico() {
    setSalvandoDados(true)
    setSucessoSalvar(false)
    await salvarOS({ mecanico, funcao, setor, statusOS, dataHoraAbertura, dataHoraFechamento })
    setSucessoSalvar(true)
    setTimeout(() => setSucessoSalvar(false), 3000)
    setSalvandoDados(false)
  }

  async function handleAlterarStatus(novoStatusId: string) {
    setSalvandoStatus(true)
    try {
      await atualizarStatusMovimentacao(movimentacao.id, novoStatusId || null)
      if (onStatusChange) await onStatusChange()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'ERRO AO ATUALIZAR STATUS.')
    } finally {
      setSalvandoStatus(false)
    }
  }

  // ── Handlers de itens ────────────────────────────────────────────────────────

  function buildRow(secaoId: string, item: ItemChecklist, patch: Partial<ItemRow>): ItemRow {
    const existing = itemsDB[item.id]
    return {
      item_id: item.id,
      secao_id: secaoId,
      label: item.label,
      is_custom: Boolean(item.isCustom),
      checked: existing?.checked ?? false,
      data: existing?.data ?? '',
      data_inicio: existing?.data_inicio ?? existing?.data ?? '',
      data_fim: existing?.data_fim ?? '',
      hora_inicio: existing?.hora_inicio ?? '',
      hora_fim: existing?.hora_fim ?? '',
      mecanico: existing?.mecanico ?? '',
      ...patch,
    }
  }

  function toggleItem(secaoId: string, item: ItemChecklist) {
    const existing = itemsDB[item.id]
    const nextChecked = !(existing?.checked ?? false)
    const dataInicio = existing?.data_inicio || existing?.data || (nextChecked ? nowDateString() : '')
    const horaInicio =
      nextChecked && !(existing?.hora_inicio)
        ? nowTimeString()
        : existing?.hora_inicio ?? ''

    salvarItem(buildRow(secaoId, item, {
      checked: nextChecked,
      mecanico: existing?.mecanico || mecanico,
      data: dataInicio,
      data_inicio: dataInicio,
      data_fim: existing?.data_fim ?? '',
      hora_inicio: horaInicio,
      hora_fim: existing?.hora_fim ?? '',
    }))
  }

  function updateItemPatch(secaoId: string, item: ItemChecklist, patch: Partial<ItemRow>) {
    salvarItem(buildRow(secaoId, item, patch))
  }

  async function adicionarNovoItem(secaoId: string) {
    if (!novoItemNome.trim()) return
    const customId = `custom_${secaoId}_${Date.now()}`
    const label = novoItemNome.trim().toUpperCase()

    await salvarItem({
      item_id: customId,
      secao_id: secaoId,
      label,
      is_custom: true,
      checked: false,
      hora_inicio: '',
      hora_fim: '',
      mecanico: '',
    })

    setNovoItemNome('')
    setAdicionandoEmSecao(null)
  }

  async function marcarTodos() {
    const todos = secoes.flatMap((sec) =>
      sec.itens.map((item) =>
        buildRow(sec.id, item, {
          checked: true,
          mecanico: itemsDB[item.id]?.mecanico || mecanico,
        }),
      ),
    )
    for (const row of todos) await salvarItem(row)
  }

  function toggleExpandItem(itemId: string) {
    setExpandedItems((prev) => ({ ...prev, [itemId]: !prev[itemId] }))
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Card className="border-border/60 p-10 text-center uppercase">
        <div className="flex flex-col items-center gap-3 text-secondary">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-secondary/30 border-t-primary" />
          <p className="text-xs font-semibold">CARREGANDO CHECKLIST…</p>
        </div>
      </Card>
    )
  }

  return (
    <Card className="border-border/60 space-y-5 p-5 uppercase">
      {/* Header do Card */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/20 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <FileCheck className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-bold text-foreground">CHECKLIST DE INSPEÇÃO DE VEÍCULO</h3>
          </div>
          <p className="text-xs text-secondary">
            INSPEÇÃO E APONTAMENTO DE HORAS PARA{' '}
            <strong className="text-foreground font-mono">{movimentacao.veiculo?.placa}</strong> — ALIMENTANDO O{' '}
            <strong>INDICADOR DE PERFORMANCE</strong>
          </p>
        </div>

        {/* Status e Ações Rápidas */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-secondary">STATUS:</span>
            <Select
              value={movimentacao.status_id ?? ''}
              onChange={(e) => handleAlterarStatus(e.target.value)}
              disabled={salvandoStatus}
              className="!h-8 !text-xs !px-2.5 !w-auto"
            >
              <option value="">SEM MANUTENÇÃO</option>
              {statusManutencao.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome.toUpperCase()}
                </option>
              ))}
            </Select>
          </div>

          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={marcarTodos}
            className="!h-8 !text-xs !px-3 uppercase font-semibold"
          >
            <Check className="h-3.5 w-3.5 mr-1" />
            MARCAR TODOS
          </Button>

          {itensConcluidos > 0 && (
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={limparTodos}
              className="!h-8 !text-xs !px-3 text-secondary hover:text-red-400 uppercase font-semibold"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              LIMPAR
            </Button>
          )}
        </div>
      </div>

      {/* BLOCO: Dados do Mecânico / Abertura / Fechamento */}
      <div className="rounded-2xl border border-border/30 bg-surface/60 p-4 sm:p-5 space-y-4 shadow-sm backdrop-blur-sm">
        {/* Cabeçalho do Bloco */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 border-b border-border/15 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 text-primary">
              <User className="h-4 w-4" />
            </div>
            <span className="text-xs sm:text-sm font-black text-foreground tracking-wide uppercase">
              RESPONSÁVEL PRINCIPAL &amp; APONTAMENTO DE HORAS
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {totalMinutosAtividades > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-primary/30 bg-primary/10 text-primary text-[11px] font-black uppercase">
                <Clock className="h-3.5 w-3.5" />
                <span>ATIVIDADES: {formatMinutosParaTexto(totalMinutosAtividades).toUpperCase()}</span>
              </div>
            )}
            <div
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border text-[11px] font-black uppercase ${
                calculoHorasGeral.status === 'fechado'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : calculoHorasGeral.status === 'em_andamento'
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 animate-pulse'
                    : calculoHorasGeral.status === 'erro'
                      ? 'bg-red-500/10 border-red-500/30 text-red-400'
                      : 'bg-secondary/10 border-border/30 text-secondary'
              }`}
            >
              <Timer className="h-3.5 w-3.5" />
              <span>DURAÇÃO: {calculoHorasGeral.texto}</span>
            </div>
          </div>
        </div>

        {/* Grid de Inputs: 4 Colunas Perfeitas no Desktop e Adaptativas no Mobile */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Mecânico Principal / Responsável */}
          <div className="flex flex-col justify-between">
            <Label htmlFor="mecanico-nome" className="!text-[11px] !mb-1.5 font-bold text-secondary uppercase tracking-wider h-5 flex items-center">
              MECÂNICO PRINCIPAL
            </Label>
            <Select
              id="mecanico-nome"
              value={mecanico}
              onChange={(e) => handleMecanicoChange(e.target.value)}
              className="!h-10 !text-xs !px-3 uppercase font-bold text-foreground border-border/40 focus:border-primary bg-surface"
            >
              <option value="">SELECIONE O RESPONSÁVEL...</option>
              {EQUIPE_GVEL.map((m) => (
                <option key={m.nome} value={m.nome}>
                  {m.nome}
                </option>
              ))}
              {mecanico && !EQUIPE_GVEL.some((m) => m.nome === mecanico) && (
                <option value={mecanico}>{mecanico}</option>
              )}
            </Select>
          </div>

          {/* Função / Cargo */}
          <div className="flex flex-col justify-between">
            <Label htmlFor="mecanico-funcao" className="!text-[11px] !mb-1.5 font-bold text-secondary uppercase tracking-wider h-5 flex items-center">
              FUNÇÃO / CARGO
            </Label>
            <Select
              id="mecanico-funcao"
              value={funcao}
              onChange={(e) => handleFuncaoChange(e.target.value)}
              className="!h-10 !text-xs !px-3 uppercase font-bold text-foreground border-border/40 focus:border-primary bg-surface"
            >
              <option value="">SELECIONE A FUNÇÃO...</option>
              {FUNCOES_EQUIPE.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
              {funcao && !FUNCOES_EQUIPE.includes(funcao) && (
                <option value={funcao}>{funcao}</option>
              )}
            </Select>
          </div>

          {/* Abertura */}
          <div className="flex flex-col justify-between">
            <div className="flex items-center justify-between !mb-1.5 h-5">
              <Label htmlFor="data-hora-abertura" className="!text-[11px] font-bold text-secondary uppercase tracking-wider">
                ABERTURA
              </Label>
              <button
                type="button"
                onClick={() => handleDataHoraAberturaChange(nowLocalInputValue())}
                className="text-[10px] text-primary hover:underline font-black uppercase cursor-pointer"
              >
                AGORA
              </button>
            </div>
            <Input
              id="data-hora-abertura"
              type="datetime-local"
              value={dataHoraAbertura}
              onChange={(e) => handleDataHoraAberturaChange(e.target.value)}
              className="!h-10 !text-xs !px-3 text-foreground font-semibold border-border/40 focus:border-primary"
            />
          </div>

          {/* Fechamento */}
          <div className="flex flex-col justify-between">
            <div className="flex items-center justify-between !mb-1.5 h-5">
              <Label htmlFor="data-hora-fechamento" className="!text-[11px] font-bold text-secondary uppercase tracking-wider">
                FECHAMENTO
              </Label>
              <button
                type="button"
                onClick={() => handleDataHoraFechamentoChange(nowLocalInputValue())}
                className="text-[10px] text-primary hover:underline font-black uppercase cursor-pointer"
              >
                AGORA
              </button>
            </div>
            <Input
              id="data-hora-fechamento"
              type="datetime-local"
              value={dataHoraFechamento}
              onChange={(e) => handleDataHoraFechamentoChange(e.target.value)}
              className="!h-10 !text-xs !px-3 text-foreground font-semibold border-border/40 focus:border-primary"
            />
          </div>
        </div>

        {/* Campo Status da O.S */}
        <div className="pt-3 border-t border-border/15 space-y-2.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="status-os-field" className="!text-[11px] font-bold text-secondary uppercase tracking-wider">
              STATUS DA O.S / ETAPA ATUAL
            </Label>
            <span className="text-xs font-black text-primary uppercase">
              {statusOS}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {[
              { id: 'EM ANDAMENTO', label: '🟢 EM ANDAMENTO', cor: 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10' },
              { id: 'AGUARDANDO PEÇAS', label: '⏳ AGUARD. PEÇAS', cor: 'border-amber-500/40 text-amber-400 bg-amber-500/10' },
              { id: 'AGUARDANDO APROVAÇÃO DO ORÇAMENTO', label: '📄 AGUARD. ORÇAMENTO', cor: 'border-purple-500/40 text-purple-400 bg-purple-500/10' },
              { id: 'AGUARDANDO AUTORIZAÇÃO', label: '⚠️ AGUARD. AUTORIZAÇÃO', cor: 'border-orange-500/40 text-orange-400 bg-orange-500/10' },
              { id: 'AGUARDANDO APROVAÇÃO MULTILIXO', label: '🏢 AGUARD. MULTILIXO', cor: 'border-cyan-500/40 text-cyan-400 bg-cyan-500/10' },
              { id: 'AGUARDANDO APROVAÇÃO DO CLIENTE', label: '👥 AGUARD. CLIENTE', cor: 'border-pink-500/40 text-pink-400 bg-pink-500/10' },
            ].map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => handleStatusOSChange(st.id)}
                className={`py-2 px-2 rounded-xl text-[11px] font-bold uppercase transition-all flex items-center justify-center gap-1 border text-center cursor-pointer ${
                  statusOS === st.id
                    ? `${st.cor} ring-2 ring-primary/40 shadow-sm`
                    : 'border-border/20 bg-surface/50 text-secondary hover:text-foreground hover:border-border/60'
                }`}
              >
                <span className="truncate">{st.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/20">
          <div className="flex items-center gap-2 flex-wrap">
            {sucessoSalvar && (
              <span className="text-emerald-400 text-xs font-bold flex items-center gap-1 uppercase">
                <Check className="h-3.5 w-3.5" /> SALVO COM SUCESSO!
              </span>
            )}
            {dataHoraFechamento && (
              <span className="px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-black uppercase flex items-center gap-1.5">
                🏁 O.S FINALIZADA
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {dataHoraFechamento ? (
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={handleReabrirOS}
                className="!h-9 !text-xs !px-3.5 uppercase font-bold text-secondary hover:text-foreground border border-border/40"
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                REABRIR O.S
              </Button>
            ) : (
              <Button
                type="button"
                size="md"
                onClick={handleFinalizarOS}
                className="!h-9 !text-xs !px-4 uppercase font-black bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-all active:scale-95"
              >
                🏁 FINALIZAR O.S
              </Button>
            )}

            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={salvarDadosServico}
              disabled={salvandoDados}
              className="!h-9 !text-xs !px-3.5 uppercase font-bold"
            >
              <Save className="h-3.5 w-3.5 mr-1" />
              {salvandoDados ? 'SALVANDO…' : 'SALVAR'}
            </Button>
          </div>
        </div>
      </div>

      {/* Barra de Progresso */}
      <div className="rounded-xl border border-border/30 bg-background/50 p-3.5 space-y-2">
        <div className="flex items-center justify-between text-xs uppercase">
          <span className="font-semibold text-foreground flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            PROGRESSO DA INSPEÇÃO
          </span>
          <span className="font-medium text-secondary">
            <strong className="text-foreground">{itensConcluidos}</strong> DE {totalItens} ITENS VERIFICADOS ({porcentagem}%)
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-secondary/15">
          <div
            className={`h-full transition-all duration-300 rounded-full ${
              porcentagem === 100 ? 'bg-emerald-500' : porcentagem > 50 ? 'bg-primary' : 'bg-amber-500'
            }`}
            style={{ width: `${porcentagem}%` }}
          />
        </div>
      </div>

      {/* Grid das Seções */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {secoes.map((secao) => {
          const Icone = secao.icone
          const concluidosNaSecao = secao.itens.filter((i) => itemsDB[i.id]?.checked).length
          const secaoCompleta = secao.itens.length > 0 && concluidosNaSecao === secao.itens.length

          return (
            <div
              key={secao.id}
              className={`rounded-xl border p-4 transition-all bg-card/60 flex flex-col justify-between ${
                secaoCompleta ? 'border-emerald-500/30 bg-emerald-500/[0.02]' : 'border-border/40 hover:border-border/80'
              }`}
            >
              <div>
                {/* Cabeçalho da Seção */}
                <div className="flex items-center justify-between gap-2 mb-3.5 pb-2.5 border-b border-border/20">
                  <div className="flex items-center gap-2.5">
                    <div className={`flex h-7 w-7 items-center justify-center rounded-lg border ${secao.cor}`}>
                      <Icone className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-bold text-foreground tracking-wide uppercase">{secao.titulo}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                        secaoCompleta
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-secondary/10 text-secondary'
                      }`}
                    >
                      {concluidosNaSecao}/{secao.itens.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setAdicionandoEmSecao(adicionandoEmSecao === secao.id ? null : secao.id)
                        setNovoItemNome('')
                      }}
                      title="ADICIONAR NOVO ITEM A ESTA SEÇÃO"
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/40 bg-surface/50 text-secondary transition-colors hover:border-primary/50 hover:bg-primary/10 hover:text-primary"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Formulário Novo Item */}
                {adicionandoEmSecao === secao.id && (
                  <div className="mb-3 rounded-lg border border-primary/30 bg-primary/5 p-2.5 space-y-2">
                    <Label className="!text-xs font-medium text-foreground uppercase">
                      NOVO ITEM PARA {secao.titulo}
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        autoFocus
                        placeholder="EX: TROCA DE ÓLEO, REVISÃO DE BICOS…"
                        value={novoItemNome}
                        onChange={(e) => setNovoItemNome(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { e.preventDefault(); adicionarNovoItem(secao.id) }
                        }}
                        className="!h-8 !text-xs !px-2.5 uppercase"
                      />
                      <Button type="button" variant="primary" size="md" onClick={() => adicionarNovoItem(secao.id)} className="!h-8 !text-xs !px-3 shrink-0 uppercase font-bold">
                        ADICIONAR
                      </Button>
                      <Button type="button" variant="secondary" size="md" onClick={() => { setAdicionandoEmSecao(null); setNovoItemNome('') }} className="!h-8 !text-xs !px-2.5 shrink-0 uppercase">
                        CANCELAR
                      </Button>
                    </div>
                  </div>
                )}

                {/* Lista de Itens */}
                <div className="space-y-2">
                  {secao.itens.map((item) => {
                    const data = itemsDB[item.id]
                    const isChecked = Boolean(data?.checked)
                    const isExpanded = Boolean(expandedItems[item.id])
                    const duracao = calcularDuracaoHorasMin(data?.hora_inicio, data?.hora_fim, data?.data_inicio || data?.data, data?.data_fim)
                    const mecanicoDoItem = data?.mecanico || ''

                    return (
                      <div
                        key={item.id}
                        className={`rounded-lg border transition-all ${
                          isChecked
                            ? 'border-primary/40 bg-primary/5 shadow-sm'
                            : 'border-border/30 bg-background/60 hover:border-border hover:bg-overlay/5'
                        }`}
                      >
                        {/* Linha Principal com Suporte a Mobile Perfeito */}
                        <div className="p-2.5">
                          <div className="flex items-start justify-between gap-2.5">
                            {/* Lado Esquerdo: Checkbox + Título + Badges em Nova Linha */}
                            <div className="flex items-start gap-2.5 flex-1 min-w-0">
                              <button
                                type="button"
                                onClick={() => toggleItem(secao.id, item)}
                                className={`flex h-5 w-5 shrink-0 mt-0.5 items-center justify-center rounded-md border transition-all cursor-pointer ${
                                  isChecked
                                    ? 'border-primary bg-primary text-white shadow-sm'
                                    : 'border-secondary/40 bg-surface/50 hover:border-primary/60'
                                }`}
                                aria-label={isChecked ? 'DESMARCAR' : 'MARCAR'}
                              >
                                {isChecked && <Check className="h-3.5 w-3.5 stroke-[2.5]" />}
                              </button>

                              <div
                                onClick={() => toggleExpandItem(item.id)}
                                className="flex-1 min-w-0 cursor-pointer select-none space-y-1"
                              >
                                <span
                                  className={`text-sm leading-tight block uppercase truncate ${
                                    isChecked ? 'font-semibold text-foreground' : 'text-foreground/90 font-medium'
                                  }`}
                                >
                                  {item.label}
                                </span>

                                {/* Badges de Mecânico e Andamento / Duração */}
                                {(mecanicoDoItem || duracao) && (
                                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                    {mecanicoDoItem && (
                                      <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/25 text-blue-400 shrink-0 uppercase">
                                        <User className="h-3 w-3" />
                                        {mecanicoDoItem}
                                      </span>
                                    )}

                                    {duracao && (
                                      <span
                                        className={`inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-md border shrink-0 uppercase ${
                                          duracao.emAndamento
                                            ? 'bg-amber-500/15 border-amber-500/30 text-amber-400 animate-pulse'
                                            : 'bg-primary/10 border-primary/25 text-primary'
                                        }`}
                                      >
                                        <Clock className="h-3 w-3" />
                                        {duracao.texto}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Lado Direito: Botão de Detalhes / Expandir Sempre Visível e Fácil de Tocar */}
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => toggleExpandItem(item.id)}
                                title={isExpanded ? 'OCULTAR DETALHES' : 'DEFINIR MECÂNICO E HORÁRIOS'}
                                className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border transition-all shrink-0 uppercase font-semibold cursor-pointer active:scale-95 ${
                                  data?.hora_inicio || data?.hora_fim || data?.mecanico || isExpanded
                                    ? 'border-primary/40 bg-surface text-foreground shadow-sm'
                                    : 'border-border/40 bg-surface/50 text-secondary hover:text-foreground'
                                }`}
                              >
                                <Timer className="h-3.5 w-3.5 text-primary" />
                                <span className="text-[11px] font-bold">
                                  {isExpanded ? 'FECHAR' : 'DETALHES'}
                                </span>
                                {isExpanded ? (
                                  <ChevronUp className="h-3.5 w-3.5 text-secondary" />
                                ) : (
                                  <ChevronDown className="h-3.5 w-3.5 text-secondary" />
                                )}
                              </button>

                              {item.isCustom && (
                                <button
                                  type="button"
                                  onClick={() => removerItem(item.id)}
                                  title="REMOVER ITEM CUSTOMIZADO"
                                  className="text-secondary/50 hover:text-red-400 p-1.5 transition-colors cursor-pointer"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Bloco Expandido */}
                        {isExpanded && (
                          <div className="px-3 pb-3 pt-2 border-t border-border/20 space-y-2.5 bg-surface/20 rounded-b-lg uppercase">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-secondary font-bold whitespace-nowrap flex items-center gap-1">
                                <User className="h-3.5 w-3.5 text-primary" />
                                MECÂNICO:
                              </span>
                              <select
                                value={data?.mecanico || ''}
                                onChange={(e) => updateItemPatch(secao.id, item, { mecanico: e.target.value.toUpperCase() })}
                                className="h-8 px-2.5 text-xs rounded-lg border border-border/40 bg-surface text-foreground focus:outline-none focus:ring-1 focus:ring-primary flex-1 uppercase font-bold"
                              >
                                <option value="">
                                  {mecanico ? `PADRÃO DA O.S: ${mecanico}` : 'SELECIONE O MECÂNICO...'}
                                </option>
                                {EQUIPE_GVEL.map((m) => (
                                  <option key={m.nome} value={m.nome}>
                                    {m.nome}
                                  </option>
                                ))}
                                {data?.mecanico && !EQUIPE_GVEL.some((m) => m.nome === data.mecanico) && (
                                  <option value={data.mecanico}>{data.mecanico}</option>
                                )}
                              </select>
                            </div>

                            <div className="space-y-2 pt-1 border-t border-border/10">
                              {/* Linha INÍCIO */}
                              <div className="flex flex-wrap items-center gap-2.5">
                                <span className="text-xs text-secondary font-bold whitespace-nowrap w-16">INÍCIO:</span>

                                {/* Data Início */}
                                <div className="flex items-center gap-1">
                                  <input
                                    type="date"
                                    value={data?.data_inicio || data?.data || ''}
                                    onChange={(e) => {
                                      const val = e.target.value
                                      updateItemPatch(secao.id, item, { data_inicio: val, data: val })
                                    }}
                                    className="h-7 px-2 text-xs rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const hoje = nowDateString()
                                      updateItemPatch(secao.id, item, { data_inicio: hoje, data: hoje })
                                    }}
                                    className="text-[10px] text-primary hover:underline font-bold px-1 uppercase"
                                  >
                                    HOJE
                                  </button>
                                </div>

                                {/* Hora Início */}
                                <div className="flex items-center gap-1">
                                  <input
                                    type="time"
                                    value={data?.hora_inicio || ''}
                                    onChange={(e) => updateItemPatch(secao.id, item, { hora_inicio: e.target.value })}
                                    className="h-7 px-2 text-xs rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const hora = nowTimeString()
                                      const hoje = nowDateString()
                                      updateItemPatch(secao.id, item, {
                                        hora_inicio: hora,
                                        data_inicio: data?.data_inicio || data?.data || hoje,
                                        data: data?.data || hoje,
                                      })
                                    }}
                                    className="text-[10px] text-primary hover:underline font-bold px-1 uppercase"
                                  >
                                    AGORA
                                  </button>
                                </div>
                              </div>

                              {/* Linha FIM */}
                              <div className="flex flex-wrap items-center gap-2.5">
                                <span className="text-xs text-secondary font-bold whitespace-nowrap w-16">FIM:</span>

                                {/* Data Fim */}
                                <div className="flex items-center gap-1">
                                  <input
                                    type="date"
                                    value={data?.data_fim || ''}
                                    onChange={(e) => updateItemPatch(secao.id, item, { data_fim: e.target.value })}
                                    className="h-7 px-2 text-xs rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => updateItemPatch(secao.id, item, { data_fim: nowDateString() })}
                                    className="text-[10px] text-primary hover:underline font-bold px-1 uppercase"
                                  >
                                    HOJE
                                  </button>
                                </div>

                                {/* Hora Fim */}
                                <div className="flex items-center gap-1">
                                  <input
                                    type="time"
                                    value={data?.hora_fim || ''}
                                    onChange={(e) => updateItemPatch(secao.id, item, { hora_fim: e.target.value })}
                                    className="h-7 px-2 text-xs rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const hora = nowTimeString()
                                      const hoje = nowDateString()
                                      updateItemPatch(secao.id, item, {
                                        hora_fim: hora,
                                        data_fim: data?.data_fim || hoje,
                                      })
                                    }}
                                    className="text-[10px] text-primary hover:underline font-bold px-1 uppercase"
                                  >
                                    AGORA
                                  </button>
                                </div>

                                {/* Botão para voltar a atividade para Em Andamento (limpar fim) */}
                                {(data?.hora_fim || data?.data_fim) && (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      const row = buildRow(secao.id, item, {
                                        hora_fim: '',
                                        data_fim: '',
                                      })
                                      await salvarItem(row)
                                      setSalvoItemId(item.id)
                                      setTimeout(() => setSalvoItemId(null), 2500)
                                    }}
                                    className="text-xs text-amber-400 hover:text-amber-300 font-black px-2.5 py-1 rounded border border-amber-500/40 bg-amber-500/15 uppercase transition-colors flex items-center gap-1 shadow-sm active:scale-95 cursor-pointer"
                                    title="Limpa o término para deixar a atividade em andamento"
                                  >
                                    <span>⏳ DEIXAR EM ANDAMENTO (LIMPAR TÉRMINO)</span>
                                  </button>
                                )}
                              </div>

                              {/* Rodapé do Bloco Expandido */}
                              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/20">
                                {duracao && !duracao.emAndamento ? (
                                  <div className="text-xs font-bold text-primary flex items-center gap-1 uppercase">
                                    <Clock className="h-3.5 w-3.5" />
                                    <span>TEMPO GASTO: {duracao.texto}</span>
                                  </div>
                                ) : duracao?.emAndamento ? (
                                  <div className="text-xs font-bold text-amber-400 flex items-center gap-1 uppercase animate-pulse">
                                    <Clock className="h-3.5 w-3.5" />
                                    <span>STATUS: ATIVIDADE EM ANDAMENTO</span>
                                  </div>
                                ) : (
                                  <div />
                                )}

                                <button
                                  type="button"
                                  onClick={async () => {
                                    const row = buildRow(secao.id, item, {
                                      mecanico: data?.mecanico || mecanico || '',
                                    })
                                    await salvarItem(row)
                                    setSalvoItemId(item.id)
                                    setTimeout(() => setSalvoItemId(null), 2500)
                                  }}
                                  className={`px-3 py-1 rounded-md text-xs font-bold uppercase transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer ${
                                    salvoItemId === item.id
                                      ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-400'
                                      : 'bg-primary/15 border border-primary/40 text-primary hover:bg-primary/25'
                                  }`}
                                >
                                  <Check className="h-3.5 w-3.5" />
                                  <span>{salvoItemId === item.id ? 'SALVO COM SUCESSO!' : 'SALVAR ATIVIDADE'}</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Botão + rodapé da seção */}
              <button
                type="button"
                onClick={() => { setAdicionandoEmSecao(secao.id); setNovoItemNome('') }}
                className="mt-3 flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg border border-dashed border-border/40 text-xs text-secondary hover:border-primary/50 hover:bg-primary/5 hover:text-primary transition-all uppercase font-semibold"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>ADICIONAR OUTRO ITEM EM {secao.titulo}</span>
              </button>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
