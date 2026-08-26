import { useState, useMemo, useEffect } from 'react'
import { PageHeader } from '@/components/layout/Header'
import { useAuth } from '@/contexts/AuthContext'
import { ClientesTab } from '@/pages/configuracoes/ClientesTab'
import { FrotaTab } from '@/pages/configuracoes/FrotaTab'
import { UsuariosTab } from '@/pages/configuracoes/UsuariosTab'
import { NotificacoesTab } from '@/pages/configuracoes/NotificacoesTab'
import { EmpresasTab } from '@/pages/configuracoes/EmpresasTab'
import { Users, Truck, UserCheck, Bell, Building2, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { temPermissaoModulo } from '@/lib/permissoes'

const ALL_TABS = [
  { id: 'empresas', subId: 'config_empresas', label: 'Empresas', icon: Building2 },
  { id: 'clientes', subId: 'config_clientes', label: 'Clientes', icon: Users },
  { id: 'frota', subId: 'config_frota', label: 'Frota', icon: Truck },
  { id: 'usuarios', subId: 'config_usuarios', label: 'Usuários', icon: UserCheck },
  { id: 'notificacoes', subId: 'config_notificacoes', label: 'Notificações', icon: Bell },
] as const

type TabId = (typeof ALL_TABS)[number]['id']

export function Configuracoes() {
  const { perfil, user, perfilLoading } = useAuth()
  const isAdmin = perfil?.nivel === 'admin' || user?.email === 'ricardo_h.16@hotmail.com' || user?.email === 'victor@gveldiesel.com'
  const userRef = perfil || { email: user?.email }

  // Filtra as abas autorizadas para o usuário logado
  const allowedTabs = useMemo(() => {
    if (isAdmin) return ALL_TABS
    return ALL_TABS.filter((t) => {
      if (t.id === 'usuarios') return false // Apenas administradores podem ver ou gerenciar usuários
      return temPermissaoModulo(userRef, t.subId) || temPermissaoModulo(userRef, 'configuracoes')
    })
  }, [isAdmin, userRef])

  const [tab, setTab] = useState<TabId>(() => {
    if (isAdmin) return 'empresas'
    return allowedTabs[0]?.id || 'notificacoes'
  })

  // Garante que se a aba ativa não for permitida, redireciona para a primeira permitida
  useEffect(() => {
    if (allowedTabs.length > 0 && !allowedTabs.some((t) => t.id === tab)) {
      setTab(allowedTabs[0].id)
    }
  }, [allowedTabs, tab])

  if (perfilLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-secondary font-medium uppercase">Carregando configurações…</p>
      </div>
    )
  }

  // Se o usuário não tiver permissão para nenhuma aba de configuração
  if (allowedTabs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 space-y-4 uppercase">
        <div className="h-16 w-16 rounded-2xl bg-status-danger/10 border border-status-danger/30 flex items-center justify-center text-status-danger">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <div className="space-y-1.5 max-w-md">
          <h2 className="text-xl font-black text-foreground tracking-tight">Acesso Restrito</h2>
          <p className="text-xs text-secondary leading-relaxed">
            Você não possui permissão para acessar as abas de configurações do sistema.
          </p>
        </div>
        <Button onClick={() => (window.location.href = '/')} variant="secondary" size="md" className="uppercase font-bold text-xs">
          Voltar ao Início
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Configurações" subtitle="Cadastros do sistema e preferências" />

      {/* Barra de Abas: Grid Dinâmico que se adapta à quantidade de abas liberadas */}
      {allowedTabs.length > 1 && (
        <div className="w-full">
          <div
            className="grid p-1 rounded-2xl bg-surface/90 border border-border/50 gap-1 shadow-sm"
            style={{
              gridTemplateColumns: `repeat(${allowedTabs.length}, minmax(0, 1fr))`,
            }}
          >
            {allowedTabs.map((t) => {
              const Icon = t.icon
              const isActive = t.id === tab
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 py-2 sm:py-2.5 px-1 sm:px-3 rounded-xl transition-all duration-200 cursor-pointer active:scale-95 text-center ${
                    isActive
                      ? 'bg-primary text-white shadow-md shadow-primary/25 ring-1 ring-primary/40 font-bold'
                      : 'text-secondary hover:text-foreground hover:bg-white/5 font-medium'
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-white' : 'text-secondary'}`} />
                  <span className="text-[10px] sm:text-xs uppercase tracking-tight truncate max-w-full">
                    {t.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div>
        {tab === 'empresas' && <EmpresasTab />}
        {tab === 'clientes' && <ClientesTab />}
        {tab === 'frota' && <FrotaTab />}
        {tab === 'usuarios' && <UsuariosTab />}
        {tab === 'notificacoes' && <NotificacoesTab />}
      </div>
    </div>
  )
}
