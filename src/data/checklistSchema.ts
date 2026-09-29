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
  /** Quantidade mínima de fotos para o item contar como respondido (padrão 1). */
  minFotos?: number
  /** Limite de fotos no item (sem limite quando ausente). */
  maxFotos?: number
  /** Texto de ajuda junto da contagem de fotos (ex.: "uma de cada pneu"). */
  dicaFotos?: string
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

// Liberação é só registro fotográfico: todo item exige foto (sem Conforme/Não conforme).
export const CHECKLIST_LIBERACAO: ChecklistSecaoDef[] = [
  {
    id: 'documentacao_seguranca',
    nome: 'Documentação e segurança',
    itens: [
      { id: 'extintor', label: 'Extintor de incêndio dentro da validade e em condições', foto: 'obrigatoria' },
      { id: 'triangulo', label: 'Triângulo de sinalização disponível', foto: 'obrigatoria' },
      { id: 'macaco_chave_roda', label: 'Macaco e chave de roda disponíveis', foto: 'obrigatoria' },
    ],
  },
  {
    id: 'externa_carroceria',
    nome: 'Parte externa / carroceria',
    itens: [
      { id: 'frente', label: 'Frente', foto: 'obrigatoria' },
      { id: 'lateral_esquerda', label: 'Lateral esquerda', foto: 'obrigatoria' },
      { id: 'lateral_direita', label: 'Lateral direita', foto: 'obrigatoria' },
      { id: 'traseira', label: 'Traseira', foto: 'obrigatoria' },
      { id: 'chassi', label: 'Chassi', foto: 'obrigatoria' },
      { id: 'para_brisa', label: 'Para-brisa', foto: 'obrigatoria' },
      { id: 'retrovisores', label: 'Retrovisores', foto: 'obrigatoria', multiplasFotos: true, minFotos: 2, maxFotos: 2 },
      {
        id: 'portas',
        label: 'Portas, fechaduras e dobradiças',
        foto: 'obrigatoria',
        multiplasFotos: true,
        minFotos: 2,
        maxFotos: 6,
      },
      {
        id: 'degraus_alcas',
        label: 'Degraus e alças de acesso',
        foto: 'obrigatoria',
        multiplasFotos: true,
        minFotos: 2,
        maxFotos: 2,
      },
    ],
  },
  {
    id: 'parte_interna',
    nome: 'Parte interna',
    itens: [
      { id: 'assoalho', label: 'Assoalho todo', foto: 'obrigatoria', multiplasFotos: true, minFotos: 4, maxFotos: 4 },
      { id: 'painel_ligado', label: 'Painel ligado', foto: 'obrigatoria' },
      { id: 'console_interno', label: 'Console interno', foto: 'obrigatoria' },
      { id: 'geladeira', label: 'Geladeira automotiva', foto: 'obrigatoria' },
      { id: 'bancos', label: 'Bancos', foto: 'obrigatoria', multiplasFotos: true, minFotos: 2, maxFotos: 2 },
    ],
  },
  {
    id: 'rodagem',
    nome: 'Rodagem',
    itens: [
      // Um item só com várias fotos: mínimo 4 (um carro); caminhão adiciona quantas precisar.
      {
        id: 'pneus',
        label: 'Pneus',
        foto: 'obrigatoria',
        multiplasFotos: true,
        minFotos: 4,
        dicaFotos: 'uma de cada pneu',
      },
    ],
  },
  {
    id: 'iluminacao_sinalizacao',
    nome: 'Iluminação e sinalização',
    itens: [
      { id: 'farol_baixo', label: 'Farol baixo', foto: 'obrigatoria' },
      { id: 'farol_alto', label: 'Farol alto', foto: 'obrigatoria' },
      {
        id: 'luzes_laterais',
        label: 'Luzes laterais',
        foto: 'obrigatoria',
        multiplasFotos: true,
        minFotos: 2,
        maxFotos: 2,
        dicaFotos: 'lado esquerdo e lado direito',
      },
      { id: 'lanternas_traseiras', label: 'Lanternas traseiras', foto: 'obrigatoria' },
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
