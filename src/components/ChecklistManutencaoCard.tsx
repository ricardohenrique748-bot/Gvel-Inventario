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
import { useHistoricoMovimentacao } from '@/hooks/useHistoricoMovimentacao'
import {
  formatMinutosParaTexto,
  permanenciaEmMinutos,
  toLocalInputValue,
  nowLocalInputValue,
} from '@/lib/format'
import { differenceInMinutes } from 'date-fns'
import type { MovimentacaoComVeiculo } from '@/lib/types'

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

export interface ItemChecklistData {
  checked: boolean
  horaInicio?: string // Formato HH:mm
  horaFim?: string // Formato HH:mm
  mecanico?: string // Mecânico específico desta atividade
  historicoId?: string // ID associado na tabela movimentacao_historico
}

function nowTimeString() {
  const now = new Date()
  return now.toTimeString().slice(0, 5) // "14:40"
}

function calcularDuracaoHorasMin(inicio?: string, fim?: string): { minutos: number; texto: string } | null {
  if (!inicio || !fim) return null
  const [h1, m1] = inicio.split(':').map(Number)
  const [h2, m2] = fim.split(':').map(Number)
  if (isNaN(h1) || isNaN(m1) || isNaN(h2) || isNaN(m2)) return null
  let min = h2 * 60 + m2 - (h1 * 60 + m1)
  if (min < 0) min += 24 * 60 // caso passe da meia-noite
  return {
    minutos: min,
    texto: formatMinutosParaTexto(min).toUpperCase(),
  }
}

interface ChecklistManutencaoCardProps {
  movimentacao: MovimentacaoComVeiculo
  onStatusChange?: () => void | Promise<void>
}

export function ChecklistManutencaoCard({ movimentacao, onStatusChange }: ChecklistManutencaoCardProps) {
  const { statusManutencao } = useStatusManutencao()
  const { historico } = useHistoricoMovimentacao(movimentacao.id)

  const itemsStorageKey = `checklist_items_data_${movimentacao.id}`
  const customSecoesStorageKey = `checklist_custom_secoes_${movimentacao.id}`

  // Estado das seções com suporte a itens extras customizados
  const [secoes, setSecoes] = useState<SecaoChecklist[]>(() => {
    try {
      const saved = localStorage.getItem(customSecoesStorageKey)
      if (saved) {
        const parsed = JSON.parse(saved) as Record<string, ItemChecklist[]>
        return SECOES_PADRAO.map((sec) => ({
          ...sec,
          itens: [...sec.itens, ...(parsed[sec.id] || [])],
        }))
      }
    } catch {
      // fallback
    }
    return SECOES_PADRAO
  })

  // Estado dos dados de cada item (checked, horaInicio, horaFim, mecanico, historicoId)
  const [itemsData, setItemsData] = useState<Record<string, ItemChecklistData>>(() => {
    try {
      const saved = localStorage.getItem(itemsStorageKey)
      if (saved) return JSON.parse(saved)
      const legacy = localStorage.getItem(`checklist_manutencao_${movimentacao.id}`)
      if (legacy) {
        const parsedLegacy = JSON.parse(legacy) as Record<string, boolean>
        const converted: Record<string, ItemChecklistData> = {}
        for (const [k, v] of Object.entries(parsedLegacy)) {
          converted[k] = { checked: Boolean(v) }
        }
        return converted
      }
    } catch {
      // fallback
    }
    return {}
  })

  // Controle de adição de novo item por seção
  const [adicionandoEmSecao, setAdicionandoEmSecao] = useState<string | null>(null)
  const [novoItemNome, setNovoItemNome] = useState('')

  // Itens expandidos para edição de horários e mecânico
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({})

  // Campos gerais de serviço
  const [mecanico, setMecanico] = useState('')
  const [funcao, setFuncao] = useState('')
  const [setor, setSetor] = useState('')
  const [dataHoraAbertura, setDataHoraAbertura] = useState('')
  const [dataHoraFechamento, setDataHoraFechamento] = useState('')
  const [salvandoDados, setSalvandoDados] = useState(false)
  const [salvandoStatus, setSalvandoStatus] = useState(false)
  const [sucessoSalvar, setSucessoSalvar] = useState(false)

  // Localiza registro do histórico geral associado
  const etapaOS = useMemo(() => {
    return (
      historico.find(
        (h) =>
          h.descricao.includes('GERAL') ||
          h.descricao.includes('Geral') ||
          h.os_criada ||
          h.data_hora_abertura ||
          h.mecanico_executor,
      ) || historico[0]
    )
  }, [historico])

  // Recarrega os dados quando muda a movimentação
  useEffect(() => {
    try {
      // Carrega seções e itens customizados
      const savedSecoes = localStorage.getItem(`checklist_custom_secoes_${movimentacao.id}`)
      if (savedSecoes) {
        const parsed = JSON.parse(savedSecoes) as Record<string, ItemChecklist[]>
        setSecoes(
          SECOES_PADRAO.map((sec) => ({
            ...sec,
            itens: [...sec.itens, ...(parsed[sec.id] || [])],
          })),
        )
      } else {
        setSecoes(SECOES_PADRAO)
      }

      // Carrega itemsData
      const saved = localStorage.getItem(`checklist_items_data_${movimentacao.id}`)
      if (saved) {
        setItemsData(JSON.parse(saved))
      } else {
        const legacy = localStorage.getItem(`checklist_manutencao_${movimentacao.id}`)
        if (legacy) {
          const parsedLegacy = JSON.parse(legacy) as Record<string, boolean>
          const converted: Record<string, ItemChecklistData> = {}
          for (const [k, v] of Object.entries(parsedLegacy)) {
            converted[k] = { checked: Boolean(v) }
          }
          setItemsData(converted)
        } else {
          setItemsData({})
        }
      }

      // Carrega informações gerais do serviço
      const savedInfo = localStorage.getItem(`checklist_info_${movimentacao.id}`)
      if (savedInfo) {
        const parsed = JSON.parse(savedInfo)
        setMecanico(parsed.mecanico || '')
        setFuncao(parsed.funcao || '')
        setSetor(parsed.setor || '')
        setDataHoraAbertura(parsed.dataHoraAbertura || '')
        setDataHoraFechamento(parsed.dataHoraFechamento || '')
      } else if (etapaOS && etapaOS.mecanico_executor) {
        setMecanico(etapaOS.mecanico_executor || '')
        setFuncao(etapaOS.funcao || '')
        setSetor(etapaOS.setor || '')
        setDataHoraAbertura(toLocalInputValue(etapaOS.data_hora_abertura || etapaOS.data_hora))
        setDataHoraFechamento(toLocalInputValue(etapaOS.data_hora_fechamento))
      } else {
        setMecanico('')
        setFuncao('')
        setSetor('')
        setDataHoraAbertura('')
        setDataHoraFechamento('')
      }
    } catch {
      setItemsData({})
    }
  }, [movimentacao.id, etapaOS])

  function handleMecanicoChange(val: string) {
    const valUpper = val.toUpperCase()
    setMecanico(valUpper)
    let dtAbertura = dataHoraAbertura
    if (valUpper.trim().length > 0 && !dtAbertura) {
      dtAbertura = nowLocalInputValue()
      setDataHoraAbertura(dtAbertura)
    }
    try {
      const existing = localStorage.getItem(`checklist_info_${movimentacao.id}`)
      const parsed = existing ? JSON.parse(existing) : {}
      localStorage.setItem(
        `checklist_info_${movimentacao.id}`,
        JSON.stringify({
          ...parsed,
          mecanico: valUpper.trim(),
          funcao: (funcao || '').toUpperCase(),
          setor: (setor || '').toUpperCase(),
          dataHoraAbertura: dtAbertura,
          dataHoraFechamento,
        }),
      )
      window.dispatchEvent(new CustomEvent('checklist_updated', { detail: { movId: movimentacao.id } }))
    } catch {}
  }

  function handleDataHoraAberturaChange(val: string) {
    setDataHoraAbertura(val)
    try {
      const existing = localStorage.getItem(`checklist_info_${movimentacao.id}`)
      const parsed = existing ? JSON.parse(existing) : {}
      localStorage.setItem(
        `checklist_info_${movimentacao.id}`,
        JSON.stringify({
          ...parsed,
          mecanico: (mecanico || '').toUpperCase().trim(),
          funcao: (funcao || '').toUpperCase(),
          setor: (setor || '').toUpperCase(),
          dataHoraAbertura: val,
          dataHoraFechamento,
        }),
      )
      window.dispatchEvent(new CustomEvent('checklist_updated', { detail: { movId: movimentacao.id } }))
    } catch {}
  }

  function handleDataHoraFechamentoChange(val: string) {
    setDataHoraFechamento(val)
    try {
      const existing = localStorage.getItem(`checklist_info_${movimentacao.id}`)
      const parsed = existing ? JSON.parse(existing) : {}
      localStorage.setItem(
        `checklist_info_${movimentacao.id}`,
        JSON.stringify({
          ...parsed,
          mecanico: (mecanico || '').toUpperCase().trim(),
          funcao: (funcao || '').toUpperCase(),
          setor: (setor || '').toUpperCase(),
          dataHoraAbertura,
          dataHoraFechamento: val,
        }),
      )
      window.dispatchEvent(new CustomEvent('checklist_updated', { detail: { movId: movimentacao.id } }))
    } catch {}
  }

  function handleFinalizarOS() {
    if (!mecanico.trim()) {
      alert('POR FAVOR, INFORME O NOME DO RESPONSÁVEL / MECÂNICO ANTES DE FINALIZAR A O.S.')
      return
    }
    const dtAgora = nowLocalInputValue()
    setDataHoraFechamento(dtAgora)
    try {
      const existing = localStorage.getItem(`checklist_info_${movimentacao.id}`)
      const parsed = existing ? JSON.parse(existing) : {}
      localStorage.setItem(
        `checklist_info_${movimentacao.id}`,
        JSON.stringify({
          ...parsed,
          mecanico: (mecanico || '').toUpperCase().trim(),
          funcao: (funcao || '').toUpperCase(),
          setor: (setor || '').toUpperCase(),
          dataHoraAbertura: dataHoraAbertura || dtAgora,
          dataHoraFechamento: dtAgora,
        }),
      )
      persistItemsData(itemsData)
      window.dispatchEvent(new CustomEvent('checklist_updated', { detail: { movId: movimentacao.id } }))
      setSucessoSalvar(true)
      setTimeout(() => setSucessoSalvar(false), 3000)
    } catch {}
  }

  function handleReabrirOS() {
    setDataHoraFechamento('')
    try {
      const existing = localStorage.getItem(`checklist_info_${movimentacao.id}`)
      const parsed = existing ? JSON.parse(existing) : {}
      localStorage.setItem(
        `checklist_info_${movimentacao.id}`,
        JSON.stringify({
          ...parsed,
          mecanico: (mecanico || '').toUpperCase().trim(),
          funcao: (funcao || '').toUpperCase(),
          setor: (setor || '').toUpperCase(),
          dataHoraAbertura,
          dataHoraFechamento: '',
        }),
      )
      window.dispatchEvent(new CustomEvent('checklist_updated', { detail: { movId: movimentacao.id } }))
      setSucessoSalvar(true)
      setTimeout(() => setSucessoSalvar(false), 3000)
    } catch {}
  }

  // Salva itemsData no localStorage
  function persistItemsData(nextData: Record<string, ItemChecklistData>) {
    setItemsData(nextData)
    try {
      localStorage.setItem(`checklist_items_data_${movimentacao.id}`, JSON.stringify(nextData))
      window.dispatchEvent(new CustomEvent('checklist_updated', { detail: { movId: movimentacao.id } }))
    } catch (err) {
      console.error('Erro ao salvar dados dos itens:', err)
    }
  }

  // Alterna o checkbox do item
  function toggleItem(itemId: string) {
    const current = itemsData[itemId] || { checked: false }
    const nextChecked = !current.checked

    const nextItem: ItemChecklistData = {
      ...current,
      checked: nextChecked,
      mecanico: current.mecanico || mecanico,
      horaInicio: nextChecked && !current.horaInicio ? current.horaInicio || nowTimeString() : current.horaInicio,
      horaFim: nextChecked && current.horaInicio && !current.horaFim ? nowTimeString() : current.horaFim,
    }

    persistItemsData({
      ...itemsData,
      [itemId]: nextItem,
    })
  }

  // Atualiza qualquer campo de um item específico (horaInicio, horaFim, mecanico)
  function updateItemField(itemId: string, field: keyof ItemChecklistData, value: string) {
    const current = itemsData[itemId] || { checked: false }
    const nextItem = {
      ...current,
      [field]: value,
    }
    persistItemsData({
      ...itemsData,
      [itemId]: nextItem,
    })
  }

  // Adiciona novo item customizado na seção
  function adicionarNovoItem(secaoId: string) {
    if (!novoItemNome.trim()) return
    const customId = `custom_${secaoId}_${Date.now()}`
    const novoItem: ItemChecklist = {
      id: customId,
      label: novoItemNome.trim().toUpperCase(),
      isCustom: true,
    }

    const nextSecoes = secoes.map((sec) => {
      if (sec.id === secaoId) {
        return {
          ...sec,
          itens: [...sec.itens, novoItem],
        }
      }
      return sec
    })

    setSecoes(nextSecoes)
    setNovoItemNome('')
    setAdicionandoEmSecao(null)

    try {
      const customMap: Record<string, ItemChecklist[]> = {}
      for (const sec of nextSecoes) {
        const customs = sec.itens.filter((i) => i.isCustom)
        if (customs.length > 0) {
          customMap[sec.id] = customs
        }
      }
      localStorage.setItem(`checklist_custom_secoes_${movimentacao.id}`, JSON.stringify(customMap))
    } catch (err) {
      console.error('Erro ao salvar item customizado:', err)
    }
  }

  // Remove item customizado
  function removerItemCustom(secaoId: string, itemId: string) {
    const nextSecoes = secoes.map((sec) => {
      if (sec.id === secaoId) {
        return {
          ...sec,
          itens: sec.itens.filter((i) => i.id !== itemId),
        }
      }
      return sec
    })
    setSecoes(nextSecoes)

    const nextData = { ...itemsData }
    delete nextData[itemId]
    persistItemsData(nextData)

    try {
      const customMap: Record<string, ItemChecklist[]> = {}
      for (const sec of nextSecoes) {
        const customs = sec.itens.filter((i) => i.isCustom)
        if (customs.length > 0) {
          customMap[sec.id] = customs
        }
      }
      localStorage.setItem(`checklist_custom_secoes_${movimentacao.id}`, JSON.stringify(customMap))
    } catch (err) {
      console.error('Erro ao remover item:', err)
    }
  }

  function toggleExpandItem(itemId: string) {
    setExpandedItems((prev) => ({ ...prev, [itemId]: !prev[itemId] }))
  }

  function marcarTodos() {
    const next: Record<string, ItemChecklistData> = {}
    for (const secao of secoes) {
      for (const item of secao.itens) {
        next[item.id] = {
          checked: true,
          mecanico: itemsData[item.id]?.mecanico || mecanico,
          horaInicio: itemsData[item.id]?.horaInicio || '',
          horaFim: itemsData[item.id]?.horaFim || '',
        }
      }
    }
    persistItemsData(next)
  }

  function desmarcarTodos() {
    persistItemsData({})
  }

  // Salva os dados dos mecânicos e horários do checklist
  async function salvarDadosServico() {
    setSalvandoDados(true)
    setSucessoSalvar(false)
    try {
      const infoToSave = {
        mecanico: mecanico.toUpperCase(),
        funcao: funcao.toUpperCase(),
        setor: setor.toUpperCase(),
        dataHoraAbertura,
        dataHoraFechamento,
      }
      localStorage.setItem(`checklist_info_${movimentacao.id}`, JSON.stringify(infoToSave))
      persistItemsData(itemsData)
      window.dispatchEvent(new CustomEvent('checklist_updated', { detail: { movId: movimentacao.id } }))

      setSucessoSalvar(true)
      setTimeout(() => setSucessoSalvar(false), 3000)
    } catch (err) {
      console.error('Erro ao salvar informações de serviço:', err)
      setSucessoSalvar(true)
      setTimeout(() => setSucessoSalvar(false), 3000)
    } finally {
      setSalvandoDados(false)
    }
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

  // Total de itens dinâmico considerando customizados
  const totalItens = useMemo(() => {
    return secoes.reduce((acc, sec) => acc + sec.itens.length, 0)
  }, [secoes])

  const itensConcluidos = useMemo(() => {
    return Object.values(itemsData).filter((d) => d.checked).length
  }, [itemsData])

  const porcentagem = totalItens > 0 ? Math.round((itensConcluidos / totalItens) * 100) : 0

  // Soma de minutos totais de todas as atividades do checklist
  const totalMinutosAtividades = useMemo(() => {
    let soma = 0
    for (const data of Object.values(itemsData)) {
      if (data.horaInicio && data.horaFim) {
        const dur = calcularDuracaoHorasMin(data.horaInicio, data.horaFim)
        if (dur) soma += dur.minutos
      }
    }
    return soma
  }, [itemsData])

  // Cálculo das horas gerais trabalhadas
  const calculoHorasGeral = useMemo(() => {
    if (!dataHoraAbertura) {
      return {
        texto: 'AGUARDANDO ABERTURA',
        minutos: 0,
        status: 'pendente' as const,
      }
    }

    const dInicio = new Date(dataHoraAbertura)

    if (dataHoraFechamento) {
      const dFim = new Date(dataHoraFechamento)
      const minutos = differenceInMinutes(dFim, dInicio)
      if (minutos < 0) {
        return {
          texto: 'DATA DE FECHAMENTO ANTERIOR À ABERTURA',
          minutos: 0,
          status: 'erro' as const,
        }
      }
      return {
        texto: formatMinutosParaTexto(minutos).toUpperCase(),
        minutos,
        status: 'fechado' as const,
      }
    }

    const minutos = permanenciaEmMinutos(dInicio.toISOString())
    return {
      texto: `${formatMinutosParaTexto(minutos).toUpperCase()} (EM ANDAMENTO)`,
      minutos,
      status: 'em_andamento' as const,
    }
  }, [dataHoraAbertura, dataHoraFechamento])

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
            <strong className="text-foreground font-mono">{movimentacao.veiculo?.placa}</strong> — ALIMENTANDO O <strong>INDICADOR DE PERFORMANCE</strong>
          </p>
        </div>

        {/* Status de Manutenção e Ações Rápidas */}
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
              onClick={desmarcarTodos}
              className="!h-8 !text-xs !px-3 text-secondary hover:text-red-400 uppercase font-semibold"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              LIMPAR
            </Button>
          )}
        </div>
      </div>

      {/* BLOCO: Dados do Mecânico Geral, Abertura, Fechamento e Horas Trabalhadas */}
      <div className="rounded-xl border border-border/40 bg-background/70 p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border/20 pb-3">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground uppercase">
              RESPONSÁVEL PRINCIPAL & APONTAMENTO PARA O INDICADOR DE PERFORMANCE
            </span>
          </div>

          {/* Destaque do Cálculo de Horas Geral e Soma das Atividades */}
          <div className="flex flex-wrap items-center gap-2">
            {totalMinutosAtividades > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-primary/30 bg-primary/10 text-primary text-xs font-bold uppercase">
                <Clock className="h-3.5 w-3.5" />
                <span>SOMA ATIVIDADES: {formatMinutosParaTexto(totalMinutosAtividades).toUpperCase()}</span>
              </div>
            )}

            <div
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-bold uppercase ${
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
              <span>DURAÇÃO TOTAL: {calculoHorasGeral.texto}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Nome do Mecânico Geral */}
          <div>
            <Label htmlFor="mecanico-nome" className="!text-xs !mb-1 font-medium text-secondary uppercase">
              MECÂNICO PRINCIPAL / RESPONSÁVEL
            </Label>
            <Input
              id="mecanico-nome"
              placeholder="EX: CARLOS SILVA, ROBERTO…"
              value={mecanico}
              onChange={(e) => handleMecanicoChange(e.target.value)}
              className="!h-9 !text-sm !px-3 uppercase"
            />
          </div>

          {/* Data e Hora de Abertura */}
          <div>
            <div className="flex items-center justify-between !mb-1">
              <Label htmlFor="data-hora-abertura" className="!text-xs font-medium text-secondary uppercase">
                DATA/HORA DA ABERTURA
              </Label>
              <button
                type="button"
                onClick={() => handleDataHoraAberturaChange(nowLocalInputValue())}
                className="text-[11px] text-primary hover:underline font-bold uppercase"
              >
                AGORA
              </button>
            </div>
            <Input
              id="data-hora-abertura"
              type="datetime-local"
              value={dataHoraAbertura}
              onChange={(e) => handleDataHoraAberturaChange(e.target.value)}
              className="!h-9 !text-sm !px-3"
            />
          </div>

          {/* Data e Hora de Fechamento */}
          <div>
            <div className="flex items-center justify-between !mb-1">
              <Label htmlFor="data-hora-fechamento" className="!text-xs font-medium text-secondary uppercase">
                DATA/HORA DO FECHAMENTO
              </Label>
              <button
                type="button"
                onClick={() => handleDataHoraFechamentoChange(nowLocalInputValue())}
                className="text-[11px] text-primary hover:underline font-bold uppercase"
              >
                AGORA
              </button>
            </div>
            <Input
              id="data-hora-fechamento"
              type="datetime-local"
              value={dataHoraFechamento}
              onChange={(e) => handleDataHoraFechamentoChange(e.target.value)}
              className="!h-9 !text-sm !px-3"
            />
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

      {/* Barra de Progresso do Checklist */}
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
              porcentagem === 100
                ? 'bg-emerald-500'
                : porcentagem > 50
                  ? 'bg-primary'
                  : 'bg-amber-500'
            }`}
            style={{ width: `${porcentagem}%` }}
          />
        </div>
      </div>

      {/* Grid das Seções do Checklist */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {secoes.map((secao) => {
          const Icone = secao.icone
          const concluidosNaSecao = secao.itens.filter((i) => itemsData[i.id]?.checked).length
          const secaoCompleta = secao.itens.length > 0 && concluidosNaSecao === secao.itens.length

          return (
            <div
              key={secao.id}
              className={`rounded-xl border p-4 transition-all bg-card/60 flex flex-col justify-between ${
                secaoCompleta
                  ? 'border-emerald-500/30 bg-emerald-500/[0.02]'
                  : 'border-border/40 hover:border-border/80'
              }`}
            >
              <div>
                {/* Cabeçalho da Seção */}
                <div className="flex items-center justify-between gap-2 mb-3.5 pb-2.5 border-b border-border/20">
                  <div className="flex items-center gap-2.5">
                    <div className={`flex h-7 w-7 items-center justify-center rounded-lg border ${secao.cor}`}>
                      <Icone className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-bold text-foreground tracking-wide uppercase">
                      {secao.titulo}
                    </span>
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

                    {/* Botão + para adicionar item */}
                    <button
                      type="button"
                      onClick={() => {
                        setAdicionandoEmSecao(adicionandoEmSecao === secao.id ? null : secao.id)
                        setNovoItemNome('')
                      }}
                      title="ADICIONAR NOVO ITEM A ESTA SEÇÃO"
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/40 bg-surface/50 text-secondary transition-colors hover:border-primary/50 hover:bg-primary/10 hover:text-primary"
                      aria-label="ADICIONAR ITEM"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Formulário Inline de Adicionar Novo Item */}
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
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            adicionarNovoItem(secao.id)
                          }
                        }}
                        className="!h-8 !text-xs !px-2.5 uppercase"
                      />
                      <Button
                        type="button"
                        variant="primary"
                        size="md"
                        onClick={() => adicionarNovoItem(secao.id)}
                        className="!h-8 !text-xs !px-3 shrink-0 uppercase font-bold"
                      >
                        ADICIONAR
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="md"
                        onClick={() => {
                          setAdicionandoEmSecao(null)
                          setNovoItemNome('')
                        }}
                        className="!h-8 !text-xs !px-2.5 shrink-0 uppercase"
                      >
                        CANCELAR
                      </Button>
                    </div>
                  </div>
                )}

                {/* Lista de Itens com Horários Iniciais/Finais, Mecânico e Checkbox */}
                <div className="space-y-2">
                  {secao.itens.map((item) => {
                    const data = itemsData[item.id] || { checked: false }
                    const isChecked = Boolean(data.checked)
                    const isExpanded = Boolean(expandedItems[item.id])
                    const duracao = calcularDuracaoHorasMin(data.horaInicio, data.horaFim)
                    const mecanicoDoItem = data.mecanico || ''

                    return (
                      <div
                        key={item.id}
                        className={`rounded-lg border transition-all ${
                          isChecked
                            ? 'border-primary/40 bg-primary/5 shadow-sm'
                            : 'border-border/30 bg-background/60 hover:border-border hover:bg-overlay/5'
                        }`}
                      >
                        {/* Linha Principal do Item */}
                        <div className="flex items-center gap-3 p-2.5 min-w-0 overflow-hidden">
                          {/* Quadrado do Checkbox */}
                          <button
                            type="button"
                            onClick={() => toggleItem(item.id)}
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all ${
                              isChecked
                                ? 'border-primary bg-primary text-white shadow-sm'
                                : 'border-secondary/40 bg-surface/50 hover:border-primary/60'
                            }`}
                            aria-label={isChecked ? 'DESMARCAR' : 'MARCAR'}
                          >
                            {isChecked && <Check className="h-3.5 w-3.5 stroke-[2.5]" />}
                          </button>

                          {/* Texto do Item */}
                          <span
                            onClick={() => toggleItem(item.id)}
                            className={`text-sm leading-snug flex-1 cursor-pointer select-none uppercase truncate min-w-0 ${
                              isChecked
                                ? 'font-semibold text-foreground'
                                : 'text-foreground/90 font-medium'
                            }`}
                          >
                            {item.label}
                          </span>

                          {/* Badge de Mecânico Específico Atribuído */}
                          {mecanicoDoItem && (
                            <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/25 text-blue-400 shrink-0 uppercase">
                              <User className="h-3 w-3" />
                              {mecanicoDoItem}
                            </span>
                          )}

                          {/* Badge de Horas Calculadas na Atividade */}
                          {duracao && (
                            <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-primary/10 border border-primary/25 text-primary shrink-0 uppercase">
                              <Clock className="h-3 w-3" />
                              {duracao.texto}
                            </span>
                          )}

                          {/* Botão para Expandir/Ocultar Horários e Mecânico */}
                          <button
                            type="button"
                            onClick={() => toggleExpandItem(item.id)}
                            title={isExpanded ? 'OCULTAR DETALHES' : 'DEFINIR MECÂNICO E HORÁRIOS'}
                            className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md border transition-colors shrink-0 uppercase font-semibold ${
                              data.horaInicio || data.horaFim || data.mecanico || isExpanded
                                ? 'border-border bg-surface text-foreground'
                                : 'border-transparent text-secondary hover:text-foreground hover:bg-surface/50'
                            }`}
                          >
                            <Timer className="h-3 w-3 text-secondary" />
                            <span className="text-[11px]">
                              {data.horaInicio && data.horaFim
                                ? `${data.horaInicio} - ${data.horaFim}`
                                : data.horaInicio
                                  ? `${data.horaInicio} - …`
                                  : 'DETALHES'}
                            </span>
                            {isExpanded ? (
                              <ChevronUp className="h-3 w-3 text-secondary" />
                            ) : (
                              <ChevronDown className="h-3 w-3 text-secondary" />
                            )}
                          </button>

                          {/* Botão de Excluir se for Item Customizado */}
                          {item.isCustom && (
                            <button
                              type="button"
                              onClick={() => removerItemCustom(secao.id, item.id)}
                              title="REMOVER ITEM CUSTOMIZADO"
                              className="text-secondary/50 hover:text-red-400 p-1 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>

                        {/* Bloco Expandido: Mecânico Responsável da Atividade + Inputs de Hora Inicial e Final */}
                        {isExpanded && (
                          <div className="px-3 pb-3 pt-2 border-t border-border/20 space-y-2.5 bg-surface/20 rounded-b-lg uppercase">
                            {/* Mecânico da Atividade */}
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-secondary font-bold whitespace-nowrap flex items-center gap-1">
                                <User className="h-3.5 w-3.5 text-primary" />
                                MECÂNICO:
                              </span>
                              <input
                                type="text"
                                placeholder={mecanico ? `PADRÃO: ${mecanico.toUpperCase()}` : 'EX: ROBERTO, CARLOS…'}
                                value={data.mecanico || ''}
                                onChange={(e) => updateItemField(item.id, 'mecanico', e.target.value.toUpperCase())}
                                className="h-7 px-2.5 text-xs rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary flex-1 uppercase"
                              />
                            </div>

                            {/* Horários Início e Fim */}
                            <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-border/10">
                              {/* Hora Inicial */}
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs text-secondary font-bold whitespace-nowrap">
                                  INÍCIO:
                                </span>
                                <input
                                  type="time"
                                  value={data.horaInicio || ''}
                                  onChange={(e) => updateItemField(item.id, 'horaInicio', e.target.value)}
                                  className="h-7 px-2 text-xs rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                                <button
                                  type="button"
                                  onClick={() => updateItemField(item.id, 'horaInicio', nowTimeString())}
                                  className="text-[10px] text-primary hover:underline font-bold px-1 uppercase"
                                >
                                  AGORA
                                </button>
                              </div>

                              {/* Hora Final */}
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs text-secondary font-bold whitespace-nowrap">
                                  FIM:
                                </span>
                                <input
                                  type="time"
                                  value={data.horaFim || ''}
                                  onChange={(e) => updateItemField(item.id, 'horaFim', e.target.value)}
                                  className="h-7 px-2 text-xs rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                                <button
                                  type="button"
                                  onClick={() => updateItemField(item.id, 'horaFim', nowTimeString())}
                                  className="text-[10px] text-primary hover:underline font-bold px-1 uppercase"
                                >
                                  AGORA
                                </button>
                              </div>

                              {/* Duração Calculada */}
                              {duracao && (
                                <div className="text-xs font-bold text-primary flex items-center gap-1 ml-auto uppercase">
                                  <span>TEMPO GASTO: {duracao.texto}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Botão rápido para adicionar item no rodapé da seção */}
              <button
                type="button"
                onClick={() => {
                  setAdicionandoEmSecao(secao.id)
                  setNovoItemNome('')
                }}
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
