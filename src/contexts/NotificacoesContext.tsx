import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { notificationSound } from '@/lib/notificationSound'

export interface NotificacaoItem {
  id: string
  tipo: 'entrada' | 'saida' | 'patio_tempo' | 'os_status' | 'os_finalizada' | 'sistema'
  titulo: string
  mensagem: string
  dataHora: string
  link?: string
  lida: boolean
  prioridade?: 'normal' | 'alerta' | 'urgente'
  icone?: string
}

export interface ConfigNotificacoes {
  pushAtivo: boolean
  alertaEntradaAtivo: boolean
  alertaSaidaAtivo: boolean
  alertaPatioAtivo: boolean
  alertaPatioHoras: number
  alertaOsAbertaAtivo: boolean
  alertaOsPecasAtivo: boolean
  alertaOsOrcamentoAtivo: boolean
  alertaOsAutorizacaoAtivo: boolean
  alertaOsMultilixoAtivo: boolean
  alertaOsClienteAtivo: boolean
  alertaOsFinalizadaAtivo: boolean
  somAtivo: boolean
}

export const CONFIG_NOTIF_DEFAULT: ConfigNotificacoes = {
  pushAtivo: false,
  alertaEntradaAtivo: false,
  alertaSaidaAtivo: false,
  alertaPatioAtivo: false,
  alertaPatioHoras: 24,
  alertaOsAbertaAtivo: false,
  alertaOsPecasAtivo: false,
  alertaOsOrcamentoAtivo: false,
  alertaOsAutorizacaoAtivo: false,
  alertaOsMultilixoAtivo: false,
  alertaOsClienteAtivo: false,
  alertaOsFinalizadaAtivo: false,
  somAtivo: false,
}

const STORAGE_CONFIG_KEY = 'config_notificacoes'
const STORAGE_LIDAS_KEY = 'notificacoes_lidas_ids'
const STORAGE_MANUAIS_KEY = 'notificacoes_manuais_broadcast'

interface NotificacoesContextType {
  notificacoes: NotificacaoItem[]
  naoLidasCount: number
  config: ConfigNotificacoes
  updateConfig: (patch: Partial<ConfigNotificacoes>) => void
  salvarConfig: (novaConfig: ConfigNotificacoes) => void
  marcarComoLida: (id: string) => void
  marcarTodasComoLidas: () => void
  limparTodas: () => void
  dispararNotificacaoTeste: () => void
  criarNotificacaoManual: (titulo: string, mensagem: string, prioridade?: 'normal' | 'alerta' | 'urgente') => void
  tocarSom: () => void
  recarregar: () => Promise<void>
}

const NotificacoesContext = createContext<NotificacoesContextType | undefined>(undefined)

export function NotificacoesProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<ConfigNotificacoes>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_CONFIG_KEY)
      if (raw) return { ...CONFIG_NOTIF_DEFAULT, ...JSON.parse(raw) }
    } catch {}
    return CONFIG_NOTIF_DEFAULT
  })

  const [lidas, setLidas] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_LIDAS_KEY)
      if (raw) return new Set(JSON.parse(raw))
    } catch {}
    return new Set()
  })

  const [manuais, setManuais] = useState<NotificacaoItem[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_MANUAIS_KEY)
      if (raw) return JSON.parse(raw)
    } catch {}
    return []
  })

  const [notificacoesDinamicas, setNotificacoesDinamicas] = useState<NotificacaoItem[]>([])

  const salvarConfig = useCallback((novaConfig: ConfigNotificacoes) => {
    setConfig(novaConfig)
    try {
      localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(novaConfig))
    } catch {}
  }, [])

  const updateConfig = useCallback((patch: Partial<ConfigNotificacoes>) => {
    setConfig((prev) => {
      const next = { ...prev, ...patch }
      try {
        localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(next))
      } catch {}
      return next
    })
  }, [])

  const marcarComoLida = useCallback((id: string) => {
    setLidas((prev) => {
      const next = new Set(prev)
      next.add(id)
      try {
        localStorage.setItem(STORAGE_LIDAS_KEY, JSON.stringify(Array.from(next)))
      } catch {}
      return next
    })
  }, [])

  const marcarTodasComoLidas = useCallback(() => {
    const todosIds = [...notificacoesDinamicas, ...manuais].map((n) => n.id)
    setLidas(() => {
      const next = new Set(todosIds)
      try {
        localStorage.setItem(STORAGE_LIDAS_KEY, JSON.stringify(Array.from(next)))
      } catch {}
      return next
    })
  }, [notificacoesDinamicas, manuais])

  const limparTodas = useCallback(() => {
    const todosIds = [...notificacoesDinamicas, ...manuais].map((n) => n.id)
    setLidas(new Set(todosIds))
    setManuais([])
    try {
      localStorage.setItem(STORAGE_LIDAS_KEY, JSON.stringify(todosIds))
      localStorage.removeItem(STORAGE_MANUAIS_KEY)
    } catch {}
  }, [notificacoesDinamicas, manuais])

  const carregarEventos = useCallback(async () => {
    if (!config.pushAtivo) {
      setNotificacoesDinamicas([])
      return
    }

    try {
      const lista: NotificacaoItem[] = []
      const agora = new Date()
      // Início do dia de hoje (00:00) para entradas/saídas
      const inicioHoje = new Date()
      inicioHoje.setHours(0, 0, 0, 0)
      const inicioHojeISO = inicioHoje.toISOString()

      const [movsRes, osRes] = await Promise.all([
        supabase
          .from('movimentacoes')
          .select(`
            id,
            status,
            data_hora_entrada,
            data_hora_saida,
            motorista,
            veiculo:veiculos (
              id,
              placa,
              marca:marcas (nome),
              modelo:modelos (nome)
            ),
            patio:patios (nome)
          `)
          .or(`data_hora_entrada.gte.${inicioHojeISO},status.eq.no_patio`)
          .order('data_hora_entrada', { ascending: false })
          .limit(40),
        supabase
          .from('checklist_os')
          .select(`
            id,
            movimentacao_id,
            status_os,
            mecanico,
            data_hora_abertura,
            data_hora_fechamento,
            created_at,
            movimentacao:movimentacoes (
              veiculo:veiculos (placa)
            )
          `)
          .order('created_at', { ascending: false })
          .limit(30),
      ])

      const movs = movsRes.data ?? []
      const osList = osRes.data ?? []

      // Alertas de Pátio
      for (const m of movs) {
        const veic = m.veiculo as { placa?: string } | null
        const placa = veic?.placa || 'VEÍCULO'
        const patioNome = (m.patio as { nome?: string } | null)?.nome || 'PÁTIO'

        // 1. Alerta Crítico: Tempo no Pátio Excedido
        if (config.alertaPatioAtivo && m.status === 'no_patio' && m.data_hora_entrada) {
          const dEntrada = new Date(m.data_hora_entrada)
          const horasNoPatio = Math.floor((agora.getTime() - dEntrada.getTime()) / (1000 * 3600))
          if (horasNoPatio >= config.alertaPatioHoras) {
            lista.push({
              id: `patio_${m.id}`,
              tipo: 'patio_tempo',
              titulo: `⏰ TEMPO NO PÁTIO EXCEDIDO (${horasNoPatio}H): ${placa}`,
              mensagem: `Veículo ultrapassou o limite de ${config.alertaPatioHoras}h no pátio ${patioNome}.`,
              dataHora: m.data_hora_entrada,
              link: `/movimentacoes`,
              lida: false,
              prioridade: 'urgente',
              icone: '⏰',
            })
          }
        }

        // 2. Entradas do dia
        if (config.alertaEntradaAtivo && m.data_hora_entrada) {
          const dEntrada = new Date(m.data_hora_entrada)
          if (dEntrada >= inicioHoje) {
            lista.push({
              id: `entrada_${m.id}`,
              tipo: 'entrada',
              titulo: `🚗 ENTRADA: ${placa}`,
              mensagem: `Entrou no pátio ${patioNome}${m.motorista ? ` · Motorista: ${m.motorista}` : ''}.`,
              dataHora: m.data_hora_entrada,
              link: `/movimentacoes`,
              lida: false,
              prioridade: 'normal',
              icone: '🚗',
            })
          }
        }

        // 3. Saídas do dia
        if (config.alertaSaidaAtivo && m.data_hora_saida) {
          const dSaida = new Date(m.data_hora_saida)
          if (dSaida >= inicioHoje) {
            lista.push({
              id: `saida_${m.id}`,
              tipo: 'saida',
              titulo: `🏁 SAÍDA: ${placa}`,
              mensagem: `Veículo liberado do pátio ${patioNome}.`,
              dataHora: m.data_hora_saida,
              link: `/movimentacoes`,
              lida: false,
              prioridade: 'normal',
              icone: '🏁',
            })
          }
        }
      }

      // Alertas de O.S e Oficinas
      for (const os of osList) {
        const mov = os.movimentacao as { veiculo?: { placa?: string } } | null
        const placa = mov?.veiculo?.placa || 'VEÍCULO'
        const mec = os.mecanico ? ` · Mecânico: ${os.mecanico}` : ''
        const st = (os.status_os || 'EM ANDAMENTO').toUpperCase()

        if (st === 'AGUARDANDO PEÇAS' && config.alertaOsPecasAtivo) {
          lista.push({
            id: `os_pecas_${os.id}`,
            tipo: 'os_status',
            titulo: `⏳ AGUARDANDO PEÇAS: ${placa}`,
            mensagem: `O.S parada aguardando peças de reposição${mec}.`,
            dataHora: os.created_at,
            link: `/manutencao`,
            lida: false,
            prioridade: 'alerta',
            icone: '⏳',
          })
        } else if (st === 'AGUARDANDO APROVAÇÃO DO ORÇAMENTO' && config.alertaOsOrcamentoAtivo) {
          lista.push({
            id: `os_orc_${os.id}`,
            tipo: 'os_status',
            titulo: `📄 AGUARD. ORÇAMENTO: ${placa}`,
            mensagem: `Orçamento de manutenção pendente de aprovação${mec}.`,
            dataHora: os.created_at,
            link: `/manutencao`,
            lida: false,
            prioridade: 'alerta',
            icone: '📄',
          })
        } else if (st === 'AGUARDANDO AUTORIZAÇÃO' && config.alertaOsAutorizacaoAtivo) {
          lista.push({
            id: `os_aut_${os.id}`,
            tipo: 'os_status',
            titulo: `⚠️ AGUARD. AUTORIZAÇÃO: ${placa}`,
            mensagem: `Aguardando autorização de serviço${mec}.`,
            dataHora: os.created_at,
            link: `/manutencao`,
            lida: false,
            prioridade: 'urgente',
            icone: '⚠️',
          })
        } else if (st === 'AGUARDANDO APROVAÇÃO MULTILIXO' && config.alertaOsMultilixoAtivo) {
          lista.push({
            id: `os_multi_${os.id}`,
            tipo: 'os_status',
            titulo: `🏢 AGUARD. MULTILIXO: ${placa}`,
            mensagem: `O.S aguardando aprovação da Multilixo${mec}.`,
            dataHora: os.created_at,
            link: `/manutencao`,
            lida: false,
            prioridade: 'alerta',
            icone: '🏢',
          })
        } else if (st === 'AGUARDANDO APROVAÇÃO DO CLIENTE' && config.alertaOsClienteAtivo) {
          lista.push({
            id: `os_cli_${os.id}`,
            tipo: 'os_status',
            titulo: `👥 AGUARD. CLIENTE: ${placa}`,
            mensagem: `O.S aguardando aprovação do cliente${mec}.`,
            dataHora: os.created_at,
            link: `/manutencao`,
            lida: false,
            prioridade: 'alerta',
            icone: '👥',
          })
        }
      }

      setNotificacoesDinamicas(lista)
    } catch (e) {
      console.error('[useNotificacoes] Erro ao carregar notificações:', e)
    }
  }, [config])

  useEffect(() => {
    carregarEventos()
    const timer = setInterval(carregarEventos, 30000)

    const channel = supabase
      .channel('notificacoes_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'movimentacoes' }, () => {
        carregarEventos()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checklist_os' }, () => {
        carregarEventos()
      })
      .subscribe()

    const onChecklistUpdated = () => carregarEventos()
    window.addEventListener('checklist_updated', onChecklistUpdated)

    return () => {
      clearInterval(timer)
      supabase.removeChannel(channel)
      window.removeEventListener('checklist_updated', onChecklistUpdated)
    }
  }, [carregarEventos])

  const tocarSom = useCallback(() => {
    notificationSound.playChime()
  }, [])

  const criarNotificacaoManual = useCallback((titulo: string, mensagem: string, prioridade: 'normal' | 'alerta' | 'urgente' = 'normal') => {
    const item: NotificacaoItem = {
      id: `manual_${Date.now()}`,
      tipo: 'sistema',
      titulo: titulo.toUpperCase(),
      mensagem,
      dataHora: new Date().toISOString(),
      lida: false,
      prioridade,
      icone: '📢',
    }

    if (config.somAtivo) {
      notificationSound.playChime()
    }

    setManuais((prev) => {
      const next = [item, ...prev]
      try {
        localStorage.setItem(STORAGE_MANUAIS_KEY, JSON.stringify(next))
      } catch {}
      return next
    })
  }, [config.somAtivo])

  const dispararNotificacaoTeste = useCallback(() => {
    notificationSound.playChime()
    criarNotificacaoManual(
      '🔔 NOTIFICAÇÃO DE TESTE DO SISTEMA',
      'As notificações sonoras e visuais do sistema estão ativas e funcionando!',
      'alerta'
    )
  }, [criarNotificacaoManual])

  const todasNotificacoes = useMemo(() => {
    const unificadas = [...manuais, ...notificacoesDinamicas].map((n) => ({
      ...n,
      lida: lidas.has(n.id),
    }))

    // Ordena mais recentes primeiro
    unificadas.sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime())
    return unificadas
  }, [notificacoesDinamicas, manuais, lidas])

  const naoLidasCount = useMemo(() => {
    return todasNotificacoes.filter((n) => !n.lida).length
  }, [todasNotificacoes])

  return (
    <NotificacoesContext.Provider
      value={{
        notificacoes: todasNotificacoes,
        naoLidasCount,
        config,
        updateConfig,
        salvarConfig,
        marcarComoLida,
        marcarTodasComoLidas,
        limparTodas,
        dispararNotificacaoTeste,
        criarNotificacaoManual,
        tocarSom,
        recarregar: carregarEventos,
      }}
    >
      {children}
    </NotificacoesContext.Provider>
  )
}

export function useNotificacoes() {
  const ctx = useContext(NotificacoesContext)
  if (!ctx) {
    throw new Error('useNotificacoes must be used within NotificacoesProvider')
  }
  return ctx
}
