import { useEffect, useRef, useState } from 'react'
import { FileClock, Save, Trash2 } from 'lucide-react'
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
import {
  apagarRascunhoLiberacao,
  carregarRascunhoLiberacao,
  salvarRascunhoLiberacao,
  temConteudo,
  type RascunhoLiberacao,
} from './rascunhoLiberacao'

function horaCurta(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

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

  // ── Rascunho (só liberação) ────────────────────────────────────────────────
  // Ao abrir: se existe rascunho, pergunta antes de mostrar o formulário (e não
  // salva nada por cima enquanto a pessoa não decide). Depois: salva sozinho
  // 1s após cada mudança e na hora em que o app vai pro fundo/fecha.
  const usuarioRascunho = user?.email
  const [rascunhoEncontrado, setRascunhoEncontrado] = useState<RascunhoLiberacao | null>(null)
  const [rascunhoDecidido, setRascunhoDecidido] = useState(!liberacao)
  const [rascunhoSalvoEm, setRascunhoSalvoEm] = useState<string | null>(null)

  useEffect(() => {
    if (!liberacao || !usuarioRascunho) return
    let cancelado = false
    carregarRascunhoLiberacao(usuarioRascunho)
      .then((r) => {
        if (cancelado) return
        if (r && temConteudo(r.state)) setRascunhoEncontrado(r)
        else setRascunhoDecidido(true)
      })
      .catch(() => !cancelado && setRascunhoDecidido(true))
    return () => {
      cancelado = true
    }
  }, [liberacao, usuarioRascunho])

  const ultimoRef = useRef({ state, step })
  ultimoRef.current = { state, step }
  const podeSalvarRascunho = liberacao && rascunhoDecidido && !!usuarioRascunho

  async function salvarRascunhoAgora() {
    const { state: s, step: st } = ultimoRef.current
    if (!podeSalvarRascunho || !temConteudo(s)) return
    try {
      setRascunhoSalvoEm(await salvarRascunhoLiberacao(usuarioRascunho, s, st))
    } catch (err) {
      console.warn('Não foi possível salvar o rascunho da liberação:', err)
    }
  }

  useEffect(() => {
    if (!podeSalvarRascunho || !temConteudo(state)) return
    const t = setTimeout(salvarRascunhoAgora, 1000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, step, podeSalvarRascunho])

  useEffect(() => {
    if (!podeSalvarRascunho) return
    const aoSair = () => {
      if (document.visibilityState === 'hidden') salvarRascunhoAgora()
    }
    document.addEventListener('visibilitychange', aoSair)
    window.addEventListener('pagehide', salvarRascunhoAgora)
    return () => {
      document.removeEventListener('visibilitychange', aoSair)
      window.removeEventListener('pagehide', salvarRascunhoAgora)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [podeSalvarRascunho])

  function continuarRascunho() {
    if (!rascunhoEncontrado) return
    setState(rascunhoEncontrado.state)
    setStep(rascunhoEncontrado.step)
    setRascunhoSalvoEm(rascunhoEncontrado.salvoEm)
    setRascunhoEncontrado(null)
    setRascunhoDecidido(true)
  }

  function descartarRascunho() {
    apagarRascunhoLiberacao(usuarioRascunho).catch(() => {})
    setState(criarEstadoInicial(state.modelo))
    setStep(0)
    setRascunhoEncontrado(null)
    setRascunhoSalvoEm(null)
    setRascunhoDecidido(true)
  }

  function reset() {
    if (liberacao) {
      apagarRascunhoLiberacao(usuarioRascunho).catch(() => {})
      setRascunhoSalvoEm(null)
    }
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
      ) : rascunhoEncontrado ? (
        <div className="max-w-xl rounded-2xl border border-primary/30 bg-surface p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <FileClock className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground">Você tem uma liberação em andamento</p>
              <p className="mt-1 text-xs text-secondary">
                {rascunhoEncontrado.state.placa ? `Placa ${rascunhoEncontrado.state.placa.toUpperCase()} · ` : ''}
                Etapa {rascunhoEncontrado.step + 1} de {steps.length} ({steps[rascunhoEncontrado.step]}) · salvo em{' '}
                {horaCurta(rascunhoEncontrado.salvoEm)}
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={continuarRascunho}
              className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110 transition"
            >
              Continuar de onde parei
            </button>
            <button
              type="button"
              onClick={descartarRascunho}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-border/40 px-4 py-2.5 text-sm font-medium text-secondary hover:text-foreground transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              Descartar e começar nova
            </button>
          </div>
        </div>
      ) : (
        <>
          {podeSalvarRascunho && temConteudo(state) && (
            <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-secondary">
              <span>{rascunhoSalvoEm ? `Rascunho salvo em ${horaCurta(rascunhoSalvoEm)}` : 'Rascunho ainda não salvo'}</span>
              <button
                type="button"
                onClick={salvarRascunhoAgora}
                className="inline-flex items-center gap-1 rounded-lg border border-border/40 px-2.5 py-1 font-medium text-foreground hover:border-primary/60 transition-colors"
              >
                <Save className="h-3.5 w-3.5" />
                Salvar rascunho
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirm('Descartar esta liberação em andamento? O que foi preenchido será apagado.')) descartarRascunho()
                }}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 hover:text-status-danger transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Descartar
              </button>
            </div>
          )}
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
