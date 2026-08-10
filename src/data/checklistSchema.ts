import type { TipoVeiculo } from '@/lib/types'

export interface ChecklistItemDef {
  id: string
  label: string
  apenasPesado?: boolean
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
