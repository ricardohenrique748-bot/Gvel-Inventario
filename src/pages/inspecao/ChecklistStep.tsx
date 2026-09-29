import { useMemo, useState } from 'react'
import { AccordionItem } from '@/components/ui/Accordion'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { getChecklist } from '@/data/checklistSchema'
import { ChecklistItemRow } from './ChecklistItemRow'
import { itemKey, itemRespondido, faltaFotoNaoConforme, type InspecaoWizardState, type ChecklistItemState } from './types'

interface Props {
  state: InspecaoWizardState
  onPatch: (next: Partial<InspecaoWizardState>) => void
  onNext: () => void
  onBack: () => void
}

export function ChecklistStep({ state, onPatch, onNext, onBack }: Props) {
  const secoes = useMemo(() => getChecklist(state.modelo, state.tipo), [state.modelo, state.tipo])
  const [tentouAvancar, setTentouAvancar] = useState(false)

  const totalItens = secoes.reduce((acc, s) => acc + s.itens.length, 0)
  const respondidos = secoes.reduce(
    (acc, s) => acc + s.itens.filter((i) => itemRespondido(state.modelo, i, state.itens[itemKey(s.id, i.id)])).length,
    0,
  )
  // Checklist só de fotos (liberação) não tem Conforme/Não conforme pra contar.
  const temStatus = secoes.some((s) => s.itens.some((i) => !i.foto))
  const contadores = {
    conforme: Object.values(state.itens).filter((i) => i?.status === 'conforme').length,
    nao_conforme: Object.values(state.itens).filter((i) => i?.status === 'nao_conforme').length,
    pendente: Object.values(state.itens).filter((i) => i?.status === 'pendente').length,
  }

  function updateItem(key: string, next: ChecklistItemState) {
    onPatch({ itens: { ...state.itens, [key]: next } })
  }

  function handleContinuar() {
    if (respondidos < totalItens) {
      setTentouAvancar(true)
      return
    }
    onNext()
  }

  return (
    <div className="max-w-3xl">
      {/* Não é sticky: no celular ficava escondido atrás do cabeçalho fixo do app. */}
      <Card className="p-4 mb-4">
        <div className="mb-2 flex items-baseline justify-between">
          <p className="text-sm font-medium text-foreground">Progresso</p>
          <p className="text-sm font-semibold text-foreground">
            {respondidos}/{totalItens}
          </p>
        </div>
        <ProgressBar value={respondidos} max={totalItens} />
        {temStatus && (
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <Badge tone="success" className="justify-center px-1.5">{contadores.conforme} conforme</Badge>
            <Badge tone="danger" className="justify-center px-1.5">{contadores.nao_conforme} não conf.</Badge>
            <Badge tone="warning" className="justify-center px-1.5">{contadores.pendente} pendente</Badge>
          </div>
        )}
      </Card>

      <div className="space-y-3">
        {secoes.map((secao) => {
          const respondidosSecao = secao.itens.filter((i) => itemRespondido(state.modelo, i, state.itens[itemKey(secao.id, i.id)])).length
          return (
            <AccordionItem
              key={secao.id}
              title={secao.nome}
              defaultOpen
              subtitle={
                <p className="text-xs text-secondary">
                  {respondidosSecao}/{secao.itens.length} respondidos
                </p>
              }
            >
              <div className="-mt-2 divide-y divide-border/10">
                {secao.itens.map((item) => {
                  const key = itemKey(secao.id, item.id)
                  return (
                    <ChecklistItemRow
                      key={key}
                      label={item.label}
                      foto={item.foto}
                      multiplasFotos={item.multiplasFotos}
                      minFotos={item.minFotos}
                      maxFotos={item.maxFotos}
                      dicaFotos={item.dicaFotos}
                      faltaFoto={faltaFotoNaoConforme(state.modelo, state.itens[key])}
                      value={state.itens[key]}
                      onChange={(next) => updateItem(key, next)}
                    />
                  )
                })}
              </div>
            </AccordionItem>
          )
        })}
      </div>

      {tentouAvancar && respondidos < totalItens && (
        <p className="mt-3 text-xs text-status-danger">
          {temStatus
            ? 'Preencha o status de todos os itens e tire as fotos obrigatórias antes de continuar'
            : 'Tire todas as fotos obrigatórias antes de continuar'}{' '}
          ({totalItens - respondidos} restando).
        </p>
      )}

      <div className="flex justify-between pt-5">
        <Button type="button" variant="secondary" onClick={onBack}>
          Voltar
        </Button>
        <Button type="button" onClick={handleContinuar}>
          Continuar
        </Button>
      </div>
    </div>
  )
}
