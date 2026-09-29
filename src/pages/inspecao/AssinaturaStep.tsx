import { useMemo, useRef, useState } from 'react'
import SignatureCanvas from 'react-signature-canvas'
import { Eraser } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { Input, Label, FieldError, Textarea } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import type { StatusLiberacao } from '@/lib/types'
import { getChecklist } from '@/data/checklistSchema'
import { calcularStatusLiberacao, itemKey, STATUS_LIBERACAO_LABEL, type InspecaoWizardState } from './types'

const OPCOES_LIBERACAO: { value: StatusLiberacao; emoji: string; activeClass: string; motivo: string }[] = [
  {
    value: 'liberado',
    emoji: '🟢',
    activeClass: 'bg-status-success text-white border-status-success',
    motivo: 'Todos os itens do checklist estão conformes.',
  },
  {
    value: 'liberado_restricao',
    emoji: '🟡',
    activeClass: 'bg-status-warning text-white border-status-warning',
    motivo: 'Há itens pendentes no checklist.',
  },
  {
    value: 'nao_liberado',
    emoji: '🔴',
    activeClass: 'bg-status-danger text-white border-status-danger',
    motivo: 'Há itens não conformes no checklist.',
  },
]

interface Props {
  state: InspecaoWizardState
  onPatch: (next: Partial<InspecaoWizardState>) => void
  onNext: () => void
  onBack: () => void
}

export function AssinaturaStep({ state, onPatch, onNext, onBack }: Props) {
  const sigRef = useRef<SignatureCanvas>(null)
  const nomeRef = useRef<HTMLInputElement>(null)
  const [nome, setNome] = useState(state.responsavelNome ?? '')
  const [cargo, setCargo] = useState(state.responsavelCargo ?? '')
  const [declarou, setDeclarou] = useState(Boolean(state.assinaturaDataUrl))
  const [erro, setErro] = useState<string | null>(null)
  const liberacao = state.modelo === 'liberacao'
  const statusLiberacao = liberacao ? calcularStatusLiberacao(state) : undefined
  const opcaoAtual = OPCOES_LIBERACAO.find((o) => o.value === statusLiberacao)
  const [observacoes, setObservacoes] = useState(state.observacoes ?? '')

  // Itens que impedem o "Liberado", pra mostrar o porquê do status.
  const itensComProblema = useMemo(
    () =>
      getChecklist(state.modelo, state.tipo).flatMap((secao) =>
        secao.itens
          .map((item) => ({ item, s: state.itens[itemKey(secao.id, item.id)] }))
          .filter((x) => x.s?.status === 'nao_conforme' || x.s?.status === 'pendente')
          .map((x) => ({ label: x.item.label, status: x.s!.status!, obs: x.s?.observacao })),
      ),
    [state.modelo, state.tipo, state.itens],
  )

  function handleLimpar() {
    sigRef.current?.clear()
    setErro(null)
  }

  function handleConfirmar() {
    // Alguns navegadores preenchem o campo via autofill sem disparar o onChange
    // do React — lê o valor direto do input como reforço ao state.
    const nomeValor = (nome || nomeRef.current?.value || '').trim()

    if (liberacao && statusLiberacao !== 'liberado' && !observacoes.trim()) {
      setErro('Descreva as restrições/pendências nas observações.')
      return
    }
    if (!nomeValor) {
      setErro('Informe o nome do responsável.')
      return
    }
    if (!declarou) {
      setErro('É necessário confirmar a declaração para continuar.')
      return
    }
    if (!sigRef.current || sigRef.current.isEmpty()) {
      setErro('Colete a assinatura antes de continuar.')
      return
    }

    const dataUrl = sigRef.current.getTrimmedCanvas().toDataURL('image/png')
    onPatch({
      assinaturaDataUrl: dataUrl,
      responsavelNome: nomeValor,
      responsavelCargo: cargo.trim(),
      ...(liberacao ? { statusLiberacao, observacoes: observacoes.trim() || undefined } : {}),
    })
    onNext()
  }

  return (
    <Card className="max-w-2xl">
      <CardContent className="pt-6 space-y-5">
        {liberacao && (
          <>
            <div>
              <Label>Status do veículo</Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {OPCOES_LIBERACAO.map((opt) => (
                  <div
                    key={opt.value}
                    aria-current={statusLiberacao === opt.value}
                    className={cn(
                      'flex h-11 items-center justify-center rounded-lg border text-sm font-semibold',
                      statusLiberacao === opt.value ? opt.activeClass : 'border-secondary/20 text-secondary/40',
                    )}
                  >
                    {opt.emoji} {STATUS_LIBERACAO_LABEL[opt.value].toUpperCase()}
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-secondary">
                Definido automaticamente pelo checklist. {opcaoAtual?.motivo}
              </p>
              {itensComProblema.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs">
                  {itensComProblema.map((i) => (
                    <li key={i.label} className="text-foreground">
                      <span className={i.status === 'nao_conforme' ? 'text-status-danger' : 'text-status-warning'}>
                        {i.status === 'nao_conforme' ? '✕ Não conforme' : '⏱ Pendente'}
                      </span>{' '}
                      — {i.label}
                      {i.obs && <span className="text-secondary"> ({i.obs})</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <Label htmlFor="observacoes">Observações / Pendências</Label>
              <Textarea
                id="observacoes"
                rows={3}
                value={observacoes}
                onChange={(e) => {
                  setObservacoes(e.target.value)
                  setErro(null)
                }}
                placeholder={statusLiberacao && statusLiberacao !== 'liberado' ? 'Obrigatório: descreva a restrição/pendência' : 'Opcional'}
              />
            </div>
          </>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="responsavelNome">{liberacao ? 'Responsável pela liberação' : 'Nome do responsável'}</Label>
            <Input
              id="responsavelNome"
              ref={nomeRef}
              value={nome}
              onChange={(e) => {
                setNome(e.target.value)
                setErro(null)
              }}
            />
          </div>
          <div>
            <Label htmlFor="responsavelCargo">Cargo</Label>
            <Input
              id="responsavelCargo"
              value={cargo}
              onChange={(e) => setCargo(e.target.value)}
              placeholder="Opcional"
            />
          </div>
        </div>

        <div>
          <Label>Assinatura</Label>
          <div className="rounded-xl bg-white overflow-hidden border border-secondary/30">
            <SignatureCanvas
              ref={sigRef}
              penColor="#1a1a1a"
              canvasProps={{ className: 'w-full h-48 touch-none' }}
              onEnd={() => setErro(null)}
            />
          </div>
          <button
            type="button"
            onClick={handleLimpar}
            className="mt-2 inline-flex items-center gap-1.5 text-xs text-secondary hover:text-foreground"
          >
            <Eraser className="h-3.5 w-3.5" />
            Limpar assinatura
          </button>
        </div>

        <label className="flex items-start gap-2 text-xs text-secondary">
          <input
            type="checkbox"
            checked={declarou}
            onChange={(e) => {
              setDeclarou(e.target.checked)
              setErro(null)
            }}
            className="mt-0.5 h-4 w-4 accent-primary"
          />
          Declaro que as informações prestadas nesta {liberacao ? 'liberação' : 'vistoria'} são verdadeiras e foram
          conferidas junto ao veículo.
        </label>

        <FieldError message={erro ?? undefined} />

        <div className="flex justify-between pt-2">
          <Button type="button" variant="secondary" onClick={onBack}>
            Voltar
          </Button>
          <Button type="button" onClick={handleConfirmar}>
            Confirmar
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
