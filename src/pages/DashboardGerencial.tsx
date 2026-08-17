import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Clock,
  ArrowLeftRight,
  Truck,
  Hammer,
  Wrench,
  FileBarChart,
  Settings,
  Users,
  ShieldCheck,
  TrendingUp,
  Activity,
  Calendar,
  Sparkles,
  ArrowUpRight,
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { PageHeader } from '@/components/layout/Header'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useAuth } from '@/contexts/AuthContext'
import { useMovimentacoes } from '@/hooks/useMovimentacoes'
import { useClientes } from '@/hooks/useClientes'
import { useUsuarios } from '@/hooks/useUsuarios'

export function DashboardGerencial() {
  const { perfil, user, perfilLoading } = useAuth()
  const { movimentacoes, loading: loadingMovs } = useMovimentacoes()
  const { clientes, loading: loadingClientes } = useClientes()
  const { usuarios, loading: loadingUsuarios } = useUsuarios()

  // Saudação de acordo com o horário
  const saudacao = useMemo(() => {
    const hora = new Date().getHours()
    if (hora >= 5 && hora < 12) return 'Bom dia'
    if (hora >= 12 && hora < 18) return 'Boa tarde'
    return 'Boa noite'
  }, [])

  // Nome do usuário
  const primeiroNome = useMemo(() => {
    if (perfil?.nome) return perfil.nome.split(' ')[0]
    if (user?.email) return user.email.split('@')[0]
    return 'Gestor'
  }, [perfil?.nome, user?.email])

  // Data formatada por extenso
  const dataHoje = useMemo(() => {
    return format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })
  }, [])

  // Métricas rápidas
  const metricas = useMemo(() => {
    const noPatio = movimentacoes.filter((m) => m.status === 'no_patio').length
    const finalizadas = movimentacoes.filter((m) => m.status === 'saiu').length
    const totalClientes = clientes.length
    const totalUsuarios = usuarios.length

    return {
      noPatio,
      finalizadas,
      totalClientes,
      totalUsuarios,
      totalMovimentacoes: movimentacoes.length,
    }
  }, [movimentacoes, clientes, usuarios])

  if (perfilLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-secondary/30 border-t-primary" />
      </div>
    )
  }

  if (perfil?.nivel !== 'admin') {
    return (
      <div>
        <PageHeader title="Dashboard Gerencial" subtitle="Visão consolidada da operação" />
        <Card className="p-8 text-center">
          <ShieldCheck className="mx-auto mb-3 h-10 w-10 text-secondary" />
          <p className="text-base font-semibold text-foreground">Acesso restrito</p>
          <p className="mt-1 text-sm text-secondary">
            Apenas administradores podem acessar esta visão gerencial.
          </p>
        </Card>
      </div>
    )
  }

  const atalhos = [
    {
      to: '/controle-horas',
      title: 'Controle de Horas',
      desc: 'Apontamentos e tempo de trabalho da equipe',
      icon: Clock,
      tone: 'from-amber-500/20 to-amber-500/5 text-amber-500 border-amber-500/20',
      badge: 'Operacional',
    },
    {
      to: '/inventario-caminhoes',
      title: 'Inventário de Caminhões',
      desc: 'Status, fluxo do pátio e frota ativa',
      icon: Truck,
      tone: 'from-blue-500/20 to-blue-500/5 text-blue-500 border-blue-500/20',
      badge: `${metricas.noPatio} no pátio`,
    },
    {
      to: '/movimentacoes',
      title: 'Movimentações',
      desc: 'Entradas, saídas e inspeções de veículos',
      icon: ArrowLeftRight,
      tone: 'from-emerald-500/20 to-emerald-500/5 text-emerald-500 border-emerald-500/20',
      badge: `${metricas.totalMovimentacoes} registros`,
    },
    {
      to: '/inventario-ferramentas',
      title: 'Inventário de Ferramentas',
      desc: 'Controle de patrimônio e equipamentos',
      icon: Hammer,
      tone: 'from-purple-500/20 to-purple-500/5 text-purple-500 border-purple-500/20',
      badge: 'Estoque',
    },
    {
      to: '/manutencao',
      title: 'Manutenção',
      desc: 'Ordens de serviço e revisões preventivas',
      icon: Wrench,
      tone: 'from-red-500/20 to-red-500/5 text-red-500 border-red-500/20',
      badge: 'Serviços',
    },
    {
      to: '/relatorios',
      title: 'Relatórios & Exportações',
      desc: 'Métricas analíticas, PDFs e planilhas',
      icon: FileBarChart,
      tone: 'from-cyan-500/20 to-cyan-500/5 text-cyan-500 border-cyan-500/20',
      badge: 'Gerencial',
    },
    {
      to: '/configuracoes',
      title: 'Configurações do Sistema',
      desc: 'Gestão de usuários, clientes e parâmetros',
      icon: Settings,
      tone: 'from-zinc-500/20 to-zinc-500/5 text-zinc-400 border-zinc-500/20',
      badge: `${metricas.totalUsuarios} usuários`,
    },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Banner de Boas-Vindas */}
      <div className="relative overflow-hidden rounded-3xl border border-border/10 bg-gradient-to-br from-surface via-surface to-overlay/5 p-6 sm:p-8 shadow-2xl shadow-black/40">
        {/* Glow decorativo de fundo */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-primary/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 left-1/3 h-48 w-48 rounded-full bg-primary/10 blur-2xl" />

        <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Painel de Gestão e Controle</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {saudacao}, <span className="text-primary">{primeiroNome}</span>! 👋
            </h1>

            <p className="text-sm text-secondary max-w-xl">
              Bem-vindo ao seu painel gerencial. Acompanhe abaixo o resumo das operações, indicadores principais e acesse rapidamente todos os módulos do sistema.
            </p>

            <div className="flex items-center gap-2 pt-1 text-xs text-secondary capitalize">
              <Calendar className="h-3.5 w-3.5 text-primary" />
              <span>{dataHoje}</span>
            </div>
          </div>

          {/* Badge Perfil Admin */}
          <div className="flex items-center gap-3 self-start md:self-auto rounded-2xl border border-border/10 bg-background/60 backdrop-blur-md px-4 py-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-sm font-bold text-primary">
              {primeiroNome.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">{perfil?.nome || user?.email}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-status-success animate-pulse" />
                <span className="text-[11px] font-medium text-primary uppercase tracking-wider">
                  Administrador
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cards de Métricas Principais */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Card className="p-4 sm:p-5 transition-all hover:border-primary/40 hover:-translate-y-0.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-secondary">No Pátio</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
              <Truck className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl sm:text-3xl font-bold tabular-nums text-foreground">
            {loadingMovs ? '—' : metricas.noPatio}
          </p>
          <p className="mt-1 text-xs text-secondary">Veículos em atendimento</p>
        </Card>

        <Card className="p-4 sm:p-5 transition-all hover:border-primary/40 hover:-translate-y-0.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-secondary">Movimentações</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
              <Activity className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl sm:text-3xl font-bold tabular-nums text-foreground">
            {loadingMovs ? '—' : metricas.totalMovimentacoes}
          </p>
          <p className="mt-1 text-xs text-secondary">Registros no histórico</p>
        </Card>

        <Card className="p-4 sm:p-5 transition-all hover:border-primary/40 hover:-translate-y-0.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-secondary">Clientes</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10 text-purple-500">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl sm:text-3xl font-bold tabular-nums text-foreground">
            {loadingClientes ? '—' : metricas.totalClientes}
          </p>
          <p className="mt-1 text-xs text-secondary">Cadastrados no sistema</p>
        </Card>

        <Card className="p-4 sm:p-5 transition-all hover:border-primary/40 hover:-translate-y-0.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-secondary">Usuários</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl sm:text-3xl font-bold tabular-nums text-foreground">
            {loadingUsuarios ? '—' : metricas.totalUsuarios}
          </p>
          <p className="mt-1 text-xs text-secondary">Acessos gerenciados</p>
        </Card>
      </div>

      {/* Atalhos Rápidos para os Módulos */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold text-foreground">Módulos & Acesso Rápido</h2>
          </div>
          <span className="text-xs text-secondary">Acesse diretamente qualquer área</span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {atalhos.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/10 bg-surface p-5 transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-black/50"
            >
              <div className="flex items-start justify-between gap-3">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border bg-gradient-to-br ${item.tone}`}>
                  <item.icon className="h-5 w-5" />
                </div>
                <div className="flex items-center gap-1.5">
                  {item.badge && (
                    <Badge tone="neutral" className="text-[11px] font-normal">
                      {item.badge}
                    </Badge>
                  )}
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg text-secondary opacity-0 transition-all group-hover:opacity-100 group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                    <ArrowUpRight className="h-4 w-4" />
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                  {item.title}
                </h3>
                <p className="mt-1 text-xs text-secondary line-clamp-2">
                  {item.desc}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
