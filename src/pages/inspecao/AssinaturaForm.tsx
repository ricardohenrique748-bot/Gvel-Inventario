import { useRef, useState } from 'react'
import SignatureCanvas from 'react-signature-canvas'
import { Eraser } from 'lucide-react'
import { Input, Label, FieldError, Textarea } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import type { StatusLiberacao } from '@/lib/types'
import { STATUS_LIBERACAO_LABEL } from './types'

const OPCOES_LIBERACAO: { value: StatusLiberacao; emoji: string; activeClass: string }[] = [
  { value: 'liberado', emoji: '🟢', activeClass: 'bg-status-success text-white border-status-success' },
  { value: 'liberado_restricao', emoji: '🟡', activeClass: 'bg-status-warning text-white border-status-warning' },
  { value: 'nao_liberado', emoji: '🔴', activeClass: 'bg-status-danger text-white border-status-danger' },
]

export interface DadosAssinatura {
  statusLiberacao?: StatusLiberacao
  observacoes?: string
  nome: string
  cargo: string
  assinaturaDataUrl: string
}

interface Props {
  /** Mostra a escolha Liberado / Com restrição / Não liberado + observações (aprovação da liberação). */
  comStatus?: boolean
  labelNome: string
  textoDeclaracao: string
  inicial?: Partial<Omit<DadosAssinatura, 'assinaturaDataUrl'>> & { declarou?: boolean }
  labelVoltar?: string
  labelConfirmar?: string
  confirmando?: boolean
  onVoltar: () => void
  onConfirmar: (dados: DadosAssinatura) => void
}

/** Nome, cargo, assinatura e declaração — usado na etapa final do wizard e na aprovação da liberação. */
export function AssinaturaForm({
  comStatus,
  labelNome,
  textoDeclaracao,
  inicial,
  labelVoltar = 'Voltar',
  labelConfirmar = 'Confirmar',
  confirmando,
  onVoltar,
  onConfirmar,
}: Props) {
  const sigRef = useRef<SignatureCanvas>(null)
  const nomeRef = useRef<HTMLInputElement>(null)
  const [nome, setNome] = useState(inicial?.nome ?? '')
  const [cargo, setCargo] = useState(inicial?.cargo ?? '')
  const [declarou, setDeclarou] = useState(Boolean(inicial?.declarou))
  const [statusLiberacao, setStatusLiberacao] = useState<StatusLiberacao | undefined>(inicial?.statusLiberacao)
  const [observacoes, setObservacoes] = useState(inicial?.observacoes ?? '')
  const [erro, setErro] = useState<string | null>(null)

  function handleLimpar() {
    sigRef.current?.clear()
    setErro(null)
  }

  function handleConfirmar() {
    // Alguns navegadores preenchem o campo via autofill sem disparar o onChange
    // do React — lê o valor direto do input como reforço ao state.
    const nomeValor = (nome || nomeRef.current?.value || '').trim()

    if (comStatus && !statusLiberacao) {
      setErro('Selecione o status do veículo.')
      return
    }
    if (comStatus && statusLiberacao !== 'liberado' && !observacoes.trim()) {
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

    onConfirmar({
      statusLiberacao: comStatus ? statusLiberacao : undefined,
      observacoes: comStatus ? observacoes.trim() || undefined : undefined,
      nome: nomeValor,
      cargo: cargo.trim(),
      assinaturaDataUrl: sigRef.current.getTrimmedCanvas().toDataURL('image/png'),
    })
  }

  return (
    <div className="space-y-5">
      {comStatus && (
        <>
          <div>
            <Label>Status do veículo</Label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {OPCOES_LIBERACAO.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={statusLiberacao === opt.value}
                  onClick={() => {
                    setStatusLiberacao(opt.value)
                    setErro(null)
                  }}
                  className={cn(
                    'flex h-11 items-center justify-center rounded-lg border text-sm font-semibold transition-colors',
                    statusLiberacao === opt.value
                      ? opt.activeClass
                      : 'border-secondary/30 text-secondary hover:text-foreground',
                  )}
                >
                  {opt.emoji} {STATUS_LIBERACAO_LABEL[opt.value].toUpperCase()}
                </button>
              ))}
            </div>
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
              placeholder={
                statusLiberacao && statusLiberacao !== 'liberado'
                  ? 'Obrigatório: descreva a restrição/pendência'
                  : 'Opcional'
              }
            />
          </div>
        </>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="responsavelNome">{labelNome}</Label>
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
          <Input id="responsavelCargo" value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="Opcional" />
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
        {textoDeclaracao}
      </label>

      <FieldError message={erro ?? undefined} />

      <div className="flex justify-between pt-2">
        <Button type="button" variant="secondary" onClick={onVoltar} disabled={confirmando}>
          {labelVoltar}
        </Button>
        <Button type="button" onClick={handleConfirmar} disabled={confirmando}>
          {confirmando ? 'Salvando…' : labelConfirmar}
        </Button>
      </div>
    </div>
  )
}
