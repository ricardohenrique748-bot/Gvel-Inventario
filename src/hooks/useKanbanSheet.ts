import { useState, useEffect, useCallback } from 'react'

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

const STORAGE_KEY = 'gvel_kanban_data'
const LAST_SYNC_KEY = 'gvel_kanban_last_sync'

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

export function useKanbanSheet() {
  const [items, setItems] = useState<KanbanItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastSync, setLastSync] = useState<string | null>(() => {
    return localStorage.getItem(LAST_SYNC_KEY)
  })

  const fetchSheet = useCallback(async () => {
    setLoading(true)
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
      setItems(parsed)
      const nowStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      setLastSync(nowStr)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed))
      localStorage.setItem(LAST_SYNC_KEY, nowStr)
    } catch (err: any) {
      console.error('Erro ao sincronizar planilha Kanban:', err)
      setError(err?.message || 'Não foi possível conectar com o Google Sheets.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // If no data cached or if mounted, fetch live
    if (items.length === 0) {
      fetchSheet()
    }
  }, [fetchSheet, items.length])

  return {
    items,
    loading,
    error,
    lastSync,
    fetchSheet,
  }
}
