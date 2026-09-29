import type { ModeloInspecao, TipoVeiculo } from '@/lib/types'

export interface ChecklistItemDef {
  id: string
  label: string
  apenasPesado?: boolean
  /**
   * Item de registro fotográfico: não tem status, só a foto.
   * 'obrigatoria' trava o avanço sem foto; 'opcional' ("quando aplicável") não.
   */
  foto?: 'obrigatoria' | 'opcional'
  /** Aceita várias fotos no mesmo item (ex.: uma por pneu). */
  multiplasFotos?: boolean
}

export interface ChecklistSecaoDef {
  id: string
  nome: string
  apenasPesado?: boolean
  itens: ChecklistItemDef[]
}

export const CHECKLIST_SCHEMA: ChecklistSecaoDef[] = [
  {
    id: 'documentacao',
    nome: 'Documentação',
    itens: [
      { id: 'crlv', label: 'CRLV' },
      { id: 'seguro_obrigatorio', label: 'Seguro obrigatório' },
      { id: 'licenciamento', label: 'Licenciamento' },
    ],
  },
  {
    id: 'motor_fluidos',
    nome: 'Motor e fluidos',
    itens: [
      { id: 'oleo_motor', label: 'Óleo do motor' },
      { id: 'arrefecimento', label: 'Arrefecimento' },
      { id: 'fluido_freio', label: 'Fluido de freio' },
      { id: 'vazamentos', label: 'Vazamentos' },
      { id: 'correias', label: 'Correias' },
    ],
  },
  {
    id: 'freios_suspensao',
    nome: 'Freios e suspensão',
    itens: [
      { id: 'freio_servico', label: 'Freio de serviço' },
      { id: 'freio_estacionamento', label: 'Freio de estacionamento' },
      { id: 'pastilhas_lonas', label: 'Pastilhas/lonas' },
      { id: 'amortecedores', label: 'Amortecedores' },
      { id: 'molas_feixe', label: 'Molas/feixe', apenasPesado: true },
    ],
  },
  {
    id: 'pneus_rodas',
    nome: 'Pneus e rodas',
    itens: [
      { id: 'pneus_dianteiros', label: 'Pneus dianteiros' },
      { id: 'pneus_traseiros', label: 'Pneus traseiros' },
      { id: 'estepe', label: 'Estepe' },
      { id: 'calibragem', label: 'Calibragem' },
      { id: 'rodas_parafusos', label: 'Rodas e parafusos' },
    ],
  },
  {
    id: 'iluminacao_eletrica',
    nome: 'Iluminação e elétrica',
    itens: [
      { id: 'farois', label: 'Faróis' },
      { id: 'lanternas', label: 'Lanternas' },
      { id: 'setas', label: 'Setas' },
      { id: 'luz_freio', label: 'Luz de freio' },
      { id: 'buzina', label: 'Buzina' },
      { id: 'bateria', label: 'Bateria' },
    ],
  },
  {
    id: 'cabine_seguranca',
    nome: 'Cabine e segurança',
    itens: [
      { id: 'cintos', label: 'Cintos' },
      { id: 'retrovisores', label: 'Retrovisores' },
      { id: 'limpador', label: 'Limpador' },
      { id: 'extintor', label: 'Extintor' },
      { id: 'triangulo', label: 'Triângulo' },
      { id: 'macaco_chave_roda', label: 'Macaco/chave de roda' },
      { id: 'tacografo', label: 'Tacógrafo', apenasPesado: true },
    ],
  },
  {
    id: 'estrutura',
    nome: 'Estrutura',
    apenasPesado: true,
    itens: [
      { id: 'quinta_roda', label: 'Quinta roda' },
      { id: 'engate_carreta', label: 'Engate/carreta' },
      { id: 'sistema_pneumatico', label: 'Sistema pneumático' },
      { id: 'freio_motor', label: 'Freio motor' },
    ],
  },
]

export const CHECKLIST_LIBERACAO: ChecklistSecaoDef[] = [
  {
    id: 'inspecao_mecanica',
    nome: 'Inspeção mecânica',
    itens: [
      { id: 'motor', label: 'Motor funcionando corretamente' },
      { id: 'nivel_oleo', label: 'Nível de óleo' },
      { id: 'nivel_arrefecimento', label: 'Nível do líquido de arrefecimento' },
      { id: 'vazamentos', label: 'Vazamentos' },
      { id: 'correias', label: 'Correias' },
      { id: 'mangueiras', label: 'Mangueiras' },
      { id: 'freios', label: 'Freios' },
      { id: 'suspensao', label: 'Suspensão' },
      { id: 'direcao', label: 'Direção' },
      { id: 'pneus', label: 'Pneus' },
      { id: 'rodas_porcas', label: 'Rodas / porcas' },
      { id: 'bateria', label: 'Bateria' },
      { id: 'iluminacao', label: 'Iluminação' },
    ],
  },
  {
    id: 'testes_funcionais',
    nome: 'Testes funcionais',
    itens: [
      { id: 'partida', label: 'Partida' },
      { id: 'marcha_lenta', label: 'Marcha lenta' },
      { id: 'aceleracao', label: 'Aceleração' },
      { id: 'cambio', label: 'Câmbio' },
      { id: 'freio', label: 'Freio' },
      { id: 'direcao', label: 'Direção' },
      { id: 'teste_rodagem', label: 'Teste de rodagem' },
      { id: 'ruidos_anomalias', label: 'Verificação de ruídos / anomalias' },
      { id: 'painel_sem_falhas', label: 'Painel sem falhas' },
    ],
  },
  {
    id: 'registro_fotografico',
    nome: 'Registro fotográfico',
    itens: [
      { id: 'frente', label: 'Frente do veículo', foto: 'obrigatoria' },
      { id: 'para_brisa', label: 'Para-brisa', foto: 'obrigatoria' },
      { id: 'lateral_esquerda', label: 'Lateral esquerda', foto: 'obrigatoria' },
      { id: 'lateral_direita', label: 'Lateral direita', foto: 'obrigatoria' },
      { id: 'interna_cabine', label: 'Interna da cabine', foto: 'obrigatoria' },
      { id: 'geladeira', label: 'Geladeira', foto: 'obrigatoria' },
      { id: 'painel_ligado', label: 'Painel ligado', foto: 'obrigatoria' },
      { id: 'console', label: 'Console', foto: 'obrigatoria' },
      { id: 'assoalho', label: 'Assoalho', foto: 'obrigatoria' },
      { id: 'traseira', label: 'Traseira', foto: 'obrigatoria' },
      { id: 'motor_funcionando', label: 'Veículo ligado / motor em funcionamento', foto: 'obrigatoria' },
      { id: 'chassi', label: 'Chassi', foto: 'obrigatoria' },
    ],
  },
  {
    id: 'fotos_pneus',
    nome: 'Fotos dos pneus',
    itens: [
      { id: 'dianteiro_esquerdo', label: 'Pneu dianteiro esquerdo', foto: 'obrigatoria' },
      { id: 'dianteiro_direito', label: 'Pneu dianteiro direito', foto: 'obrigatoria' },
      { id: 'traseiro_esquerdo', label: 'Pneu traseiro esquerdo', foto: 'obrigatoria' },
      { id: 'traseiro_direito', label: 'Pneu traseiro direito', foto: 'obrigatoria' },
      { id: 'demais_pneus', label: 'Demais pneus (quando aplicável)', foto: 'opcional', multiplasFotos: true },
    ],
  },
]

/** Checklist do modelo de inspeção escolhido, já filtrado pelo tipo do veículo. */
export function getChecklist(modelo: ModeloInspecao, tipo: TipoVeiculo): ChecklistSecaoDef[] {
  return modelo === 'liberacao' ? CHECKLIST_LIBERACAO : getChecklistParaTipo(tipo)
}

export function getChecklistParaTipo(tipo: TipoVeiculo): ChecklistSecaoDef[] {
  // "apenasPesado" cobre itens de veículo de carga em geral (ex.: quinta roda,
  // engate/carreta) — além de "pesado", também se aplica a trator e carreta.
  const ehPesado = tipo !== 'leve'
  return CHECKLIST_SCHEMA.filter((secao) => !secao.apenasPesado || ehPesado)
    .map((secao) => ({
      ...secao,
      itens: secao.itens.filter((item) => !item.apenasPesado || ehPesado),
    }))
}

export function contarItensChecklist(tipo: TipoVeiculo): number {
  return getChecklistParaTipo(tipo).reduce((acc, secao) => acc + secao.itens.length, 0)
}
