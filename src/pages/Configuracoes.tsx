import { useState } from 'react'
import { PageHeader } from '@/components/layout/Header'
import { useAuth } from '@/contexts/AuthContext'
import { ClientesTab } from '@/pages/configuracoes/ClientesTab'
import { FrotaTab } from '@/pages/configuracoes/FrotaTab'
import { UsuariosTab } from '@/pages/configuracoes/UsuariosTab'
import { NotificacoesTab } from '@/pages/configuracoes/NotificacoesTab'

const TABS = [
  { id: 'clientes', label: 'Clientes' },
  { id: 'frota', label: 'Frota' },
  { id: 'usuarios', label: 'Usuários' },
  { id: 'notificacoes', label: '🔔 Notificações' },
] as const

type TabId = (typeof TABS)[number]['id']

export function Configuracoes() {
  const { perfil, perfilLoading } = useAuth()
  const isAdmin = perfil?.nivel === 'admin'
  const [tab, setTab] = useState<TabId>(isAdmin ? 'clientes' : 'notificacoes')

  if (perfilLoading) {
    return <p className="text-sm text-secondary">Carregando…</p>
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
    <div>
      <PageHeader title="Configurações" subtitle="Cadastros do sistema e notificações" />

      <div className="mb-6 flex gap-3">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={
              t.id === tab
                ? 'h-11 flex-1 rounded-xl border border-primary bg-primary/10 text-foreground font-medium sm:flex-none sm:px-6'
                : 'h-11 flex-1 rounded-xl border border-secondary/30 text-secondary sm:flex-none sm:px-6'
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'clientes' && <ClientesTab />}
      {tab === 'frota' && <FrotaTab />}
      {tab === 'usuarios' && <UsuariosTab />}
      {tab === 'notificacoes' && <NotificacoesTab />}
    </div>
  )
}
