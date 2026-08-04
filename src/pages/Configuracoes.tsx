import { useState } from 'react'
import { PageHeader } from '@/components/layout/Header'
import { ClientesTab } from '@/pages/configuracoes/ClientesTab'
import { FrotaTab } from '@/pages/configuracoes/FrotaTab'
import { UsuariosTab } from '@/pages/configuracoes/UsuariosTab'

const TABS = [
  { id: 'clientes', label: 'Clientes' },
  { id: 'frota', label: 'Frota' },
  { id: 'usuarios', label: 'Usuários' },
] as const

type TabId = (typeof TABS)[number]['id']

export function Configuracoes() {
  const [tab, setTab] = useState<TabId>('clientes')

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
                ? 'h-11 flex-1 rounded-xl border border-primary bg-primary/10 text-white font-medium sm:flex-none sm:px-6'
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
    </div>
  )
}
