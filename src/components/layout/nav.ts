import {
  LayoutDashboard,
  ArrowLeftRight,
  Users,
  FileBarChart,
  Settings,
  Clock,
  Wrench,
  Truck,
  Car,
  Hammer,
  BarChart3,
  DollarSign,
  UserCheck,
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
      { to: '/frotas?categoria=leve', label: 'Frota Leve', icon: Car },
      { to: '/frotas?categoria=pesado', label: 'Rodocaçamba', icon: Truck },
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
] as const

import { temPermissaoModulo } from '@/lib/permissoes'
import type { Usuario } from '@/lib/types'

export function isModuloAuthorized(userOrPerfil: Partial<Usuario> | null | undefined, moduloId: string): boolean {
  if (!userOrPerfil) return false
  return temPermissaoModulo(userOrPerfil, moduloId)
}

export function isKanbanAuthorized(userOrEmail?: string | Partial<Usuario> | null): boolean {
  if (!userOrEmail) return false
  if (typeof userOrEmail === 'object') return temPermissaoModulo(userOrEmail, 'kanban')
  return temPermissaoModulo({ email: userOrEmail }, 'kanban')
}

export function isDashboardGerencialAuthorized(userOrEmail?: string | Partial<Usuario> | null): boolean {
  if (!userOrEmail) return false
  if (typeof userOrEmail === 'object') return temPermissaoModulo(userOrEmail, 'dashboard_gerencial')
  return temPermissaoModulo({ email: userOrEmail }, 'dashboard_gerencial')
}

export function isFinanceiroAuthorized(userOrEmail?: string | Partial<Usuario> | null): boolean {
  if (!userOrEmail) return false
  if (typeof userOrEmail === 'object') return temPermissaoModulo(userOrEmail, 'financeiro')
  return temPermissaoModulo({ email: userOrEmail }, 'financeiro')
}

export function isRelatoriosAuthorized(userOrEmail?: string | Partial<Usuario> | null): boolean {
  if (!userOrEmail) return false
  if (typeof userOrEmail === 'object') return temPermissaoModulo(userOrEmail, 'relatorios')
  return temPermissaoModulo({ email: userOrEmail }, 'relatorios')
}

export function isEstoqueAuthorized(userOrEmail?: string | Partial<Usuario> | null, _isNative = false): boolean {
  if (!userOrEmail) return false
  if (typeof userOrEmail === 'object') return temPermissaoModulo(userOrEmail, 'estoque')
  return temPermissaoModulo({ email: userOrEmail }, 'estoque')
}


