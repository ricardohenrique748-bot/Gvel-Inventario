import { LayoutDashboard, ArrowLeftRight, Users, FileBarChart, Settings, Clock, Wrench, Truck, Hammer, BarChart3 } from 'lucide-react'

export const navItems = [
  {
    to: '/dashboard-gerencial',
    label: 'Dashboard Gerencial',
    icon: BarChart3,
    children: [
      { to: '/controle-horas', label: 'Controle de Horas', icon: Clock },
    ],
  },
  { to: '/manutencao', label: 'Manutenção', icon: Wrench },
  {
    to: '/inventario-caminhoes',
    label: 'Inventário de Caminhões',
    icon: Truck,
    children: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/movimentacoes', label: 'Movimentações', icon: ArrowLeftRight },
    ],
  },
  { to: '/inventario-ferramentas', label: 'Inventário de Ferramentas', icon: Hammer },
  {
    to: '/configuracoes',
    label: 'Configurações',
    icon: Settings,
    children: [
      { to: '/clientes', label: 'Clientes', icon: Users },
      { to: '/relatorios', label: 'Relatórios', icon: FileBarChart },
    ],
  },
] as const

export type NavItem = (typeof navItems)[number]

export const ADMIN_ONLY_ROUTES = ['/configuracoes', '/controle-horas', '/dashboard-gerencial'] as const
