export type TipoVeiculo = 'pesado' | 'leve' | 'trator' | 'carreta'
export type StatusMovimentacao = 'no_patio' | 'saiu'
export type StatusChecklist = 'conforme' | 'nao_conforme' | 'pendente'
export type NivelUsuario = 'admin' | 'usuario'

export interface Usuario {
  id: string
  nome: string
  email: string
  telefone: string | null
  nivel: NivelUsuario
  empresa_id?: string
  modulos?: string[]
  deve_trocar_senha: boolean
  created_at: string
}

export interface Cliente {
  id: string
  nome: string
  telefone: string | null
  cnpj: string | null
  endereco: string | null
  share_token: string | null
  created_at: string
}

export interface Patio {
  id: string
  nome: string
  created_at: string
}

export interface StatusManutencao {
  id: string
  nome: string
  created_at: string
}

export interface Marca {
  id: string
  nome: string
}

export interface Modelo {
  id: string
  marca_id: string
  nome: string
}

export interface Veiculo {
  id: string
  placa: string
  marca_id: string | null
  modelo_id: string | null
  cliente_id: string
  tipo: TipoVeiculo
  cor: string | null
  ano: number | null
  chassi: string | null
  operante: boolean
  created_at: string
}

export interface VeiculoComRelacoes extends Veiculo {
  marca?: Marca
  modelo?: Modelo
  cliente?: Cliente
}

export interface Movimentacao {
  id: string
  veiculo_id: string
  patio_id: string | null
  status_id: string | null
  motorista: string | null
  destino: string | null
  data_hora_entrada: string
  data_hora_saida: string | null
  km_entrada: number | null
  km_saida: number | null
  observacoes: string | null
  status: StatusMovimentacao
  foto_frente_url: string | null
  foto_lado_esquerdo_url: string | null
  foto_lado_direito_url: string | null
  foto_traseira_url: string | null
  foto_painel_url: string | null
  usuario_entrada_id: string | null
  usuario_saida_id: string | null
  created_at: string
}

export interface MovimentacaoComVeiculo extends Movimentacao {
  veiculo: VeiculoComRelacoes
  patio?: Patio
  status_manutencao?: StatusManutencao
  usuario_entrada?: { nome: string } | null
  usuario_saida?: { nome: string } | null
}

export interface VeiculoPublicoItem {
  placa: string
  marca: string | null
  modelo: string | null
  cor: string | null
  ano: number | null
  tipo: TipoVeiculo
  chassi: string | null
  operante: boolean
  movimentacao_id: string
  patio_nome: string | null
  status: StatusMovimentacao
  status_manutencao: string | null
  motorista: string | null
  destino: string | null
  observacoes: string | null
  data_hora_entrada: string
  data_hora_saida: string | null
  foto_frente_url: string | null
  foto_lado_esquerdo_url: string | null
  foto_lado_direito_url: string | null
  foto_traseira_url: string | null
  foto_painel_url: string | null
}

export interface Inspecao {
  id: string
  veiculo_id: string
  cliente_id: string
  inspetor: string
  km: number | null
  data_hora: string
  assinatura_url: string | null
  responsavel_nome: string | null
  responsavel_cargo: string | null
  status_geral: StatusChecklist
  created_at: string
}

export interface FrotaPublicaItem {
  cliente_nome: string
  movimentacao_id: string
  veiculo_id: string
  placa: string
  marca: string | null
  modelo: string | null
  patio_nome: string | null
  status: StatusMovimentacao
  status_manutencao: string | null
  operante: boolean
  /** Apesar do nome, é a melhor foto disponível (get_frota_publica faz COALESCE entre todos os ângulos). */
  foto_frente_url: string | null
  data_hora_entrada: string
  data_hora_saida: string | null
}

export interface InspecaoItem {
  id: string
  inspecao_id: string
  secao: string
  item: string
  status: StatusChecklist
  observacao: string | null
  foto_url: string | null
}

export type StatusRetiradaFerramenta = 'em_uso' | 'devolvido' | 'avaria_perda' | 'baixa_definitiva'

export interface Ferramenta {
  id: string
  codigo: string | null
  nome: string
  categoria: string
  tipo_ferramenta?: 'comum' | 'especial'
  quantidade_total: number
  quantidade_disponivel: number
  localizacao: string | null
  observacoes: string | null
  foto_url?: string | null
  created_at: string
}

export interface FerramentaRetirada {
  id: string
  ferramenta_id: string
  veiculo_id: string | null
  placa: string
  responsavel: string
  quantidade: number
  data_hora_retirada: string
  data_hora_devolucao: string | null
  status: StatusRetiradaFerramenta
  tipo_saida?: 'temporaria' | 'definitiva'
  motivo_baixa?: string | null
  observacoes_retirada: string | null
  observacoes_devolucao: string | null
  foto_responsavel_url?: string | null
  foto_url?: string | null
  created_at: string
  ferramenta?: Ferramenta
  veiculo?: VeiculoComRelacoes
}

export interface ItemChecagem {
  id: string
  categoria: string
  nome: string
  status: 'conforme' | 'nao_conforme' | 'nao_se_aplica'
  observacao?: string
}

export interface FotosVistoria {
  painel?: string            // Foto do Painel / Hodômetro
  frente?: string            // Foto da Frente do Veículo
  ladoEsquerdo?: string      // Foto do Lado Esquerdo
  traseira?: string          // Foto da Traseira do Veículo
  ladoDireito?: string       // Foto do Lado Direito
}

export interface StatusPreventivaChecklist {
  status: 'em_dia' | 'proxima' | 'vencida' | 'sem_dados'
  kmUltima?: number
  kmLimite?: number
  kmRestante?: number
  kmRodados?: number
  mensagem: string
}

export interface RegistroChecklist {
  id: string
  veiculoId: string
  placa: string
  modeloNome?: string
  clienteNome?: string
  motoristaNome: string
  inspetorNome: string
  kmAtual: number
  resultado: 'aprovado' | 'aprovado_com_ressalvas' | 'reprovado'
  statusPreventiva?: StatusPreventivaChecklist
  itens: ItemChecagem[]
  fotos?: FotosVistoria
  observacoesGerais?: string
  dataHora: string
}

