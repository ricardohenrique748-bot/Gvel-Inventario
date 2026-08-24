import { useState, useEffect, useCallback, useRef } from 'react'

export interface KanbanItem {
  id: string
  placa: string
  cliente: string
  modelo: string
  condicao: string
  localAtual: string
  previsaoEntrega: string
  obsGvel: string
  mes: string
  localEntrega: string
  chassi: string
  orcamento: string
}

const SHEET_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vQA_sHIwYemwUI6KdcR7xIjXzLi6SNcGC0ZSJyUyrRQ83L1w_qLiVi_fvd8ZVcCktq-2ui2G18RNqNW/pub?gid=0&single=true&output=csv'

export interface KanbanHistoryEntry {
  id: string
  dataHora: string
  usuario: string
  detalhes: string
  tipo?: 'edicao' | 'sync'
  versaoAtual?: boolean
}

const STORAGE_KEY = 'gvel_kanban_data'
const LAST_SYNC_KEY = 'gvel_kanban_last_sync'
const LAST_USER_KEY = 'gvel_kanban_last_user'
const HISTORY_KEY = 'gvel_kanban_history'
const AUTO_SYNC_INTERVAL_MS = 30000 // 30 segundos

const HISTORICO_INICIAL: KanbanHistoryEntry[] = [
  {
    id: 'hist-1',
    dataHora: '20 de agosto, 16:20',
    usuario: 'ALCIR ROBERTO GONÇALVES JUNIOR',
    detalhes: 'Alterações em RNH7H38 (status FINALIZADO), RVB5H54, RVH4I98, RVI8H41',
    versaoAtual: true,
  },
  {
    id: 'hist-2',
    dataHora: '20 de agosto, 15:12',
    usuario: 'ALCIR ROBERTO GONÇALVES JUNIOR',
    detalhes: 'Atualização de status de preparação e revisão de orçamentos',
  },
  {
    id: 'hist-3',
    dataHora: '20 de agosto, 13:38',
    usuario: 'ALCIR ROBERTO GONÇALVES JUNIOR',
    detalhes: 'Atualização de prazos e locais de entrega em Maringá e Ribeirão Preto',
  },
  {
    id: 'hist-4',
    dataHora: '20 de agosto, 12:33',
    usuario: 'ALCIR ROBERTO GONÇALVES JUNIOR',
    detalhes: 'Ajustes operacionais em veículos aguardando definição da diretoria',
  },
  {
    id: 'hist-5',
    dataHora: '20 de agosto, 11:51',
    usuario: 'TIAGO RENZI',
    detalhes: 'Lançamento de lote de veículos e definição de condições operacionais',
  },
]

function parseCsv(csvText: string): KanbanItem[] {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0)
  if (lines.length < 2) return []

  const items: KanbanItem[] = []

  // Skip header (index 0)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    // Simple CSV parser handling quotes
    const cols: string[] = []
    let current = ''
    let inQuotes = false

    for (let j = 0; j < line.length; j++) {
      const char = line[j]
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        cols.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    cols.push(current.trim())

    const placa = (cols[0] || '').toUpperCase().trim()
    if (!placa) continue

    items.push({
      id: `kanban-${i}-${placa}`,
      placa,
      cliente: (cols[1] || 'NÃO INFORMADO').trim(),
      modelo: (cols[2] || '').trim(),
      condicao: (cols[3] || 'Operante').trim(),
      localAtual: (cols[4] || 'Gvel - SJRP').trim(),
      previsaoEntrega: (cols[5] || 'SEM PREVISÃO').trim(),
      obsGvel: (cols[6] || 'EM ANDAMENTO').trim(),
      mes: (cols[7] || '').trim(),
      localEntrega: (cols[8] || '').trim(),
      chassi: (cols[9] || '').trim(),
      orcamento: (cols[10] || '').trim(),
    })
  }

  return items
}

export function useKanbanSheet(defaultUser?: string) {
  const [items, setItems] = useState<KanbanItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  const [historico, setHistorico] = useState<KanbanHistoryEntry[]>(() => {
    try {
      const saved = localStorage.getItem(HISTORY_KEY)
      return saved ? JSON.parse(saved) : HISTORICO_INICIAL
    } catch {
      return HISTORICO_INICIAL
    }
  })

  const [loading, setLoading] = useState(false)
  const [isAutoSyncing, setIsAutoSyncing] = useState(false)
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastSync, setLastSync] = useState<string | null>(() => {
    return localStorage.getItem(LAST_SYNC_KEY)
  })
  const [lastSyncUser, setLastSyncUser] = useState<string | null>(() => {
    return localStorage.getItem(LAST_USER_KEY) || defaultUser || 'ALCIR ROBERTO GONÇALVES JUNIOR'
  })

  const isFetchingRef = useRef(false)

  const fetchSheet = useCallback(async (usuario?: string, silent: boolean = false) => {
    if (isFetchingRef.current) return
    isFetchingRef.current = true

    if (silent) {
      setIsAutoSyncing(true)
    } else {
      setLoading(true)
    }
    setError(null)

    try {
      // Add timestamp to bypass caching
      const res = await fetch(`${SHEET_CSV_URL}&t=${Date.now()}`)
      if (!res.ok) {
        throw new Error(`Falha ao carregar planilha (status ${res.status})`)
      }
      const text = await res.text()
      const parsed = parseCsv(text)
      if (parsed.length === 0) {
        throw new Error('Nenhum dado encontrado na planilha')
      }

      // Comparar com itens anteriores para detectar mudanças
      const previousItemsStr = localStorage.getItem(STORAGE_KEY)
      const previousItems: KanbanItem[] = previousItemsStr ? JSON.parse(previousItemsStr) : []
      const diffs: string[] = []

      if (previousItems.length > 0) {
        parsed.forEach((novo) => {
          const antigo = previousItems.find((p) => p.placa === novo.placa)
          if (antigo) {
            if (antigo.obsGvel !== novo.obsGvel) {
              diffs.push(`${novo.placa}: status alterado de "${antigo.obsGvel}" para "${novo.obsGvel}"`)
            } else if (antigo.orcamento !== novo.orcamento) {
              diffs.push(`${novo.placa}: orçamento alterado para "${novo.orcamento}"`)
            } else if (antigo.previsaoEntrega !== novo.previsaoEntrega) {
              diffs.push(`${novo.placa}: previsão alterada para "${novo.previsaoEntrega}"`)
            }
          } else {
            diffs.push(`Novo veículo adicionado: ${novo.placa} (${novo.cliente})`)
          }
        })
      }

      setItems(parsed)
      const now = new Date()
      const nowStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      const dataStr = `${now.getDate()} de ${now.toLocaleDateString('pt-BR', { month: 'long' })}, ${nowStr}`
      const fullSyncStr = `${now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ÀS ${nowStr}`
      
      setLastSync(fullSyncStr)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed))
      localStorage.setItem(LAST_SYNC_KEY, fullSyncStr)

      const userToSave = usuario || defaultUser || 'ALCIR ROBERTO GONÇALVES JUNIOR'
      setLastSyncUser(userToSave)
      localStorage.setItem(LAST_USER_KEY, userToSave)

      // Registrar no histórico se houver alterações ou na sincronização explícita
      if (!silent || diffs.length > 0) {
        setHistorico((prev) => {
          const novaEntrada: KanbanHistoryEntry = {
            id: `hist-${Date.now()}`,
            dataHora: dataStr,
            usuario: userToSave,
            detalhes: diffs.length > 0 ? diffs.slice(0, 4).join('; ') : 'Sincronização e validação dos dados da planilha',
            versaoAtual: true,
          }

          const atualizado = [
            novaEntrada,
            ...prev.map((h) => ({ ...h, versaoAtual: false })),
          ].slice(0, 25)

          localStorage.setItem(HISTORY_KEY, JSON.stringify(atualizado))
          return atualizado
        })
      }
    } catch (err: any) {
      console.error('Erro ao sincronizar planilha Kanban:', err)
      if (!silent) {
        setError(err?.message || 'Não foi possível conectar com o Google Sheets.')
      }
    } finally {
      setLoading(false)
      setIsAutoSyncing(false)
      isFetchingRef.current = false
    }
  }, [defaultUser])

  // Carga inicial
  useEffect(() => {
    fetchSheet(defaultUser, items.length > 0)
  }, [])

  // Auto-atualização periódica (polling a cada 30 segundos) e quando a aba/janela ganha foco
  useEffect(() => {
    if (!autoSyncEnabled) return

    const timer = setInterval(() => {
      // Se a aba estiver visível, atualiza silenciosamente
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchSheet(defaultUser, true)
      }
    }, AUTO_SYNC_INTERVAL_MS)

    const onFocus = () => {
      fetchSheet(defaultUser, true)
    }

    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)

    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [autoSyncEnabled, fetchSheet, defaultUser])

  return {
    items,
    historico,
    loading,
    isAutoSyncing,
    autoSyncEnabled,
    setAutoSyncEnabled,
    error,
    lastSync,
    lastSyncUser,
    fetchSheet,
  }
}
