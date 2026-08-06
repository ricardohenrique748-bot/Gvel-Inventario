import { LayoutDashboard, ArrowLeftRight, Users, FileBarChart, Settings } from 'lucide-react'

export const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/movimentacoes', label: 'Movimentações', icon: ArrowLeftRight },
  { to: '/clientes', label: 'Clientes', icon: Users },
  { to: '/relatorios', label: 'Relatórios', icon: FileBarChart },
  { to: '/configuracoes', label: 'Configurações', icon: Settings },
] as const
