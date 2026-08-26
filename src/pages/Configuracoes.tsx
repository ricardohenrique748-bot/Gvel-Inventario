import { useState } from 'react'
import { PageHeader } from '@/components/layout/Header'
import { useAuth } from '@/contexts/AuthContext'
import { ClientesTab } from '@/pages/configuracoes/ClientesTab'
import { FrotaTab } from '@/pages/configuracoes/FrotaTab'
import { UsuariosTab } from '@/pages/configuracoes/UsuariosTab'
import { NotificacoesTab } from '@/pages/configuracoes/NotificacoesTab'
import { EmpresasTab } from '@/pages/configuracoes/EmpresasTab'
import { Users, Truck, UserCheck, Bell, Building2 } from 'lucide-react'

const TABS = [
  { id: 'empresas', label: 'Empresas', icon: Building2 },
  { id: 'clientes', label: 'Clientes', icon: Users },
  { id: 'frota', label: 'Frota', icon: Truck },
  { id: 'usuarios', label: 'Usuários', icon: UserCheck },
  { id: 'notificacoes', label: 'Notif.', icon: Bell },
] as const

type TabId = (typeof TABS)[number]['id']

export function Configuracoes() {
  const { perfil, perfilLoading } = useAuth()
  const isAdmin = perfil?.nivel === 'admin'
  const [tab, setTab] = useState<TabId>(isAdmin ? 'empresas' : 'notificacoes')

  if (perfilLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-secondary font-medium">Carregando configurações…</p>
      </div>
    )
  }

  // Usuários comuns acessam diretamente a aba de Notificações
  if (!isAdmin) {
    return (
      <div>
        <PageHeader title="Preferências e Notificações" subtitle="Personalização de alertas e avisos sonoros" />
        <NotificacoesTab />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Configurações" subtitle="Cadastros do sistema e notificações" />

      {/* Barra de Abas: Grid de 5 Colunas */}
      <div className="w-full">
        <div className="grid grid-cols-5 p-1 rounded-2xl bg-surface/90 border border-border/50 gap-1 shadow-sm">
          {TABS.map((t) => {
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
