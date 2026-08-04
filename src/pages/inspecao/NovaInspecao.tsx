import { useState } from 'react'
import { PageHeader } from '@/components/layout/Header'
import { cn } from '@/lib/cn'
import { criarEstadoInicial, type InspecaoWizardState } from './types'
import { DadosVeiculoStep } from './DadosVeiculoStep'
import { ChecklistStep } from './ChecklistStep'
import { AssinaturaStep } from './AssinaturaStep'
import { ResumoStep } from './ResumoStep'

const STEPS = ['Dados do veículo', 'Checklist', 'Assinatura', 'Resumo']

export function NovaInspecao() {
  const [step, setStep] = useState(0)
  const [state, setState] = useState<InspecaoWizardState>(() => criarEstadoInicial())

  function patch(next: Partial<InspecaoWizardState>) {
    setState((prev) => ({ ...prev, ...next }))
  }

  function reset() {
    setState(criarEstadoInicial())
    setStep(0)
  }

  return (
    <div>
      <PageHeader title="Nova inspeção" subtitle="Checklist de vistoria" back />

      <div className="mb-6 flex items-center gap-2 overflow-x-auto pb-1">
        {STEPS.map((label, i) => (
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
            <span className={cn('text-xs', i === step ? 'text-white' : 'text-secondary')}>{label}</span>
            {i < STEPS.length - 1 && <div className="h-px w-6 bg-white/10" />}
          </div>
        ))}
      </div>

      {step === 0 && (
        <DadosVeiculoStep state={state} onPatch={patch} onNext={() => setStep(1)} />
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
