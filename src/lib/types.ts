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
  /** @deprecated Substituído por `company_id` (FK real para `companies`). */
  empresa_id?: string
  company_id: string
  is_master_admin: boolean
  modulos?: string[]
  foto_url?: string | null
  deve_trocar_senha: boolean
  created_at: string
}

export type CompanyStatus = 'active' | 'inactive'

export interface Company {
  id: string
  name: string
  cnpj: string | null
  logo: string | null
  sistema_label: string
  primary_color: string
  secondary_color: string | null
  observacoes: string | null
  status: CompanyStatus
  /** `null` = sem restrição, todos os módulos liberados (padrão). Preenchido = só esses módulos aparecem no menu da empresa. */
  modulos_habilitados: string[] | null
  /** Mostra os campos extras (cliente, veículo, vencimento, forma/status de pagamento) no lançamento do Fluxo de Caixa. */
  financeiro_campos_estendidos: boolean
  created_at: string
  updated_at: string
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
  tipo_ferramenta?: 'comum' | 'especial' | 'estoque'
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

export interface ItemConsumo {
  id: string
  codigo: string | null
  nome: string
  categoria: string
  unidade: string
  quantidade_atual: number
  quantidade_minima: number
  /** Capacidade cheia (ex: 200 para um tambor de 200L). Se preenchida, o
   * item vira um "barril" e mostra o indicador visual de nível de líquido
   * em vez da foto genérica. */
  capacidade_maxima?: number | null
  /** Formato do recipiente desenhado quando capacidade_maxima está
   * preenchida. 'barril' = tambor de óleo (padrão), 'cilindro_gas' = botijão
   * de gás refrigerante (ex: R-134a). */
  tipo_recipiente?: 'barril' | 'cilindro_gas' | null
  /** Quantidade de tambores no estoque (o barril desenhado mostra sempre
   * o nível do tambor em uso — isso é só informativo, não entra no %). */
  quantidade_tambores?: number | null
  /** Número do tambor em uso no momento (estampado no desenho, ex: "GV 2").
   * Sobe sozinho quando um tambor zera e entra reposição de um novo. */
  numero_tambor_atual?: number | null
  localizacao: string | null
  observacoes: string | null
  foto_url: string | null
  created_at: string
}

export interface RegistroBaixaConsumo {
  id: string
  item_id: string
  item_nome: string
  unidade: string
  quantidade: number
  responsavel: string
  foto_responsavel_url?: string | null
  placa?: string | null
  motivo?: string | null
  /** Número do tambor (ex: 6 = "GV 6") que estava em uso no item no momento
   * desta baixa — só preenchido para insumos tipo barril. */
  numero_tambor?: number | null
  /** Quantidade que sobrou no tambor logo após esta baixa (já considera a
   * abertura de um tambor novo se este esvaziou o atual). */
  quantidade_restante?: number | null
  data_hora: string
}

export interface RegistroEntradaConsumo {
  id: string
  item_id: string | null
  item_nome: string
  unidade: string
  quantidade: number
  /** 'quantidade' = somou no item; 'tambor' = entrou um tambor cheio na reserva. */
  tipo: 'quantidade' | 'tambor'
  numero_nf?: string | null
  nf_url?: string | null
  nf_nome?: string | null
  responsavel?: string | null
  data_hora: string
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
  /** Só usado por placas que exigem checklist de ida E de volta (ex: veículos emprestados/rotativos). */
  tipoChecklist?: 'ida' | 'volta'
}

export type StatusViagem = 'cotada' | 'confirmada' | 'em_transito' | 'entregue' | 'cancelada'
export type FormaCalculoFrete = 'valor_fixo' | 'por_km' | 'por_tonelada' | 'por_m3'
export type TipoFrete = 'CIF' | 'FOB'

export interface CentroCusto {
  id: string
  nome: string
}

export interface Transportadora {
  id: string
  nome: string
}

export interface TipoCarga {
  id: string
  nome: string
}

export interface Pessoa {
  id: string
  nome: string
}

export interface FormaPagamento {
  id: string
  nome: string
}

export interface TipoLancamento {
  id: string
  nome: string
}

export interface EnderecoFrequente {
  id: string
  apelido: string
  endereco: string
  cidade: string
  uf: string
}

export interface VeiculoCarregado {
  veiculoId: string
  placa: string
}

export interface RegistroViagem {
  id: string
  // Participantes
  clienteId?: string
  clienteNome?: string
  veiculoId?: string
  placa: string
  veiculoNome?: string
  motoristaNome: string
  centroCustoId?: string
  centroCustoNome?: string
  transportadoraId?: string
  transportadoraNome?: string
  // Rota de transporte
  origem: string
  destino: string
  enderecoOrigem?: string
  cidadeOrigem?: string
  ufOrigem?: string
  dataColetaPrevista?: string // YYYY-MM-DD
  enderecoDestino?: string
  cidadeDestino?: string
  ufDestino?: string
  dataEntregaPrevista?: string // YYYY-MM-DD
  distanciaEstimadaKm?: number
  tempoEstimadoHoras?: number
  // Detalhes da carga
  tipoCargaId?: string
  tipoCargaNome?: string
  veiculosCarregados?: VeiculoCarregado[]
  pesoCargaToneladas?: number
  volumeM3?: number
  // Detalhes financeiros
  formaCalculoFrete?: FormaCalculoFrete
  freteBruto?: number
  despesasAbater?: number
  adiantamento?: number
  tipoFrete?: TipoFrete
  percentualImposto?: number
  pessoaImposto?: string
  percentualComissao?: number
  pessoaComissao?: string
  custoOperacional?: number
  // Legado (viagens registradas antes da tela de frete completa)
  dataHoraSaida: string
  dataHoraChegada?: string
  kmSaida?: number
  kmChegada?: number
  // Status e fechamento
  status: StatusViagem
  finalidade?: string
  observacoes?: string
  createdAt: string
}

/** Livre — cada empresa usa os status que fizer sentido (Pago, Pendente, Cancelado, Isento, etc). */
export type StatusPagamentoLancamento = string

export interface LancamentoFluxoCaixa {
  id: string
  data: string
  movimentacao: 'entrada' | 'saida'
  descricao: string
  valor: number
  observacao?: string
  usuarioNome?: string
  createdAt: string
  /** Campos estendidos (ver companies.financeiro_campos_estendidos) — opcionais, nem toda empresa usa. */
  clienteId?: string
  clienteNome?: string
  veiculoId?: string
  veiculoPlaca?: string
  quantidadeVeiculos?: number
  dataVencimento?: string
  formaPagamento?: string
  statusPagamento?: StatusPagamentoLancamento
}

export interface Fornecedor {
  id: string
  nome: string
}

export type TipoMovimentacaoConta = 'despesa' | 'receita'
export type StatusContaPagarReceber = 'pendente' | 'pago' | 'atrasado' | 'cancelado'

export interface ContaPagarReceber {
  id: string
  descricao?: string
  centroCustoId: string
  centroCustoNome?: string
  tipoMovimentacao: TipoMovimentacaoConta
  tipoLancamentoId: string
  tipoLancamentoNome?: string
  valor: number
  dataLancamento: string // YYYY-MM-DD
  dataVencimento: string // YYYY-MM-DD
  status: StatusContaPagarReceber
  veiculoId?: string
  placa?: string
  fornecedorId?: string
  fornecedorNome?: string
  contaBancariaId?: string
  contaBancariaNome?: string
  observacoes?: string
  numeroParcelas?: number
  createdAt: string
}

export interface VeiculoCliente {
  id: string
  clienteId: string
  clienteNome?: string
  placa: string
  modelo?: string
  marca?: string
  cor?: string
}

export type StatusEstadiaPatio = 'no_patio' | 'finalizado'

export interface EstadiaPatio {
  id: string
  clienteId: string
  clienteNome?: string
  veiculoClienteId?: string
  placa: string
  modelo?: string
  marca?: string
  cor?: string
  dataHoraEntrada: string
  previsaoSaida?: string
  dataHoraSaidaReal?: string
  valorDiaria: number
  centroCustoId: string
  centroCustoNome?: string
  observacoes?: string
  createdAt: string
}

export type TipoOrdemServico = 'preventiva' | 'corretiva'
export type StatusOrdemServico = 'solicitada' | 'em_andamento' | 'aguardando_peca' | 'concluida' | 'cancelada'
export type PrioridadeOrdemServico = 'baixa' | 'normal' | 'alta' | 'critica'

export interface OrdemServico {
  id: string
  veiculoId: string
  placa: string
  veiculoNome?: string
  centroCustoId: string
  centroCustoNome?: string
  tipo: TipoOrdemServico
  status: StatusOrdemServico
  prioridade: PrioridadeOrdemServico
  dataEntrada?: string // YYYY-MM-DD
  dataConclusao?: string // YYYY-MM-DD
  descricaoServico: string
  oficina: string
  kmEntrada?: number
  valor: number
  fornecedorId?: string
  fornecedorNome?: string
  observacoes?: string
  createdAt: string
}

export type OrigemAbastecimento = 'manual' | 'despesa_viagem'

export interface Abastecimento {
  id: string
  veiculoId: string
  placa: string
  veiculoNome?: string
  centroCustoId: string
  centroCustoNome?: string
  combustivel: string
  dataHora: string
  odometro?: number
  horasMotor?: number
  postoFornecedor: string
  volume: number
  valorUnitario?: number
  valorTotal: number
  origem: OrigemAbastecimento
  aprovado: boolean
  observacoes?: string
  createdAt: string
}

export type OrigemLeituraOdometro = 'manual' | 'abastecimento'

export interface LeituraOdometro {
  id: string
  veiculoId: string
  placa: string
  dataLeitura: string
  quilometragem: number
  horasMotor?: number
  origem: OrigemLeituraOdometro
  validada: boolean
  justificativa?: string
  createdAt: string
}

export interface LoteImportacaoExtrato {
  id: string
  nomeArquivo: string
  banco?: string
  contaBancariaId?: string
  contaBancariaNome?: string
  dataInicio?: string
  dataFim?: string
  totalTransacoes: number
  createdAt: string
}

export type StatusTransacaoExtrato = 'pendente' | 'conciliada' | 'divergente' | 'ignorada'

export interface TransacaoExtrato {
  id: string
  loteId: string
  fitid: string
  data: string
  descricao: string
  valor: number
  tipo?: string
  status: StatusTransacaoExtrato
  contaPagarReceberId?: string
  contaPagarReceberDescricao?: string
  createdAt: string
}

