import { useState, useEffect } from 'react'
import { Bell, BellOff, Clock, ClipboardCheck, Save, Check, Smartphone } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Label } from '@/components/ui/Input'

const STORAGE_KEY = 'config_notificacoes'

interface ConfigNotificacoes {
  pushAtivo: boolean
  alertaPatioAtivo: boolean
  alertaPatioHoras: number
  alertaOsAbertaAtivo: boolean
  alertaOsFinalizadaAtivo: boolean
}

const DEFAULTS: ConfigNotificacoes = {
  pushAtivo: true,
  alertaPatioAtivo: true,
  alertaPatioHoras: 24,
  alertaOsAbertaAtivo: true,
  alertaOsFinalizadaAtivo: true,
}

function loadConfig(): ConfigNotificacoes {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return { ...DEFAULTS, ...JSON.parse(saved) }
  } catch {}
  return DEFAULTS
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${
        disabled ? 'opacity-40 cursor-not-allowed' : ''
      } ${
        checked
          ? 'border-primary bg-primary'
          : 'border-border bg-surface'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 rounded-full shadow-md ring-0 transition-transform duration-200 ${
          checked ? 'translate-x-5 bg-white' : 'translate-x-0.5 bg-secondary/50'
        }`}
      />
    </button>
  )
}

export function NotificacoesTab() {
  const [config, setConfig] = useState<ConfigNotificacoes>(loadConfig)
  const [salvo, setSalvo] = useState(false)

  // Recarrega sempre que a aba for montada
  useEffect(() => {
    setConfig(loadConfig())
  }, [])

  function update<K extends keyof ConfigNotificacoes>(key: K, value: ConfigNotificacoes[K]) {
    setConfig((prev) => ({ ...prev, [key]: value }))
  }

  function salvar() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
      setSalvo(true)
      setTimeout(() => setSalvo(false), 2500)
    } catch {}
  }

  const patioBloqueado = !config.pushAtivo || !config.alertaPatioAtivo

  return (
    <div className="space-y-5 uppercase">

      {/* Notificações Push Globais */}
      <Card className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors ${
                config.pushAtivo
                  ? 'bg-primary/10 border-primary/30 text-primary'
                  : 'bg-secondary/10 border-border/30 text-secondary'
              }`}
            >
              {config.pushAtivo ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
            </div>
            <div>
              <p className="font-bold text-foreground text-sm">Notificações Push</p>
              <p className="text-xs text-secondary mt-0.5 normal-case">
                Ativa ou desativa todas as notificações no celular
              </p>
            </div>
          </div>
          <Toggle checked={config.pushAtivo} onChange={(v) => update('pushAtivo', v)} />
        </div>

        {!config.pushAtivo && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
            <Smartphone className="h-4 w-4 text-amber-400 shrink-0" />
            <p className="text-xs text-amber-300 font-semibold normal-case">
              Todas as notificações estão desativadas. Ative para configurar os alertas abaixo.
            </p>
          </div>
        )}
      </Card>

      {/* Alerta de Tempo no Pátio */}
      <Card className={`p-5 transition-opacity ${!config.pushAtivo ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors ${
                config.alertaPatioAtivo && config.pushAtivo
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                  : 'bg-secondary/10 border-border/30 text-secondary'
              }`}
            >
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="font-bold text-foreground text-sm">Alerta de Tempo no Pátio</p>
              <p className="text-xs text-secondary mt-0.5 normal-case">
                Notifica quando um veículo ultrapassar o limite de horas no pátio
              </p>
            </div>
          </div>
          <Toggle
            checked={config.alertaPatioAtivo}
            onChange={(v) => update('alertaPatioAtivo', v)}
            disabled={!config.pushAtivo}
          />
        </div>

        <div
          className={`transition-all overflow-hidden ${
            config.alertaPatioAtivo ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="border-t border-border/20 pt-4">
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Label
                  htmlFor="horas-patio"
                  className="!text-xs !mb-1.5 font-semibold text-secondary uppercase"
                >
                  Limite de horas no pátio
                </Label>
                <Input
                  id="horas-patio"
                  type="number"
                  min={1}
                  max={720}
                  value={config.alertaPatioHoras}
                  onChange={(e) =>
                    update('alertaPatioHoras', Math.max(1, Number(e.target.value)))
                  }
                  disabled={patioBloqueado}
                  className="!h-10 !text-sm !px-3"
                />
              </div>
              <div className="pb-px">
                <span className="text-sm font-bold text-secondary">HORAS</span>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-secondary/70 normal-case">
              Ex: 24 horas = alerta se o veículo estiver há mais de 1 dia no pátio sem saída.
            </p>
          </div>
        </div>
      </Card>

      {/* Alertas de O.S */}
      <Card className={`p-5 space-y-0 transition-opacity ${!config.pushAtivo ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="flex items-center gap-3 mb-4">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors ${
              (config.alertaOsAbertaAtivo || config.alertaOsFinalizadaAtivo) && config.pushAtivo
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-secondary/10 border-border/30 text-secondary'
            }`}
          >
            <ClipboardCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="font-bold text-foreground text-sm">Alertas de Ordem de Serviço (O.S)</p>
            <p className="text-xs text-secondary mt-0.5 normal-case">
              Notificações relacionadas à abertura e finalização de ordens de serviço
            </p>
          </div>
        </div>

        <div className="space-y-3 border-t border-border/20 pt-4">
          {/* O.S Aberta */}
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border/20 bg-background/50 px-3.5 py-3">
            <div>
              <p className="text-sm font-semibold text-foreground">🟢 O.S Aberta</p>
              <p className="text-[11px] text-secondary mt-0.5 normal-case">
                Notificar quando uma nova O.S for iniciada
              </p>
            </div>
            <Toggle
              checked={config.alertaOsAbertaAtivo}
              onChange={(v) => update('alertaOsAbertaAtivo', v)}
              disabled={!config.pushAtivo}
            />
          </div>

          {/* O.S Finalizada */}
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border/20 bg-background/50 px-3.5 py-3">
            <div>
              <p className="text-sm font-semibold text-foreground">🏁 O.S Finalizada</p>
              <p className="text-[11px] text-secondary mt-0.5 normal-case">
                Notificar quando uma O.S for concluída e fechada
              </p>
            </div>
            <Toggle
              checked={config.alertaOsFinalizadaAtivo}
              onChange={(v) => update('alertaOsFinalizadaAtivo', v)}
              disabled={!config.pushAtivo}
            />
          </div>
        </div>
      </Card>

      {/* Botão Salvar */}
      <div className="flex items-center justify-end gap-3 pt-1">
        {salvo && (
          <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
            <Check className="h-4 w-4" />
            CONFIGURAÇÕES SALVAS!
          </span>
        )}
        <Button
          type="button"
          variant="primary"
          size="md"
          onClick={salvar}
          className="!px-6 !h-10 uppercase font-bold"
        >
          <Save className="h-4 w-4 mr-1.5" />
          SALVAR CONFIGURAÇÕES
        </Button>
      </div>
    </div>
  )
}
