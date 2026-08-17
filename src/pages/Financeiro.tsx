import { DollarSign, Construction, Clock, ShieldCheck, Layers } from 'lucide-react'
import { PageHeader } from '@/components/layout/Header'
import { Card } from '@/components/ui/Card'

export function Financeiro() {
  return (
    <div className="space-y-6 animate-fade-in uppercase">
      {/* Cabeçalho */}
      <PageHeader
        title="FINANCEIRO"
        subtitle="MÓDULO EM DESENVOLVIMENTO • GESTÃO DE FLUXO DE CAIXA, FATURAMENTO E CONTAS"
      />

      {/* Card Principal - Em Desenvolvimento */}
      <Card className="relative overflow-hidden p-8 sm:p-12 text-center border-border/20 bg-gradient-to-b from-surface to-background shadow-2xl">
        {/* Glow decorativo */}
        <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />

        <div className="relative z-10 mx-auto max-w-lg space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-400 shadow-inner">
            <Construction className="h-8 w-8 animate-bounce" />
          </div>

          <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-400">
            <Clock className="h-3.5 w-3.5" />
            <span>MÓDULO EM CONSTRUÇÃO</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-foreground">
            MÓDULO FINANCEIRO EM BREVE
          </h2>

          <p className="text-xs sm:text-sm text-secondary font-medium leading-relaxed">
            ESTA ÁREA ESTÁ SENDO ESTRUTURADA PARA OFERECER O CONTROLE COMPLETO DE FATURAMENTO DAS ORDENS DE SERVIÇO, RECEITAS, DESPESAS DA OFICINA, FLUXO DE CAIXA E EMISSÃO DE RELATÓRIOS CONSOLIDADOS.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 text-left">
            <div className="rounded-xl border border-border/10 bg-surface/80 p-3.5">
              <DollarSign className="h-4 w-4 text-emerald-400 mb-1.5" />
              <p className="text-xs font-bold text-foreground">FLUXO DE CAIXA</p>
              <p className="text-[11px] text-secondary mt-0.5">RECEITAS E DESPESAS OPERACIONAIS</p>
            </div>

            <div className="rounded-xl border border-border/10 bg-surface/80 p-3.5">
              <Layers className="h-4 w-4 text-cyan-400 mb-1.5" />
              <p className="text-xs font-bold text-foreground">FATURAMENTO DE O.S.</p>
              <p className="text-[11px] text-secondary mt-0.5">INTEGRAÇÃO COM MANUTENÇÃO</p>
            </div>

            <div className="rounded-xl border border-border/10 bg-surface/80 p-3.5">
              <ShieldCheck className="h-4 w-4 text-purple-400 mb-1.5" />
              <p className="text-xs font-bold text-foreground">CONTROLE GERENCIAL</p>
              <p className="text-[11px] text-secondary mt-0.5">EXPORTAÇÃO DRE E BALANCETES</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
