import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { differenceInDays, parseISO, isBefore, startOfDay, format } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { notificationSound } from '@/lib/notificationSound'
import { dispararPushLocal, solicitarPermissaoNotificacoes, inicializarPushRemoto } from '@/lib/pushNotifications'

export interface NotificacaoItem {
  id: string
  tipo: 'entrada' | 'saida' | 'patio_tempo' | 'os_status' | 'os_finalizada' | 'sistema' | 'frota_preventiva' | 'frota_doc_vencido' | 'frota_doc_avencer'
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
  alertaFrotaPreventivaAtivo: boolean
  alertaFrotaDocAtivo: boolean
  somAtivo: boolean
}

export const CONFIG_NOTIF_DEFAULT: ConfigNotificacoes = {
  pushAtivo: true,
  alertaEntradaAtivo: true,
  alertaSaidaAtivo: true,
  alertaPatioAtivo: true,
  alertaPatioHoras: 24,
  alertaOsAbertaAtivo: true,
  alertaOsPecasAtivo: true,
  alertaOsOrcamentoAtivo: true,
  alertaOsAutorizacaoAtivo: true,
  alertaOsMultilixoAtivo: true,
  alertaOsClienteAtivo: true,
  alertaOsFinalizadaAtivo: true,
  alertaFrotaPreventivaAtivo: true,
  alertaFrotaDocAtivo: true,
  somAtivo: true,
}

const STORAGE_CONFIG_KEY = 'config_notificacoes_v2'
const STORAGE_LIDAS_KEY = 'notificacoes_lidas_ids_v2'
const STORAGE_MANUAIS_KEY = 'notificacoes_manuais_broadcast_v2'
const STORAGE_DISPARADAS_KEY = 'notificacoes_disparadas_push_ids_v2'
const STORAGE_REMOVIDAS_KEY = 'notificacoes_removidas_ids_v2'

interface NotificacoesContextType {
  notificacoes: NotificacaoItem[]
  naoLidasCount: number
  config: ConfigNotificacoes
  updateConfig: (patch: Partial<ConfigNotificacoes>) => void
  salvarConfig: (novaConfig: ConfigNotificacoes) => void
  marcarComoLida: (id: string) => void
  marcarTodasComoLidas: () => void
  removerNotificacao: (id: string) => void
  limparTodas: () => void
  dispararNotificacaoTeste: () => void
  criarNotificacaoManual: (titulo: string, mensagem: string, prioridade?: 'normal' | 'alerta' | 'urgente') => void
  tocarSom: () => void
  recarregar: () => Promise<void>
}

const NotificacoesContext = createContext<NotificacoesContextType | undefined>(undefined)

export function NotificacoesProvider({ children }: { children: React.ReactNode }) {
  const inicializadoRef = useRef(false)
  const disparadasRef = useRef<Set<string>>(new Set())

  const [config, setConfig] = useState<ConfigNotificacoes>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_CONFIG_KEY)
      if (raw) return { ...CONFIG_NOTIF_DEFAULT, ...JSON.parse(raw) }
      // Migração de chave antiga se houver
      const rawOld = localStorage.getItem('config_notificacoes')
      if (rawOld) {
        const parsedOld = JSON.parse(rawOld)
        return {
          ...CONFIG_NOTIF_DEFAULT,
          ...parsedOld,
          pushAtivo: true,
          somAtivo: true,
          alertaFrotaPreventivaAtivo: true,
          alertaFrotaDocAtivo: true,
        }
      }
    } catch {}
    return CONFIG_NOTIF_DEFAULT
  })

  // Inicializa canal e permissões no Android/APK e Web logo na inicialização
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_DISPARADAS_KEY)
      if (raw) {
        disparadasRef.current = new Set(JSON.parse(raw))
      }
    } catch {}

    solicitarPermissaoNotificacoes()
    inicializarPushRemoto()

    const onUserInteract = () => {
      solicitarPermissaoNotificacoes()
      inicializarPushRemoto()
      window.removeEventListener('click', onUserInteract)
      window.removeEventListener('touchstart', onUserInteract)
    }
    window.addEventListener('click', onUserInteract, { passive: true })
    window.addEventListener('touchstart', onUserInteract, { passive: true })

    return () => {
      window.removeEventListener('click', onUserInteract)
      window.removeEventListener('touchstart', onUserInteract)
    }
  }, [])

  const [lidas, setLidas] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_LIDAS_KEY)
      if (raw) return new Set(JSON.parse(raw))
    } catch {}
    return new Set()
  })

  // IDs descartados pelo usuário (botão de excluir). Como as notificações
  // "dinâmicas" são recalculadas a cada poll a partir do estado real (ex:
  // entrada de hoje), sem essa lista persistida elas voltariam a aparecer
  // sozinhas no ciclo seguinte mesmo depois de excluídas.
  const [removidas, setRemovidas] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_REMOVIDAS_KEY)
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
    if (novaConfig.pushAtivo) {
      solicitarPermissaoNotificacoes()
    }
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

  const removerNotificacao = useCallback((id: string) => {
    setRemovidas((prev) => {
      const next = new Set(prev)
      next.add(id)
      try {
        localStorage.setItem(STORAGE_REMOVIDAS_KEY, JSON.stringify(Array.from(next)))
      } catch {}
      return next
    })
    setManuais((prev) => {
      if (!prev.some((n) => n.id === id)) return prev
      const next = prev.filter((n) => n.id !== id)
      try {
        localStorage.setItem(STORAGE_MANUAIS_KEY, JSON.stringify(next))
      } catch {}
      return next
    })
  }, [])

  const limparTodas = useCallback(() => {
    const todosIds = [...notificacoesDinamicas, ...manuais].map((n) => n.id)
    setLidas((prev) => new Set([...prev, ...todosIds]))
    setRemovidas((prev) => new Set([...prev, ...todosIds]))
    setManuais([])
    try {
      localStorage.setItem(STORAGE_LIDAS_KEY, JSON.stringify(Array.from(new Set([...lidas, ...todosIds]))))
      localStorage.setItem(STORAGE_REMOVIDAS_KEY, JSON.stringify(Array.from(new Set([...removidas, ...todosIds]))))
      localStorage.removeItem(STORAGE_MANUAIS_KEY)
    } catch {}
  }, [notificacoesDinamicas, manuais, lidas, removidas])

  const carregarEventos = useCallback(async () => {
    try {
      const lista: NotificacaoItem[] = []
      const agora = new Date()
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

      // 1. Alertas de Pátio, Entradas e Saídas
      for (const m of movs) {
        const veic = m.veiculo as { placa?: string } | null
        const placa = veic?.placa ? veic.placa.toUpperCase().trim() : 'VEÍCULO'
        const patioNome = (m.patio as { nome?: string } | null)?.nome || 'PÁTIO'

        // A) Tempo no Pátio Excedido
        if (config.alertaPatioAtivo && m.status === 'no_patio' && m.data_hora_entrada) {
          const dEntrada = new Date(m.data_hora_entrada)
          const horasNoPatio = Math.floor((agora.getTime() - dEntrada.getTime()) / (1000 * 3600))
          if (horasNoPatio >= (config.alertaPatioHoras || 24)) {
            lista.push({
              id: `patio_${m.id}`,
              tipo: 'patio_tempo',
              titulo: `⏰ TEMPO NO PÁTIO EXCEDIDO (${horasNoPatio}H): ${placa}`,
              mensagem: `Veículo ultrapassou o limite de ${config.alertaPatioHoras || 24}h no pátio ${patioNome}.`,
              dataHora: m.data_hora_entrada,
              link: `/movimentacoes`,
              lida: false,
              prioridade: 'urgente',
              icone: '⏰',
            })
          }
        }

        // B) Entradas de hoje
        if (config.alertaEntradaAtivo && m.data_hora_entrada) {
          const dEntrada = new Date(m.data_hora_entrada)
          if (dEntrada >= inicioHoje) {
            lista.push({
              id: `entrada_${m.id}`,
              tipo: 'entrada',
              titulo: `🚗 ENTRADA REGISTRADA: ${placa}`,
              mensagem: `Veículo entrou no pátio ${patioNome}${m.motorista ? ` · Motorista: ${m.motorista}` : ''}.`,
              dataHora: m.data_hora_entrada,
              link: `/movimentacoes`,
              lida: false,
              prioridade: 'normal',
              icone: '🚗',
            })
          }
        }

        // C) Saídas de hoje
        if (config.alertaSaidaAtivo && m.data_hora_saida) {
          const dSaida = new Date(m.data_hora_saida)
          if (dSaida >= inicioHoje) {
            lista.push({
              id: `saida_${m.id}`,
              tipo: 'saida',
              titulo: `🏁 SAÍDA REGISTRADA: ${placa}`,
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

      // 2. Alertas de O.S e Oficinas
      for (const os of osList) {
        const mov = os.movimentacao as { veiculo?: { placa?: string } } | null
        const placa = mov?.veiculo?.placa ? mov.veiculo.placa.toUpperCase().trim() : 'VEÍCULO'
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

      // 3. Alertas de Gestão de Frotas (KM da Preventiva, Data e Documentos CRLV)
      try {
        const rawFrotas = localStorage.getItem('gvel_frotas_cadastradas_v1')

        if (rawFrotas) {
          const frotas: Array<{
            id: string
            placa: string
            modeloNome?: string
            clienteNome?: string
            kmUltimaPreventiva?: number
            intervaloPreventivaKm?: number
            dataUltimaPreventiva?: string
            vencimentoPreventiva?: string
            vencimentoDocumento?: string
          }> = JSON.parse(rawFrotas)

          // Mapeia última KM informada nos checklists (Supabase) para cada placa
          const ultimasKms = new Map<string, number>()
          try {
            const { data: chks } = await supabase
              .from('checklists_frota')
              .select('placa, km_atual')
              .gt('km_atual', 0)
            ;(chks || []).forEach((chk: { placa: string; km_atual: number }) => {
              if (chk.placa && chk.km_atual > 0) {
                const p = chk.placa.toUpperCase().trim()
                const atual = ultimasKms.get(p) || 0
                if (chk.km_atual > atual) ultimasKms.set(p, chk.km_atual)
              }
            })
          } catch (chkErr) {
            console.warn('Falha ao buscar KM dos checklists da frota para notificações:', chkErr)
          }

          const hoje = startOfDay(new Date())

          for (const v of frotas) {
            const placa = v.placa ? v.placa.toUpperCase().trim() : 'VEÍCULO'
            const modelo = v.modeloNome || 'Frota'
            const kmAtual = ultimasKms.get(placa) || 0
            const kmUltima = v.kmUltimaPreventiva || 0
            const intervalo = v.intervaloPreventivaKm || 10000

            // A) Alerta Preventiva por KM
            if (config.alertaFrotaPreventivaAtivo && kmUltima > 0 && kmAtual > 0) {
              const kmLimite = kmUltima + intervalo
              const kmRestante = kmLimite - kmAtual
              if (kmRestante < 0) {
                lista.push({
                  id: `frota_prev_km_${v.id}_${kmLimite}`,
                  tipo: 'frota_preventiva',
                  titulo: `🛑 PREVENTIVA VENCIDA POR KM: ${placa}`,
                  mensagem: `Veículo atingiu ${kmAtual.toLocaleString('pt-BR')} KM (ultrapassou o limite de revisão de ${kmLimite.toLocaleString('pt-BR')} KM em ${Math.abs(kmRestante).toLocaleString('pt-BR')} KM).`,
                  dataHora: agora.toISOString(),
                  link: '/frotas',
                  lida: false,
                  prioridade: 'urgente',
                  icone: '🛑',
                })
              } else if (kmRestante <= 1000) {
                lista.push({
                  id: `frota_prev_km_prox_${v.id}_${kmLimite}`,
                  tipo: 'frota_preventiva',
                  titulo: `⚠️ PREVENTIVA PRÓXIMA: ${placa}`,
                  mensagem: `Faltam apenas ${kmRestante.toLocaleString('pt-BR')} KM para a próxima revisão preventiva (${kmLimite.toLocaleString('pt-BR')} KM).`,
                  dataHora: agora.toISOString(),
                  link: '/frotas',
                  lida: false,
                  prioridade: 'alerta',
                  icone: '⚠️',
                })
              }
            }

            // B) Preventiva por Data
            const dataPrevStr = v.dataUltimaPreventiva || v.vencimentoPreventiva
            if (config.alertaFrotaPreventivaAtivo && dataPrevStr) {
              try {
                const dataPrev = parseISO(dataPrevStr)
                if (isBefore(dataPrev, hoje)) {
                  const diasAtraso = Math.abs(differenceInDays(dataPrev, hoje))
                  lista.push({
                    id: `frota_prev_data_${v.id}_${dataPrevStr}`,
                    tipo: 'frota_preventiva',
                    titulo: `⚠️ PREVENTIVA ATRASADA (DATA): ${placa}`,
                    mensagem: `A revisão periódica do veículo (${modelo}) venceu em ${format(dataPrev, 'dd/MM/yyyy')} (${diasAtraso} dias atrás).`,
                    dataHora: `${dataPrevStr}T08:00:00.000Z`,
                    link: '/frotas',
                    lida: false,
                    prioridade: 'urgente',
                    icone: '⚠️',
                  })
                }
              } catch {}
            }

            // C) Documento Vencido ou a Vencer (CRLV)
            if (config.alertaFrotaDocAtivo && v.vencimentoDocumento) {
              try {
                const dataDoc = parseISO(v.vencimentoDocumento)
                const diasDoc = differenceInDays(dataDoc, hoje)

                if (diasDoc < 0) {
                  lista.push({
                    id: `frota_doc_venc_${v.id}_${v.vencimentoDocumento}`,
                    tipo: 'frota_doc_vencido',
                    titulo: `🛑 CRLV VENCIDO: ${placa}`,
                    mensagem: `O documento do veículo (${modelo}) expirou em ${format(dataDoc, 'dd/MM/yyyy')} (${Math.abs(diasDoc)} dias atrás).`,
                    dataHora: `${v.vencimentoDocumento}T08:00:00.000Z`,
                    link: '/frotas',
                    lida: false,
                    prioridade: 'urgente',
                    icone: '🛑',
                  })
                } else if (diasDoc <= 30) {
                  lista.push({
                    id: `frota_doc_avencer_${v.id}_${v.vencimentoDocumento}`,
                    tipo: 'frota_doc_avencer',
                    titulo: `⏳ CRLV A VENCER (${diasDoc === 0 ? 'HOJE' : `${diasDoc}D`}): ${placa}`,
                    mensagem: `O documento do veículo (${modelo}) vencerá em ${format(dataDoc, 'dd/MM/yyyy')}.`,
                    dataHora: agora.toISOString(),
                    link: '/frotas',
                    lida: false,
                    prioridade: 'alerta',
                    icone: '⏳',
                  })
                }
              } catch {}
            }
          }
        }
      } catch (e) {
        console.error('[useNotificacoes] Erro ao verificar alertas de frotas:', e)
      }

      // Gerenciamento de disparo de push nativo e som para NOVOS eventos
      if (!inicializadoRef.current) {
        // Na primeira carga, memoriza os itens já existentes no snapshot inicial
        lista.forEach((item) => disparadasRef.current.add(item.id))
        try {
          localStorage.setItem(STORAGE_DISPARADAS_KEY, JSON.stringify(Array.from(disparadasRef.current)))
        } catch {}
        inicializadoRef.current = true
      } else {
        // Dispara som e push para eventos novos que acabaram de acontecer
        const novos = lista.filter((item) => !disparadasRef.current.has(item.id))
        if (novos.length > 0) {
          novos.forEach((item) => {
            disparadasRef.current.add(item.id)
            if (config.pushAtivo) {
              dispararPushLocal(item.titulo, item.mensagem)
            }
          })

          if (config.somAtivo) {
            notificationSound.playChime()
          }

          try {
            localStorage.setItem(STORAGE_DISPARADAS_KEY, JSON.stringify(Array.from(disparadasRef.current)))
          } catch {}
        }
      }

      setNotificacoesDinamicas(lista)
    } catch (e) {
      console.error('[useNotificacoes] Erro ao carregar notificações:', e)
    }
  }, [config])

  useEffect(() => {
    carregarEventos()
    const timer = setInterval(carregarEventos, 10000)

    // Realtime do Supabase
    const channel = supabase
      .channel('notificacoes_realtime_v2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'movimentacoes' }, () => {
        carregarEventos()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checklist_os' }, () => {
        carregarEventos()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checklist_itens' }, () => {
        carregarEventos()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ferramentas_retiradas' }, () => {
        carregarEventos()
      })
      .subscribe()

    // Eventos customizados locais
    const onLocalUpdate = () => carregarEventos()
    window.addEventListener('checklist_updated', onLocalUpdate)
    window.addEventListener('frota_updated', onLocalUpdate)
    window.addEventListener('movimentacao_cadastrada', onLocalUpdate)
    window.addEventListener('movimentacao_updated', onLocalUpdate)

    return () => {
      clearInterval(timer)
      supabase.removeChannel(channel)
      window.removeEventListener('checklist_updated', onLocalUpdate)
      window.removeEventListener('frota_updated', onLocalUpdate)
      window.removeEventListener('movimentacao_cadastrada', onLocalUpdate)
      window.removeEventListener('movimentacao_updated', onLocalUpdate)
    }
  }, [carregarEventos])

  const tocarSom = useCallback(() => {
    notificationSound.playChime()
  }, [])

  const criarNotificacaoManual = useCallback((titulo: string, mensagem: string, prioridade: 'normal' | 'alerta' | 'urgente' = 'normal') => {
    const item: NotificacaoItem = {
      id: `manual_${Date.now()}_${Math.random()}`,
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

    if (config.pushAtivo) {
      dispararPushLocal(item.titulo, item.mensagem)
    }

    setManuais((prev) => {
      const next = [item, ...prev]
      try {
        localStorage.setItem(STORAGE_MANUAIS_KEY, JSON.stringify(next))
      } catch {}
      return next
    })
  }, [config.somAtivo, config.pushAtivo])

  const dispararNotificacaoTeste = useCallback(() => {
    notificationSound.playChime()
    dispararPushLocal(
      '🔔 TESTE DE NOTIFICAÇÃO',
      'Notificações no celular e sistema ativas e funcionando perfeitamente!'
    )
    criarNotificacaoManual(
      '🔔 NOTIFICAÇÃO DE TESTE DO SISTEMA',
      'As notificações sonoras, push no celular e avisos do sistema estão ativas e funcionando!',
      'alerta'
    )
  }, [criarNotificacaoManual])

  const todasNotificacoes = useMemo(() => {
    const combinadas = [...notificacoesDinamicas, ...manuais]
    const unicos = new Map<string, NotificacaoItem>()
    combinadas.forEach((n) => {
      if (removidas.has(n.id)) return
      unicos.set(n.id, {
        ...n,
        lida: lidas.has(n.id),
      })
    })

    return Array.from(unicos.values()).sort(
      (a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime()
    )
  }, [notificacoesDinamicas, manuais, lidas, removidas])

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
        removerNotificacao,
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
    throw new Error('useNotificacoes deve ser usado dentro de um NotificacoesProvider')
  }
  return ctx
}
