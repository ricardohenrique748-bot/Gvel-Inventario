import { useCallback, useEffect, useState } from 'react'
import { supabase, FOTOS_BUCKET } from '@/lib/supabase'
import { dataUrlParaBlob } from '@/lib/imagem'
import type { RegistroChecklist, ItemChecagem, FotosVistoria, StatusPreventivaChecklist } from '@/lib/types'

// Checklist da Frota Leve (vistoria de veículo). Antes ficava só no
// localStorage do navegador, incluindo as fotos em base64 — sem backup e
// sem aparecer em outro aparelho. Agora vai para o Supabase, no mesmo
// padrão usado pelas Inspeções (useInspecao.ts).

const CAMPOS_FOTO: (keyof FotosVistoria)[] = [
  'painel', 'capo', 'interna', 'frente', 'ladoEsquerdo',
  'traseira', 'ladoDireito', 'pneuDiantEsq', 'pneuDiantDir', 'pneuTrasEsq', 'pneuTrasDir',
]

const COLUNA_FOTO: Record<keyof FotosVistoria, string> = {
  painel: 'foto_painel_url',
  capo: 'foto_capo_url',
  interna: 'foto_interna_url',
  frente: 'foto_frente_url',
  ladoEsquerdo: 'foto_lado_esquerdo_url',
  traseira: 'foto_traseira_url',
  ladoDireito: 'foto_lado_direito_url',
  pneuDiantEsq: 'foto_pneu_diant_esq_url',
  pneuDiantDir: 'foto_pneu_diant_dir_url',
  pneuTrasEsq: 'foto_pneu_tras_esq_url',
  pneuTrasDir: 'foto_pneu_tras_dir_url',
}

function mapRowParaRegistro(row: any): RegistroChecklist {
  const fotos: FotosVistoria = {}
  for (const campo of CAMPOS_FOTO) {
    const url = row[COLUNA_FOTO[campo]]
    if (url) fotos[campo] = url
  }

  let statusPreventiva: StatusPreventivaChecklist | undefined
  if (row.status_preventiva) {
    statusPreventiva = {
      status: row.status_preventiva,
      kmUltima: row.km_ultima_preventiva ?? undefined,
      kmLimite: row.km_limite_preventiva ?? undefined,
      kmRestante: row.km_restante_preventiva ?? undefined,
      kmRodados: row.km_rodados_preventiva ?? undefined,
      mensagem: row.mensagem_preventiva || '',
    }
  }

  return {
    id: row.id,
    veiculoId: row.veiculo_id || '',
    placa: row.placa,
    modeloNome: row.modelo_nome || undefined,
    clienteNome: row.cliente_nome || undefined,
    motoristaNome: row.motorista_nome,
    inspetorNome: row.inspetor_nome,
    kmAtual: row.km_atual || 0,
    resultado: row.resultado,
    statusPreventiva,
    itens: (row.checklist_frota_itens || []).map((it: any) => ({
      id: it.item_id || it.id,
      categoria: it.categoria,
      nome: it.nome,
      status: it.status,
      observacao: it.observacao || undefined,
    })) as ItemChecagem[],
    fotos,
    observacoesGerais: row.observacoes_gerais || undefined,
    dataHora: row.data_hora,
  }
}

export async function fetchChecklistsFrotaSupabase(limit = 500): Promise<RegistroChecklist[]> {
  const { data, error } = await supabase
    .from('checklists_frota')
    .select('*, checklist_frota_itens(*)')
    .order('data_hora', { ascending: false })
    .limit(limit)

  if (error) {
    console.warn('Erro ao buscar checklists da frota no Supabase:', error)
    return []
  }
  return (data || []).map(mapRowParaRegistro)
}

export interface CriarChecklistFrotaInput {
  veiculoId: string
  placa: string
  modeloNome?: string
  clienteNome?: string
  motoristaNome: string
  inspetorNome: string
  kmAtual: number
  resultado: 'aprovado' | 'aprovado_com_ressalvas' | 'reprovado'
  statusPreventiva?: StatusPreventivaChecklist
  itens: ItemChecagem[]
  /** Fotos como dataURL base64 (é o que o formulário de checklist já produz). */
  fotos?: FotosVistoria
  observacoesGerais?: string
}

export async function criarChecklistFrota(
  input: CriarChecklistFrotaInput,
  dataHora: string = new Date().toISOString(),
): Promise<RegistroChecklist> {
  const checklistId = crypto.randomUUID()

  // Sobe todas as fotos em paralelo. Cada foto é evidência opcional do
  // item — se uma falhar (ex: conexão fraca), não trava o registro inteiro.
  const fotoUrls: Partial<Record<keyof FotosVistoria, string>> = {}
  await Promise.all(
    CAMPOS_FOTO.map(async (campo) => {
      const base64 = input.fotos?.[campo]
      if (!base64) return
      try {
        const blob = dataUrlParaBlob(base64)
        const path = `checklist-frota/${checklistId}/${campo}.jpg`
        const { error } = await supabase.storage.from(FOTOS_BUCKET).upload(path, blob, {
          contentType: blob.type || 'image/jpeg',
          upsert: true,
        })
        if (!error) {
          fotoUrls[campo] = supabase.storage.from(FOTOS_BUCKET).getPublicUrl(path).data.publicUrl
        } else {
          console.warn(`Falha ao enviar foto "${campo}" do checklist:`, error)
        }
      } catch (err) {
        console.warn(`Falha ao enviar foto "${campo}" do checklist:`, err)
      }
    }),
  )

  const payload = {
    id: checklistId,
    veiculo_id: input.veiculoId || null,
    placa: input.placa,
    modelo_nome: input.modeloNome || null,
    cliente_nome: input.clienteNome || null,
    motorista_nome: input.motoristaNome,
    inspetor_nome: input.inspetorNome,
    km_atual: input.kmAtual,
    resultado: input.resultado,
    status_preventiva: input.statusPreventiva?.status || null,
    km_ultima_preventiva: input.statusPreventiva?.kmUltima ?? null,
    km_limite_preventiva: input.statusPreventiva?.kmLimite ?? null,
    km_restante_preventiva: input.statusPreventiva?.kmRestante ?? null,
    km_rodados_preventiva: input.statusPreventiva?.kmRodados ?? null,
    mensagem_preventiva: input.statusPreventiva?.mensagem || null,
    observacoes_gerais: input.observacoesGerais || null,
    foto_painel_url: fotoUrls.painel || null,
    foto_capo_url: fotoUrls.capo || null,
    foto_interna_url: fotoUrls.interna || null,
    foto_frente_url: fotoUrls.frente || null,
    foto_lado_esquerdo_url: fotoUrls.ladoEsquerdo || null,
    foto_traseira_url: fotoUrls.traseira || null,
    foto_lado_direito_url: fotoUrls.ladoDireito || null,
    foto_pneu_diant_esq_url: fotoUrls.pneuDiantEsq || null,
    foto_pneu_diant_dir_url: fotoUrls.pneuDiantDir || null,
    foto_pneu_tras_esq_url: fotoUrls.pneuTrasEsq || null,
    foto_pneu_tras_dir_url: fotoUrls.pneuTrasDir || null,
    data_hora: dataHora,
  }

  const { error: insertError } = await supabase.from('checklists_frota').insert(payload)
  if (insertError) throw insertError

  if (input.itens.length > 0) {
    const { error: itensError } = await supabase.from('checklist_frota_itens').insert(
      input.itens.map((it) => ({
        checklist_id: checklistId,
        item_id: it.id,
        categoria: it.categoria,
        nome: it.nome,
        status: it.status,
        observacao: it.observacao || null,
      })),
    )
    if (itensError) throw itensError
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('checklist_frota_updated'))
  }

  return {
    id: checklistId,
    veiculoId: input.veiculoId,
    placa: input.placa,
    modeloNome: input.modeloNome,
    clienteNome: input.clienteNome,
    motoristaNome: input.motoristaNome,
    inspetorNome: input.inspetorNome,
    kmAtual: input.kmAtual,
    resultado: input.resultado,
    statusPreventiva: input.statusPreventiva,
    itens: input.itens,
    fotos: { ...input.fotos, ...fotoUrls },
    observacoesGerais: input.observacoesGerais,
    dataHora,
  }
}

export async function excluirChecklistFrota(id: string): Promise<void> {
  const { error } = await supabase.from('checklists_frota').delete().eq('id', id)
  if (error) throw error
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('checklist_frota_updated'))
  }
}

// ----------------------------------------------------
// Migração automática dos checklists antigos (só localStorage, versão anterior)
// ----------------------------------------------------
const STORAGE_CHECKLISTS_ANTIGOS_KEY = 'gvel_frotas_checklists_v1'

async function migrarChecklistsLocaisAntigos(): Promise<void> {
  let antigos: RegistroChecklist[] = []
  try {
    const raw = localStorage.getItem(STORAGE_CHECKLISTS_ANTIGOS_KEY)
    if (raw) antigos = JSON.parse(raw)
  } catch {
    return
  }
  if (!Array.isArray(antigos) || antigos.length === 0) return

  const restantes: RegistroChecklist[] = []
  for (const registro of antigos) {
    try {
      await criarChecklistFrota(
        {
          veiculoId: registro.veiculoId,
          placa: registro.placa,
          modeloNome: registro.modeloNome,
          clienteNome: registro.clienteNome,
          motoristaNome: registro.motoristaNome,
          inspetorNome: registro.inspetorNome,
          kmAtual: registro.kmAtual,
          resultado: registro.resultado,
          statusPreventiva: registro.statusPreventiva,
          itens: registro.itens,
          fotos: registro.fotos,
          observacoesGerais: registro.observacoesGerais,
        },
        registro.dataHora,
      )
    } catch (err) {
      console.warn('Falha ao migrar checklist antigo para o Supabase (tenta de novo depois):', err)
      restantes.push(registro)
    }
  }

  try {
    if (restantes.length > 0) {
      localStorage.setItem(STORAGE_CHECKLISTS_ANTIGOS_KEY, JSON.stringify(restantes))
    } else {
      localStorage.removeItem(STORAGE_CHECKLISTS_ANTIGOS_KEY)
    }
  } catch {}
}

export function useChecklistsFrota() {
  const [checklists, setChecklists] = useState<RegistroChecklist[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    try {
      const dados = await fetchChecklistsFrotaSupabase()
      setChecklists(dados)
      setError(null)
    } catch (err) {
      console.warn('Falha ao buscar checklists da frota:', err)
      setError(err instanceof Error ? err.message : 'Erro ao carregar checklists.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    ;(async () => {
      await migrarChecklistsLocaisAntigos()
      await refetch()
    })()

    const handleUpdate = () => refetch()
    window.addEventListener('checklist_frota_updated', handleUpdate)
    return () => window.removeEventListener('checklist_frota_updated', handleUpdate)
  }, [refetch])

  return { checklists, loading, error, refetch }
}
