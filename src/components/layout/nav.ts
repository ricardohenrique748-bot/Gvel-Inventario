import {
  LayoutDashboard,
  ArrowLeftRight,
  Users,
  FileBarChart,
  Settings,
  Clock,
  Wrench,
  Truck,
  Hammer,
  BarChart3,
  DollarSign,
  UserCheck,
  ShoppingCart,
  FileText,
  Link2,
  Building2,
  Columns3,
} from 'lucide-react'

export const navItems = [
  {
    to: '/dashboard-gerencial',
    label: 'Dashboard Gerencial',
    icon: BarChart3,
    children: [
      { to: '/controle-horas', label: 'Indicador de Performance', icon: Clock },
    ],
  },
  { to: '/manutencao', label: 'Manutenção', icon: Wrench },
  { to: '/kanban', label: 'Kanban', icon: Columns3 },
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
    to: '/financeiro',
    label: 'Financeiro',
    icon: DollarSign,
    children: [
      { to: '/financeiro', label: 'Lançamentos', icon: FileText, end: true },
      { to: '/financeiro/conciliacao', label: 'Conciliação', icon: Link2 },
      { to: '/financeiro/dre', label: 'DRE', icon: BarChart3 },
      { to: '/financeiro/contas', label: 'Contas Bancárias', icon: Building2 },
    ],
  },
  { to: '/rh', label: 'RH', icon: UserCheck },
  { to: '/compras', label: 'Compras', icon: ShoppingCart },
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

export const ADMIN_ONLY_ROUTES = [
  '/controle-horas',
  '/dashboard-gerencial',
  '/kanban',
  '/financeiro',
  '/financeiro/conciliacao',
  '/financeiro/dre',
  '/financeiro/contas',
  '/rh',
  '/compras',
] as const

export const KANBAN_ALLOWED_EMAILS = [
  'victor@gveldiesel.com',
  'ricardo_h.16@hotmail.com',
] as const

export function isKanbanAuthorized(email?: string | null): boolean {
  if (!email) return false
  return KANBAN_ALLOWED_EMAILS.some((e) => e.toLowerCase() === email.toLowerCase().trim())
}
