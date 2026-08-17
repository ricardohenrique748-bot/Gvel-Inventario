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
import {
  useHistoricoMovimentacao,
  adicionarHistorico,
  atualizarHistorico,
} from '@/hooks/useHistoricoMovimentacao'
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
    titulo: 'Mecânica',
    icone: Wrench,
    cor: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
    itens: [
      { id: 'mec_motor_transmissao', label: 'Motor e transmissão' },
      { id: 'mec_freios_suspensao', label: 'Freios e suspensão' },
      { id: 'mec_vazamentos_fluidos', label: 'Vazamentos e níveis de fluidos' },
    ],
  },
  {
    id: 'eletrica',
    titulo: 'Elétrica',
    icone: Zap,
    cor: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
    itens: [
      { id: 'ele_bateria_carga', label: 'Bateria e sistema de carga' },
      { id: 'ele_iluminacao_sinalizacao', label: 'Iluminação e sinalização' },
      { id: 'ele_painel_eletricos', label: 'Painel e componentes elétricos' },
    ],
  },
  {
    id: 'funilaria',
    titulo: 'Funilaria',
    icone: Hammer,
    cor: 'text-orange-500 bg-orange-500/10 border-orange-500/20',
    itens: [
      { id: 'fun_lataria_amassados', label: 'Lataria e amassados' },
      { id: 'fun_portas_capo_tampas', label: 'Portas, capô e tampas' },
      { id: 'fun_parachoques_acabamentos', label: 'Para-choques e acabamentos' },
    ],
  },
  {
    id: 'pintura',
    titulo: 'Pintura',
    icone: Palette,
    cor: 'text-purple-500 bg-purple-500/10 border-purple-500/20',
    itens: [
      { id: 'pin_riscos_arranhoes', label: 'Riscos e arranhões' },
      { id: 'pin_descascados_manchas', label: 'Descascados e manchas' },
      { id: 'pin_diferenca_tonalidade', label: 'Diferença de tonalidade' },
    ],
  },
  {
    id: 'estetica',
    titulo: 'Estética',
    icone: Sparkles,
    cor: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
    itens: [
      { id: 'est_limpeza_interna', label: 'Limpeza interna' },
      { id: 'est_limpeza_externa', label: 'Limpeza externa' },
      { id: 'est_bancos_painel_revestimentos', label: 'Bancos, painel e revestimentos' },
    ],
  },
]

export interface ItemChecklistData {
  checked: boolean
  horaInicio?: string // Formato HH:mm
  horaFim?: string // Formato HH:mm
  historicoId?: string // ID associado na tabela movimentacao_historico
}

function nowTimeString() {
  const now = new Date()
  return now.toTimeString().slice(0, 5) // "14:40"
}

function toIsoFromTime(timeStr?: string, baseDateStr?: string) {
  if (!timeStr) return undefined
  const baseDate = baseDateStr ? new Date(baseDateStr) : new Date()
  const y = baseDate.getFullYear()
  const m = String(baseDate.getMonth() + 1).padStart(2, '0')
  const d = String(baseDate.getDate()).padStart(2, '0')
  return new Date(`${y}-${m}-${d}T${timeStr}:00`).toISOString()
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
    texto: formatMinutosParaTexto(min),
  }
}

interface ChecklistManutencaoCardProps {
  movimentacao: MovimentacaoComVeiculo
  onStatusChange?: () => void | Promise<void>
}

export function ChecklistManutencaoCard({ movimentacao, onStatusChange }: ChecklistManutencaoCardProps) {
  const { statusManutencao } = useStatusManutencao()
  const { historico, refetch: refetchHistorico } = useHistoricoMovimentacao(movimentacao.id)

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

  // Estado dos dados de cada item (checked, horaInicio, horaFim, historicoId)
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

  // Itens expandidos para edição de horários
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
    return historico.find((h) => h.descricao.includes('Geral') || h.os_criada || h.data_hora_abertura || h.mecanico_executor) || historico[0]
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
      } else if (etapaOS) {
        setMecanico(etapaOS.mecanico_executor || '')
        setFuncao(etapaOS.funcao || '')
        setSetor(etapaOS.setor || '')
        setDataHoraAbertura(toLocalInputValue(etapaOS.data_hora_abertura || etapaOS.data_hora))
        setDataHoraFechamento(toLocalInputValue(etapaOS.data_hora_fechamento))
      } else {
        setMecanico('')
        setFuncao('')
        setSetor('')
        setDataHoraAbertura(toLocalInputValue(movimentacao.data_hora_entrada))
        setDataHoraFechamento('')
      }
    } catch {
      setItemsData({})
    }
  }, [movimentacao.id, etapaOS, movimentacao.data_hora_entrada])

  // Salva itemsData no localStorage
  function persistItemsData(nextData: Record<string, ItemChecklistData>) {
    setItemsData(nextData)
    try {
      localStorage.setItem(`checklist_items_data_${movimentacao.id}`, JSON.stringify(nextData))
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
      horaInicio: nextChecked && !current.horaInicio ? current.horaInicio || nowTimeString() : current.horaInicio,
      horaFim: nextChecked && current.horaInicio && !current.horaFim ? nowTimeString() : current.horaFim,
    }

    persistItemsData({
      ...itemsData,
      [itemId]: nextItem,
    })
  }

  // Atualiza horários de um item específico
  function updateItemTime(itemId: string, field: 'horaInicio' | 'horaFim', value: string) {
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
      label: novoItemNome.trim(),
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

  // Sincroniza e Salva os dados do mecânico e horários no banco de dados (movimentacao_historico)
  async function salvarDadosServico() {
    setSalvandoDados(true)
    setSucessoSalvar(false)
    try {
      // 1. Salva no localStorage para persistência imediata
      const infoToSave = {
        mecanico,
        funcao,
        setor,
        dataHoraAbertura,
        dataHoraFechamento,
      }
      localStorage.setItem(`checklist_info_${movimentacao.id}`, JSON.stringify(infoToSave))

      const dataRef = movimentacao.data_hora_entrada || new Date().toISOString()
      const dataIsoAberturaGeral = dataHoraAbertura ? new Date(dataHoraAbertura).toISOString() : new Date().toISOString()
      const dataIsoFechamentoGeral = dataHoraFechamento ? new Date(dataHoraFechamento).toISOString() : undefined

      // 2. Salva/atualiza o registro geral de manutenção no histórico para o Controle de Horas
      if (etapaOS) {
        await atualizarHistorico(etapaOS.id, {
          descricao: etapaOS.descricao || 'Manutenção Geral - Checklist',
          dataHora: dataIsoAberturaGeral,
          mecanicoExecutor: mecanico,
          funcao: funcao || 'Mecânico',
          setor: setor || 'Manutenção',
          dataHoraAbertura: dataIsoAberturaGeral,
          dataHoraFechamento: dataIsoFechamentoGeral,
          osCriada: true,
        })
      } else {
        await adicionarHistorico(movimentacao.id, 'Manutenção Geral - Checklist', dataIsoAberturaGeral, {
          mecanicoExecutor: mecanico,
          funcao: funcao || 'Mecânico',
          setor: setor || 'Manutenção',
          dataHoraAbertura: dataIsoAberturaGeral,
          osCriada: true,
        })
      }

      // 3. Sincroniza cada atividade do checklist com horários preenchidos no histórico
      const nextItemsData = { ...itemsData }
      for (const sec of secoes) {
        for (const it of sec.itens) {
          const itData = nextItemsData[it.id]
          if (itData && (itData.horaInicio || itData.horaFim)) {
            const isoInicio = toIsoFromTime(itData.horaInicio, dataRef) || dataIsoAberturaGeral
            const isoFim = toIsoFromTime(itData.horaFim, dataRef)

            if (itData.historicoId) {
              try {
                await atualizarHistorico(itData.historicoId, {
                  descricao: it.label,
                  dataHora: isoInicio,
                  mecanicoExecutor: mecanico,
                  funcao: funcao || 'Mecânico',
                  setor: sec.titulo,
                  dataHoraAbertura: isoInicio,
                  dataHoraFechamento: isoFim,
                  osCriada: true,
                })
              } catch {
                // se o id não existir mais no banco, insere um novo
                const created = await adicionarHistorico(movimentacao.id, it.label, isoInicio, {
                  mecanicoExecutor: mecanico,
                  funcao: funcao || 'Mecânico',
                  setor: sec.titulo,
                  dataHoraAbertura: isoInicio,
                  osCriada: true,
                })
                if (isoFim) {
                  await atualizarHistorico(created.id, {
                    descricao: it.label,
                    dataHora: isoInicio,
                    mecanicoExecutor: mecanico,
                    funcao: funcao || 'Mecânico',
                    setor: sec.titulo,
                    dataHoraAbertura: isoInicio,
                    dataHoraFechamento: isoFim,
                    osCriada: true,
                  })
                }
                itData.historicoId = created.id
              }
            } else {
              const created = await adicionarHistorico(movimentacao.id, it.label, isoInicio, {
                mecanicoExecutor: mecanico,
                funcao: funcao || 'Mecânico',
                setor: sec.titulo,
                dataHoraAbertura: isoInicio,
                osCriada: true,
              })
              if (isoFim) {
                await atualizarHistorico(created.id, {
                  descricao: it.label,
                  dataHora: isoInicio,
                  mecanicoExecutor: mecanico,
                  funcao: funcao || 'Mecânico',
                  setor: sec.titulo,
                  dataHoraAbertura: isoInicio,
                  dataHoraFechamento: isoFim,
                  osCriada: true,
                })
              }
              itData.historicoId = created.id
            }
          }
        }
      }

      persistItemsData(nextItemsData)
      await refetchHistorico()
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
      alert(err instanceof Error ? err.message : 'Erro ao atualizar status.')
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
        texto: 'Aguardando abertura',
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
          texto: 'Data de fechamento anterior à abertura',
          minutos: 0,
          status: 'erro' as const,
        }
      }
      return {
        texto: formatMinutosParaTexto(minutos),
        minutos,
        status: 'fechado' as const,
      }
    }

    const minutos = permanenciaEmMinutos(dInicio.toISOString())
    return {
      texto: `${formatMinutosParaTexto(minutos)} (em andamento)`,
      minutos,
      status: 'em_andamento' as const,
    }
  }, [dataHoraAbertura, dataHoraFechamento])

  return (
    <Card className="border-border/60 space-y-5 p-5">
      {/* Header do Card */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/20 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <FileCheck className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-bold text-foreground">Checklist de Inspeção de Veículo</h3>
          </div>
          <p className="text-xs text-secondary">
            Inspeção e apontamento de horas para{' '}
            <strong className="text-foreground font-mono">{movimentacao.veiculo?.placa}</strong> — Alimentando o <strong>Controle de Horas</strong>
          </p>
        </div>

        {/* Status de Manutenção e Ações Rápidas */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-secondary">Status:</span>
            <Select
              value={movimentacao.status_id ?? ''}
              onChange={(e) => handleAlterarStatus(e.target.value)}
              disabled={salvandoStatus}
              className="!h-8 !text-xs !px-2.5 !w-auto"
            >
              <option value="">Sem manutenção</option>
              {statusManutencao.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
            </Select>
          </div>

          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={marcarTodos}
            className="!h-8 !text-xs !px-3"
          >
            <Check className="h-3.5 w-3.5 mr-1" />
            Marcar todos
          </Button>

          {itensConcluidos > 0 && (
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={desmarcarTodos}
              className="!h-8 !text-xs !px-3 text-secondary hover:text-red-400"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Limpar
            </Button>
          )}
        </div>
      </div>

      {/* BLOCO: Dados do Mecânico, Abertura, Fechamento e Horas Trabalhadas */}
      <div className="rounded-xl border border-border/40 bg-background/70 p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border/20 pb-3">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">
              Responsável & Apontamento para o Controle de Horas
            </span>
          </div>

          {/* Destaque do Cálculo de Horas Geral e Soma das Atividades */}
          <div className="flex flex-wrap items-center gap-2">
            {totalMinutosAtividades > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-primary/30 bg-primary/10 text-primary text-xs font-bold">
                <Clock className="h-3.5 w-3.5" />
                <span>Soma Atividades: {formatMinutosParaTexto(totalMinutosAtividades)}</span>
              </div>
            )}

            <div
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-bold ${
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
              <span>Duração Total: {calculoHorasGeral.texto}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Nome do Mecânico */}
          <div>
            <Label htmlFor="mecanico-nome" className="!text-xs !mb-1 font-medium text-secondary">
              Mecânico Executor
            </Label>
            <Input
              id="mecanico-nome"
              placeholder="Ex: Carlos Silva, Roberto…"
              value={mecanico}
              onChange={(e) => setMecanico(e.target.value)}
              className="!h-9 !text-sm !px-3"
            />
          </div>

          {/* Data e Hora de Abertura */}
          <div>
            <div className="flex items-center justify-between !mb-1">
              <Label htmlFor="data-hora-abertura" className="!text-xs font-medium text-secondary">
                Data/Hora da Abertura
              </Label>
              <button
                type="button"
                onClick={() => setDataHoraAbertura(nowLocalInputValue())}
                className="text-[11px] text-primary hover:underline font-medium"
              >
                Agora
              </button>
            </div>
            <Input
              id="data-hora-abertura"
              type="datetime-local"
              value={dataHoraAbertura}
              onChange={(e) => setDataHoraAbertura(e.target.value)}
              className="!h-9 !text-sm !px-3"
            />
          </div>

          {/* Data e Hora de Fechamento */}
          <div>
            <div className="flex items-center justify-between !mb-1">
              <Label htmlFor="data-hora-fechamento" className="!text-xs font-medium text-secondary">
                Data/Hora do Fechamento
              </Label>
              <button
                type="button"
                onClick={() => setDataHoraFechamento(nowLocalInputValue())}
                className="text-[11px] text-primary hover:underline font-medium"
              >
                Agora
              </button>
            </div>
            <Input
              id="data-hora-fechamento"
              type="datetime-local"
              value={dataHoraFechamento}
              onChange={(e) => setDataHoraFechamento(e.target.value)}
              className="!h-9 !text-sm !px-3"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-secondary">
            {sucessoSalvar && (
              <span className="text-emerald-400 font-medium flex items-center gap-1">
                <Check className="h-3.5 w-3.5" /> Salvo e sincronizado com o Controle de Horas!
              </span>
            )}
          </span>

          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={salvarDadosServico}
            disabled={salvandoDados}
            className="!h-8 !text-xs !px-3"
          >
            <Save className="h-3.5 w-3.5 mr-1" />
            {salvandoDados ? 'Salvando…' : 'Salvar no Controle de Horas'}
          </Button>
        </div>
      </div>

      {/* Barra de Progresso do Checklist */}
      <div className="rounded-xl border border-border/30 bg-background/50 p-3.5 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-foreground flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            Progresso da Inspeção
          </span>
          <span className="font-medium text-secondary">
            <strong className="text-foreground">{itensConcluidos}</strong> de {totalItens} itens verificados ({porcentagem}%)
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
                    <span className="text-sm font-bold text-foreground tracking-wide">
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
                      title="Adicionar novo item a esta seção"
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/40 bg-surface/50 text-secondary transition-colors hover:border-primary/50 hover:bg-primary/10 hover:text-primary"
                      aria-label="Adicionar item"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Formulário Inline de Adicionar Novo Item */}
                {adicionandoEmSecao === secao.id && (
                  <div className="mb-3 rounded-lg border border-primary/30 bg-primary/5 p-2.5 space-y-2">
                    <Label className="!text-xs font-medium text-foreground">
                      Novo item para {secao.titulo}
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        autoFocus
                        placeholder="Ex: Troca de óleo, Revisão de bicos…"
                        value={novoItemNome}
                        onChange={(e) => setNovoItemNome(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            adicionarNovoItem(secao.id)
                          }
                        }}
                        className="!h-8 !text-xs !px-2.5"
                      />
                      <Button
                        type="button"
                        variant="primary"
                        size="md"
                        onClick={() => adicionarNovoItem(secao.id)}
                        className="!h-8 !text-xs !px-3 shrink-0"
                      >
                        Adicionar
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="md"
                        onClick={() => {
                          setAdicionandoEmSecao(null)
                          setNovoItemNome('')
                        }}
                        className="!h-8 !text-xs !px-2.5 shrink-0"
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}

                {/* Lista de Itens com Horários Iniciais/Finais e Checkbox */}
                <div className="space-y-2">
                  {secao.itens.map((item) => {
                    const data = itemsData[item.id] || { checked: false }
                    const isChecked = Boolean(data.checked)
                    const isExpanded = Boolean(expandedItems[item.id])
                    const duracao = calcularDuracaoHorasMin(data.horaInicio, data.horaFim)

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
                        <div className="flex items-center gap-3 p-2.5">
                          {/* Quadrado do Checkbox */}
                          <button
                            type="button"
                            onClick={() => toggleItem(item.id)}
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all ${
                              isChecked
                                ? 'border-primary bg-primary text-white shadow-sm'
                                : 'border-secondary/40 bg-surface/50 hover:border-primary/60'
                            }`}
                            aria-label={isChecked ? 'Desmarcar' : 'Marcar'}
                          >
                            {isChecked && <Check className="h-3.5 w-3.5 stroke-[2.5]" />}
                          </button>

                          {/* Texto do Item */}
                          <span
                            onClick={() => toggleItem(item.id)}
                            className={`text-sm leading-snug flex-1 cursor-pointer select-none ${
                              isChecked
                                ? 'font-medium text-foreground'
                                : 'text-foreground/80'
                            }`}
                          >
                            {item.label}
                          </span>

                          {/* Badge de Horas Calculadas na Atividade */}
                          {duracao && (
                            <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-primary/10 border border-primary/25 text-primary shrink-0">
                              <Clock className="h-3 w-3" />
                              {duracao.texto}
                            </span>
                          )}

                          {/* Botão para Expandir/Ocultar Horários */}
                          <button
                            type="button"
                            onClick={() => toggleExpandItem(item.id)}
                            title={isExpanded ? 'Ocultar horários' : 'Apontar horário inicial e final'}
                            className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md border transition-colors shrink-0 ${
                              data.horaInicio || data.horaFim || isExpanded
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
                                  : 'Horário'}
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
                              title="Remover item customizado"
                              className="text-secondary/50 hover:text-red-400 p-1 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>

                        {/* Bloco Expandido: Inputs de Hora Inicial e Hora Final */}
                        {isExpanded && (
                          <div className="px-3 pb-3 pt-1 border-t border-border/20 flex flex-wrap items-center gap-3 bg-surface/20 rounded-b-lg">
                            {/* Hora Inicial */}
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-secondary font-medium whitespace-nowrap">
                                Início:
                              </span>
                              <input
                                type="time"
                                value={data.horaInicio || ''}
                                onChange={(e) => updateItemTime(item.id, 'horaInicio', e.target.value)}
                                className="h-7 px-2 text-xs rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                              />
                              <button
                                type="button"
                                onClick={() => updateItemTime(item.id, 'horaInicio', nowTimeString())}
                                className="text-[10px] text-primary hover:underline font-medium px-1"
                              >
                                Agora
                              </button>
                            </div>

                            {/* Hora Final */}
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-secondary font-medium whitespace-nowrap">
                                Fim:
                              </span>
                              <input
                                type="time"
                                value={data.horaFim || ''}
                                onChange={(e) => updateItemTime(item.id, 'horaFim', e.target.value)}
                                className="h-7 px-2 text-xs rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                              />
                              <button
                                type="button"
                                onClick={() => updateItemTime(item.id, 'horaFim', nowTimeString())}
                                className="text-[10px] text-primary hover:underline font-medium px-1"
                              >
                                Agora
                              </button>
                            </div>

                            {/* Duração Calculada */}
                            {duracao && (
                              <div className="text-xs font-bold text-primary flex items-center gap-1 ml-auto">
                                <span>Tempo gasto: {duracao.texto}</span>
                              </div>
                            )}
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
                className="mt-3 flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg border border-dashed border-border/40 text-xs text-secondary hover:border-primary/50 hover:bg-primary/5 hover:text-primary transition-all"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Adicionar outro item em {secao.titulo}</span>
              </button>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
