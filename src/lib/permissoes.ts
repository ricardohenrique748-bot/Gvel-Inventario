import type { Usuario } from './types'

export interface ModuloSistema {
  id: string
  label: string
  descricao: string
  iconeNome: string
  rotaPadrao: string
  categoria?: 'operacional' | 'gestao' | 'administrativo'
}

export const MODULOS_SISTEMA: ModuloSistema[] = [
  {
    id: 'dashboard_gerencial',
    label: 'Dashboard Gerencial',
    descricao: 'Visão executiva, métricas e performance da equipe',
    iconeNome: 'BarChart3',
    rotaPadrao: '/dashboard-gerencial',
    categoria: 'gestao',
  },
  {
    id: 'manutencao',
    label: 'Manutenção',
    descricao: 'Ordens de serviço, preventivas e revisões',
    iconeNome: 'Wrench',
    rotaPadrao: '/manutencao',
    categoria: 'operacional',
  },
  {
    id: 'inventario_caminhoes',
    label: 'Inventário de Caminhões',
    descricao: 'Pátio, status dos veículos e movimentações',
    iconeNome: 'Truck',
    rotaPadrao: '/inventario-caminhoes',
    categoria: 'operacional',
  },
  {
    id: 'frotas',
    label: 'Gestão de Frotas',
    descricao: 'Controle de veículos, checklists e vencimento CRLV',
    iconeNome: 'ClipboardCheck',
    rotaPadrao: '/frotas',
    categoria: 'operacional',
  },
  {
    id: 'estoque',
    label: 'Estoque de Ferramentas',
    descricao: 'Controle de ferramentas, caixas e consumo',
    iconeNome: 'Hammer',
    rotaPadrao: '/inventario-ferramentas',
    categoria: 'operacional',
  },
  {
    id: 'financeiro',
    label: 'Financeiro',
    descricao: 'DRE, Caixa, Conciliação e Plano de Contas',
    iconeNome: 'DollarSign',
    rotaPadrao: '/financeiro',
    categoria: 'gestao',
  },
  {
    id: 'kanban',
    label: 'Kanban Localiza',
    descricao: 'Fluxo e acompanhamento de processos em tempo real',
    iconeNome: 'Columns3',
    rotaPadrao: '/kanban',
    categoria: 'operacional',
  },
  {
    id: 'rh',
    label: 'Recursos Humanos (RH)',
    descricao: 'Quadro de equipe, mecânicos e escalas',
    iconeNome: 'UserCheck',
    rotaPadrao: '/rh',
    categoria: 'administrativo',
  },
  {
    id: 'compras',
    label: 'Compras',
    descricao: 'Cotações, pedidos e fornecedores',
    iconeNome: 'ShoppingCart',
    rotaPadrao: '/compras',
    categoria: 'administrativo',
  },
  {
    id: 'relatorios',
    label: 'Relatórios',
    descricao: 'Relatórios analíticos, exportações em PDF e Excel',
    iconeNome: 'FileBarChart',
    rotaPadrao: '/relatorios',
    categoria: 'gestao',
  },
  {
    id: 'configuracoes',
    label: 'Configurações',
    descricao: 'Gestão de empresas, clientes, usuários e notificações',
    iconeNome: 'Settings',
    rotaPadrao: '/configuracoes',
    categoria: 'administrativo',
  },
]

export const TODOS_MODULOS_IDS = MODULOS_SISTEMA.map((m) => m.id)

// Módulos padrão para novos usuários comuns
export const MODULOS_PADRAO_USUARIO = [
  'inventario_caminhoes',
  'manutencao',
  'frotas',
]

const STORAGE_PERMISSOES_KEY = 'gvel_permissoes_usuarios_v2'

/**
 * Carrega permissões armazenadas localmente
 */
export function getPermissoesLocais(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(STORAGE_PERMISSOES_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return {}
}

/**
 * Salva permissões de um usuário específico
 */
export function salvarPermissoesUsuario(emailOuId: string, modulos: string[]) {
  if (!emailOuId) return
  const chave = emailOuId.toLowerCase().trim()
  const map = getPermissoesLocais()
  map[chave] = modulos
  try {
    localStorage.setItem(STORAGE_PERMISSOES_KEY, JSON.stringify(map))
  } catch {}
}

/**
 * Obtém os módulos permitidos para um usuário
 */
export function getModulosUsuario(usuario?: Partial<Usuario> | null): string[] {
  if (!usuario) return []

  // Administrador tem acesso total a todos os módulos
  if (usuario.nivel === 'admin') {
    return TODOS_MODULOS_IDS
  }

  // 1. Verificar se veio do objeto usuário (Supabase / perfil)
  if (Array.isArray(usuario.modulos) && usuario.modulos.length > 0) {
    return usuario.modulos
  }

  // 2. Verificar no armazenamento local sincronizado
  const chaveEmail = (usuario.email || '').toLowerCase().trim()
  const chaveId = usuario.id || ''
  const locais = getPermissoesLocais()
  
  if (chaveEmail && locais[chaveEmail]) {
    return locais[chaveEmail]
  }
  if (chaveId && locais[chaveId]) {
    return locais[chaveId]
  }

  // 3. Fallbacks legados baseados em regras anteriores
  if (chaveEmail === 'inventario@gveldiesel.com') {
    return ['estoque', 'inventario_caminhoes', 'frotas', 'relatorios']
  }
  if (chaveEmail === 'victor@gveldiesel.com') {
    return TODOS_MODULOS_IDS
  }
  if (chaveEmail === 'junior@gveldiesel.com' || chaveEmail === 'mariaclara@gveldiesel.com') {
    return ['dashboard_gerencial', 'manutencao', 'inventario_caminhoes', 'frotas', 'relatorios']
  }

  return MODULOS_PADRAO_USUARIO
}

/**
 * Verifica se o usuário tem permissão para acessar um módulo específico
 */
export function temPermissaoModulo(
  usuario: Partial<Usuario> | null | undefined,
  moduloId: string,
): boolean {
  if (!usuario) return false
  if (usuario.nivel === 'admin') return true

  const permitidos = getModulosUsuario(usuario)
  return permitidos.includes(moduloId)
}
