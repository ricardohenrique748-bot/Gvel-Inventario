import { Wrench } from 'lucide-react'
import { PageHeader } from '@/components/layout/Header'
import { Card } from '@/components/ui/Card'

export function Manutencao() {
  return (
    <div>
      <PageHeader
        title="Manutenção"
        subtitle="Registros e controle de manutenção"
      />

      <Card className="flex flex-col items-center justify-center gap-4 p-12 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <Wrench className="h-8 w-8 text-primary" />
        </div>
        <div>
          <p className="text-base font-semibold text-foreground">
            Módulo em construção
          </p>
          <p className="mt-1 text-sm text-secondary">
            Os registros de manutenção estarão disponíveis em breve.
          </p>
        </div>
      </Card>
    </div>
  )
}
