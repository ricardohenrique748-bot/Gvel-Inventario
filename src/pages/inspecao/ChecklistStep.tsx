import { useMemo, useState } from 'react'
import { AccordionItem } from '@/components/ui/Accordion'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { getChecklistParaTipo } from '@/data/checklistSchema'
import { ChecklistItemRow } from './ChecklistItemRow'
import { itemKey, type InspecaoWizardState, type ChecklistItemState } from './types'

interface Props {
  state: InspecaoWizardState
  onPatch: (next: Partial<InspecaoWizardState>) => void
  onNext: () => void
  onBack: () => void
}

export function ChecklistStep({ state, onPatch, onNext, onBack }: Props) {
  const secoes = useMemo(() => getChecklistParaTipo(state.tipo), [state.tipo])
  const [tentouAvancar, setTentouAvancar] = useState(false)

  const totalItens = secoes.reduce((acc, s) => acc + s.itens.length, 0)
  const respondidos = Object.values(state.itens).filter((i) => i?.status).length
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
      <Card className="p-4 mb-4 sticky top-0 z-10 md:static">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-white">
            Progresso: {respondidos}/{totalItens}
          </p>
          <div className="flex gap-2">
            <Badge tone="success">{contadores.conforme} conforme</Badge>
            <Badge tone="danger">{contadores.nao_conforme} não conf.</Badge>
            <Badge tone="warning">{contadores.pendente} pendente</Badge>
          </div>
        </div>
        <ProgressBar value={respondidos} max={totalItens} />
      </Card>

      <div className="space-y-3">
        {secoes.map((secao) => {
          const respondidosSecao = secao.itens.filter((i) => state.itens[itemKey(secao.id, i.id)]?.status).length
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
              {secao.itens.map((item) => {
                const key = itemKey(secao.id, item.id)
                return (
                  <ChecklistItemRow
                    key={key}
                    label={item.label}
                    value={state.itens[key]}
                    onChange={(next) => updateItem(key, next)}
                  />
                )
              })}
            </AccordionItem>
          )
        })}
      </div>

      {tentouAvancar && respondidos < totalItens && (
        <p className="mt-3 text-xs text-status-danger">
          Preencha o status de todos os itens antes de continuar ({totalItens - respondidos} restando).
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
