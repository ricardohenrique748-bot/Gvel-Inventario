import { useState } from 'react'
import { PageHeader } from '@/components/layout/Header'
import { Card } from '@/components/ui/Card'
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
  const [tab, setTab] = useState<TabId>('clientes')
  const { perfil, perfilLoading } = useAuth()

  if (perfilLoading) {
    return <p className="text-sm text-secondary">Carregando…</p>
  }

  if (perfil?.nivel !== 'admin') {
    return (
      <div>
        <PageHeader title="Configurações" subtitle="Cadastros do sistema" />
        <Card className="p-6 text-center">
          <p className="text-sm text-secondary">Apenas administradores podem acessar as configurações.</p>
        </Card>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Configurações" subtitle="Cadastros do sistema" />

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
