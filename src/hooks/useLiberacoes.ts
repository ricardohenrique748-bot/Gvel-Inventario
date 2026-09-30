import { useCallback, useEffect, useState } from 'react'
import { supabase, ASSINATURAS_BUCKET } from '@/lib/supabase'
import { dataUrlParaBlob } from '@/lib/imagem'
import { comPrefixoEmpresa } from '@/lib/tenant'
import { up } from '@/lib/text'
import type { DadosAssinatura } from '@/pages/inspecao/AssinaturaForm'
import { VEICULO_COM_RELACOES } from '@/lib/queries'
import type { Inspecao, InspecaoItem, VeiculoComRelacoes } from '@/lib/types'

export interface LiberacaoComVeiculo extends Inspecao {
  veiculo: VeiculoComRelacoes | null
}

/** Liberações de veículo já finalizadas (inspecoes com modelo = 'liberacao'), mais recentes primeiro. */
export function useLiberacoes() {
  const [liberacoes, setLiberacoes] = useState<LiberacaoComVeiculo[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setErro(null)
    try {
      const { data, error } = await supabase
        .from('inspecoes')
        .select(`*, veiculo:veiculos(${VEICULO_COM_RELACOES})`)
        .eq('modelo', 'liberacao')
        .order('data_hora', { ascending: false })
        .limit(200)
      if (error) {
        console.error('[useLiberacoes]', error)
        setErro(error.message)
      }
      setLiberacoes((data as unknown as LiberacaoComVeiculo[]) ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { liberacoes, loading, erro, refetch }
}

/**
 * OK final da liberação (só o aprovador — o banco recusa os demais, migration 0086):
 * grava status, observações, responsável e assinatura.
 */
export async function aprovarLiberacao(inspecaoId: string, dados: DadosAssinatura) {
  const blob = dataUrlParaBlob(dados.assinaturaDataUrl)
  const path = comPrefixoEmpresa(`${inspecaoId}.png`)
  const { error: uploadError } = await supabase.storage.from(ASSINATURAS_BUCKET).upload(path, blob, {
    contentType: 'image/png',
    upsert: true,
  })
  if (uploadError) throw uploadError
  const assinaturaUrl = supabase.storage.from(ASSINATURAS_BUCKET).getPublicUrl(path).data.publicUrl

  const { error } = await supabase
    .from('inspecoes')
    .update({
      status_liberacao: dados.statusLiberacao,
      observacoes: up(dados.observacoes),
      responsavel_nome: up(dados.nome),
      responsavel_cargo: up(dados.cargo),
      assinatura_url: assinaturaUrl,
    })
    .eq('id', inspecaoId)
  if (error) throw error
}

/** Exclui a liberação (só admin, travado na tela). Os itens caem junto por cascade. */
export async function excluirLiberacao(inspecaoId: string) {
  const { data, error } = await supabase.from('inspecoes').delete().eq('id', inspecaoId).select('id')
  if (error) throw error
  // RLS bloqueando o DELETE não dá erro, só volta vazio.
  if (!data?.length) throw new Error('Sem permissão para excluir esta liberação.')
}

export async function carregarItensInspecao(inspecaoId: string): Promise<InspecaoItem[]> {
  const { data, error } = await supabase.from('inspecao_itens').select('*').eq('inspecao_id', inspecaoId)
  if (error) throw error
  return (data as InspecaoItem[]) ?? []
}
