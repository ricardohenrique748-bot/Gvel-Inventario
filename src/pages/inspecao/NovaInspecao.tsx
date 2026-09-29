import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/layout/Header'
import { cn } from '@/lib/cn'
import type { ModeloInspecao } from '@/lib/types'
import { criarEstadoInicial, type InspecaoWizardState } from './types'
import { DadosVeiculoStep } from './DadosVeiculoStep'
import { ChecklistStep } from './ChecklistStep'
import { AssinaturaStep } from './AssinaturaStep'
import { ResumoStep } from './ResumoStep'

export function NovaInspecao() {
  const [searchParams] = useSearchParams()
  const modeloInicial: ModeloInspecao = searchParams.get('modelo') === 'liberacao' ? 'liberacao' : 'vistoria'

  const [step, setStep] = useState(0)
  const [state, setState] = useState<InspecaoWizardState>(() => criarEstadoInicial(modeloInicial))
  const liberacao = state.modelo === 'liberacao'

  // Clicar em "Liberação do Veículo" no menu estando já nesta tela só troca a URL.
  if (modeloInicial !== state.modelo) {
    setState(criarEstadoInicial(modeloInicial))
    setStep(0)
  }

  const steps = ['Dados do veículo', 'Checklist', liberacao ? 'Liberação' : 'Assinatura', 'Resumo']

  function patch(next: Partial<InspecaoWizardState>) {
    setState((prev) => ({ ...prev, ...next }))
  }

  function reset() {
    setState(criarEstadoInicial(state.modelo))
    setStep(0)
  }

  return (
    <div>
      <PageHeader
        title={liberacao ? 'Liberação do veículo' : 'Nova inspeção'}
        subtitle={liberacao ? 'Checklist de liberação pós-manutenção' : 'Checklist de vistoria'}
        back
      />


      <div className="mb-6 flex items-center gap-2 overflow-x-auto pb-1">
        {steps.map((label, i) => (
          <div key={label} className="flex items-center gap-2 shrink-0">
            <div
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold',
                i === step
                  ? 'bg-primary text-white'
                  : i < step
                    ? 'bg-status-success text-white'
                    : 'bg-surface text-secondary',
              )}
            >
              {i + 1}
            </div>
            <span className={cn('text-xs', i === step ? 'text-foreground' : 'text-secondary')}>{label}</span>
            {i < steps.length - 1 && <div className="h-px w-6 bg-overlay/10" />}
          </div>
        ))}
      </div>

      {step === 0 && (
        <DadosVeiculoStep key={state.modelo} state={state} onPatch={patch} onNext={() => setStep(1)} />
      )}
      {step === 1 && (
        <ChecklistStep
          state={state}
          onPatch={patch}
          onNext={() => setStep(2)}
          onBack={() => setStep(0)}
        />
      )}
      {step === 2 && (
        <AssinaturaStep state={state} onPatch={patch} onNext={() => setStep(3)} onBack={() => setStep(1)} />
      )}
      {step === 3 && <ResumoStep state={state} onBack={() => setStep(2)} onFinalizado={reset} />}
    </div>
  )
}
