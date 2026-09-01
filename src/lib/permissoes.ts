import type { Usuario } from './types'

export interface SubModuloSistema {
  id: string
  label: string
  descricao: string
  rota?: string
}

export interface ModuloSistema {
  id: string
  label: string
  descricao: string
  iconeNome: string
  rotaPadrao: string
  categoria?: 'operacional' | 'gestao' | 'administrativo'
  subModulos?: SubModuloSistema[]
}

export const MODULOS_SISTEMA: ModuloSistema[] = [
  {
    id: 'dashboard_gerencial',
    label: 'Dashboard Gerencial',
    descricao: 'Visão executiva, métricas e performance da equipe',
    iconeNome: 'BarChart3',
    rotaPadrao: '/dashboard-gerencial',
    categoria: 'gestao',
    subModulos: [
      { id: 'dashboard_visao_geral', label: 'Painel Geral', descricao: 'Visão executiva e consolidação de dados', rota: '/dashboard-gerencial' },
      { id: 'dashboard_controle_horas', label: 'Indicador de Performance', descricao: 'Controle de horas e apontamentos', rota: '/controle-horas' },
    ],
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
    subModulos: [
      { id: 'caminhoes_dashboard', label: 'Dashboard do Pátio', descricao: 'Status em tempo real dos caminhões no pátio', rota: '/' },
      { id: 'caminhoes_movimentacoes', label: 'Movimentações', descricao: 'Entradas, saídas e registros de fluxo', rota: '/movimentacoes' },
    ],
  },
  {
    id: 'frotas',
    label: 'Gestão de Frotas',
    descricao: 'Controle de veículos, checklists e vencimento CRLV',
    iconeNome: 'ClipboardCheck',
    rotaPadrao: '/frotas',
    categoria: 'operacional',
    subModulos: [
      { id: 'frotas_dashboard', label: 'Dashboard Frota', descricao: 'Gráficos, status e vencimentos de documentos', rota: '/frotas' },
      { id: 'frotas_veiculos', label: 'Veículos', descricao: 'Listagem e cadastro completo de veículos', rota: '/frotas?aba=veiculos' },
      { id: 'frotas_checklist', label: 'Checklist', descricao: 'Inspeções e conferência de itens', rota: '/frotas?aba=checklist' },
    ],
  },
  {
    id: 'estoque',
    label: 'Estoque',
    descricao: 'Controle de ferramentas, caixas e consumo',
    iconeNome: 'Hammer',
    rotaPadrao: '/inventario-ferramentas',
    categoria: 'operacional',
    subModulos: [
      { id: 'estoque_ferramentas', label: 'Inventário de Ferramentas', descricao: 'Catálogo geral e inventário de ferramentas', rota: '/inventario-ferramentas' },
      { id: 'estoque_consumo', label: 'Uso e Consumo', descricao: 'Insumos, descartáveis e reposição', rota: '/inventario-ferramentas?aba=consumo' },
      { id: 'estoque_caixas', label: 'Caixas de Ferramentas', descricao: 'Kits por mecânico e caixas de ferramentas', rota: '/inventario-ferramentas?aba=caixas' },
      { id: 'estoque_em_uso', label: 'Em Uso no Momento', descricao: 'Ferramentas retiradas da oficina', rota: '/inventario-ferramentas?aba=em_uso' },
      { id: 'estoque_historico', label: 'Histórico de Retiradas', descricao: 'Log completo de retiradas e devoluções', rota: '/inventario-ferramentas?aba=historico' },
    ],
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
    descricao: 'Ajustes e cadastros gerais do sistema',
    iconeNome: 'Settings',
    rotaPadrao: '/configuracoes',
    categoria: 'administrativo',
    subModulos: [
      { id: 'config_empresas', label: 'Empresas', descricao: 'Cadastro e gestão de empresas do Grupo GVEL' },
      { id: 'config_clientes', label: 'Clientes', descricao: 'Cadastro e gerenciamento de clientes e contatos' },
      { id: 'config_frota', label: 'Frota', descricao: 'Modelos, marcas e veículos da frota' },
      { id: 'config_usuarios', label: 'Usuários & Permissões', descricao: 'Gerenciar contas, senhas e permissões de acesso' },
      { id: 'config_notificacoes', label: 'Notificações', descricao: 'Preferências de alertas e avisos sonoros' },
    ],
  },
]

// Todos os IDs incluindo sub-módulos
export const TODOS_MODULOS_IDS = MODULOS_SISTEMA.flatMap((m) => [
  m.id,
  ...(m.subModulos ? m.subModulos.map((s) => s.id) : []),
])

// Módulos padrão para novos usuários comuns
export const MODULOS_PADRAO_USUARIO = [
  'inventario_caminhoes',
  'caminhoes_dashboard',
  'caminhoes_movimentacoes',
  'manutencao',
  'frotas',
  'frotas_dashboard',
  'frotas_veiculos',
  'frotas_checklist',
  'config_notificacoes',
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
 * Único critério de "é admin" do sistema — usado tanto para liberar módulos
 * quanto para travar ações destrutivas (excluir) só para administradores.
 * As duas contas hardcoded são donos do sistema e sempre contam como admin,
 * mesmo que o campo `nivel` do cadastro não esteja marcado assim.
 *
 * `emailFallback` serve pro caso comum de telas que checam tanto o perfil
 * (tabela usuarios, pode ainda estar carregando) quanto o `user.email` da
 * sessão do Supabase Auth — ex: isAdminUsuario(perfil, user?.email).
 */
export function isAdminUsuario(usuario?: Partial<Usuario> | null, emailFallback?: string | null): boolean {
  const email = (usuario?.email || emailFallback || '').toLowerCase().trim()
  return usuario?.nivel === 'admin' || email === 'victor@gveldiesel.com' || email === 'ricardo_h.16@hotmail.com'
}

/**
 * Obtém os módulos permitidos para um usuário
 */
export function getModulosUsuario(usuario?: Partial<Usuario> | null): string[] {
  if (!usuario) return []

  const chaveEmail = (usuario.email || '').toLowerCase().trim()
  const chaveId = usuario.id || ''

  // Administrador tem acesso total a todos os módulos
  if (isAdminUsuario(usuario)) {
    return TODOS_MODULOS_IDS
  }

  // 1. Verificar se veio do objeto usuário (Supabase / perfil)
  if (Array.isArray(usuario.modulos) && usuario.modulos.length > 0) {
    return usuario.modulos
  }

  // 2. Verificar no armazenamento local sincronizado
  const locais = getPermissoesLocais()
  if (chaveEmail && locais[chaveEmail]) {
    return locais[chaveEmail]
  }
  if (chaveId && locais[chaveId]) {
    return locais[chaveId]
  }

  // 3. Fallbacks legados baseados em regras anteriores
  if (chaveEmail === 'inventario@gveldiesel.com') {
    return [
      'estoque',
      'estoque_ferramentas',
      'estoque_especiais',
      'estoque_insumos',
      'inventario_caminhoes',
      'caminhoes_dashboard',
      'caminhoes_movimentacoes',
      'frotas',
      'frotas_dashboard',
      'frotas_veiculos',
      'frotas_checklist',
      'relatorios',
      'config_notificacoes',
    ]
  }
  if (chaveEmail === 'junior@gveldiesel.com' || chaveEmail === 'mariaclara@gveldiesel.com') {
    return [
      'dashboard_gerencial',
      'dashboard_visao_geral',
      'dashboard_controle_horas',
      'manutencao',
      'inventario_caminhoes',
      'caminhoes_dashboard',
      'caminhoes_movimentacoes',
      'frotas',
      'frotas_dashboard',
      'frotas_veiculos',
      'frotas_checklist',
      'relatorios',
      'config_notificacoes',
    ]
  }

  return MODULOS_PADRAO_USUARIO
}

/**
 * Mapeia prefixos para facilitar a resolução de módulo pai e filho
 */
const PREFIXO_PAI_MAP: Record<string, string> = {
  config_: 'configuracoes',
  estoque_: 'estoque',
  frotas_: 'frotas',
  caminhoes_: 'inventario_caminhoes',
  dashboard_: 'dashboard_gerencial',
}

/**
 * Verifica se o usuário tem permissão para acessar um módulo ou sub-módulo específico
 */
export function temPermissaoModulo(
  usuario: Partial<Usuario> | null | undefined,
  moduloId: string,
): boolean {
  if (!usuario) return false
  if (isAdminUsuario(usuario)) {
    return true
  }

  const permitidos = getModulosUsuario(usuario)
  
  // Se tem o ID exato
  if (permitidos.includes(moduloId)) return true

  // Verifica se o usuário possui o módulo pai do sub-módulo
  for (const [prefixo, paiId] of Object.entries(PREFIXO_PAI_MAP)) {
    if (moduloId.startsWith(prefixo) && permitidos.includes(paiId)) {
      return true
    }
  }

  // Verifica se o usuário possui qualquer sub-módulo do módulo pai
  for (const [prefixo, paiId] of Object.entries(PREFIXO_PAI_MAP)) {
    if (moduloId === paiId && permitidos.some((p) => p.startsWith(prefixo))) {
      return true
    }
  }

  return false
}
