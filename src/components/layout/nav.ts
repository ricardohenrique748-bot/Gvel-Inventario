import { LayoutDashboard, ArrowLeftRight, Users, FileBarChart, Settings, Clock } from 'lucide-react'

export const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/controle-horas', label: 'Controle de Horas', icon: Clock },
  { to: '/movimentacoes', label: 'Movimentações', icon: ArrowLeftRight },
  { to: '/clientes', label: 'Clientes', icon: Users },
  { to: '/relatorios', label: 'Relatórios', icon: FileBarChart },
  { to: '/configuracoes', label: 'Configurações', icon: Settings },
] as const

export const ADMIN_ONLY_ROUTES = ['/configuracoes', '/controle-horas'] as const
