import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { STORAGE_FROTAS_KEY } from '@/lib/frotasStorage'
import type { ItemFrotaCadastrada } from '@/pages/Frotas'

// Veículos da frota própria (Gestão de Frotas) ficavam só no localStorage —
// uma edição feita num navegador (ex: corrigir uma placa) nunca aparecia em
// outro computador/celular. Esta tabela guarda só as EDIÇÕES e os veículos
// cadastrados manualmente (os "overrides"); a lista oficial de veículos
// continua vivendo em código (src/data/veiculosFrotaPadrao.ts) e a mesclagem
// das duas é feita em Frotas.tsx, exatamente como já era feito com o
// localStorage — só a fonte dos overrides mudou.

function mapRowParaItem(row: any): ItemFrotaCadastrada {
  return {
    id: row.id,
    placa: row.placa,
    tipo: row.tipo,
    tipoVeiculo: row.tipo_veiculo || undefined,
    marcaNome: row.marca_nome || undefined,
    modeloNome: row.modelo_nome || undefined,
    clienteNome: row.cliente_nome || undefined,
    clienteId: row.cliente_id || undefined,
    ano: row.ano ?? undefined,
    cor: row.cor || undefined,
    setor: row.setor || undefined,
    responsavel: row.responsavel || undefined,
    chassi: row.chassi || undefined,
    renavam: row.renavam || undefined,
    categoria: row.categoria || undefined,
    situacao: row.situacao || 'operante',
    vencimentoDocumento: row.vencimento_documento || undefined,
    crlvPago: row.crlv_pago ?? undefined,
    vencimentoSeguro: row.vencimento_seguro || undefined,
    seguroOk: row.seguro_ok ?? undefined,
    numeroTacografo: row.numero_tacografo || undefined,
    emissaoTacografo: row.emissao_tacografo || undefined,
    vencimentoTacografo: row.vencimento_tacografo || undefined,
    dataUltimaPreventiva: row.data_ultima_preventiva || undefined,
    kmUltimaPreventiva: row.km_ultima_preventiva ?? undefined,
    intervaloPreventivaKm: row.intervalo_preventiva_km ?? undefined,
    vencimentoPreventiva: row.vencimento_preventiva || undefined,
    kmProximaPreventiva: row.km_proxima_preventiva ?? undefined,
    observacoes: row.observacoes || undefined,
    createdAt: row.created_at,
  }
}

function mapItemParaPayload(item: ItemFrotaCadastrada): Record<string, unknown> {
  return {
    id: item.id,
    placa: item.placa,
    tipo: item.tipo,
    tipo_veiculo: item.tipoVeiculo || null,
    marca_nome: item.marcaNome || null,
    modelo_nome: item.modeloNome || null,
    cliente_nome: item.clienteNome || null,
    cliente_id: item.clienteId || null,
    ano: item.ano ?? null,
    cor: item.cor || null,
    setor: item.setor || null,
    responsavel: item.responsavel || null,
    chassi: item.chassi || null,
    renavam: item.renavam || null,
    categoria: item.categoria || null,
    situacao: item.situacao || 'operante',
    vencimento_documento: item.vencimentoDocumento || null,
    crlv_pago: item.crlvPago ?? null,
    vencimento_seguro: item.vencimentoSeguro || null,
    seguro_ok: item.seguroOk ?? null,
    numero_tacografo: item.numeroTacografo || null,
    emissao_tacografo: item.emissaoTacografo || null,
    vencimento_tacografo: item.vencimentoTacografo || null,
    data_ultima_preventiva: item.dataUltimaPreventiva || null,
    km_ultima_preventiva: item.kmUltimaPreventiva ?? null,
    intervalo_preventiva_km: item.intervaloPreventivaKm ?? null,
    vencimento_preventiva: item.vencimentoPreventiva || null,
    km_proxima_preventiva: item.kmProximaPreventiva ?? null,
    observacoes: item.observacoes || null,
    created_at: item.createdAt || new Date().toISOString(),
  }
}

export async function fetchVeiculosFrotaOverridesSupabase(): Promise<ItemFrotaCadastrada[]> {
  const { data, error } = await supabase.from('veiculos_frota').select('*')
  if (error) throw error
  return (data || []).map(mapRowParaItem)
}

export async function upsertVeiculoFrota(item: ItemFrotaCadastrada): Promise<ItemFrotaCadastrada> {
  const { data, error } = await supabase
    .from('veiculos_frota')
    .upsert(mapItemParaPayload(item))
    .select()
    .single()
  if (error) throw error
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('frota_updated'))
  return mapRowParaItem(data)
}

export async function excluirVeiculoFrotaOverride(id: string): Promise<void> {
  const { error } = await supabase.from('veiculos_frota').delete().eq('id', id)
  if (error) throw error
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('frota_updated'))
}

// ----------------------------------------------------
// Migração automática (uma única vez por navegador) do cache antigo que só
// existia em localStorage — evita perder edições/cadastros já feitos.
// ----------------------------------------------------
const STORAGE_MIGRADO_KEY = 'gvel_frotas_migrado_supabase_v1'

async function migrarVeiculosFrotaLocaisAntigos(): Promise<void> {
  try {
    if (localStorage.getItem(STORAGE_MIGRADO_KEY) === 'true') return
  } catch {
    return
  }

  let antigos: ItemFrotaCadastrada[] = []
  try {
    const raw = localStorage.getItem(STORAGE_FROTAS_KEY)
    if (raw) antigos = JSON.parse(raw)
  } catch {
    return
  }

  if (Array.isArray(antigos) && antigos.length > 0) {
    for (const item of antigos) {
      try {
        await upsertVeiculoFrota(item)
      } catch (err) {
        console.warn('Falha ao migrar veículo da frota para o Supabase (tenta de novo depois):', err)
        return // não marca como migrado — tenta tudo de novo na próxima carga
      }
    }
  }

  try {
    localStorage.setItem(STORAGE_MIGRADO_KEY, 'true')
  } catch {}
}

export function useVeiculosFrotaOverrides() {
  const [overrides, setOverrides] = useState<ItemFrotaCadastrada[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    try {
      const dados = await fetchVeiculosFrotaOverridesSupabase()
      setOverrides(dados)
      setError(null)
    } catch (err) {
      console.warn('Falha ao buscar veículos da frota no Supabase, usando cache local:', err)
      setError(err instanceof Error ? err.message : 'Erro ao carregar veículos da frota.')
      try {
        const raw = localStorage.getItem(STORAGE_FROTAS_KEY)
        if (raw) setOverrides(JSON.parse(raw))
      } catch {}
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    ;(async () => {
      await migrarVeiculosFrotaLocaisAntigos()
      await refetch()
    })()

    const handleUpdate = () => refetch()
    window.addEventListener('frota_updated', handleUpdate)
    return () => window.removeEventListener('frota_updated', handleUpdate)
  }, [refetch])

  return { overrides, loading, error, refetch }
}
