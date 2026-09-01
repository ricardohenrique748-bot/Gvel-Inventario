import { useState, useEffect, useCallback, useRef } from 'react'

export interface VamosItem {
  id: string
  placa: string
  modelo: string
  previsaoEntrega: string
  orcamento: string
}

const SHEET_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vS5FLy8WEs4Pega5nkSn3ZYZvP7w2M-ZFnf2GohRc1iUjtKVd1Dxd6fyI9SkQ2MSec0-2u2j_eHLnN0/pub?output=csv'

export interface VamosHistoryEntry {
  id: string
  dataHora: string
  usuario: string
  detalhes: string
  versaoAtual?: boolean
}

const STORAGE_KEY = 'gvel_vamos_data'
const LAST_SYNC_KEY = 'gvel_vamos_last_sync'
const LAST_USER_KEY = 'gvel_vamos_last_user'
const HISTORY_KEY = 'gvel_vamos_history'
const AUTO_SYNC_INTERVAL_MS = 30000 // 30 segundos

function parseCsv(csvText: string): VamosItem[] {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0)
  if (lines.length < 2) return []

  const items: VamosItem[] = []

  // Pula o cabeçalho (índice 0)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    // Parser simples de CSV, com suporte a aspas
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
      id: `vamos-${i}-${placa}`,
      placa,
      modelo: (cols[1] || '').trim(),
      previsaoEntrega: (cols[2] || 'SEM PREVISÃO').trim(),
      orcamento: (cols[3] || '').trim(),
    })
  }

  return items
}

export function useVamosSheet(defaultUser?: string) {
  const [items, setItems] = useState<VamosItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  const [historico, setHistorico] = useState<VamosHistoryEntry[]>(() => {
    try {
      const saved = localStorage.getItem(HISTORY_KEY)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
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
    return localStorage.getItem(LAST_USER_KEY) || defaultUser || null
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
      // Adiciona timestamp pra evitar cache
      const res = await fetch(`${SHEET_CSV_URL}&t=${Date.now()}`)
      if (!res.ok) {
        throw new Error(`Falha ao carregar planilha (status ${res.status})`)
      }
      const text = await res.text()
      const parsed = parseCsv(text)
      if (parsed.length === 0) {
        throw new Error('Nenhum dado encontrado na planilha')
      }

      // Compara com os itens anteriores pra detectar mudanças
      const previousItemsStr = localStorage.getItem(STORAGE_KEY)
      const previousItems: VamosItem[] = previousItemsStr ? JSON.parse(previousItemsStr) : []
      const diffs: string[] = []

      if (previousItems.length > 0) {
        parsed.forEach((novo) => {
          const antigo = previousItems.find((p) => p.placa === novo.placa)
          if (antigo) {
            if (antigo.orcamento !== novo.orcamento) {
              diffs.push(`${novo.placa}: orçamento alterado de "${antigo.orcamento}" para "${novo.orcamento}"`)
            } else if (antigo.previsaoEntrega !== novo.previsaoEntrega) {
              diffs.push(`${novo.placa}: previsão alterada para "${novo.previsaoEntrega}"`)
            }
          } else {
            diffs.push(`Novo veículo adicionado: ${novo.placa}`)
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

      const userToSave = usuario || defaultUser || 'SISTEMA'
      setLastSyncUser(userToSave)
      localStorage.setItem(LAST_USER_KEY, userToSave)

      // Registra no histórico se houver alterações ou na sincronização explícita
      if (!silent || diffs.length > 0) {
        setHistorico((prev) => {
          const novaEntrada: VamosHistoryEntry = {
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
      console.error('Erro ao sincronizar planilha VAMOS:', err)
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
