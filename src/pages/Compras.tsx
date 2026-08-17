import { ShoppingCart, Construction, Clock, PackageCheck, Truck } from 'lucide-react'
import { PageHeader } from '@/components/layout/Header'
import { Card } from '@/components/ui/Card'

export function Compras() {
  return (
    <div className="space-y-6 animate-fade-in uppercase">
      {/* Cabeçalho */}
      <PageHeader
        title="COMPRAS"
        subtitle="MÓDULO EM DESENVOLVIMENTO • GESTÃO DE PEDIDOS, COTAÇÕES E FORNECEDORES"
      />

      {/* Card Principal - Em Desenvolvimento */}
      <Card className="relative overflow-hidden p-8 sm:p-12 text-center border-border/20 bg-gradient-to-b from-surface to-background shadow-2xl">
        {/* Glow decorativo */}
        <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />

        <div className="relative z-10 mx-auto max-w-lg space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-orange-500/30 bg-orange-500/10 text-orange-400 shadow-inner">
            <Construction className="h-8 w-8 animate-bounce" />
          </div>

          <div className="inline-flex items-center gap-1.5 rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-xs font-bold text-orange-400">
            <Clock className="h-3.5 w-3.5" />
            <span>MÓDULO EM CONSTRUÇÃO</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-foreground">
            MÓDULO DE COMPRAS EM BREVE
          </h2>

          <p className="text-xs sm:text-sm text-secondary font-medium leading-relaxed">
            ESTA ÁREA ESTÁ SENDO ESTRUTURADA PARA OFERECER O CONTROLE DE REQUISIÇÃO DE PEÇAS, COTAÇÕES COM FORNECEDORES, EMISSÃO DE PEDIDOS DE COMPRA E ENTRADA DE NOTAS FISCAIS PARA A OFICINA E PÁTIO.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 text-left">
            <div className="rounded-xl border border-border/10 bg-surface/80 p-3.5">
              <ShoppingCart className="h-4 w-4 text-orange-400 mb-1.5" />
              <p className="text-xs font-bold text-foreground">PEDIDOS DE COMPRA</p>
              <p className="text-[11px] text-secondary mt-0.5">REQUISIÇÃO DE PEÇAS E INSUMOS</p>
            </div>

            <div className="rounded-xl border border-border/10 bg-surface/80 p-3.5">
              <Truck className="h-4 w-4 text-blue-400 mb-1.5" />
              <p className="text-xs font-bold text-foreground">FORNECEDORES</p>
              <p className="text-[11px] text-secondary mt-0.5">CATÁLOGO E AVALIAÇÃO DE PREÇOS</p>
            </div>

            <div className="rounded-xl border border-border/10 bg-surface/80 p-3.5">
              <PackageCheck className="h-4 w-4 text-emerald-400 mb-1.5" />
              <p className="text-xs font-bold text-foreground">RECEBIMENTO</p>
              <p className="text-[11px] text-secondary mt-0.5">INTEGRAÇÃO COM ESTOQUE</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
