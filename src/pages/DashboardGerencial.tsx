import { BarChart3 } from 'lucide-react'
import { PageHeader } from '@/components/layout/Header'
import { Card } from '@/components/ui/Card'
import { useAuth } from '@/contexts/AuthContext'

export function DashboardGerencial() {
  const { perfil, perfilLoading } = useAuth()

  if (perfilLoading) {
    return <p className="text-sm text-secondary">Carregando…</p>
  }

  if (perfil?.nivel !== 'admin') {
    return (
      <div>
        <PageHeader title="Dashboard Gerencial" subtitle="Visão consolidada da operação" />
        <Card className="p-6 text-center">
          <p className="text-sm text-secondary">Apenas administradores podem acessar esta página.</p>
        </Card>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Dashboard Gerencial"
        subtitle="Visão consolidada da operação"
      />

      <Card className="flex flex-col items-center justify-center gap-4 p-12 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <BarChart3 className="h-8 w-8 text-primary" />
        </div>
        <div>
          <p className="text-base font-semibold text-foreground">
            Módulo em construção
          </p>
          <p className="mt-1 text-sm text-secondary">
            O Dashboard Gerencial estará disponível em breve.
          </p>
        </div>
      </Card>
    </div>
  )
}
