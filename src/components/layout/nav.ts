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
  Columns3,
  ClipboardCheck,
  Package,
  Boxes,
  Briefcase,
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
  { to: '/kanban', label: 'Kanban Localiza', icon: Columns3 },
  {
    to: '/inventario-caminhoes',
    label: 'Inventário de Caminhões',
    icon: Truck,
    children: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/movimentacoes', label: 'Movimentações', icon: ArrowLeftRight },
    ],
  },
  {
    to: '/frotas',
    label: 'Gestão de Frotas',
    icon: Truck,
    children: [
      { to: '/frotas', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/frotas?aba=veiculos', label: 'Veículos', icon: Truck },
      { to: '/frotas?aba=checklist', label: 'Checklist', icon: ClipboardCheck },
    ],
  },
  {
    to: '/inventario-ferramentas',
    label: 'Estoque',
    icon: Package,
    children: [
      { to: '/inventario-ferramentas', label: 'Inventário de Ferramentas', icon: Hammer, end: true },
      { to: '/inventario-ferramentas?aba=consumo', label: 'Uso e Consumo', icon: Boxes },
      { to: '/inventario-ferramentas?aba=caixas', label: 'Caixas de Ferramentas', icon: Briefcase },
      { to: '/inventario-ferramentas?aba=em_uso', label: 'Em Uso no Momento', icon: Truck },
      { to: '/inventario-ferramentas?aba=historico', label: 'Histórico de Retiradas', icon: Clock },
    ],
  },
  { to: '/financeiro', label: 'Financeiro', icon: DollarSign },
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

export const DASHBOARD_GERENCIAL_ALLOWED_EMAILS = [
  'junior@gveldiesel.com',
  'victor@gveldiesel.com',
  'ricardo_h.16@hotmail.com',
] as const

export function isDashboardGerencialAuthorized(email?: string | null): boolean {
  if (!email) return false
  return DASHBOARD_GERENCIAL_ALLOWED_EMAILS.some((e) => e.toLowerCase() === email.toLowerCase().trim())
}

export const FINANCEIRO_ALLOWED_EMAILS = [
  'victor@gveldiesel.com',
  'ricardo_h.16@hotmail.com',
] as const

export function isFinanceiroAuthorized(email?: string | null): boolean {
  if (!email) return false
  return FINANCEIRO_ALLOWED_EMAILS.some((e) => e.toLowerCase() === email.toLowerCase().trim())
}

export const RELATORIOS_ALLOWED_EMAILS = [
  'victor@gveldiesel.com',
  'ricardo_h.16@hotmail.com',
  'inventario@gveldiesel.com',
] as const

export function isRelatoriosAuthorized(email?: string | null): boolean {
  if (!email) return false
  return RELATORIOS_ALLOWED_EMAILS.some((e) => e.toLowerCase() === email.toLowerCase().trim())
}

export const ESTOQUE_APK_ALLOWED_EMAILS = [
  'inventario@gveldiesel.com',
] as const

export function isEstoqueAuthorized(email?: string | null, isNative = false): boolean {
  if (isNative) {
    if (!email) return false
    return email.toLowerCase().trim() === 'inventario@gveldiesel.com'
  }
  return true
}


