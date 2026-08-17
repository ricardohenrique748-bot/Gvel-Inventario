import { Hammer } from 'lucide-react'
import { PageHeader } from '@/components/layout/Header'
import { Card } from '@/components/ui/Card'

export function InventarioFerramentas() {
  return (
    <div>
      <PageHeader
        title="Inventário de Ferramentas"
        subtitle="Controle e gestão do estoque de ferramentas"
      />

      <Card className="flex flex-col items-center justify-center gap-4 p-12 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <Hammer className="h-8 w-8 text-primary" />
        </div>
        <div>
          <p className="text-base font-semibold text-foreground">
            Módulo em construção
          </p>
          <p className="mt-1 text-sm text-secondary">
            O inventário de ferramentas estará disponível em breve.
          </p>
        </div>
      </Card>
    </div>
  )
}
