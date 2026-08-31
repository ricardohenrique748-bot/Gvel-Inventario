import { useState, useEffect } from 'react'
import {
  Bell,
  BellOff,
  ClipboardCheck,
  Save,
  Send,
  Car,
  Radio,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Label, Textarea } from '@/components/ui/Input'
import { useNotificacoes, type ConfigNotificacoes } from '@/contexts/NotificacoesContext'
import { useAuth } from '@/contexts/AuthContext'
import { solicitarPermissaoNotificacoes, verificarPermissaoNotificacoes } from '@/lib/pushNotifications'
import { Capacitor } from '@capacitor/core'

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
  const { perfil } = useAuth()
  const isAdmin = perfil?.nivel === 'admin'

  const {
    config,
    salvarConfig,
    dispararNotificacaoTeste,
    criarNotificacaoManual,
    tocarSom,
  } = useNotificacoes()

  const [formConfig, setFormConfig] = useState<ConfigNotificacoes>(config)
  const [salvo, setSalvo] = useState(false)
  const [testeDisparado, setTesteDisparado] = useState(false)

  // Sincroniza sempre que a configuração mudar
  useEffect(() => {
    setFormConfig(config)
  }, [config])

  // Estados do Comunicado Manual
  const [tituloComunicado, setTituloComunicado] = useState('')
  const [mensagemComunicado, setMensagemComunicado] = useState('')
  const [prioridadeComunicado, setPrioridadeComunicado] = useState<'normal' | 'alerta' | 'urgente'>('normal')
  const [comunicadoEnviado, setComunicadoEnviado] = useState(false)

  function update<K extends keyof ConfigNotificacoes>(key: K, value: ConfigNotificacoes[K]) {
    const novo = { ...formConfig, [key]: value }
    setFormConfig(novo)
    // Salva instantaneamente a cada alteração
    salvarConfig(novo)
    setSalvo(true)
    setTimeout(() => setSalvo(false), 1500)
  }

  function handleSalvar() {
    salvarConfig(formConfig)
    setSalvo(true)
    setTimeout(() => setSalvo(false), 2500)
  }

  function handleTestar() {
    dispararNotificacaoTeste()
    setTesteDisparado(true)
    setTimeout(() => setTesteDisparado(false), 3000)
  }

  function handleEnviarComunicado(e: React.FormEvent) {
    e.preventDefault()
    if (!tituloComunicado.trim() || !mensagemComunicado.trim()) return

    criarNotificacaoManual(tituloComunicado.trim(), mensagemComunicado.trim(), prioridadeComunicado)
    setTituloComunicado('')
    setMensagemComunicado('')
    setComunicadoEnviado(true)
    setTimeout(() => setComunicadoEnviado(false), 3000)
  }

  const patioBloqueado = !formConfig.pushAtivo || !formConfig.alertaPatioAtivo

  const [permissaoStatus, setPermissaoStatus] = useState<string>('default')
  const isNativo = Capacitor.isNativePlatform()

  useEffect(() => {
    verificarPermissaoNotificacoes().then(setPermissaoStatus)
  }, [])

  async function handleSolicitarPermissao() {
    const granted = await solicitarPermissaoNotificacoes()
    setPermissaoStatus(await verificarPermissaoNotificacoes())
    if (granted) {
      dispararNotificacaoTeste()
      setTesteDisparado(true)
      setTimeout(() => setTesteDisparado(false), 3000)
    }
  }

  return (
    <div className="space-y-6 uppercase">
      {/* Banner de Status de Permissão de Push no Navegador / Dispositivo */}
      {permissaoStatus !== 'granted' && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-amber-500/10 border border-amber-500/30 p-4 rounded-2xl animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
              <Bell className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <p className="text-xs font-black text-amber-300">
                {isNativo ? 'PERMISSÃO DE NOTIFICAÇÕES NÃO ATIVADA NO APARELHO' : 'PERMISSÃO DE NOTIFICAÇÕES NÃO ATIVADA NO NAVEGADOR'}
              </p>
              <p className="text-[11px] text-secondary normal-case mt-0.5">
                {isNativo
                  ? 'Sem essa permissão, os alertas aparecem só dentro do app (sininho), mas não como notificação na barra do Android.'
                  : 'Para receber alertas mesmo com a página em segundo plano ou em outra aba, permita as notificações.'}
              </p>
              {isNativo && permissaoStatus === 'denied' && (
                <p className="text-[11px] text-amber-300 normal-case mt-1.5 font-semibold">
                  Já foi negada uma vez — o botão abaixo pode não abrir o pedido de novo. Se não funcionar, ative manualmente em:
                  Ajustes do Android → Apps → Estrutura - GV → Notificações.
                </p>
              )}
            </div>
          </div>
          <Button
            type="button"
            size="md"
            onClick={handleSolicitarPermissao}
            className="!h-9 !text-xs !bg-amber-600 hover:!bg-amber-700 whitespace-nowrap"
          >
            🔔 PERMITIR NOTIFICAÇÕES AGORA
          </Button>
        </div>
      )}

      {/* Barra de Ações Rápidas do Topo */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-surface/40 p-4 rounded-2xl border border-border/40">
        <div>
          <h2 className="text-base font-bold text-foreground">CONFIGURAÇÕES DE NOTIFICAÇÕES</h2>
          <p className="text-xs text-secondary normal-case">
            Defina quais eventos acionam a Central de Notificações, efeitos sonoros e alertas no sistema.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={handleTestar}
            className="!h-9 !text-xs gap-1.5"
          >
            <Bell className="h-4 w-4 text-primary" />
            <span>{testeDisparado ? 'DISPARADO NO SININHO! 🔔' : 'TESTAR COM SOM'}</span>
          </Button>
          <Button
            type="button"
            size="md"
            onClick={handleSalvar}
            className="!h-9 !text-xs gap-1.5"
          >
            <Save className="h-4 w-4" />
            <span>{salvo ? 'SALVO COM SUCESSO! ✅' : 'SALVAR PREFERÊNCIAS'}</span>
          </Button>
        </div>
      </div>

      {/* 1. Ativação Geral / Notificações Push & Som */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Ativação Geral */}
        <Card className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors ${
                  formConfig.pushAtivo
                    ? 'bg-primary/10 border-primary/30 text-primary'
                    : 'bg-secondary/10 border-border/30 text-secondary'
                }`}
              >
                {formConfig.pushAtivo ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
              </div>
              <div>
                <p className="font-bold text-foreground text-sm">Central de Notificações</p>
                <p className="text-xs text-secondary mt-0.5 normal-case">
                  Exibe o sininho e os alertas no sistema
                </p>
              </div>
            </div>
            <Toggle checked={formConfig.pushAtivo} onChange={(v) => update('pushAtivo', v)} />
          </div>
        </Card>

        {/* Som de Notificação */}
        <Card className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors ${
                  formConfig.somAtivo
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-secondary/10 border-border/30 text-secondary'
                }`}
              >
                {formConfig.somAtivo ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-bold text-foreground text-sm">Alerta Sonoro (Áudio)</p>
                  <button
                    type="button"
                    onClick={() => tocarSom()}
                    className="text-[10px] text-primary hover:underline font-black px-1.5 py-0.5 rounded border border-primary/30 bg-primary/10"
                    title="Tocar som de teste agora"
                  >
                    OUVIR SOM 🔊
                  </button>
                </div>
                <p className="text-xs text-secondary mt-0.5 normal-case">
                  Toca sinal sonoro quando um novo alerta chegar
                </p>
              </div>
            </div>
            <Toggle checked={formConfig.somAtivo} onChange={(v) => update('somAtivo', v)} />
          </div>
        </Card>
      </div>

      {/* 2. Alertas de Pátio e Fluxo de Veículos */}
      <Card className={`p-5 transition-opacity ${!formConfig.pushAtivo ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border bg-blue-500/10 border-blue-500/30 text-blue-400">
            <Car className="h-5 w-5" />
          </div>
          <div>
            <p className="font-bold text-foreground text-sm">Alertas de Movimentação do Pátio</p>
            <p className="text-xs text-secondary mt-0.5 normal-case">
              Notificações ao registrar entrada, saída ou tempo de permanência no pátio
            </p>
          </div>
        </div>

        <div className="space-y-3 border-t border-border/20 pt-4">
          {/* Alerta de Entrada */}
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border/20 bg-background/50 px-3.5 py-3">
            <div>
              <p className="text-sm font-semibold text-foreground">🚗 Entrada de Veículo</p>
              <p className="text-[11px] text-secondary mt-0.5 normal-case">
                Notificar no sininho assim que um novo veículo der entrada no pátio
              </p>
            </div>
            <Toggle
              checked={formConfig.alertaEntradaAtivo}
              onChange={(v) => update('alertaEntradaAtivo', v)}
              disabled={!formConfig.pushAtivo}
            />
          </div>

          {/* Alerta de Saída */}
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border/20 bg-background/50 px-3.5 py-3">
            <div>
              <p className="text-sm font-semibold text-foreground">🏁 Saída de Veículo</p>
              <p className="text-[11px] text-secondary mt-0.5 normal-case">
                Notificar quando a saída de um veículo for concluída
              </p>
            </div>
            <Toggle
              checked={formConfig.alertaSaidaAtivo}
              onChange={(v) => update('alertaSaidaAtivo', v)}
              disabled={!formConfig.pushAtivo}
            />
          </div>

          {/* Alerta de Tempo Excedido no Pátio */}
          <div className="rounded-lg border border-border/20 bg-background/50 p-3.5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">⏰ Alerta de Tempo no Pátio</p>
                <p className="text-[11px] text-secondary mt-0.5 normal-case">
                  Alerta crítico quando um veículo ultrapassar o limite de horas no pátio
                </p>
              </div>
              <Toggle
                checked={formConfig.alertaPatioAtivo}
                onChange={(v) => update('alertaPatioAtivo', v)}
                disabled={!formConfig.pushAtivo}
              />
            </div>

            {formConfig.alertaPatioAtivo && (
              <div className="border-t border-border/20 pt-3 flex items-center gap-3">
                <div className="w-36">
                  <Label htmlFor="horas-patio" className="!text-[11px] !mb-1 text-secondary uppercase">
                    Limite Máximo
                  </Label>
                  <Input
                    id="horas-patio"
                    type="number"
                    min={1}
                    max={720}
                    value={formConfig.alertaPatioHoras}
                    onChange={(e) => update('alertaPatioHoras', Math.max(1, Number(e.target.value)))}
                    disabled={patioBloqueado}
                    className="!h-9 !text-xs !px-3"
                  />
                </div>
                <div className="pt-4">
                  <span className="text-xs font-bold text-secondary">HORAS NO PÁTIO</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* 3. Alertas de O.S e Manutenção */}
      <Card className={`p-5 space-y-0 transition-opacity ${!formConfig.pushAtivo ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border bg-emerald-500/10 border-emerald-500/30 text-emerald-400">
            <ClipboardCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="font-bold text-foreground text-sm">Alertas de Ordem de Serviço (O.S)</p>
            <p className="text-xs text-secondary mt-0.5 normal-case">
              Configure quais mudanças de etapa de oficina devem gerar alertas no sistema
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 border-t border-border/20 pt-4">
          {/* O.S Aberta */}
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border/20 bg-background/50 px-3.5 py-3">
            <div>
              <p className="text-xs font-bold text-foreground">🟢 O.S EM ANDAMENTO</p>
              <p className="text-[10px] text-secondary mt-0.5 normal-case">Quando um mecânico inicia uma O.S</p>
            </div>
            <Toggle
              checked={formConfig.alertaOsAbertaAtivo}
              onChange={(v) => update('alertaOsAbertaAtivo', v)}
              disabled={!formConfig.pushAtivo}
            />
          </div>

          {/* Aguardando Peças */}
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border/20 bg-background/50 px-3.5 py-3">
            <div>
              <p className="text-xs font-bold text-foreground">⏳ AGUARDANDO PEÇAS</p>
              <p className="text-[10px] text-secondary mt-0.5 normal-case">Quando a O.S entra em espera de peças</p>
            </div>
            <Toggle
              checked={formConfig.alertaOsPecasAtivo}
              onChange={(v) => update('alertaOsPecasAtivo', v)}
              disabled={!formConfig.pushAtivo}
            />
          </div>

          {/* Aguardando Orçamento */}
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border/20 bg-background/50 px-3.5 py-3">
            <div>
              <p className="text-xs font-bold text-foreground">📄 AGUARD. ORÇAMENTO</p>
              <p className="text-[10px] text-secondary mt-0.5 normal-case">Pendente de aprovação orçamentária</p>
            </div>
            <Toggle
              checked={formConfig.alertaOsOrcamentoAtivo}
              onChange={(v) => update('alertaOsOrcamentoAtivo', v)}
              disabled={!formConfig.pushAtivo}
            />
          </div>

          {/* Aguardando Autorização */}
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border/20 bg-background/50 px-3.5 py-3">
            <div>
              <p className="text-xs font-bold text-foreground">⚠️ AGUARD. AUTORIZAÇÃO</p>
              <p className="text-[10px] text-secondary mt-0.5 normal-case">Aguardando autorização de serviço</p>
            </div>
            <Toggle
              checked={formConfig.alertaOsAutorizacaoAtivo}
              onChange={(v) => update('alertaOsAutorizacaoAtivo', v)}
              disabled={!formConfig.pushAtivo}
            />
          </div>

          {/* Aguardando Aprovação Multilixo */}
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border/20 bg-background/50 px-3.5 py-3">
            <div>
              <p className="text-xs font-bold text-foreground">🏢 AGUARD. MULTILIXO</p>
              <p className="text-[10px] text-secondary mt-0.5 normal-case">Aguardando aprovação da Multilixo</p>
            </div>
            <Toggle
              checked={formConfig.alertaOsMultilixoAtivo}
              onChange={(v) => update('alertaOsMultilixoAtivo', v)}
              disabled={!formConfig.pushAtivo}
            />
          </div>

          {/* Aguardando Aprovação do Cliente */}
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border/20 bg-background/50 px-3.5 py-3">
            <div>
              <p className="text-xs font-bold text-foreground">👥 AGUARD. CLIENTE</p>
              <p className="text-[10px] text-secondary mt-0.5 normal-case">Aguardando aprovação do cliente</p>
            </div>
            <Toggle
              checked={formConfig.alertaOsClienteAtivo}
              onChange={(v) => update('alertaOsClienteAtivo', v)}
              disabled={!formConfig.pushAtivo}
            />
          </div>

          {/* O.S Finalizada */}
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border/20 bg-background/50 px-3.5 py-3">
            <div>
              <p className="text-xs font-bold text-foreground">✅ O.S FINALIZADA</p>
              <p className="text-[10px] text-secondary mt-0.5 normal-case">Quando a O.S é concluída com sucesso</p>
            </div>
            <Toggle
              checked={formConfig.alertaOsFinalizadaAtivo}
              onChange={(v) => update('alertaOsFinalizadaAtivo', v)}
              disabled={!formConfig.pushAtivo}
            />
          </div>
        </div>
      </Card>

      {/* 4. Alertas de Gestão de Frotas */}
      <Card className={`p-5 space-y-0 transition-opacity ${!formConfig.pushAtivo ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border bg-primary/10 border-primary/30 text-primary">
            <Car className="h-5 w-5" />
          </div>
          <div>
            <p className="font-bold text-foreground text-sm">Alertas de Gestão de Frotas</p>
            <p className="text-xs text-secondary mt-0.5 normal-case">
              Notificações críticas de vencimento de preventiva e regularização de documentos (CRLV)
            </p>
          </div>
        </div>

        <div className="space-y-2.5 border-t border-border/20 pt-4">
          {/* Preventiva Atrasada */}
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border/20 bg-background/50 px-3.5 py-3">
            <div>
              <p className="text-xs font-bold text-foreground">⚠️ PREVENTIVA ATRASADA</p>
              <p className="text-[10px] text-secondary mt-0.5 normal-case">
                Alerta urgente quando a data limite de revisão preventiva do veículo estiver vencida
              </p>
            </div>
            <Toggle
              checked={formConfig.alertaFrotaPreventivaAtivo}
              onChange={(v) => update('alertaFrotaPreventivaAtivo', v)}
              disabled={!formConfig.pushAtivo}
            />
          </div>

          {/* Vencimento de Documentos / CRLV */}
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border/20 bg-background/50 px-3.5 py-3">
            <div>
              <p className="text-xs font-bold text-foreground">📑 DOCUMENTO A VENCER / VENCIDO (CRLV)</p>
              <p className="text-[10px] text-secondary mt-0.5 normal-case">
                Avisa quando o documento do veículo estiver a 30 dias de vencer ou expirado
              </p>
            </div>
            <Toggle
              checked={formConfig.alertaFrotaDocAtivo}
              onChange={(v) => update('alertaFrotaDocAtivo', v)}
              disabled={!formConfig.pushAtivo}
            />
          </div>
        </div>
      </Card>

      {/* 5. Disparar Comunicado Geral para Todos os Usuários (Apenas Administradores) */}
      {isAdmin && (
        <Card className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border bg-primary/10 border-primary/30 text-primary">
              <Radio className="h-5 w-5" />
            </div>
            <div>
              <p className="font-bold text-foreground text-sm">Disparar Comunicado Geral</p>
              <p className="text-xs text-secondary mt-0.5 normal-case">
                Envie uma notificação instantânea para o sininho de todos os usuários do sistema
              </p>
            </div>
          </div>

          <form onSubmit={handleEnviarComunicado} className="space-y-3.5 border-t border-border/20 pt-4">
            <div>
              <Label htmlFor="titulo-comunicado" className="!text-xs uppercase font-bold text-secondary">
                Título do Comunicado *
              </Label>
              <Input
                id="titulo-comunicado"
                placeholder="EX: AVISO DE MANUTENÇÃO NO PÁTIO, REUNIÃO DA EQUIPE…"
                value={tituloComunicado}
                onChange={(e) => setTituloComunicado(e.target.value.toUpperCase())}
                className="!h-9 !text-xs uppercase"
                required
              />
            </div>

            <div>
              <Label htmlFor="msg-comunicado" className="!text-xs uppercase font-bold text-secondary">
                Mensagem *
              </Label>
              <Textarea
                id="msg-comunicado"
                rows={2}
                placeholder="Digite a mensagem que aparecerá no sininho de todos..."
                value={mensagemComunicado}
                onChange={(e) => setMensagemComunicado(e.target.value)}
                className="!text-xs"
                required
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-secondary">PRIORIDADE:</span>
                <button
                  type="button"
                  onClick={() => setPrioridadeComunicado('normal')}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border uppercase transition-all ${
                    prioridadeComunicado === 'normal'
                      ? 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                      : 'border-border/30 text-secondary'
                  }`}
                >
                  NORMAL
                </button>
                <button
                  type="button"
                  onClick={() => setPrioridadeComunicado('alerta')}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border uppercase transition-all ${
                    prioridadeComunicado === 'alerta'
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                      : 'border-border/30 text-secondary'
                  }`}
                >
                  ALERTA
                </button>
                <button
                  type="button"
                  onClick={() => setPrioridadeComunicado('urgente')}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border uppercase transition-all ${
                    prioridadeComunicado === 'urgente'
                      ? 'bg-red-500/20 text-red-400 border-red-500/40'
                      : 'border-border/30 text-secondary'
                  }`}
                >
                  URGENTE
                </button>
              </div>

              <Button type="submit" size="md" className="!h-9 !text-xs gap-1.5">
                <Send className="h-3.5 w-3.5" />
                <span>{comunicadoEnviado ? 'ENVIADO COM SUCESSO! 📢' : 'ENVIAR COMUNICADO'}</span>
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  )
}
