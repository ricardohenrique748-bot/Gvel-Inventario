export type TipoVeiculo = 'pesado' | 'leve'
export type StatusMovimentacao = 'no_patio' | 'saiu'
export type StatusChecklist = 'conforme' | 'nao_conforme' | 'pendente'
export type NivelUsuario = 'admin' | 'usuario'

export interface Usuario {
  id: string
  nome: string
  email: string
  telefone: string | null
  nivel: NivelUsuario
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
  marca_id: string
  modelo_id: string
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
