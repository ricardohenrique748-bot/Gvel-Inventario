import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import {
  Bell,
  CheckCheck,
  Trash2,
  X,
  ExternalLink,
  Clock,
  Wrench,
  Car,
  AlertTriangle,
  CheckCircle2,
  Settings,
} from 'lucide-react'
import { useNotificacoes, type NotificacaoItem } from '@/contexts/NotificacoesContext'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function NotificacoesDropdown() {
  const [isOpen, setIsOpen] = useState(false)
  const [filtro, setFiltro] = useState<'todas' | 'os' | 'patio'>('todas')
  const navigate = useNavigate()

  const {
    notificacoes,
    naoLidasCount,
    marcarComoLida,
    marcarTodasComoLidas,
    limparTodas,
  } = useNotificacoes()

  // Bloqueia rolagem do body quando o drawer estiver aberto
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
      {/* Botão do Sininho */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Central de Notificações"
        className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-border/40 bg-surface text-secondary hover:text-foreground hover:border-primary/50 transition-all active:scale-95 cursor-pointer shadow-sm"
      >
        <Bell className={`h-4 w-4 ${naoLidasCount > 0 ? 'text-primary' : ''}`} />
        
        {naoLidasCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white shadow-lg ring-2 ring-surface animate-pulse">
            {naoLidasCount > 99 ? '99+' : naoLidasCount}
          </span>
        )}
      </button>

      {/* Drawer Lateral via React Portal no Body (z-index absoluto e isolado) */}
      {isOpen &&
        createPortal(
          <div className="fixed inset-0 z-[99999] flex justify-end font-sans">
            {/* Backdrop Escuro com Blur total */}
            <div
              className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
              onClick={() => setIsOpen(false)}
            />

            {/* Painel Lateral Direito */}
            <div className="relative z-10 flex h-full w-full sm:w-[440px] flex-col border-l border-border bg-[#18181b] text-foreground shadow-2xl animate-in slide-in-from-right duration-250">
              {/* Cabeçalho */}
              <div className="flex items-center justify-between border-b border-border/50 px-5 py-4 bg-[#1f1f23]">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary">
                    <Bell className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground uppercase tracking-wide">
                      CENTRAL DE NOTIFICAÇÕES
                    </h3>
                    {naoLidasCount > 0 ? (
                      <span className="text-[11px] font-semibold text-primary uppercase">
                        {naoLidasCount} NOVA{naoLidasCount > 1 ? 'S' : ''} NÃO LIDA{naoLidasCount > 1 ? 'S' : ''}
                      </span>
                    ) : (
                      <span className="text-[11px] text-secondary uppercase">TODOS OS ALERTAS EM DIA</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {naoLidasCount > 0 && (
                    <button
                      type="button"
                      onClick={marcarTodasComoLidas}
                      title="Marcar todas como lidas"
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-secondary hover:text-primary hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <CheckCheck className="h-4 w-4" />
                    </button>
                  )}
                  {notificacoes.length > 0 && (
                    <button
                      type="button"
                      onClick={limparTodas}
                      title="Limpar histórico"
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-secondary hover:text-red-400 hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    aria-label="Fechar"
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-secondary hover:text-foreground hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Filtros em Abas */}
              <div className="flex border-b border-border/40 px-4 py-2.5 gap-2 bg-[#141416]">
                <button
                  type="button"
                  onClick={() => setFiltro('todas')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg uppercase transition-all cursor-pointer ${
                    filtro === 'todas'
                      ? 'bg-primary/20 text-primary border border-primary/30 shadow-sm'
                      : 'text-secondary hover:text-foreground hover:bg-white/5'
                  }`}
                >
                  TODAS ({notificacoes.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFiltro('os')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg uppercase transition-all cursor-pointer ${
                    filtro === 'os'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-sm'
                      : 'text-secondary hover:text-foreground hover:bg-white/5'
                  }`}
                >
                  O.S / OFICINA
                </button>
                <button
                  type="button"
                  onClick={() => setFiltro('patio')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg uppercase transition-all cursor-pointer ${
                    filtro === 'patio'
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30 shadow-sm'
                      : 'text-secondary hover:text-foreground hover:bg-white/5'
                  }`}
                >
                  PÁTIO
                </button>
              </div>

              {/* Lista com Rolagem Fluida */}
              <div className="flex-1 overflow-y-auto divide-y divide-border/20 p-3 overscroll-contain bg-[#18181b]">
                {listaFiltrada.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center text-secondary">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 border border-border mb-3">
                      <Bell className="h-6 w-6 stroke-1 opacity-50" />
                    </div>
                    <p className="text-sm font-bold uppercase text-foreground">SEM NOTIFICAÇÕES</p>
                    <p className="text-xs text-secondary/70 mt-1 max-w-[240px] normal-case">
                      Nenhum alerta pendente no momento para este filtro.
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
                        className={`flex items-start gap-3.5 p-3.5 rounded-xl transition-all cursor-pointer text-left mb-2 ${
                          !item.lida
                            ? 'bg-primary/10 border border-primary/30 shadow-sm'
                            : 'bg-[#202024] hover:bg-[#27272c] border border-border/30 opacity-85 hover:opacity-100'
                        }`}
                      >
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border mt-0.5 ${
                            item.prioridade === 'urgente'
                              ? 'bg-red-500/15 border-red-500/40'
                              : item.prioridade === 'alerta'
                                ? 'bg-amber-500/15 border-amber-500/40'
                                : 'bg-primary/15 border-primary/30'
                          }`}
                        >
                          {renderIcon(item.tipo, item.prioridade)}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <p className={`text-xs font-bold truncate uppercase ${
                              !item.lida ? 'text-white font-black' : 'text-foreground/90'
                            }`}>
                              {item.titulo}
                            </p>
                            {!item.lida && (
                              <span className="h-2 w-2 rounded-full bg-primary shrink-0 ring-2 ring-primary/30" />
                            )}
                          </div>

                          <p className="text-xs text-[#a1a1aa] leading-snug">
                            {item.mensagem}
                          </p>

                          <div className="mt-2 flex items-center justify-between text-[11px] text-[#71717a] uppercase font-medium">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {tempoAtras}
                            </span>
                            {item.link && (
                              <span className="text-primary font-bold flex items-center gap-1 hover:underline">
                                VER NO SISTEMA <ExternalLink className="h-3 w-3" />
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {/* Rodapé com Atalho para Configurações */}
              <div className="border-t border-border/40 p-3.5 bg-[#1f1f23]">
                <button
                  type="button"
                  onClick={() => {
                    navigate('/configuracoes')
                    setIsOpen(false)
                  }}
                  className="flex w-full items-center justify-center gap-2 py-2.5 text-xs font-bold text-primary hover:bg-primary/10 rounded-xl border border-primary/30 transition-all uppercase cursor-pointer"
                >
                  <Settings className="h-4 w-4" />
                  <span>CONFIGURAR REGRAS DE NOTIFICAÇÕES</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
