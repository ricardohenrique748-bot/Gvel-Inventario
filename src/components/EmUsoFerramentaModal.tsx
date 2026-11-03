import { useCallback, useEffect, useState } from 'react'
import { X, Undo2, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { formatDateTime } from '@/lib/format'
import {
  getRetiradasLocais,
  registrarDevolucaoFerramenta,
  recalcularDisponivelFerramenta,
} from '@/hooks/useFerramentas'
import type { Ferramenta } from '@/lib/types'

interface RetiradaAberta {
  id: string
  placa: string | null
  responsavel: string | null
  quantidade: number
  data_hora_retirada: string | null
  local: boolean
}

interface Props {
  ferramenta: Ferramenta
  onClose: () => void
  onAtualizado: () => void | Promise<void>
}

/**
 * Mostra, direto do banco, as retiradas ainda "em uso" de UMA ferramenta e
 * deixa devolver cada uma. Resolve o caso da ferramenta presa em "1 em uso"
 * quando a retirada não aparece na aba "Em uso no momento".
 */
export function EmUsoFerramentaModal({ ferramenta, onClose, onAtualizado }: Props) {
  const [abertas, setAbertas] = useState<RetiradaAberta[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [processando, setProcessando] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setErro(null)
    const { data, error } = await supabase
      .from('ferramentas_retiradas')
      .select('id,placa,responsavel,quantidade,data_hora_retirada')
      .eq('ferramenta_id', ferramenta.id)
      .eq('status', 'em_uso')
      .order('data_hora_retirada', { ascending: true })
    if (error) {
      setErro(`NÃO FOI POSSÍVEL LER AS RETIRADAS: ${error.message}`)
      setAbertas([])
      return
    }
    const remotas: RetiradaAberta[] = (data || []).map((r) => ({ ...r, quantidade: Number(r.quantidade) || 1, local: false }))
    const ids = new Set(remotas.map((r) => r.id))
    // Retiradas que só existem neste aparelho (feitas sem internet).
    const locais: RetiradaAberta[] = getRetiradasLocais()
      .filter((r) => r.ferramenta_id === ferramenta.id && r.status === 'em_uso' && !ids.has(r.id))
      .filter((r) => !/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(r.id))
      .map((r) => ({
        id: r.id,
        placa: r.placa,
        responsavel: r.responsavel,
        quantidade: Number(r.quantidade) || 1,
        data_hora_retirada: r.data_hora_retirada,
        local: true,
      }))
    setAbertas([...remotas, ...locais])
  }, [ferramenta.id])

  useEffect(() => {
    carregar()
  }, [carregar])

  const devolver = async (r: RetiradaAberta) => {
    setProcessando(r.id)
    setErro(null)
    try {
      await registrarDevolucaoFerramenta({
        retiradaId: r.id,
        status: 'devolvido',
        observacoes_devolucao: 'DEVOLVIDA PELA FERRAMENTA (CORREÇÃO DE ESTOQUE)',
      })
      await carregar()
      await onAtualizado()
    } catch (err) {
      setErro(err instanceof Error ? err.message.toUpperCase() : 'ERRO AO DEVOLVER.')
    } finally {
      setProcessando(null)
    }
  }

  const corrigirEstoque = async () => {
    setProcessando('recalcular')
    setErro(null)
    try {
      await recalcularDisponivelFerramenta(ferramenta.id)
      await onAtualizado()
      onClose()
    } catch (err) {
      setErro(err instanceof Error ? err.message.toUpperCase() : 'ERRO AO CORRIGIR O ESTOQUE.')
    } finally {
      setProcessando(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border border-border/20 bg-surface p-5 uppercase"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-black tracking-wider text-amber-500">EM USO AGORA</p>
            <h3 className="truncate text-base font-black text-foreground">
              {ferramenta.codigo ? `${ferramenta.codigo} · ` : ''}
              {ferramenta.nome}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-secondary hover:text-foreground"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {erro && <p className="mb-3 rounded-lg bg-status-danger/10 p-2 text-xs font-bold text-status-danger">{erro}</p>}

        {abertas === null ? (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-secondary/30 border-t-primary" />
          </div>
        ) : abertas.length === 0 ? (
          <div className="space-y-3 text-center">
            <p className="text-sm font-bold text-foreground">NENHUMA RETIRADA EM ABERTO PARA ESTA FERRAMENTA.</p>
            <p className="text-xs text-secondary">
              O ESTOQUE ESTÁ MARCADO COMO EM USO SEM NENHUMA SAÍDA REGISTRADA. CORRIJA PARA VOLTAR AO ESTOQUE.
            </p>
            <Button type="button" size="md" onClick={corrigirEstoque} disabled={processando !== null}>
              <RefreshCw className="h-4 w-4" />
              {processando === 'recalcular' ? 'CORRIGINDO…' : 'CORRIGIR ESTOQUE'}
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {abertas.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 rounded-xl bg-background px-3 py-2.5">
                <div className="min-w-0 text-xs">
                  <p className="font-bold text-foreground truncate">
                    {r.responsavel || '—'} {r.placa ? `· ${r.placa}` : ''}
                  </p>
                  <p className="text-secondary">
                    {r.data_hora_retirada ? formatDateTime(r.data_hora_retirada) : 'SEM DATA'} · QTD {r.quantidade}
                    {r.local ? ' · SÓ NESTE APARELHO' : ''}
                  </p>
                </div>
                <Button
                  type="button"
                  size="md"
                  variant="success"
                  className="!h-9 shrink-0"
                  onClick={() => devolver(r)}
                  disabled={processando !== null}
                >
                  <Undo2 className="h-4 w-4" />
                  {processando === r.id ? 'DEVOLVENDO…' : 'DEVOLVER'}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
