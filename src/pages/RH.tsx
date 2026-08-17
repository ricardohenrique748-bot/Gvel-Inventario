import { Construction, Clock, Users, Calendar, Award } from 'lucide-react'
import { PageHeader } from '@/components/layout/Header'
import { Card } from '@/components/ui/Card'

export function RH() {
  return (
    <div className="space-y-6 animate-fade-in uppercase">
      {/* Cabeçalho */}
      <PageHeader
        title="RECURSOS HUMANOS (RH)"
        subtitle="MÓDULO EM DESENVOLVIMENTO • GESTÃO DE EQUIPE, ESCALAS, PONTO E CARGOS"
      />

      {/* Card Principal - Em Desenvolvimento */}
      <Card className="relative overflow-hidden p-8 sm:p-12 text-center border-border/20 bg-gradient-to-b from-surface to-background shadow-2xl">
        {/* Glow decorativo */}
        <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />

        <div className="relative z-10 mx-auto max-w-lg space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-blue-500/30 bg-blue-500/10 text-blue-400 shadow-inner">
            <Construction className="h-8 w-8 animate-bounce" />
          </div>

          <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-bold text-blue-400">
            <Clock className="h-3.5 w-3.5" />
            <span>MÓDULO EM CONSTRUÇÃO</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-foreground">
            MÓDULO DE RECURSOS HUMANOS EM BREVE
          </h2>

          <p className="text-xs sm:text-sm text-secondary font-medium leading-relaxed">
            ESTA ÁREA ESTÁ SENDO ESTRUTURADA PARA REALIZAR O CONTROLE COMPLETO DO QUADRO DE COLABORADORES, ESCALAS DE TRABALHO, JORNADAS, PONTO ELETRÔNICO E DESEMPENHO DOS MECÂNICOS E OPERADORES.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 text-left">
            <div className="rounded-xl border border-border/10 bg-surface/80 p-3.5">
              <Users className="h-4 w-4 text-blue-400 mb-1.5" />
              <p className="text-xs font-bold text-foreground">QUADRO DE EQUIPE</p>
              <p className="text-[11px] text-secondary mt-0.5">CADASTRO DE CARGOS E SETORES</p>
            </div>

            <div className="rounded-xl border border-border/10 bg-surface/80 p-3.5">
              <Calendar className="h-4 w-4 text-emerald-400 mb-1.5" />
              <p className="text-xs font-bold text-foreground">ESCALAS & TURNOS</p>
              <p className="text-[11px] text-secondary mt-0.5">FÉRIAS, FOLGAS E PLANTÕES</p>
            </div>

            <div className="rounded-xl border border-border/10 bg-surface/80 p-3.5">
              <Award className="h-4 w-4 text-amber-400 mb-1.5" />
              <p className="text-xs font-bold text-foreground">PRODUTIVIDADE</p>
              <p className="text-[11px] text-secondary mt-0.5">AVALIAÇÃO DE DESEMPENHO</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
