import { useEffect, useRef, useState } from 'react'
import SignatureCanvas from 'react-signature-canvas'
import { Eraser, Hourglass } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { FieldError, Label, Textarea } from '@/components/ui/Input'
import { formatDateTime } from '@/lib/format'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/contexts/AuthContext'
import { AssinaturaForm } from './AssinaturaForm'
import { podeAprovarLiberacao, type InspecaoWizardState } from './types'

interface Props {
  state: InspecaoWizardState
  onPatch: (next: Partial<InspecaoWizardState>) => void
  onNext: () => void
  onBack: () => void
}

export function AssinaturaStep({ state, onPatch, onNext, onBack }: Props) {
  const { user } = useAuth()
  const liberacao = state.modelo === 'liberacao'

  // Liberação feita por quem não é o aprovador: só envia (fica aguardando o OK da Maria Clara).
  if (liberacao && !podeAprovarLiberacao(user?.email)) {
    return <EnvioParaAprovacao state={state} onPatch={onPatch} onNext={onNext} onBack={onBack} />
  }

  return (
    <Card className="max-w-2xl">
      <CardContent className="pt-6">
        <AssinaturaForm
          comStatus={liberacao}
          labelNome={liberacao ? 'Responsável pela liberação' : 'Nome do responsável'}
          textoDeclaracao={`Declaro que as informações prestadas nesta ${liberacao ? 'liberação' : 'vistoria'} são verdadeiras e foram conferidas junto ao veículo.`}
          inicial={{
            statusLiberacao: state.statusLiberacao,
            observacoes: state.observacoes,
            nome: state.responsavelNome,
            cargo: state.responsavelCargo,
            declarou: Boolean(state.assinaturaDataUrl),
          }}
          onVoltar={onBack}
          onConfirmar={(d) => {
            onPatch({
              assinaturaDataUrl: d.assinaturaDataUrl,
              responsavelNome: d.nome,
              responsavelCargo: d.cargo,
              ...(liberacao ? { statusLiberacao: d.statusLiberacao, observacoes: d.observacoes } : {}),
            })
            onNext()
          }}
        />
      </CardContent>
    </Card>
  )
}

function EnvioParaAprovacao({ state, onPatch, onNext, onBack }: Props) {
  const [observacoes, setObservacoes] = useState(state.observacoes ?? '')
  const sigRef = useRef<SignatureCanvas>(null)
  const [declarou, setDeclarou] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  // Data/hora automática: mostra o relógio atual e grava o momento em que confirma.
  const [agora, setAgora] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])

  function handleContinuar() {
    if (!sigRef.current || sigRef.current.isEmpty()) {
      setErro('O encarregado precisa assinar antes de enviar.')
      return
    }
    if (!declarou) {
      setErro('É necessário confirmar a declaração para continuar.')
      return
    }
    // Sem status/assinatura do aprovador: quem define é a Maria Clara.
    onPatch({
      observacoes: observacoes.trim() || undefined,
      assinaturaEncarregadoUrl: sigRef.current.getTrimmedCanvas().toDataURL('image/png'),
      dataHora: new Date().toISOString(),
      statusLiberacao: undefined,
      assinaturaDataUrl: undefined,
      responsavelNome: undefined,
      responsavelCargo: undefined,
    })
    onNext()
  }

  return (
    <Card className="max-w-2xl">
      <CardContent className="pt-6 space-y-5">
        <div className="flex gap-3 rounded-xl border border-status-warning/30 bg-status-warning/10 p-4 text-sm">
          <Hourglass className="h-5 w-5 shrink-0 text-status-warning" />
          <p className="text-foreground">
            A liberação final é feita pela <strong>Maria Clara</strong>. Ao enviar, o checklist fica{' '}
            <strong>aguardando aprovação</strong> e aparece para ela na aba Finalizadas.
          </p>
        </div>

        <div>
          <Label htmlFor="observacoes">Observações para a aprovação</Label>
          <Textarea
            id="observacoes"
            rows={3}
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Opcional: algo que a Maria Clara precisa saber"
          />
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs uppercase text-secondary">Encarregado</p>
            <p className="font-medium text-foreground">{state.inspetor || '—'}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-secondary">Data / hora</p>
            <p className="font-medium text-foreground">{formatDateTime(agora.toISOString())}</p>
          </div>
        </div>

        <div>
          <Label>Assinatura do encarregado</Label>
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
            onClick={() => sigRef.current?.clear()}
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
          Declaro que a manutenção foi realizada e que as fotos deste checklist foram tiradas do veículo.
        </label>

        <FieldError message={erro ?? undefined} />

        <div className="flex justify-between pt-2">
          <Button type="button" variant="secondary" onClick={onBack}>
            Voltar
          </Button>
          <Button type="button" onClick={handleContinuar}>
            Continuar
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
