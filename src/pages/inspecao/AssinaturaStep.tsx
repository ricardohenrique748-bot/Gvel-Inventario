import { useRef, useState } from 'react'
import SignatureCanvas from 'react-signature-canvas'
import { Eraser } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { Input, Label, FieldError } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import type { InspecaoWizardState } from './types'

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

  function handleLimpar() {
    sigRef.current?.clear()
    setErro(null)
  }

  function handleConfirmar() {
    // Alguns navegadores preenchem o campo via autofill sem disparar o onChange
    // do React — lê o valor direto do input como reforço ao state.
    const nomeValor = (nome || nomeRef.current?.value || '').trim()

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
    onPatch({ assinaturaDataUrl: dataUrl, responsavelNome: nomeValor, responsavelCargo: cargo.trim() })
    onNext()
  }

  return (
    <Card className="max-w-2xl">
      <CardContent className="pt-6 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="responsavelNome">Nome do responsável</Label>
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
          Declaro que as informações prestadas nesta vistoria são verdadeiras e foram conferidas junto ao veículo.
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
