import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import {
  Bell,
  CheckCheck,
  Trash2,
  X,
  Clock,
  Wrench,
  Car,
  AlertTriangle,
  CheckCircle2,
  Truck,
  ExternalLink,
  SlidersHorizontal,
} from 'lucide-react'
import { useNotificacoes, type NotificacaoItem } from '@/contexts/NotificacoesContext'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function NotificacoesDropdown() {
  const [isOpen, setIsOpen] = useState(false)
  const [filtro, setFiltro] = useState<'todas' | 'os' | 'patio' | 'frotas'>('todas')
  const navigate = useNavigate()

  const {
    notificacoes,
    naoLidasCount,
    marcarComoLida,
    marcarTodasComoLidas,
    limparTodas,
  } = useNotificacoes()

  // Bloqueia rolagem do body quando o painel estiver aberto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  const listaFiltrada = notificacoes.filter((n) => {
    if (filtro === 'os') return n.tipo.startsWith('os_')
    if (filtro === 'patio') return n.tipo === 'entrada' || n.tipo === 'saida' || n.tipo === 'patio_tempo'
    if (filtro === 'frotas') return n.tipo.startsWith('frota_')
    return true
  })

  function handleItemClick(item: NotificacaoItem) {
    marcarComoLida(item.id)
    if (item.link) {
      navigate(item.link)
      setIsOpen(false)
    }
  }

  function renderIcon(tipo: string, prioridade?: string) {
    if (tipo === 'frota_preventiva' || tipo === 'frota_doc_vencido') {
      return <Truck className="h-4 w-4 text-red-400" />
    }
    if (tipo === 'frota_doc_avencer') {
      return <Truck className="h-4 w-4 text-amber-400" />
    }
    if (prioridade === 'urgente' || tipo === 'patio_tempo') {
      return <AlertTriangle className="h-4 w-4 text-red-400" />
    }
    if (tipo === 'os_status') {
      return <Wrench className="h-4 w-4 text-amber-400" />
    }
    if (tipo === 'os_finalizada') {
      return <CheckCircle2 className="h-4 w-4 text-emerald-400" />
    }
    if (tipo === 'entrada' || tipo === 'saida') {
      return <Car className="h-4 w-4 text-blue-400" />
    }
    return <Bell className="h-4 w-4 text-primary" />
  }

  return (
    <>
      {/* Botão do Sininho no Topo */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Notificações"
        className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-border/40 bg-surface/80 text-secondary hover:text-foreground hover:border-primary/50 transition-all active:scale-95 cursor-pointer shadow-sm"
      >
        <Bell className={`h-4 w-4 ${naoLidasCount > 0 ? 'text-primary' : ''}`} />
        
        {naoLidasCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white shadow-md ring-2 ring-surface animate-pulse">
            {naoLidasCount > 99 ? '99+' : naoLidasCount}
          </span>
        )}
      </button>

      {/* Painel Minimalista via React Portal */}
      {isOpen &&
        createPortal(
          <div className="fixed inset-0 z-[99999] flex flex-col justify-end sm:justify-center sm:items-end font-sans">
            {/* Backdrop com Blur Suave */}
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
              onClick={() => setIsOpen(false)}
            />

            {/* Container Principal */}
            <div className="relative z-10 flex w-full flex-col bg-[#121214] text-foreground shadow-2xl transition-all duration-300
              max-h-[85vh] sm:max-h-full sm:h-full sm:w-[420px]
              rounded-t-3xl sm:rounded-none
              border-t sm:border-t-0 sm:border-l border-white/10
              animate-in slide-in-from-bottom sm:slide-in-from-right
              pb-[env(safe-area-inset-bottom)] sm:pb-0"
            >
              {/* Header Clean */}
              <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white tracking-wide">Notificações</span>
                  {naoLidasCount > 0 && (
                    <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[11px] font-semibold text-primary">
                      {naoLidasCount} nova{naoLidasCount > 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  {naoLidasCount > 0 && (
                    <button
                      type="button"
                      onClick={marcarTodasComoLidas}
                      title="Marcar todas como lidas"
                      className="p-2 rounded-lg text-secondary hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <CheckCheck className="h-4 w-4" />
                    </button>
                  )}
                  {notificacoes.length > 0 && (
                    <button
                      type="button"
                      onClick={limparTodas}
                      title="Limpar todas"
                      className="p-2 rounded-lg text-secondary hover:text-red-400 hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    aria-label="Fechar"
                    className="p-2 rounded-lg text-secondary hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Filtros em Abas Minimalistas */}
              <div className="flex px-4 py-2.5 gap-1.5 border-b border-white/5 bg-white/[0.02]">
                <button
                  type="button"
                  onClick={() => setFiltro('todas')}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    filtro === 'todas'
                      ? 'bg-white/10 text-white border border-white/15'
                      : 'text-secondary hover:text-white hover:bg-white/5'
                  }`}
                >
                  Todas ({notificacoes.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFiltro('os')}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    filtro === 'os'
                      ? 'bg-amber-500/15 text-amber-300 border border-amber-500/25'
                      : 'text-secondary hover:text-white hover:bg-white/5'
                  }`}
                >
                  O.S / Oficina
                </button>
                <button
                  type="button"
                  onClick={() => setFiltro('patio')}
                  className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    filtro === 'patio'
                      ? 'bg-blue-500/15 text-blue-300 border border-blue-500/25'
                      : 'text-secondary hover:text-white hover:bg-white/5'
                  }`}
                >
                  Pátio
                </button>
                <button
                  type="button"
                  onClick={() => setFiltro('frotas')}
                  className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    filtro === 'frotas'
                      ? 'bg-red-500/15 text-red-300 border border-red-500/25'
                      : 'text-secondary hover:text-white hover:bg-white/5'
                  }`}
                >
                  Frotas
                </button>
              </div>

              {/* Lista de Alertas */}
              <div className="flex-1 overflow-y-auto p-3.5 space-y-2 overscroll-contain">
                {listaFiltrada.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center text-secondary">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.03] border border-white/5 mb-3 text-secondary/50">
                      <Bell className="h-5 w-5 stroke-1" />
                    </div>
                    <p className="text-xs font-semibold text-white/80">Nenhuma notificação</p>
                    <p className="text-[11px] text-secondary mt-0.5">
                      Você está em dia com todos os alertas
                    </p>
                  </div>
                ) : (
                  listaFiltrada.map((item) => {
                    const tempoAtras = formatDistanceToNow(new Date(item.dataHora), {
                      addSuffix: true,
                      locale: ptBR,
                    })

                    return (
                      <div
                        key={item.id}
                        onClick={() => handleItemClick(item)}
                        className={`group relative flex items-start gap-3 p-3.5 rounded-2xl transition-all cursor-pointer ${
                          !item.lida
                            ? 'bg-white/[0.06] border border-primary/30 shadow-sm'
                            : 'bg-white/[0.02] hover:bg-white/[0.05] border border-white/5'
                        }`}
                      >
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border mt-0.5 ${
                            item.prioridade === 'urgente'
                              ? 'bg-red-500/10 border-red-500/30'
                              : item.prioridade === 'alerta'
                                ? 'bg-amber-500/10 border-amber-500/30'
                                : 'bg-primary/10 border-primary/20'
                          }`}
                        >
                          {renderIcon(item.tipo, item.prioridade)}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                            <p className={`text-xs font-bold truncate uppercase ${
                              !item.lida ? 'text-white' : 'text-white/80'
                            }`}>
                              {item.titulo}
                            </p>
                            {!item.lida && (
                              <span className="h-2 w-2 rounded-full bg-primary shrink-0 ring-2 ring-primary/20" />
                            )}
                          </div>

                          <p className="text-xs text-secondary leading-relaxed normal-case">
                            {item.mensagem}
                          </p>

                          <div className="mt-2 flex items-center justify-between text-[10px] text-secondary/70">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {tempoAtras}
                            </span>
                            {item.link && (
                              <span className="text-primary font-semibold flex items-center gap-1 group-hover:underline">
                                Abrir <ExternalLink className="h-3 w-3" />
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {/* Rodapé Clean */}
              <div className="p-3 border-t border-white/5 bg-white/[0.01]">
                <button
                  type="button"
                  onClick={() => {
                    navigate('/configuracoes')
                    setIsOpen(false)
                  }}
                  className="flex w-full items-center justify-center gap-2 py-2.5 text-xs font-medium text-secondary hover:text-white hover:bg-white/5 rounded-xl transition-all cursor-pointer"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  <span>Configurar preferências de alertas</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
