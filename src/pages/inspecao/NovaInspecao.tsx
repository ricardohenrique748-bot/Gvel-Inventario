import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/layout/Header'
import { cn } from '@/lib/cn'
import type { ModeloInspecao } from '@/lib/types'
import { useAuth } from '@/contexts/AuthContext'
import { criarEstadoInicial, podeAprovarLiberacao, type InspecaoWizardState } from './types'
import { DadosVeiculoStep } from './DadosVeiculoStep'
import { ChecklistStep } from './ChecklistStep'
import { AssinaturaStep } from './AssinaturaStep'
import { ResumoStep } from './ResumoStep'
import { LiberacoesFinalizadas } from './LiberacoesFinalizadas'

/**
 * `embutido`: usado dentro da aba "Liberação do Veículo" da Manutenção — sempre no
 * modelo liberação, sem cabeçalho próprio, e sem apagar os outros parâmetros da URL.
 */
export function NovaInspecao({ embutido = false }: { embutido?: boolean } = {}) {
  const [searchParams, setSearchParams] = useSearchParams()
  const modeloInicial: ModeloInspecao =
    embutido || searchParams.get('modelo') === 'liberacao' ? 'liberacao' : 'vistoria'
  // Aba "Finalizadas" só existe na liberação. O rascunho em andamento fica guardado ao trocar de aba.
  const verFinalizadas = modeloInicial === 'liberacao' && searchParams.get('aba') === 'finalizadas'

  const [step, setStep] = useState(0)
  const [state, setState] = useState<InspecaoWizardState>(() => criarEstadoInicial(modeloInicial))
  const liberacao = state.modelo === 'liberacao'

  // Clicar em "Liberação do Veículo" no menu estando já nesta tela só troca a URL.
  if (modeloInicial !== state.modelo) {
    setState(criarEstadoInicial(modeloInicial))
    setStep(0)
  }

  const { user } = useAuth()
  const etapa3 = !liberacao ? 'Assinatura' : podeAprovarLiberacao(user?.email) ? 'Liberação' : 'Envio'
  const steps = ['Dados do veículo', 'Checklist', etapa3, 'Resumo']

  function patch(next: Partial<InspecaoWizardState>) {
    setState((prev) => ({ ...prev, ...next }))
  }

  function reset() {
    setState(criarEstadoInicial(state.modelo))
    setStep(0)
  }

  return (
    <div>
      {!embutido && (
        <PageHeader
          title={liberacao ? 'Liberação do veículo' : 'Nova inspeção'}
          subtitle={liberacao ? 'Checklist de liberação pós-manutenção' : 'Checklist de vistoria'}
          back
        />
      )}

      {liberacao && (
        <div className="mb-4 inline-flex rounded-xl bg-surface p-1">
          {(
            [
              ['nova', 'Nova liberação'],
              ['finalizadas', 'Finalizadas'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() =>
                setSearchParams(
                  (atual) => {
                    const p = new URLSearchParams(atual)
                    if (!embutido) p.set('modelo', 'liberacao')
                    if (id === 'finalizadas') p.set('aba', id)
                    else p.delete('aba')
                    return p
                  },
                  { replace: true },
                )
              }
              className={cn(
                'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                (id === 'finalizadas') === verFinalizadas
                  ? 'bg-primary text-white'
                  : 'text-secondary hover:text-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {verFinalizadas ? (
        <LiberacoesFinalizadas />
      ) : (
        <>
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
        </>
      )}
    </div>
  )
}
