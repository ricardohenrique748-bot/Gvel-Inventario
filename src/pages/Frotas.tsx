import { useMemo, useState, useRef, useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Truck,
  Plus,
  Search,
  Pencil,
  Trash2,
  Building2,
  X,
  Clock,
  FileX,
  AlertOctagon,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Gauge,
  User,
  ShieldCheck,
  Eye,
  Camera,
  Disc,
  Users,
  AlertTriangle,
  Car,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Construction,
  Banknote,
  Route,
  EyeOff,
  Filter,
  RotateCcw,
  Printer,
  ArrowUpDown,
  MapPin,
  Package,
  Check,
  Award,
  Layers,
  CreditCard,
  Tag,
  Landmark,
  DollarSign,
  FileBarChart,
  UserCheck,
  Building,
  ExternalLink,
  ChevronDown,
  Warehouse,
  Wrench,
  Link2,
  Download,
  LogOut,
  History,
} from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  LabelList,
} from 'recharts'
import { differenceInDays, parseISO, isBefore, startOfDay, format } from 'date-fns'
import { PageHeader } from '@/components/layout/Header'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input, Label, FieldError, Select, Textarea } from '@/components/ui/Input'
import { QuickCreateSelect } from '@/components/QuickCreateSelect'
import { TipoVeiculoRadioGroup } from '@/components/TipoVeiculoRadioGroup'
import { useClientes, criarCliente } from '@/hooks/useClientes'
import {
  useMarcas,
  useModelos,
  criarMarca,
  criarModelo,
  atualizarMarca,
  excluirMarca,
  atualizarModelo,
  excluirModelo,
} from '@/hooks/useMarcasModelos'
import { useContas, type ContaBancaria } from '@/hooks/useContas'
import { useMovimentacoes } from '@/hooks/useMovimentacoes'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { isAdminUsuario } from '@/lib/permissoes'
import { tipoVeiculoLabel } from '@/lib/tipoVeiculo'
import { isNativeApp } from '@/lib/isNativeApp'
import { getErrorMessage } from '@/lib/erros'
import { exportRowsToCsv } from '@/lib/csv'
import { SETORES_FROTA_LEVE, FROTA_LEVE_OFICIAL, FROTA_PESADA_OFICIAL, FROTA_EMBARCADO_OFICIAL } from '@/data/veiculosFrotaPadrao'
import { STORAGE_FROTAS_KEY } from '@/lib/frotasStorage'
import type {
  FotosVistoria,
  StatusPreventivaChecklist,
  RegistroChecklist,
  RegistroViagem,
  StatusViagem,
  VeiculoCarregado,
  FormaCalculoFrete,
  TipoFrete,
  Cliente,
  CentroCusto,
  Transportadora,
  TipoCarga,
  EnderecoFrequente,
  ContaPagarReceber,
  StatusContaPagarReceber,
  TipoMovimentacaoConta,
  EstadiaPatio,
} from '@/lib/types'
import {
  useChecklistsFrota,
  criarChecklistFrota,
  excluirChecklistFrota,
} from '@/hooks/useChecklistsFrota'
import {
  useCentrosCusto,
  useTransportadoras,
  useTiposCarga,
  useEnderecosFrequentes,
  criarCentroCusto,
  atualizarCentroCusto,
  excluirCentroCusto,
  criarTransportadora,
  criarTipoCarga,
  atualizarTipoCarga,
  excluirTipoCarga,
  criarEnderecoFrequente,
  atualizarEnderecoFrequente,
  excluirEnderecoFrequente,
  usePessoas,
  criarPessoa,
  atualizarPessoa,
  excluirPessoa,
  useFormasPagamento,
  criarFormaPagamento,
  atualizarFormaPagamento,
  excluirFormaPagamento,
  useTiposLancamento,
  criarTipoLancamento,
  atualizarTipoLancamento,
  excluirTipoLancamento,
  useFornecedores,
  criarFornecedor,
} from '@/hooks/useCadastrosViagem'
import {
  useViagensFrota,
  criarViagemFrota,
  atualizarViagemFrota,
  excluirViagemFrota,
  type SalvarViagemInput,
} from '@/hooks/useViagensFrota'
import {
  useContasPagarReceber,
  criarContaPagarReceber,
  atualizarContaPagarReceber,
  excluirContaPagarReceber,
  type SalvarContaPagarReceberInput,
} from '@/hooks/useContasPagarReceber'
import {
  useVeiculosClientes,
  criarVeiculoCliente,
  usePatioEstadias,
  criarEstadiaPatio,
  atualizarEstadiaPatio,
  finalizarEstadiaPatio,
  excluirEstadiaPatio,
  type SalvarEstadiaPatioInput,
} from '@/hooks/usePatio'
import { ManutencaoViagens } from '@/pages/frotas/ManutencaoViagens'
import { ConciliacaoViagens } from '@/pages/frotas/ConciliacaoViagens'
import { formatarNomeSobrenome } from '@/constants/equipe'

export function isFrotaEmbarcado(v: { placa?: string; tipo?: string }): boolean {
  const placa = (v.placa || '').toUpperCase().trim()
  if (FROTA_EMBARCADO_OFICIAL.some((fe) => fe.placa.toUpperCase().trim() === placa)) return true
  return v.tipo === 'embarcado'
}

export function isFrotaLeve(v: {
  placa?: string
  tipo?: string
  tipoVeiculo?: string
  modeloNome?: string
  marcaNome?: string
  categoria?: string
  setor?: string
  responsavel?: string
}): boolean {
  const placa = (v.placa || '').toUpperCase().trim()

  // Se estiver na lista oficial de veículos embarcados (munck, plataformas), NUNCA é leve
  if (isFrotaEmbarcado(v)) return false

  // Se estiver na lista oficial da frota pesada (Rodocaçamba), é PESADO
  if (FROTA_PESADA_OFICIAL.some((fp) => fp.placa.toUpperCase().trim() === placa)) {
    return false
  }

  // Se estiver na lista oficial da frota leve, é LEVE
  if (FROTA_LEVE_OFICIAL.some((fl) => fl.placa.toUpperCase().trim() === placa)) {
    return true
  }

  if (v.tipo === 'pesado' || v.tipo === 'trator' || v.tipo === 'carreta' || v.tipo === 'embarcado') return false
  if (v.tipo === 'leve') return true

  const tipoV = (v.tipoVeiculo || '').toUpperCase()
  if (['CARRO', 'MOTO', 'CAMINHONETE', 'UTILITÁRIO', 'UTILITARIO', 'PASSAGEIRO', 'MOTOCICLETA'].includes(tipoV)) {
    return true
  }

  const mod = (v.modeloNome || '').toUpperCase()
  const cat = (v.categoria || '').toUpperCase()
  const marca = (v.marcaNome || '').toUpperCase()

  // Modelos de Frota Leve
  if (
    mod.includes('GOL') ||
    mod.includes('ONIX') ||
    mod.includes('STRADA') ||
    mod.includes('TORO') ||
    mod.includes('HILUX') ||
    mod.includes('SAVEIRO') ||
    mod.includes('MOBI') ||
    mod.includes('COROLLA') ||
    mod.includes('S10') ||
    mod.includes('S-10') ||
    mod.includes('AMAROK') ||
    mod.includes('RANGER') ||
    mod.includes('L200') ||
    mod.includes('FIORINO') ||
    mod.includes('KANGOO') ||
    mod.includes('DOBLO') ||
    mod.includes('PARTNER') ||
    mod.includes('HB20') ||
    mod.includes('ARGO') ||
    mod.includes('POLO') ||
    mod.includes('VOYAGE') ||
    mod.includes('PRISMA') ||
    mod.includes('CRONOS') ||
    mod.includes('YARIS') ||
    mod.includes('CIVIC') ||
    mod.includes('FIT') ||
    mod.includes('CITY') ||
    mod.includes('RENEGADE') ||
    mod.includes('COMPASS') ||
    mod.includes('DUSTER') ||
    mod.includes('KWID') ||
    mod.includes('ECOSPORT') ||
    mod.includes('TRACKER') ||
    mod.includes('CRETA') ||
    mod.includes('HR-V') ||
    mod.includes('KICKS') ||
    mod.includes('CG') ||
    mod.includes('TITAN') ||
    mod.includes('FAN') ||
    mod.includes('BROS') ||
    mod.includes('XRE') ||
    mod.includes('BIZ') ||
    mod.includes('POP') ||
    mod.includes('FAZER') ||
    mod.includes('FACTOR') ||
    mod.includes('CROSSER') ||
    mod.includes('LANDER') ||
    mod.includes('NXR') ||
    mod.includes('CB') ||
    mod.includes('YBR')
  ) {
    return true
  }

  // Marcas de motos
  if (marca.includes('HONDA') || marca.includes('YAMAHA') || marca.includes('SUZUKI') || marca.includes('SHINERAY')) {
    return true
  }

  // Categorias leves
  if (
    cat.includes('PASSEIO') ||
    cat.includes('MOTOCICLETA') ||
    cat.includes('CICLOMOTOR') ||
    cat.includes('MOTONETA') ||
    cat.includes('CAMINHONETE') ||
    cat.includes('UTILITARIO') ||
    cat.includes('UTILITÁRIO') ||
    cat.includes('PARTICULAR')
  ) {
    return true
  }

  return false
}

const anoAtual = new Date().getFullYear()

// ==================== SCHEMAS E TIPOS ====================

const schemaVeiculo = z.object({
  clienteId: z.string().min(1, 'Selecione o cliente').refine((val) => val !== 'todos', 'Selecione um cliente para o veículo'),
  placa: z.string().trim().min(7, 'Placa inválida').max(8, 'Placa inválida'),
  tipo: z.enum(['pesado', 'leve', 'trator', 'carreta', 'embarcado']),
  tipoVeiculo: z.string().optional(),
  cor: z.string().trim().min(1, 'Informe a cor'),
  setor: z.string().trim().optional(),
  responsavel: z.string().trim().optional(),
  chassi: z.string().trim().optional(),
  situacao: z.enum(['operante', 'inoperante']),
  ano: z
    .number({ message: 'Informe o ano' })
    .int('Ano inválido')
    .min(1950, 'Ano inválido')
    .max(anoAtual + 1, 'Ano inválido'),
  marcaId: z.string().min(1, 'Selecione a marca'),
  modeloId: z.string().min(1, 'Selecione o modelo'),
  vencimentoDocumento: z.string().optional(),
  vencimentoSeguro: z.string().optional(),
  numeroTacografo: z.string().optional(),
  emissaoTacografo: z.string().optional(),
  vencimentoTacografo: z.string().optional(),
  dataUltimaPreventiva: z.string().optional(),
  kmUltimaPreventiva: z.number().optional(),
  intervaloPreventivaKm: z.number().optional(),
  observacoes: z.string().optional(),
})

type FormVeiculoValues = z.infer<typeof schemaVeiculo>

export interface ItemFrotaCadastrada {
  id: string
  placa: string
  tipo: 'pesado' | 'leve' | 'trator' | 'carreta' | 'embarcado'
  tipoVeiculo?: 'CARRO' | 'MOTO' | 'CAMINHONETE' | 'UTILITÁRIO' | string
  marcaNome?: string
  modeloNome?: string
  clienteNome?: string
  clienteId?: string
  ano?: number
  cor?: string
  setor?: string
  responsavel?: string
  chassi?: string
  renavam?: string
  categoria?: string
  situacao: 'operante' | 'inoperante'
  vencimentoDocumento?: string // YYYY-MM-DD (Licenciamento CRLV)
  crlvPago?: boolean // Marcado manualmente quando o CRLV já foi pago, mas o sistema ainda mostra vencido/a vencer (a data nova ainda não foi atualizada)
  vencimentoSeguro?: string // YYYY-MM-DD (Seguro da Frota / Apólice)
  seguroOk?: boolean // Marcado manualmente quando ainda não há data de vencimento cadastrada, mas o seguro já está regularizado
  numeroTacografo?: string // Número do Certificado / Selo do Tacógrafo
  emissaoTacografo?: string // Data de Emissão / Ensaio do Tacógrafo
  vencimentoTacografo?: string // Data de Vencimento do Tacógrafo
  dataUltimaPreventiva?: string // Data da última preventiva
  kmUltimaPreventiva?: number // KM registrado na última preventiva
  intervaloPreventivaKm?: number // A cada quantos KM faz preventiva (ex: 10000)
  vencimentoPreventiva?: string // compatibilidade anterior
  kmProximaPreventiva?: number // compatibilidade anterior
  observacoes?: string
  createdAt: string
}

// Placas que precisam de um checklist na saída (IDA) e outro na devolução
// (VOLTA) do veículo, em vez de um único checklist por uso.
const PLACAS_CHECKLIST_IDA_VOLTA = ['IXF4J63', 'QXS9G97']

function precisaChecklistIdaVolta(placa: string): boolean {
  return PLACAS_CHECKLIST_IDA_VOLTA.includes(placa.toUpperCase().trim())
}

type OrdenacaoViagemCampo = 'id' | 'dataColeta' | 'dataEntrega' | 'frete' | 'adiantamento' | 'saldo'

const LABEL_TIPO_FROTA: Record<ItemFrotaCadastrada['tipo'], string> = {
  leve: 'FROTA LEVE',
  pesado: 'RODOCAÇAMBA',
  trator: 'TRATOR',
  carreta: 'CARRETA',
  embarcado: 'EMBARCADO',
}

function ThOrdenavelViagem({
  label,
  campo,
  ordenacao,
  onClick,
}: {
  label: string
  campo: OrdenacaoViagemCampo
  ordenacao: { campo: OrdenacaoViagemCampo; direcao: 'asc' | 'desc' }
  onClick: (campo: OrdenacaoViagemCampo) => void
}) {
  const ativo = ordenacao.campo === campo
  return (
    <th className="px-4 py-3.5">
      <button
        type="button"
        onClick={() => onClick(campo)}
        className={`flex items-center gap-1 hover:text-foreground transition-colors ${ativo ? 'text-foreground' : ''}`}
      >
        {label}
        <ArrowUpDown className={`h-3 w-3 ${ativo ? 'text-primary' : 'text-secondary/50'}`} />
      </button>
    </th>
  )
}

type SubAbaViagens =
  | 'viagens'
  | 'enderecos'
  | 'centros_custo'
  | 'tipos_carga'
  | 'marcas'
  | 'modelos'
  | 'pessoas'
  | 'formas_pagamento'
  | 'tipos_lancamento'
  | 'contas_bancarias'
  | 'contas_pagar_receber'
  | 'financeiro_viagens'
  | 'patio'
  | 'manutencao'
  | 'conciliacao'

type ItemMenuViagens =
  | { kind: 'tab'; id: SubAbaViagens; label: string; icon: React.ComponentType<{ className?: string }> }
  | { kind: 'link'; to: string; label: string; icon: React.ComponentType<{ className?: string }> }

// Sub-menu do Controle de Viagens, agrupado nas mesmas categorias do menu de
// referência (Operação / Gestão / Cadastro / Configurações) — alguns itens
// são abas próprias desta tela, outros são atalhos pra módulos que já
// existem em outro lugar do sistema (marcados com o ícone de link externo).
const GRUPOS_MENU_VIAGENS: { titulo: string; itens: ItemMenuViagens[] }[] = [
  {
    titulo: 'Operação',
    itens: [
      { kind: 'tab', id: 'viagens', label: 'VIAGENS', icon: Route },
      { kind: 'tab', id: 'financeiro_viagens', label: 'FINANCEIRO', icon: DollarSign },
      { kind: 'tab', id: 'patio', label: 'PÁTIO', icon: Warehouse },
      { kind: 'tab', id: 'manutencao', label: 'MANUTENÇÃO', icon: Wrench },
    ],
  },
  {
    titulo: 'Gestão',
    itens: [
      { kind: 'link', to: '/relatorios', label: 'RELATÓRIOS', icon: FileBarChart },
      { kind: 'tab', id: 'contas_bancarias', label: 'CONTAS BANCÁRIAS', icon: Landmark },
      { kind: 'tab', id: 'contas_pagar_receber', label: 'CONTAS A PAGAR/RECEBER', icon: CreditCard },
      { kind: 'tab', id: 'conciliacao', label: 'CONCILIAÇÃO', icon: Link2 },
    ],
  },
  {
    titulo: 'Cadastro',
    itens: [
      { kind: 'tab', id: 'pessoas', label: 'PESSOAS', icon: Users },
      { kind: 'link', to: '/frotas?aba=veiculos', label: 'VEÍCULOS', icon: Truck },
      { kind: 'tab', id: 'marcas', label: 'MARCAS', icon: Award },
      { kind: 'tab', id: 'modelos', label: 'MODELOS', icon: Layers },
      { kind: 'tab', id: 'enderecos', label: 'ENDEREÇOS FREQUENTES', icon: MapPin },
      { kind: 'tab', id: 'centros_custo', label: 'CENTROS DE CUSTO', icon: Building2 },
      { kind: 'tab', id: 'tipos_carga', label: 'TIPOS DE CARGA', icon: Package },
      { kind: 'tab', id: 'tipos_lancamento', label: 'TIPOS DE LANÇAMENTO', icon: Tag },
      { kind: 'tab', id: 'formas_pagamento', label: 'FORMAS DE PAGAMENTO', icon: CreditCard },
    ],
  },
  {
    titulo: 'Configurações',
    itens: [
      { kind: 'link', to: '/configuracoes?tab=usuarios', label: 'USUÁRIOS', icon: UserCheck },
      { kind: 'link', to: '/configuracoes?tab=empresas', label: 'EMPRESA', icon: Building },
    ],
  },
]

// Um grupo do sub-menu de Controle de Viagens, renderizado como um botão que
// abre uma lista suspensa com os itens daquele grupo — em vez de mostrar
// tudo expandido o tempo todo (ficava poluído com 10+ abas de uma vez).
function DropdownMenuGrupo({
  titulo,
  itens,
  subAbaAtiva,
  onSelecionarTab,
  onNavegar,
}: {
  titulo: string
  itens: ItemMenuViagens[]
  subAbaAtiva: SubAbaViagens
  onSelecionarTab: (id: SubAbaViagens) => void
  onNavegar: (to: string) => void
}) {
  const [aberto, setAberto] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const itemAtivo = itens.find((item) => item.kind === 'tab' && item.id === subAbaAtiva)

  useEffect(() => {
    if (!aberto) return
    function handleClickFora(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAberto(false)
      }
    }
    document.addEventListener('mousedown', handleClickFora)
    return () => document.removeEventListener('mousedown', handleClickFora)
  }, [aberto])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-black text-xs uppercase transition-all ${
          itemAtivo || aberto
            ? 'bg-primary text-white shadow-lg shadow-primary/25'
            : 'text-secondary hover:text-foreground hover:bg-surface-hover/50'
        }`}
      >
        <span>{titulo}</span>
        {itemAtivo && <span className="opacity-80 normal-case font-bold">· {itemAtivo.label}</span>}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${aberto ? 'rotate-180' : ''}`} />
      </button>

      {aberto && (
        <div className="absolute left-0 top-full z-20 mt-1.5 w-64 rounded-xl border border-border/25 bg-surface shadow-2xl py-1.5 animate-fade-in">
          {itens.map((item) => {
            const Icon = item.icon
            const ativo = item.kind === 'tab' && item.id === subAbaAtiva
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  if (item.kind === 'tab') onSelecionarTab(item.id)
                  else onNavegar(item.to)
                  setAberto(false)
                }}
                className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-xs font-bold uppercase transition-colors ${
                  ativo ? 'text-primary bg-primary/10' : 'text-foreground hover:bg-overlay/10'
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1">{item.label}</span>
                {item.kind === 'link' && <ExternalLink className="h-3 w-3 opacity-50 shrink-0" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Status do fluxo de cotação/execução de uma viagem de frete.
const STATUS_VIAGEM_INFO: Record<StatusViagem, { label: string; tone: 'neutral' | 'warning' | 'success' | 'danger' }> = {
  cotada: { label: 'COTADA', tone: 'neutral' },
  confirmada: { label: 'CONFIRMADA', tone: 'warning' },
  em_transito: { label: 'EM TRÂNSITO', tone: 'warning' },
  entregue: { label: 'ENTREGUE', tone: 'success' },
  cancelada: { label: 'CANCELADA', tone: 'danger' },
}

function DetalheCampo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <span className="text-[9px] font-black text-secondary uppercase block">{label}</span>
      <div className="text-xs font-bold text-foreground mt-0.5">{children}</div>
    </div>
  )
}

function comprimirFoto(file: File, maxWidth = 1000, quality = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let width = img.width
        let height = img.height
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width)
          width = maxWidth
        }
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) return resolve(e.target?.result as string)
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.onerror = () => resolve(e.target?.result as string)
      img.src = e.target?.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function Frotas() {
  const { user, perfil } = useAuth()
  const isAdmin = isAdminUsuario(perfil, user?.email)
  const { clientes, refetch: refetchClientes } = useClientes()
  const { marcas, refetch: refetchMarcas } = useMarcas()
  const { movimentacoes } = useMovimentacoes()
  const navigate = useNavigate()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const textColor = isDark ? '#ffffff' : '#18181b'
  const textColorSecundario = isDark ? '#cbd5e1' : '#475569'
  const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
  const axisLineColor = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)'

  const isNative = isNativeApp()
  const [searchParams] = useSearchParams()
  const abaParam = searchParams.get('aba')
  const categoriaParam = searchParams.get('categoria')

  const abaPrincipal: 'dashboard' | 'veiculos' | 'checklist' | 'viagens' = isNative
    ? 'checklist'
    : abaParam === 'checklist'
    ? 'checklist'
    : abaParam === 'viagens'
    ? 'viagens'
    : abaParam === 'veiculos' || categoriaParam === 'leve' || categoriaParam === 'pesado' || categoriaParam === 'embarcado'
    ? 'veiculos'
    : 'dashboard'

  // Lista de veículos de frotas
  const [frotas, setFrotas] = useState<ItemFrotaCadastrada[]>(() => {
    try {
      const salvo = localStorage.getItem(STORAGE_FROTAS_KEY)
      if (salvo) {
        const parsed = JSON.parse(salvo)
        if (Array.isArray(parsed) && parsed.length > 0) {
          const mapa = new Map<string, ItemFrotaCadastrada>()
          // 1. Inserir todos os veículos oficiais da Frota Leve
          FROTA_LEVE_OFICIAL.forEach((v) => {
            mapa.set(v.placa.toUpperCase().trim(), { ...v, tipo: 'leve' } as ItemFrotaCadastrada)
          })
          // 2. Inserir todos os veículos oficiais da Frota Pesada (Rodocaçamba)
          FROTA_PESADA_OFICIAL.forEach((v) => {
            mapa.set(v.placa.toUpperCase().trim(), { ...v, tipo: v.tipo || 'pesado' } as ItemFrotaCadastrada)
          })
          // 3. Inserir todos os veículos oficiais Embarcados (munck, plataformas)
          FROTA_EMBARCADO_OFICIAL.forEach((v) => {
            mapa.set(v.placa.toUpperCase().trim(), { ...v, tipo: 'embarcado' } as ItemFrotaCadastrada)
          })
          // 4. Mesclar com as edições e novos cadastros manuais do usuário
          parsed.forEach((v: ItemFrotaCadastrada) => {
            const placa = v.placa ? v.placa.toUpperCase().trim() : v.id
            const base = mapa.get(placa)
            if (base) {
              const ehEmbarcadoOficial = FROTA_EMBARCADO_OFICIAL.some((fe) => fe.placa.toUpperCase().trim() === placa)
              mapa.set(placa, {
                ...base,
                ...v,
                // Reforça a reclassificação para "embarcado": um cache antigo do
                // navegador (de antes desta categoria existir) ainda pode guardar
                // tipo 'leve'/'pesado' para essas placas — a lista oficial vence.
                tipo: ehEmbarcadoOficial ? 'embarcado' : v.tipo,
                chassi: v.chassi || base.chassi,
                renavam: v.renavam || base.renavam,
                marcaNome: v.marcaNome || base.marcaNome,
                modeloNome: v.modeloNome || base.modeloNome,
                setor: v.setor || base.setor,
                responsavel: v.responsavel || base.responsavel,
                tipoVeiculo: v.tipoVeiculo || base.tipoVeiculo,
                clienteNome: 'G VEL DIESEL & TRANSPORTES LTDA',
                clienteId: 'cliente_gvel_diesel_transportes',
                // Datas de vencimento (CRLV, seguro e tacógrafo) vêm da lista oficial,
                // que é a fonte da verdade e é corrigida diretamente no código — um
                // cadastro antigo salvo no navegador não pode continuar sobrepondo
                // uma data já corrigida ali.
                vencimentoDocumento: base.vencimentoDocumento !== undefined ? base.vencimentoDocumento : v.vencimentoDocumento,
                vencimentoSeguro: base.vencimentoSeguro !== undefined ? base.vencimentoSeguro : v.vencimentoSeguro,
                numeroTacografo: base.numeroTacografo !== undefined ? base.numeroTacografo : v.numeroTacografo,
                emissaoTacografo: base.emissaoTacografo !== undefined ? base.emissaoTacografo : v.emissaoTacografo,
                vencimentoTacografo: base.vencimentoTacografo !== undefined ? base.vencimentoTacografo : v.vencimentoTacografo,
                observacoes: base.observacoes || v.observacoes,
              })
            } else if (v.id && !v.id.startsWith('frota_') && !v.id.startsWith('pesado_')) {
              // Veículos criados manualmente pelo usuário
              mapa.set(placa, {
                ...v,
                clienteNome: 'G VEL DIESEL & TRANSPORTES LTDA',
                clienteId: 'cliente_gvel_diesel_transportes',
              })
            }
          })
          const resultado = Array.from(mapa.values()).map((item) => ({
            ...item,
            clienteNome: 'G VEL DIESEL & TRANSPORTES LTDA',
            clienteId: 'cliente_gvel_diesel_transportes',
          }))
          localStorage.setItem(STORAGE_FROTAS_KEY, JSON.stringify(resultado))
          return resultado
        }
      }
    } catch {}
    return [...FROTA_LEVE_OFICIAL, ...FROTA_PESADA_OFICIAL, ...FROTA_EMBARCADO_OFICIAL] as ItemFrotaCadastrada[]
  })

  // Lista de Checklists realizados (Supabase — com migração automática dos
  // registros antigos que ficavam só no localStorage)
  const { checklists, loading: carregandoChecklists, refetch: refetchChecklists } = useChecklistsFrota()
  const [salvandoChecklist, setSalvandoChecklist] = useState(false)

  // Controle de Viagens (Supabase)
  const { viagens, loading: carregandoViagens } = useViagensFrota()
  const { centrosCusto, loading: carregandoCentrosCusto, refetch: refetchCentrosCusto } = useCentrosCusto()
  const { transportadoras, refetch: refetchTransportadoras } = useTransportadoras()
  const { tiposCarga, loading: carregandoTiposCarga, refetch: refetchTiposCarga } = useTiposCarga()
  const {
    enderecos: enderecosFrequentes,
    loading: carregandoEnderecosFrequentes,
    refetch: refetchEnderecosFrequentes,
  } = useEnderecosFrequentes()
  const { pessoas, loading: carregandoPessoas, refetch: refetchPessoas } = usePessoas()
  const { formasPagamento, loading: carregandoFormasPagamento, refetch: refetchFormasPagamento } = useFormasPagamento()
  const { tiposLancamento, loading: carregandoTiposLancamento, refetch: refetchTiposLancamento } = useTiposLancamento()
  const { contas: contasBancarias, loading: carregandoContasBancarias, addConta, removeConta, updateConta } = useContas()
  const { fornecedores, refetch: refetchFornecedores } = useFornecedores()
  const { contas: contasPR, loading: carregandoContasPR } = useContasPagarReceber()
  const { estadias: estadiasPatio, loading: carregandoPatio } = usePatioEstadias()
  const [subAbaPatio, setSubAbaPatio] = useState<'ativos' | 'historico'>('ativos')
  const [mostrarModalPatio, setMostrarModalPatio] = useState(false)
  const [estadiaPatioEditando, setEstadiaPatioEditando] = useState<EstadiaPatio | null>(null)
  const [buscaPatio, setBuscaPatio] = useState('')
  const [filtroClientePatio, setFiltroClientePatio] = useState('')
  const [mostrarModalContaPR, setMostrarModalContaPR] = useState(false)
  const [contaPREditando, setContaPREditando] = useState<ContaPagarReceber | null>(null)
  const [filtroStatusContaPR, setFiltroStatusContaPR] = useState<'todas' | StatusContaPagarReceber>('todas')
  const [buscaContaPR, setBuscaContaPR] = useState('')
  const [subAbaViagens, setSubAbaViagens] = useState<SubAbaViagens>('viagens')
  const [mostrarModalViagem, setMostrarModalViagem] = useState(false)
  const [viagemEditando, setViagemEditando] = useState<RegistroViagem | null>(null)
  const [buscaViagem, setBuscaViagem] = useState('')
  const [filtroVeiculoIdViagem, setFiltroVeiculoIdViagem] = useState('')
  const [filtroClienteIdViagem, setFiltroClienteIdViagem] = useState('')
  const [filtroCentroCustoIdViagem, setFiltroCentroCustoIdViagem] = useState('')
  const [filtroStatusViagem, setFiltroStatusViagem] = useState<'ativas' | 'todas' | StatusViagem>('ativas')
  const [ocultarTotaisViagem, setOcultarTotaisViagem] = useState(false)
  const [mostrarFiltrosAvancadosViagem, setMostrarFiltrosAvancadosViagem] = useState(false)
  const [filtroDataColetaDeViagem, setFiltroDataColetaDeViagem] = useState('')
  const [filtroDataColetaAteViagem, setFiltroDataColetaAteViagem] = useState('')
  const [filtroTipoFreteViagem, setFiltroTipoFreteViagem] = useState<'todos' | TipoFrete>('todos')
  const [ordenacaoViagem, setOrdenacaoViagem] = useState<{ campo: OrdenacaoViagemCampo; direcao: 'asc' | 'desc' }>({
    campo: 'dataColeta',
    direcao: 'desc',
  })

  function limparFiltrosViagem() {
    setBuscaViagem('')
    setFiltroVeiculoIdViagem('')
    setFiltroClienteIdViagem('')
    setFiltroCentroCustoIdViagem('')
    setFiltroStatusViagem('ativas')
    setFiltroDataColetaDeViagem('')
    setFiltroDataColetaAteViagem('')
    setFiltroTipoFreteViagem('todos')
  }

  const contasPRFiltradas = useMemo(() => {
    return contasPR.filter((c) => {
      if (filtroStatusContaPR !== 'todas' && c.status !== filtroStatusContaPR) return false
      if (!buscaContaPR.trim()) return true
      const termo = buscaContaPR.toLowerCase().trim()
      return (
        (c.descricao && c.descricao.toLowerCase().includes(termo)) ||
        (c.centroCustoNome && c.centroCustoNome.toLowerCase().includes(termo)) ||
        (c.fornecedorNome && c.fornecedorNome.toLowerCase().includes(termo)) ||
        (c.placa && c.placa.toLowerCase().includes(termo))
      )
    })
  }, [contasPR, filtroStatusContaPR, buscaContaPR])

  const metricasContasPR = useMemo(() => {
    const hoje = new Date().toISOString().slice(0, 10)
    const totalPagar = contasPR
      .filter((c) => c.tipoMovimentacao === 'despesa' && c.status !== 'pago' && c.status !== 'cancelado')
      .reduce((acc, c) => acc + c.valor, 0)
    const totalReceber = contasPR
      .filter((c) => c.tipoMovimentacao === 'receita' && c.status !== 'pago' && c.status !== 'cancelado')
      .reduce((acc, c) => acc + c.valor, 0)
    const vencidas = contasPR.filter((c) => c.status === 'pendente' && c.dataVencimento < hoje).length
    const totalPago = contasPR.filter((c) => c.status === 'pago').reduce((acc, c) => acc + c.valor, 0)
    return { totalPagar, totalReceber, vencidas, totalPago }
  }, [contasPR])

  // Painel "Financeiro" do Controle de Viagens — resumo próprio, calculado
  // só a partir de Viagens + Contas a Pagar/Receber daqui (não é o painel
  // gerencial da empresa toda, esse é só o financeiro do módulo de viagens).
  const metricasFinanceiroViagens = useMemo(() => {
    const faturamento = viagens
      .filter((v) => v.status !== 'cancelada')
      .reduce((acc, v) => acc + (v.freteBruto || 0), 0)
    const receitas = contasPR
      .filter((c) => c.tipoMovimentacao === 'receita' && c.status === 'pago')
      .reduce((acc, c) => acc + c.valor, 0)
    const despesas = contasPR
      .filter((c) => c.tipoMovimentacao === 'despesa' && c.status === 'pago')
      .reduce((acc, c) => acc + c.valor, 0)
    const saldoCaixa = receitas - despesas
    const resultadoLiquido = faturamento - despesas
    return { faturamento, receitas, despesas, saldoCaixa, resultadoLiquido }
  }, [viagens, contasPR])

  async function handleExcluirContaPR(id: string) {
    if (!confirm('Excluir este lançamento? Essa ação não pode ser desfeita.')) return
    try {
      await excluirContaPagarReceber(id)
    } catch (err) {
      alert(getErrorMessage(err, 'Erro ao excluir o lançamento.'))
    }
  }

  const estadiasPatioFiltradas = useMemo(() => {
    return estadiasPatio.filter((e) => {
      const finalizada = Boolean(e.dataHoraSaidaReal)
      if (subAbaPatio === 'ativos' && finalizada) return false
      if (subAbaPatio === 'historico' && !finalizada) return false
      if (filtroClientePatio && e.clienteId !== filtroClientePatio) return false
      if (!buscaPatio.trim()) return true
      const termo = buscaPatio.toLowerCase().trim()
      return (
        e.placa.toLowerCase().includes(termo) ||
        (e.modelo && e.modelo.toLowerCase().includes(termo)) ||
        (e.clienteNome && e.clienteNome.toLowerCase().includes(termo))
      )
    })
  }, [estadiasPatio, subAbaPatio, filtroClientePatio, buscaPatio])

  async function handleFinalizarEstadiaPatio(e: EstadiaPatio) {
    if (!confirm(`Finalizar a estadia da placa ${e.placa} agora (${format(new Date(), 'dd/MM/yyyy HH:mm')})?`)) return
    try {
      await finalizarEstadiaPatio(e.id, new Date().toISOString())
    } catch (err) {
      alert(getErrorMessage(err, 'Erro ao finalizar a estadia.'))
    }
  }

  async function handleExcluirEstadiaPatio(id: string) {
    if (!confirm('Excluir este registro do pátio? Essa ação não pode ser desfeita.')) return
    try {
      await excluirEstadiaPatio(id)
    } catch (err) {
      alert(getErrorMessage(err, 'Erro ao excluir o registro.'))
    }
  }

  function handleExportarPatio() {
    exportRowsToCsv(
      `patio_${subAbaPatio}_${format(new Date(), 'yyyy-MM-dd')}.csv`,
      ['Placa', 'Modelo', 'Marca', 'Cor', 'Cliente', 'Entrada', 'Previsão Saída', 'Dias', 'Valor Diária', 'Taxímetro', 'Status'],
      estadiasPatioFiltradas.map((e) => {
        const { dias, valor } = calcularDiasEValorPatio(e)
        return [
          e.placa,
          e.modelo || '',
          e.marca || '',
          e.cor || '',
          e.clienteNome || '',
          format(parseISO(e.dataHoraEntrada), 'dd/MM/yyyy HH:mm'),
          e.previsaoSaida ? format(parseISO(e.previsaoSaida), 'dd/MM/yyyy HH:mm') : '',
          String(dias),
          e.valorDiaria.toFixed(2).replace('.', ','),
          valor.toFixed(2).replace('.', ','),
          e.dataHoraSaidaReal ? 'FINALIZADO' : 'NO PÁTIO',
        ]
      }),
    )
  }

  function salvarFrotas(novas: ItemFrotaCadastrada[]) {
    setFrotas(novas)
    try {
      localStorage.setItem(STORAGE_FROTAS_KEY, JSON.stringify(novas))
      window.dispatchEvent(new Event('frota_updated'))
    } catch {}
  }

  function alternarCrlvPago(id: string) {
    salvarFrotas(frotas.map((f) => (f.id === id ? { ...f, crlvPago: !f.crlvPago } : f)))
  }

  function alternarSeguroOk(id: string) {
    salvarFrotas(frotas.map((f) => (f.id === id ? { ...f, seguroOk: !f.seguroOk } : f)))
  }

  // Modais de Veículo
  const [mostrarModalVeiculo, setMostrarModalVeiculo] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [erroLista, setErroLista] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [categoriaFrota, setCategoriaFrota] = useState<'todos' | 'leve' | 'pesado' | 'embarcado'>(() => {
    if (categoriaParam === 'leve') return 'leve'
    if (categoriaParam === 'pesado') return 'pesado'
    if (categoriaParam === 'embarcado') return 'embarcado'
    return 'todos'
  })

  useEffect(() => {
    if (categoriaParam === 'leve') {
      setCategoriaFrota('leve')
    } else if (categoriaParam === 'pesado') {
      setCategoriaFrota('pesado')
    } else if (categoriaParam === 'embarcado') {
      setCategoriaFrota('embarcado')
    } else if (abaParam === 'dashboard' || (abaParam === 'veiculos' && !categoriaParam)) {
      setCategoriaFrota('todos')
    }
  }, [categoriaParam, abaParam])

  const [tipoFiltro, setTipoFiltro] = useState<string>('todos')
  const [alertaFiltro, setAlertaFiltro] = useState<
    | 'todos'
    | 'preventiva_atrasada'
    | 'doc_a_vencer'
    | 'doc_vencido'
    | 'seguro_a_vencer'
    | 'seguro_vencido'
    | 'tacografo_a_vencer'
    | 'tacografo_vencido'
  >('todos')

  // Contagens e subconjunto filtrado por categoria (Leves vs Rodocaçamba/Pesados vs Embarcados)
  const contagemLeves = useMemo(() => frotas.filter((v) => isFrotaLeve(v)).length, [frotas])
  const contagemEmbarcados = useMemo(() => frotas.filter((v) => isFrotaEmbarcado(v)).length, [frotas])
  const contagemPesados = useMemo(
    () => frotas.filter((v) => !isFrotaLeve(v) && !isFrotaEmbarcado(v)).length,
    [frotas],
  )
  const contagemTodos = frotas.length

  const frotasCategoria = useMemo(() => {
    if (categoriaFrota === 'leve') {
      return frotas.filter((v) => isFrotaLeve(v))
    }
    if (categoriaFrota === 'pesado') {
      return frotas.filter((v) => !isFrotaLeve(v) && !isFrotaEmbarcado(v))
    }
    if (categoriaFrota === 'embarcado') {
      return frotas.filter((v) => isFrotaEmbarcado(v))
    }
    return frotas
  }, [frotas, categoriaFrota])

  // Filtros dos Gráficos do Dashboard
  const [filtroGraficoKm, setFiltroGraficoKm] = useState<'top12' | 'top20' | 'criticos' | 'todos'>('top12')
  const [filtroTipoGraficoKm, setFiltroTipoGraficoKm] = useState<string>('todos_motor')

  // Modal de Detalhes do Veículo (dados cadastrados + histórico de checklists)
  const [veiculoDetalhando, setVeiculoDetalhando] = useState<ItemFrotaCadastrada | null>(null)

  // Modais de Checklist
  const [mostrarModalNovoChecklist, setMostrarModalNovoChecklist] = useState(false)
  const [checklistVisualizando, setChecklistVisualizando] = useState<RegistroChecklist | null>(null)
  const [fotoZoom, setFotoZoom] = useState<{ url: string; titulo: string } | null>(null)
  const [zoomScale, setZoomScale] = useState(1)
  const [zoomPos, setZoomPos] = useState({ x: 0, y: 0 })
  const zoomPointersRef = useRef<Map<number, { x: number; y: number }>>(new Map())
  const zoomPinchDistRef = useRef<number | null>(null)
  const zoomPinchScaleRef = useRef(1)
  const zoomDragRef = useRef<{ x: number; y: number; posX: number; posY: number } | null>(null)
  const [buscaChecklist, setBuscaChecklist] = useState('')
  const [filtroResultadoChecklist, setFiltroResultadoChecklist] = useState<string>('todos')

  // Form State para Novo Checklist
  const [veiculoChecklistId, setVeiculoChecklistId] = useState('')
  const [tipoChecklistNovo, setTipoChecklistNovo] = useState<'ida' | 'volta'>('ida')
  const [categoriaChecklistNovo, setCategoriaChecklistNovo] = useState<'todos' | 'leve' | 'rodocacamba'>('todos')
  const [placaBuscaChecklist, setPlacaBuscaChecklist] = useState('')
  const [dropdownPlacaAberto, setDropdownPlacaAberto] = useState(false)
  const containerBuscaPlacaRef = useRef<HTMLDivElement>(null)
  const [motoristaChecklist, setMotoristaChecklist] = useState('')
  const [kmChecklist, setKmChecklist] = useState<number>(0)
  const [resultadoChecklist, setResultadoChecklist] = useState<'aprovado' | 'aprovado_com_ressalvas' | 'reprovado'>('aprovado')
  const [obsChecklist, setObsChecklist] = useState('')
  const [fotosChecklist, setFotosChecklist] = useState<FotosVistoria>({})

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerBuscaPlacaRef.current && !containerBuscaPlacaRef.current.contains(e.target as Node)) {
        setDropdownPlacaAberto(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Refs de inputs de arquivo para disparar a câmera
  const inputFotoPainelRef = useRef<HTMLInputElement>(null)
  const inputFotoFrenteRef = useRef<HTMLInputElement>(null)
  const inputFotoLadoEsquerdoRef = useRef<HTMLInputElement>(null)
  const inputFotoTraseiraRef = useRef<HTMLInputElement>(null)
  const inputFotoLadoDireitoRef = useRef<HTMLInputElement>(null)

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormVeiculoValues>({
    resolver: zodResolver(schemaVeiculo),
    defaultValues: { clienteId: '', tipo: 'pesado', situacao: 'operante', ano: anoAtual, intervaloPreventivaKm: 10000 },
  })

  const marcaIdWatch = watch('marcaId')
  const tipoWatch = watch('tipo')
  const { modelos, refetch: refetchModelos } = useModelos(marcaIdWatch)

  // Ao editar um veículo, a marca/modelo dele estão salvos como texto puro
  // (marcaNome/modeloNome), não como o marcaId/modeloId que o formulário usa
  // (referência às tabelas marcas/modelos do Supabase). Por isso guardamos o
  // nome do modelo aqui e, assim que os modelos daquela marca carregarem,
  // resolvemos o id certo automaticamente — sem isso o campo aparecia vazio
  // mesmo já tendo marca/modelo cadastrados.
  const [modeloNomePendente, setModeloNomePendente] = useState<string | null>(null)
  useEffect(() => {
    if (!modeloNomePendente || modelos.length === 0) return
    const alvo = modeloNomePendente.toUpperCase().trim()
    // Tenta igualdade exata primeiro; se o nome salvo no veículo não bater
    // 100% com o cadastro de modelos (ex: "STRADA" vs "STRADA WORKING"),
    // cai pra correspondência parcial em vez de deixar o campo vazio.
    const achado =
      modelos.find((m) => m.nome.toUpperCase().trim() === alvo) ||
      modelos.find((m) => alvo.includes(m.nome.toUpperCase().trim()) || m.nome.toUpperCase().trim().includes(alvo))
    if (achado) {
      setValue('modeloId', achado.id)
      setModeloNomePendente(null)
    }
  }, [modelos, modeloNomePendente, setValue])

  // Zoom/pan da foto ampliada — reseta sempre que uma foto nova é aberta
  useEffect(() => {
    setZoomScale(1)
    setZoomPos({ x: 0, y: 0 })
    zoomPointersRef.current.clear()
    zoomPinchDistRef.current = null
    zoomDragRef.current = null
  }, [fotoZoom])

  useEffect(() => {
    if (zoomScale <= 1) setZoomPos({ x: 0, y: 0 })
  }, [zoomScale])

  function distanciaEntrePontos(pts: { x: number; y: number }[]) {
    const [a, b] = pts
    return Math.hypot(a.x - b.x, a.y - b.y)
  }

  function handleZoomPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    zoomPointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (zoomPointersRef.current.size === 2) {
      zoomPinchDistRef.current = distanciaEntrePontos(Array.from(zoomPointersRef.current.values()))
      zoomPinchScaleRef.current = zoomScale
    } else if (zoomPointersRef.current.size === 1 && zoomScale > 1) {
      zoomDragRef.current = { x: e.clientX, y: e.clientY, posX: zoomPos.x, posY: zoomPos.y }
    }
  }

  function handleZoomPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!zoomPointersRef.current.has(e.pointerId)) return
    zoomPointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (zoomPointersRef.current.size === 2 && zoomPinchDistRef.current) {
      const dist = distanciaEntrePontos(Array.from(zoomPointersRef.current.values()))
      const ratio = dist / zoomPinchDistRef.current
      setZoomScale(Math.min(4, Math.max(1, zoomPinchScaleRef.current * ratio)))
    } else if (zoomPointersRef.current.size === 1 && zoomDragRef.current) {
      const dx = e.clientX - zoomDragRef.current.x
      const dy = e.clientY - zoomDragRef.current.y
      setZoomPos({ x: zoomDragRef.current.posX + dx, y: zoomDragRef.current.posY + dy })
    }
  }

  function handleZoomPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    zoomPointersRef.current.delete(e.pointerId)
    if (zoomPointersRef.current.size < 2) zoomPinchDistRef.current = null
    if (zoomPointersRef.current.size === 0) zoomDragRef.current = null
  }

  function handleZoomWheel(e: React.WheelEvent<HTMLDivElement>) {
    e.preventDefault()
    setZoomScale((z) => Math.min(4, Math.max(1, z - e.deltaY * 0.0015)))
  }

  function handleZoomDoubleClick() {
    setZoomScale((z) => (z > 1 ? 1 : 2.5))
  }

  // Cliente padrão e exclusivo da frota própria
  const clienteGvel = useMemo(() => {
    return (
      clientes.find((c) => c.nome.toUpperCase().includes('G VEL') || c.id === 'cliente_gvel_diesel_transportes') || {
        id: 'cliente_gvel_diesel_transportes',
        nome: 'G VEL DIESEL & TRANSPORTES LTDA',
      }
    )
  }, [clientes])

  // Conjunto de placas que estão no pátio atualmente
  const placasNoPatio = useMemo(() => {
    const set = new Set<string>()
    movimentacoes.forEach((m) => {
      if (m.status === 'no_patio' && m.veiculo?.placa) {
        set.add(m.veiculo.placa.toUpperCase().trim())
      }
    })
    return set
  }, [movimentacoes])

  // Helper para status do documento (CRLV / Licenciamento)
  function getStatusDocumento(dataStr?: string) {
    if (!dataStr) return { status: 'nao_informado', label: 'NÃO INFORMADO', dias: null }
    try {
      const dataDoc = parseISO(dataStr)
      const hoje = startOfDay(new Date())
      const dias = differenceInDays(dataDoc, hoje)

      if (dias < 0) {
        return { status: 'vencido', label: `VENCIDO (${Math.abs(dias)}D ATRÁS)`, dias }
      }
      if (dias <= 30) {
        return { status: 'a_vencer', label: dias === 0 ? 'VENCE HOJE' : `VENCE EM ${dias}D`, dias }
      }
      return { status: 'em_dia', label: `EM DIA (${format(dataDoc, 'dd/MM/yyyy')})`, dias }
    } catch {
      return { status: 'nao_informado', label: 'DATA INVÁLIDA', dias: null }
    }
  }

  // Helper para status do seguro (Apólice)
  function getStatusSeguro(dataStr?: string) {
    if (!dataStr) return { status: 'nao_informado', label: 'SEM SEGURO INFORMADO', dias: null }
    try {
      const dataSeg = parseISO(dataStr)
      const hoje = startOfDay(new Date())
      const dias = differenceInDays(dataSeg, hoje)

      if (dias < 0) {
        return { status: 'vencido', label: `VENCIDO (${Math.abs(dias)}D ATRÁS)`, dias }
      }
      if (dias <= 30) {
        return { status: 'a_vencer', label: dias === 0 ? 'VENCE HOJE' : `VENCE EM ${dias}D`, dias }
      }
      return { status: 'em_dia', label: `VIGENTE (${format(dataSeg, 'dd/MM/yyyy')})`, dias }
    } catch {
      return { status: 'nao_informado', label: 'DATA INVÁLIDA', dias: null }
    }
  }

  // Helper para status do Tacógrafo (Ensaio / Vencimento)
  function getStatusTacografo(dataStr?: string) {
    if (!dataStr) return { status: 'nao_informado', label: 'NÃO INFORMADO', dias: null }
    try {
      const dataTac = parseISO(dataStr)
      const hoje = startOfDay(new Date())
      const dias = differenceInDays(dataTac, hoje)

      if (dias < 0) {
        return { status: 'vencido', label: `VENCIDO (${Math.abs(dias)}D ATRÁS)`, dias }
      }
      if (dias <= 30) {
        return { status: 'a_vencer', label: dias === 0 ? 'VENCE HOJE' : `VENCE EM ${dias}D`, dias }
      }
      return { status: 'em_dia', label: `EM DIA (${format(dataTac, 'dd/MM/yyyy')})`, dias }
    } catch {
      return { status: 'nao_informado', label: 'DATA INVÁLIDA', dias: null }
    }
  }

  // Mapeamento da última KM de cada placa registrada nos checklists
  const ultimasKmsPorPlaca = useMemo(() => {
    const map = new Map<string, number>()
    const ordenados = [...checklists].sort((a, b) => new Date(a.dataHora).getTime() - new Date(b.dataHora).getTime())
    ordenados.forEach((chk) => {
      if (chk.placa && chk.kmAtual > 0) {
        map.set(chk.placa.toUpperCase().trim(), chk.kmAtual)
      }
    })
    return map
  }, [checklists])

  // Helper para status de preventiva (calculado por KM e Data)
  // KM da Última Preventiva = KM em que a ÚLTIMA troca foi feita — soma o
  // intervalo (ex: 10.000 KM da frota leve) pra achar a meta da PRÓXIMA.
  // Data da Próxima Preventiva já é a data de vencimento em si (não soma nada).
  function getStatusPreventiva(v: ItemFrotaCadastrada) {
    const kmAtual = ultimasKmsPorPlaca.get(v.placa.toUpperCase().trim()) || 0
    const kmUltima = v.kmUltimaPreventiva || 0
    const intervalo = v.intervaloPreventivaKm || 10000

    let atrasadaPorKm = false
    let kmRestante = 0
    let kmLimite = 0

    if (kmUltima > 0 && kmAtual > 0) {
      kmLimite = kmUltima + intervalo
      kmRestante = kmLimite - kmAtual
      if (kmRestante < 0) {
        atrasadaPorKm = true
      }
    } else if (v.kmProximaPreventiva && kmAtual > 0) {
      kmLimite = v.kmProximaPreventiva
      kmRestante = kmLimite - kmAtual
      if (kmRestante < 0) {
        atrasadaPorKm = true
      }
    }

    // Checagem por Data — dataUltimaPreventiva/vencimentoPreventiva é a data
    // em que a PRÓXIMA preventiva vence; se já passou, está atrasada. Só
    // marca como atrasada se já existe pelo menos um checklist confirmando o
    // KM real do veículo — sem isso não dá pra afirmar que ele realmente
    // está rodando vencido, só que a data prevista passou.
    const dataPrevStr = v.dataUltimaPreventiva || v.vencimentoPreventiva
    let atrasadaPorData = false
    let dataFormatada = ''
    if (dataPrevStr) {
      try {
        const dataPrev = parseISO(dataPrevStr)
        const hoje = startOfDay(new Date())
        atrasadaPorData = kmAtual > 0 && isBefore(dataPrev, hoje)
        dataFormatada = format(dataPrev, 'dd/MM/yyyy')
      } catch {}
    }

    if (atrasadaPorKm) {
      return {
        status: 'atrasada',
        label: `VENCIDA (-${Math.abs(kmRestante).toLocaleString('pt-BR')} KM)`,
        kmRestante,
        kmLimite,
        atrasada: true,
      }
    }

    // Havendo KM real acompanhado (kmLimite > 0), ele manda — só falta
    // decidir se está "próxima" ou "em dia". A checagem por data só decide o
    // atraso quando NÃO existe controle de KM confiável pra esse veículo.
    if (kmLimite > 0 && kmRestante <= 5000) {
      return {
        status: 'proxima',
        label: `PRÓXIMA (${kmRestante.toLocaleString('pt-BR')} KM REST.)`,
        kmRestante,
        kmLimite,
        atrasada: false,
      }
    }

    if (kmLimite > 0) {
      return {
        status: 'em_dia',
        label: `EM DIA (${kmRestante.toLocaleString('pt-BR')} KM REST.)`,
        kmRestante,
        kmLimite,
        atrasada: false,
      }
    }

    if (atrasadaPorData) {
      return {
        status: 'atrasada',
        label: `ATRASADA (${dataFormatada})`,
        kmRestante,
        kmLimite,
        atrasada: true,
      }
    }

    if (dataFormatada) {
      return {
        status: 'em_dia',
        label: `PROGRAMADA (${dataFormatada})`,
        kmRestante: 0,
        kmLimite: 0,
        atrasada: false,
      }
    }

    return { status: 'nao_informado', label: 'NÃO INFORMADA', kmRestante: 0, kmLimite: 0, atrasada: false }
  }

  // 1. DADOS DO GRÁFICO 1: KM Restante para Preventiva por Placa (Veículos Motorizados)
  const dadosGraficoKmPreventiva = useMemo(() => {
    // Carretas e dollys não possuem odômetro de motor/KM
    const motorizados = frotasCategoria.filter((v) => v.tipo !== 'carreta')

    const filtrados = motorizados.filter((v) => {
      if (filtroTipoGraficoKm === 'todos_motor') return true
      return v.tipo === filtroTipoGraficoKm
    })

    // Só entra no gráfico quem realmente tem uma meta de preventiva
    // cadastrada (KM da Última Preventiva ou o campo legado KM Próxima
    // Preventiva) — sem isso não existe cronograma real pra acompanhar, e
    // inventar um automaticamente mostraria dado que ninguém cadastrou.
    const comMeta = filtrados.filter((v) => (v.kmUltimaPreventiva || 0) > 0 || (v.kmProximaPreventiva || 0) > 0)

    const lista = comMeta
      .map((v) => {
      const placa = v.placa.toUpperCase().trim()
      const kmAtual = ultimasKmsPorPlaca.get(placa) || 0
      const kmUltima = v.kmUltimaPreventiva || 0
      const intervalo = v.intervaloPreventivaKm || 10000
      // KM da Última Preventiva + intervalo = meta da próxima. O campo
      // legado kmProximaPreventiva já vem pronto (não soma intervalo).
      const kmMeta = kmUltima > 0 ? kmUltima + intervalo : (v.kmProximaPreventiva as number)

      // Sem nenhum checklist registrado pra placa não há KM atual real — o
      // veículo ainda aparece no gráfico, mas com uma barra neutra (cinza,
      // altura = intervalo) em vez de calcular a distância até a meta
      // (que seria a meta inteira, ex: 111.972 KM — um número que não
      // representa km rodado nenhum).
      if (kmAtual === 0) {
        return {
          placa,
          modelo: v.modeloNome || v.marcaNome || 'VEÍCULO',
          marca: v.marcaNome,
          tipo: v.tipo,
          kmAtual: 0,
          kmUltima,
          kmMeta,
          kmFaltante: intervalo,
          atrasadoPorData: false,
          status: 'sem_dados' as const,
          ordenacao: 100_000_000,
        }
      }

      const kmFaltante = kmMeta - kmAtual

      // O cálculo de KM acima só enxerga atraso por KM. Reaproveita o mesmo
      // status usado na tabela/cards (getStatusPreventiva), que também
      // considera atraso por DATA — sem isso, uma preventiva vencida por
      // data (mesmo com KM ainda folgado) aparecia aqui como "em dia".
      const statusReal = getStatusPreventiva(v)
      const atrasadoPorData = statusReal.atrasada && kmFaltante >= 0
      const status = statusReal.atrasada ? 'atrasado' : kmFaltante <= 5000 ? 'proximo' : 'em_dia'

      // Chave só pra ordenação: garante que atrasados (mesmo os que só
      // venceram por data, com KM ainda positivo) sempre fiquem à frente dos
      // que estão em dia, sem mentir o valor real de KM exibido na barra.
      const ordenacao = status === 'atrasado' ? kmFaltante - 1_000_000 : kmFaltante

      return {
        placa,
        modelo: v.modeloNome || v.marcaNome || 'VEÍCULO',
        marca: v.marcaNome,
        tipo: v.tipo,
        kmAtual,
        kmUltima,
        kmMeta,
        kmFaltante,
        atrasadoPorData,
        status,
        ordenacao,
      }
    }).sort((a, b) => a.ordenacao - b.ordenacao || a.placa.localeCompare(b.placa))

    if (filtroGraficoKm === 'criticos') {
      const criticos = lista.filter((v) => v.status === 'atrasado' || (v.status !== 'sem_dados' && v.kmFaltante <= 5000))
      return criticos.length > 0 ? criticos : lista.slice(0, 10)
    }
    if (filtroGraficoKm === 'top12') {
      return lista.slice(0, 12)
    }
    if (filtroGraficoKm === 'top20') {
      return lista.slice(0, 20)
    }
    return lista
  }, [frotasCategoria, ultimasKmsPorPlaca, filtroGraficoKm, filtroTipoGraficoKm])

  // Distribuição da Frota por Categoria — sempre reflete a frota inteira
  // (não o subconjunto filtrado pela aba), já que faz pouco sentido mostrar
  // "0%" nas outras categorias quando o usuário já está numa aba de categoria única.
  const distribuicaoCategorias = useMemo(() => {
    let trator = 0
    let pesado = 0
    let leve = 0
    let carreta = 0
    let embarcado = 0

    frotas.forEach((v) => {
      if (v.tipo === 'trator') trator++
      else if (v.tipo === 'pesado') pesado++
      else if (v.tipo === 'carreta') carreta++
      else if (v.tipo === 'embarcado') embarcado++
      else leve++
    })

    const total = frotas.length || 1

    return [
      { nome: 'Cavalo', total: trator, pct: Math.round((trator / total) * 100), cor: '#6366f1', icone: '🚜', tipo: 'trator' },
      { nome: 'Carretas & Dollys', total: carreta, pct: Math.round((carreta / total) * 100), cor: '#ec4899', icone: '🛣️', tipo: 'carreta' },
      { nome: 'Frota Leve / Utilitários', total: leve, pct: Math.round((leve / total) * 100), cor: '#3b82f6', icone: '🚗', tipo: 'leve' },
      { nome: 'Caminhões Pesados', total: pesado, pct: Math.round((pesado / total) * 100), cor: '#f59e0b', icone: '🚚', tipo: 'pesado' },
      { nome: 'Embarcados (Munck/Plataforma)', total: embarcado, pct: Math.round((embarcado / total) * 100), cor: '#a855f7', icone: '🏗️', tipo: 'embarcado' },
    ]
  }, [frotas])

  // Histórico de checklists do veículo aberto no modal de detalhes
  const checklistsDoVeiculoDetalhando = useMemo(() => {
    if (!veiculoDetalhando) return []
    const placa = veiculoDetalhando.placa.toUpperCase().trim()
    return checklists
      .filter((c) => c.placa.toUpperCase().trim() === placa)
      .sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime())
  }, [checklists, veiculoDetalhando])

  // 2. DADOS DO GRÁFICO 2: Checklists Realizados por Pessoa (Motorista / Condutor)
  // Escopado pela aba de categoria ativa (Frota Leve / Rodocaçamba / Embarcado /
  // Visão Consolidada) — hoje o checklist só existe para Frota Leve, então nas
  // abas Rodocaçamba e Embarcado este gráfico fica vazio até o recurso existir lá.
  const dadosGraficoChecklistPessoa = useMemo(() => {
    const placasDaCategoria = new Set(frotasCategoria.map((v) => v.placa.toUpperCase().trim()))
    const checklistsDaCategoria = checklists.filter((chk) => placasDaCategoria.has(chk.placa.toUpperCase().trim()))

    const contagem = new Map<
      string,
      { total: number; aprovados: number; ressalvas: number; reprovados: number; placas: Set<string> }
    >()

    checklistsDaCategoria.forEach((chk) => {
      const pessoa = (chk.motoristaNome || chk.inspetorNome || 'NÃO IDENTIFICADO').toUpperCase().trim()
      const atual = contagem.get(pessoa) || { total: 0, aprovados: 0, ressalvas: 0, reprovados: 0, placas: new Set<string>() }
      atual.total++
      if (chk.resultado === 'aprovado') atual.aprovados++
      else if (chk.resultado === 'aprovado_com_ressalvas') atual.ressalvas++
      else if (chk.resultado === 'reprovado') atual.reprovados++
      if (chk.placa) atual.placas.add(chk.placa.toUpperCase().trim())
      contagem.set(pessoa, atual)
    })

    return Array.from(contagem.entries())
      .map(([nome, dados]) => ({
        nome,
        total: dados.total,
        aprovados: dados.aprovados,
        ressalvas: dados.ressalvas,
        reprovados: dados.reprovados,
        placas: Array.from(dados.placas).sort(),
      }))
      .sort((a, b) => b.total - a.total)
  }, [checklists, frotasCategoria])

  // 3. DADOS DO GRÁFICO 3: Dias Restantes para Vencimento do CRLV por Placa
  const dadosGraficoVencimentoDoc = useMemo(() => {
    const hoje = startOfDay(new Date())

    return frotasCategoria
      .filter((v) => Boolean(v.vencimentoDocumento))
      .map((v) => {
        const placa = v.placa.toUpperCase().trim()
        const dataDoc = parseISO(v.vencimentoDocumento!)
        const dias = differenceInDays(dataDoc, hoje)

        return {
          placa,
          modelo: v.modeloNome || v.marcaNome || 'VEÍCULO',
          dias,
          vencimento: format(dataDoc, 'dd/MM/yyyy'),
          crlvPago: Boolean(v.crlvPago),
          status: v.crlvPago ? 'pago' : dias < 0 ? 'vencido' : dias <= 30 ? 'a_vencer' : 'em_dia',
        }
      })
      .sort((a, b) => a.dias - b.dias)
  }, [frotasCategoria])

  // 4. DADOS DO GRÁFICO 4: Dias Restantes para Vencimento do Tacógrafo por Placa (Exclusivo Rodocaçamba & Pesados)
  const dadosGraficoVencimentoTacografo = useMemo(() => {
    const hoje = startOfDay(new Date())

    return frotasCategoria
      .filter((v) => !isFrotaLeve(v) && Boolean(v.vencimentoTacografo))
      .map((v) => {
        const placa = v.placa.toUpperCase().trim()
        const dataTac = parseISO(v.vencimentoTacografo!)
        const dias = differenceInDays(dataTac, hoje)

        return {
          placa,
          modelo: v.modeloNome || v.marcaNome || 'VEÍCULO',
          numeroTacografo: v.numeroTacografo || '',
          emissao: v.emissaoTacografo ? format(parseISO(v.emissaoTacografo), 'dd/MM/yyyy') : '',
          dias,
          vencimento: format(dataTac, 'dd/MM/yyyy'),
          status: dias < 0 ? 'vencido' : dias <= 30 ? 'a_vencer' : 'em_dia',
        }
      })
      .sort((a, b) => a.dias - b.dias)
  }, [frotasCategoria])

  // Métricas da Frota
  const metricasFrota = useMemo(() => {
    const total = frotasCategoria.length
    let operantes = 0
    let inoperantes = 0
    let noPatio = 0
    let preventivaAtrasada = 0
    let docAVencer = 0
    let docVencido = 0
    let docEmDia = 0
    let seguroAVencer = 0
    let seguroVencido = 0
    let seguroEmDia = 0
    let tacografoAVencer = 0
    let tacografoVencido = 0
    let tacografoEmDia = 0

    frotasCategoria.forEach((v) => {
      if (v.situacao === 'operante') operantes++
      else inoperantes++

      if (placasNoPatio.has(v.placa.toUpperCase().trim())) noPatio++

      const statusPrev = getStatusPreventiva(v)
      if (statusPrev.status === 'atrasada') preventivaAtrasada++

      const statusDoc = getStatusDocumento(v.vencimentoDocumento)
      if (v.crlvPago) docEmDia++
      else if (statusDoc.status === 'vencido') docVencido++
      else if (statusDoc.status === 'a_vencer') docAVencer++
      else if (statusDoc.status === 'em_dia') docEmDia++

      const statusSeg = getStatusSeguro(v.vencimentoSeguro)
      if (statusSeg.status === 'vencido') seguroVencido++
      else if (statusSeg.status === 'a_vencer') seguroAVencer++
      else if (statusSeg.status === 'em_dia') seguroEmDia++

      // Tacógrafo apenas para pesados (frota leve não tem tacógrafo)
      if (!isFrotaLeve(v)) {
        const statusTac = getStatusTacografo(v.vencimentoTacografo)
        if (statusTac.status === 'vencido') tacografoVencido++
        else if (statusTac.status === 'a_vencer') tacografoAVencer++
        else if (statusTac.status === 'em_dia') tacografoEmDia++
      }
    })

    const foraDoPatio = total - noPatio

    return {
      total,
      operantes,
      inoperantes,
      noPatio,
      foraDoPatio,
      preventivaAtrasada,
      docAVencer,
      docVencido,
      docEmDia,
      seguroAVencer,
      seguroVencido,
      seguroEmDia,
      tacografoAVencer,
      tacografoVencido,
      tacografoEmDia,
    }
  }, [frotasCategoria, placasNoPatio, ultimasKmsPorPlaca])

  // Métricas do Checklist
  const metricasChecklist = useMemo(() => {
    const total = checklists.length
    const aprovados = checklists.filter((c) => c.resultado === 'aprovado').length
    const comRessalvas = checklists.filter((c) => c.resultado === 'aprovado_com_ressalvas').length
    const reprovados = checklists.filter((c) => c.resultado === 'reprovado').length
    const taxaAprovacao = total > 0 ? Math.round((aprovados / total) * 100) : 100

    return { total, aprovados, comRessalvas, reprovados, taxaAprovacao }
  }, [checklists])

  // Veículo Selecionado no Novo Checklist para Comparação de KM
  const veiculoChecklistSelecionado = useMemo(() => {
    return frotas.find((f) => f.id === veiculoChecklistId)
  }, [frotas, veiculoChecklistId])

  // Sugere automaticamente IDA ou VOLTA pras placas que exigem os dois: se
  // o último checklist de hoje pra essa placa foi uma IDA sem VOLTA depois,
  // sugere VOLTA — senão sugere IDA.
  useEffect(() => {
    if (!veiculoChecklistSelecionado || !precisaChecklistIdaVolta(veiculoChecklistSelecionado.placa)) return
    const placa = veiculoChecklistSelecionado.placa.toUpperCase().trim()
    const hoje = startOfDay(new Date())
    const ultimoDeHoje = checklists
      .filter((c) => c.placa.toUpperCase().trim() === placa && !isBefore(parseISO(c.dataHora), hoje))
      .sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime())[0]
    setTipoChecklistNovo(ultimoDeHoje?.tipoChecklist === 'ida' ? 'volta' : 'ida')
  }, [veiculoChecklistSelecionado, checklists])

  // Placas de ida/volta cujo checklist de IDA de hoje ainda não teve uma
  // VOLTA correspondente — ficam "pendentes" até o veículo ser devolvido.
  const checklistsIdaVoltaPendentes = useMemo(() => {
    const hoje = startOfDay(new Date())
    const pendentes: { placa: string; modelo: string; dataIda: string; veiculoId: string }[] = []

    for (const placa of PLACAS_CHECKLIST_IDA_VOLTA) {
      const deHoje = checklists
        .filter((c) => c.placa.toUpperCase().trim() === placa && !isBefore(parseISO(c.dataHora), hoje))
        .sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime())

      const ultimo = deHoje[0]
      if (ultimo && ultimo.tipoChecklist === 'ida') {
        pendentes.push({ placa, modelo: ultimo.modeloNome || '', dataIda: ultimo.dataHora, veiculoId: ultimo.veiculoId })
      }
    }

    return pendentes
  }, [checklists])

  // Cálculo da Comparação de KM da Preventiva em Tempo Real no Checklist
  const comparacaoPreventivaChecklist = useMemo((): StatusPreventivaChecklist => {
    if (!veiculoChecklistSelecionado) {
      return { status: 'sem_dados', mensagem: 'Selecione um veículo para comparar a preventiva.' }
    }

    const kmUltima = veiculoChecklistSelecionado.kmUltimaPreventiva || 0
    const intervalo = veiculoChecklistSelecionado.intervaloPreventivaKm || 10000

    if (!kmUltima && !veiculoChecklistSelecionado.kmProximaPreventiva) {
      return {
        status: 'sem_dados',
        mensagem: 'Veículo sem KM de última preventiva cadastrado.',
      }
    }

    const kmLimite = kmUltima > 0 ? kmUltima + intervalo : (veiculoChecklistSelecionado.kmProximaPreventiva || 0)
    const kmDigitada = Number(kmChecklist) || 0

    if (kmDigitada <= 0) {
      return {
        status: 'sem_dados',
        kmUltima,
        kmLimite,
        mensagem: `Digite o KM atual para comparar com o limite de preventiva (${kmLimite.toLocaleString('pt-BR')} KM).`,
      }
    }

    const kmRodados = kmUltima > 0 ? kmDigitada - kmUltima : 0
    const kmRestante = kmLimite - kmDigitada

    if (kmRestante < 0) {
      return {
        status: 'vencida',
        kmUltima,
        kmLimite,
        kmRestante,
        kmRodados,
        mensagem: `🛑 PREVENTIVA VENCIDA POR KM! Ultrapassou o limite de ${kmLimite.toLocaleString('pt-BR')} KM em ${Math.abs(kmRestante).toLocaleString('pt-BR')} KM (Rodou ${kmRodados.toLocaleString('pt-BR')} KM desde a última revisão).`,
      }
    }

    if (kmRestante <= 1000) {
      return {
        status: 'proxima',
        kmUltima,
        kmLimite,
        kmRestante,
        kmRodados,
        mensagem: `⚠️ ATENÇÃO: PREVENTIVA PRÓXIMA! Faltam apenas ${kmRestante.toLocaleString('pt-BR')} KM para atingir a quilometragem de revisão (${kmLimite.toLocaleString('pt-BR')} KM).`,
      }
    }

    return {
      status: 'em_dia',
      kmUltima,
      kmLimite,
      kmRestante,
      kmRodados,
      mensagem: `✅ PREVENTIVA EM DIA: Faltam ${kmRestante.toLocaleString('pt-BR')} KM para a próxima preventiva (Limite: ${kmLimite.toLocaleString('pt-BR')} KM).`,
    }
  }, [veiculoChecklistSelecionado, kmChecklist])

  // Filtro de Veículos
  const veiculosFiltrados = useMemo(() => {
    return frotasCategoria.filter((v) => {
      // Garantia estrita: se estiver em Rodocaçamba, NUNCA passa veículo leve ou embarcado
      if (categoriaFrota === 'pesado' && (isFrotaLeve(v) || isFrotaEmbarcado(v))) return false
      // Se estiver em Frota Leve, NUNCA passa veículo pesado ou embarcado
      if (categoriaFrota === 'leve' && !isFrotaLeve(v)) return false
      // Se estiver em Embarcados, NUNCA passa veículo fora dessa lista
      if (categoriaFrota === 'embarcado' && !isFrotaEmbarcado(v)) return false

      if (tipoFiltro !== 'todos') {
        if (categoriaFrota === 'leve') {
          const matchSub = v.tipoVeiculo?.toUpperCase() === tipoFiltro.toUpperCase() || v.tipo === tipoFiltro
          if (!matchSub) return false
        } else {
          if (v.tipo !== tipoFiltro) return false
        }
      }

      if (alertaFiltro === 'preventiva_atrasada') {
        const st = getStatusPreventiva(v)
        if (st.status !== 'atrasada') return false
      } else if (alertaFiltro === 'doc_a_vencer') {
        const st = getStatusDocumento(v.vencimentoDocumento)
        if (v.crlvPago || st.status !== 'a_vencer') return false
      } else if (alertaFiltro === 'doc_vencido') {
        const st = getStatusDocumento(v.vencimentoDocumento)
        if (v.crlvPago || st.status !== 'vencido') return false
      } else if (alertaFiltro === 'seguro_a_vencer') {
        const st = getStatusSeguro(v.vencimentoSeguro)
        if (st.status !== 'a_vencer') return false
      } else if (alertaFiltro === 'seguro_vencido') {
        const st = getStatusSeguro(v.vencimentoSeguro)
        if (st.status !== 'vencido') return false
      } else if (alertaFiltro === 'tacografo_a_vencer') {
        if (isFrotaLeve(v)) return false
        const st = getStatusTacografo(v.vencimentoTacografo)
        if (st.status !== 'a_vencer') return false
      } else if (alertaFiltro === 'tacografo_vencido') {
        if (isFrotaLeve(v)) return false
        const st = getStatusTacografo(v.vencimentoTacografo)
        if (st.status !== 'vencido') return false
      }

      if (!busca.trim()) return true
      const termo = busca.toLowerCase().trim()
      const placa = v.placa?.toLowerCase() || ''
      const modelo = v.modeloNome?.toLowerCase() || ''
      const marca = v.marcaNome?.toLowerCase() || ''
      const cliente = v.clienteNome?.toLowerCase() || ''
      const chassi = v.chassi?.toLowerCase() || ''
      const cor = v.cor?.toLowerCase() || ''
      const numTac = v.numeroTacografo?.toLowerCase() || ''

      const setor = v.setor?.toLowerCase() || ''
      const responsavel = v.responsavel?.toLowerCase() || ''
      const tipoVeiculo = v.tipoVeiculo?.toLowerCase() || ''

      return (
        placa.includes(termo) ||
        modelo.includes(termo) ||
        marca.includes(termo) ||
        cliente.includes(termo) ||
        chassi.includes(termo) ||
        cor.includes(termo) ||
        numTac.includes(termo) ||
        setor.includes(termo) ||
        responsavel.includes(termo) ||
        tipoVeiculo.includes(termo)
      )
    })
  }, [frotasCategoria, categoriaFrota, tipoFiltro, alertaFiltro, busca, ultimasKmsPorPlaca])

  // Filtro de Checklists
  const checklistsFiltrados = useMemo(() => {
    return checklists.filter((c) => {
      if (filtroResultadoChecklist !== 'todos' && c.resultado !== filtroResultadoChecklist) return false
      if (!buscaChecklist.trim()) return true
      const termo = buscaChecklist.toLowerCase().trim()
      return (
        c.placa.toLowerCase().includes(termo) ||
        c.motoristaNome.toLowerCase().includes(termo) ||
        (c.clienteNome && c.clienteNome.toLowerCase().includes(termo)) ||
        (c.modeloNome && c.modeloNome.toLowerCase().includes(termo))
      )
    })
  }, [checklists, filtroResultadoChecklist, buscaChecklist])

  // Filtro de Viagens
  const STATUS_ATIVAS: StatusViagem[] = ['cotada', 'confirmada', 'em_transito']
  const viagensFiltradas = useMemo(() => {
    const filtradas = viagens.filter((v) => {
      if (filtroStatusViagem === 'ativas' && !STATUS_ATIVAS.includes(v.status)) return false
      if (filtroStatusViagem !== 'ativas' && filtroStatusViagem !== 'todas' && v.status !== filtroStatusViagem) return false
      if (filtroVeiculoIdViagem && v.veiculoId !== filtroVeiculoIdViagem) return false
      if (filtroClienteIdViagem && v.clienteId !== filtroClienteIdViagem) return false
      if (filtroCentroCustoIdViagem && v.centroCustoId !== filtroCentroCustoIdViagem) return false
      if (filtroTipoFreteViagem !== 'todos' && v.tipoFrete !== filtroTipoFreteViagem) return false
      if (filtroDataColetaDeViagem && (!v.dataColetaPrevista || v.dataColetaPrevista < filtroDataColetaDeViagem)) return false
      if (filtroDataColetaAteViagem && (!v.dataColetaPrevista || v.dataColetaPrevista > filtroDataColetaAteViagem)) return false
      if (!buscaViagem.trim()) return true
      const termo = buscaViagem.toLowerCase().trim()
      return (
        v.id.toLowerCase().includes(termo) ||
        v.placa.toLowerCase().includes(termo) ||
        v.motoristaNome.toLowerCase().includes(termo) ||
        v.origem.toLowerCase().includes(termo) ||
        v.destino.toLowerCase().includes(termo) ||
        (v.clienteNome && v.clienteNome.toLowerCase().includes(termo)) ||
        (v.veiculoNome && v.veiculoNome.toLowerCase().includes(termo)) ||
        (v.finalidade && v.finalidade.toLowerCase().includes(termo))
      )
    })

    const valorOrdenacao = (v: RegistroViagem): string | number => {
      switch (ordenacaoViagem.campo) {
        case 'id':
          return v.id
        case 'dataColeta':
          return v.dataColetaPrevista || v.dataHoraSaida || ''
        case 'dataEntrega':
          return v.dataEntregaPrevista || ''
        case 'frete':
          return v.freteBruto || 0
        case 'adiantamento':
          return v.adiantamento || 0
        case 'saldo':
          return (v.freteBruto || 0) - (v.adiantamento || 0)
      }
    }

    const ordenadas = [...filtradas].sort((a, b) => {
      const va = valorOrdenacao(a)
      const vb = valorOrdenacao(b)
      const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb))
      return ordenacaoViagem.direcao === 'asc' ? cmp : -cmp
    })

    return ordenadas
  }, [
    viagens,
    filtroStatusViagem,
    filtroVeiculoIdViagem,
    filtroClienteIdViagem,
    filtroCentroCustoIdViagem,
    filtroTipoFreteViagem,
    filtroDataColetaDeViagem,
    filtroDataColetaAteViagem,
    buscaViagem,
    ordenacaoViagem,
  ])

  const metricasViagens = useMemo(() => {
    const totalFretes = viagensFiltradas.reduce((acc, v) => acc + (v.freteBruto || 0), 0)
    const totalAdiantamentos = viagensFiltradas.reduce((acc, v) => acc + (v.adiantamento || 0), 0)
    const saldo = totalFretes - totalAdiantamentos
    const custoOperacionalTotal = viagensFiltradas.reduce((acc, v) => acc + (v.custoOperacional || 0), 0)
    const saldoLiquido = saldo - custoOperacionalTotal
    return { totalFretes, totalAdiantamentos, saldo, custoOperacionalTotal, saldoLiquido }
  }, [viagensFiltradas])

  function alternarOrdenacaoViagem(campo: OrdenacaoViagemCampo) {
    setOrdenacaoViagem((atual) =>
      atual.campo === campo ? { campo, direcao: atual.direcao === 'asc' ? 'desc' : 'asc' } : { campo, direcao: 'asc' },
    )
  }

  // Handlers de Veículo
  function iniciarCriacaoVeiculo() {
    setEditandoId(null)
    setModeloNomePendente(null)
    const tipoInicial = categoriaFrota === 'pesado' || categoriaFrota === 'embarcado' ? 'pesado' : 'leve'
    reset({
      clienteId: clienteGvel.id,
      tipo: tipoInicial,
      tipoVeiculo: tipoInicial === 'leve' ? 'CARRO' : '',
      situacao: 'operante',
      placa: '',
      cor: 'BRANCO',
      setor: tipoInicial === 'leve' ? 'GV MANUTENÇÃO' : '',
      responsavel: '',
      chassi: '',
      ano: anoAtual,
      marcaId: '',
      modeloId: '',
      vencimentoDocumento: '',
      vencimentoSeguro: '',
      numeroTacografo: '',
      emissaoTacografo: '',
      vencimentoTacografo: '',
      dataUltimaPreventiva: '',
      kmUltimaPreventiva: undefined,
      intervaloPreventivaKm: tipoInicial === 'pesado' ? 20000 : 10000,
      observacoes: '',
    })
    setMostrarModalVeiculo(true)
  }

  function iniciarEdicaoVeiculo(v: ItemFrotaCadastrada) {
    setEditandoId(v.id)
    // Resolve a marca já cadastrada (por nome) pra pré-selecionar o dropdown
    // — sem isso o formulário sempre abria pedindo "selecione a marca" de
    // novo, mesmo com o veículo já tendo marca/modelo definidos.
    const marcaObj = marcas.find((m) => m.nome.toUpperCase().trim() === (v.marcaNome || '').toUpperCase().trim())
    setModeloNomePendente(marcaObj && v.modeloNome ? v.modeloNome : null)
    reset({
      clienteId: clienteGvel.id,
      placa: v.placa,
      tipo: v.tipo,
      tipoVeiculo: v.tipoVeiculo || (v.tipo === 'leve' ? 'CARRO' : ''),
      cor: v.cor || '',
      setor: v.setor || '',
      responsavel: v.responsavel || '',
      chassi: v.chassi ?? '',
      situacao: v.situacao,
      ano: v.ano || anoAtual,
      marcaId: marcaObj?.id || '',
      modeloId: '',
      vencimentoDocumento: v.vencimentoDocumento || '',
      vencimentoSeguro: v.vencimentoSeguro || '',
      numeroTacografo: v.numeroTacografo || '',
      emissaoTacografo: v.emissaoTacografo || '',
      vencimentoTacografo: v.vencimentoTacografo || '',
      dataUltimaPreventiva: v.dataUltimaPreventiva || v.vencimentoPreventiva || '',
      kmUltimaPreventiva: v.kmUltimaPreventiva,
      intervaloPreventivaKm:
        v.intervaloPreventivaKm || (v.tipo === 'pesado' || v.tipo === 'trator' || v.tipo === 'embarcado' ? 20000 : 10000),
      observacoes: v.observacoes || '',
    })
    setMostrarModalVeiculo(true)
  }

  async function onSubmitVeiculo(values: FormVeiculoValues) {
    setErroLista(null)
    const marcaObj = marcas.find((m) => m.id === values.marcaId)
    const modeloObj = modelos.find((m) => m.id === values.modeloId)

    // Forçar a categoria correta conforme a aba ativa
    let tipoCorreto = values.tipo
    if (categoriaFrota === 'pesado') {
      if (tipoCorreto === 'leve') tipoCorreto = 'pesado'
    } else if (categoriaFrota === 'leve') {
      tipoCorreto = 'leve'
    } else if (categoriaFrota === 'embarcado') {
      tipoCorreto = 'embarcado'
    }

    const novoItem: ItemFrotaCadastrada = {
      id: editandoId || `veic_${Date.now()}`,
      placa: values.placa.toUpperCase().trim(),
      tipo: tipoCorreto,
      tipoVeiculo: tipoCorreto === 'leve' ? (values.tipoVeiculo || 'CARRO') : undefined,
      cor: values.cor.toUpperCase().trim(),
      setor: tipoCorreto === 'leve' && values.setor?.trim() ? values.setor.toUpperCase().trim() : undefined,
      responsavel: tipoCorreto === 'leve' && values.responsavel?.trim() ? values.responsavel.toUpperCase().trim() : undefined,
      chassi: values.chassi?.trim() ? values.chassi.toUpperCase().trim() : undefined,
      situacao: values.situacao,
      ano: values.ano,
      clienteId: clienteGvel.id,
      clienteNome: 'G VEL DIESEL & TRANSPORTES LTDA',
      marcaNome: marcaObj?.nome || '',
      modeloNome: modeloObj?.nome || '',
      vencimentoDocumento: values.vencimentoDocumento || undefined,
      vencimentoSeguro: values.vencimentoSeguro || undefined,
      numeroTacografo: values.numeroTacografo?.trim() || undefined,
      emissaoTacografo: values.emissaoTacografo || undefined,
      vencimentoTacografo: values.vencimentoTacografo || undefined,
      dataUltimaPreventiva: values.dataUltimaPreventiva || undefined,
      kmUltimaPreventiva: values.kmUltimaPreventiva || undefined,
      intervaloPreventivaKm:
        values.intervaloPreventivaKm ||
        (tipoCorreto === 'pesado' || tipoCorreto === 'trator' || tipoCorreto === 'embarcado' ? 20000 : 10000),
      observacoes: values.observacoes?.trim() || undefined,
      createdAt: new Date().toISOString(),
    }

    if (editandoId) {
      salvarFrotas(frotas.map((f) => (f.id === editandoId ? novoItem : f)))
    } else {
      salvarFrotas([novoItem, ...frotas])
    }

    setMostrarModalVeiculo(false)
  }

  async function handleExcluirVeiculo(id: string) {
    if (!isAdmin) {
      setErroLista('Só administradores podem excluir veículos da frota.')
      return
    }
    if (!confirm('Deseja realmente excluir este veículo da frota?')) return
    salvarFrotas(frotas.filter((f) => f.id !== id))
  }

  // Lista de veículos disponíveis para o checklist — Frota Leve e Rodocaçamba
  // (pesados, cavalos trator e carretas). Embarcados ainda não entram.
  const veiculosFrotaLeveChecklist = useMemo(() => {
    return frotas.filter((f) => f.tipo === 'leve' || f.tipo === 'pesado' || f.tipo === 'trator' || f.tipo === 'carreta')
  }, [frotas])

  // Lista de veículos filtrados para o modal de checklist, restrita à
  // categoria escolhida no seletor (Todos / Leve / Rodocaçamba) e depois pela busca.
  const veiculosFiltradosChecklist = useMemo(() => {
    let lista = veiculosFrotaLeveChecklist
    if (categoriaChecklistNovo === 'leve') {
      lista = lista.filter((f) => f.tipo === 'leve')
    } else if (categoriaChecklistNovo === 'rodocacamba') {
      lista = lista.filter((f) => f.tipo === 'pesado' || f.tipo === 'trator' || f.tipo === 'carreta')
    }

    const buscaLimpa = placaBuscaChecklist.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
    const buscaTexto = placaBuscaChecklist.trim().toUpperCase()
    if (!buscaTexto) return lista

    return lista.filter(
      (f) =>
        f.placa.toUpperCase().replace(/[^A-Z0-9]/g, '').includes(buscaLimpa) ||
        (f.modeloNome && f.modeloNome.toUpperCase().includes(buscaTexto)) ||
        (f.marcaNome && f.marcaNome.toUpperCase().includes(buscaTexto)) ||
        (f.setor && f.setor.toUpperCase().includes(buscaTexto)) ||
        (f.responsavel && f.responsavel.toUpperCase().includes(buscaTexto))
    )
  }, [veiculosFrotaLeveChecklist, categoriaChecklistNovo, placaBuscaChecklist])

  // Handlers de Checklist
  function iniciarNovoChecklist() {
    setVeiculoChecklistId('')
    setCategoriaChecklistNovo('todos')
    setPlacaBuscaChecklist('')
    setDropdownPlacaAberto(false)
    setMotoristaChecklist('')
    setKmChecklist(0)
    setResultadoChecklist('aprovado')
    setObsChecklist('')
    setFotosChecklist({})
    setTipoChecklistNovo('ida')
    setMostrarModalNovoChecklist(true)
  }

  // Abre o modal de novo checklist já com o veículo da IDA pendente
  // selecionado, pronto pra registrar a VOLTA (o useEffect que sugere
  // ida/volta automaticamente já marca "volta" assim que o veículo é selecionado).
  function iniciarChecklistVolta(veiculoId: string) {
    setVeiculoChecklistId(veiculoId)
    setCategoriaChecklistNovo('todos')
    setPlacaBuscaChecklist('')
    setDropdownPlacaAberto(false)
    setMotoristaChecklist('')
    setKmChecklist(0)
    setResultadoChecklist('aprovado')
    setObsChecklist('')
    setFotosChecklist({})
    setMostrarModalNovoChecklist(true)
  }

  function iniciarNovaViagem() {
    setViagemEditando(null)
    setMostrarModalViagem(true)
  }

  function iniciarEdicaoViagem(viagem: RegistroViagem) {
    setViagemEditando(viagem)
    setMostrarModalViagem(true)
  }

  async function handleExcluirViagem(id: string) {
    if (!confirm('Excluir este registro de viagem? Essa ação não pode ser desfeita.')) return
    try {
      await excluirViagemFrota(id)
    } catch (err) {
      alert(getErrorMessage(err, 'Erro ao excluir a viagem.'))
    }
  }

  async function handleUploadFoto(tipo: keyof FotosVistoria, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const base64 = await comprimirFoto(file)
      setFotosChecklist((prev) => ({ ...prev, [tipo]: base64 }))
    } catch (err) {
      console.error('Erro ao processar imagem:', err)
      alert('Erro ao carregar a foto.')
    }
  }

  async function handleSalvarChecklist(e: React.FormEvent) {
    e.preventDefault()
    if (!veiculoChecklistId) {
      alert('Selecione um veículo da frota.')
      return
    }
    if (!motoristaChecklist.trim()) {
      alert('Informe o nome do motorista ou condutor.')
      return
    }

    const veiculo = frotas.find((f) => f.id === veiculoChecklistId)
    const inspetor = perfil?.nome || user?.email || 'INSPETOR'

    let resFinal = resultadoChecklist

    // Se a preventiva estiver vencida por KM, sugerir ressalva caso esteja como aprovado direto
    if (comparacaoPreventivaChecklist.status === 'vencida' && resFinal === 'aprovado') {
      resFinal = 'aprovado_com_ressalvas'
    }

    setSalvandoChecklist(true)
    try {
      await criarChecklistFrota({
        veiculoId: veiculoChecklistId,
        placa: veiculo?.placa || 'PLACA',
        modeloNome: veiculo?.modeloNome,
        clienteNome: veiculo?.clienteNome,
        motoristaNome: motoristaChecklist.toUpperCase().trim(),
        inspetorNome: inspetor.toUpperCase(),
        kmAtual: Number(kmChecklist) || 0,
        resultado: resFinal,
        statusPreventiva: comparacaoPreventivaChecklist,
        itens: [],
        fotos: fotosChecklist,
        observacoesGerais: obsChecklist.trim() || undefined,
        tipoChecklist: veiculo && precisaChecklistIdaVolta(veiculo.placa) ? tipoChecklistNovo : undefined,
      })
      await refetchChecklists()
      setMostrarModalNovoChecklist(false)
    } catch (err) {
      alert(`Não foi possível salvar o checklist: ${getErrorMessage(err, 'verifique sua conexão e tente novamente.')}`)
    } finally {
      setSalvandoChecklist(false)
    }
  }

  async function handleExcluirChecklist(id: string) {
    if (!isAdmin) {
      alert('Só administradores podem excluir registros de checklist.')
      return
    }
    if (!confirm('Deseja excluir este registro de checklist?')) return
    try {
      await excluirChecklistFrota(id)
      await refetchChecklists()
    } catch (err) {
      alert(err instanceof Error ? `Não foi possível excluir: ${err.message}` : 'Não foi possível excluir o checklist.')
    }
  }

  const totalFotosTiradas = [
    fotosChecklist.painel,
    fotosChecklist.frente,
    fotosChecklist.ladoEsquerdo,
    fotosChecklist.traseira,
    fotosChecklist.ladoDireito,
  ].filter(Boolean).length

  return (
    <div className="space-y-6 animate-fade-in uppercase pb-12">
      {/* Cabeçalho Dinâmico */}
      <PageHeader
        title={
          abaPrincipal === 'dashboard'
            ? 'DASHBOARD DA FROTA'
            : abaPrincipal === 'checklist'
            ? 'CHECKLIST DA FROTA'
            : abaPrincipal === 'viagens'
            ? 'CONTROLE DE VIAGENS'
            : 'VEÍCULOS DA FROTA'
        }
        subtitle={
          abaPrincipal === 'dashboard'
            ? 'KM RESTANTE PARA PREVENTIVA, AUDITORIA DE CHECKLISTS E VENCIMENTO DE DOCUMENTOS'
            : abaPrincipal === 'checklist'
            ? 'INSPEÇÕES VEICULARES, VISTORIAS OPERACIONAIS E LAUDOS DE CONFORMIDADE'
            : abaPrincipal === 'viagens'
            ? 'ORIGEM, DESTINO, MOTORISTA E KM RODADO DE CADA VIAGEM DA FROTA'
            : 'CONTROLE DE CAMINHÕES, PREVENTIVAS E VENCIMENTO DE DOCUMENTOS (CRLV)'
        }
        actions={
          <div className="flex items-center gap-2">
            {abaPrincipal === 'dashboard' && (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={iniciarNovoChecklist}
                  className="gap-1.5 shadow-sm font-bold text-xs"
                >
                  <ClipboardCheck className="h-4 w-4" />
                  NOVO CHECKLIST
                </Button>
                <Button
                  type="button"
                  onClick={iniciarCriacaoVeiculo}
                  className="gap-1.5 shadow-md shadow-primary/20 font-bold text-xs"
                >
                  <Plus className="h-4 w-4" />
                  NOVO VEÍCULO
                </Button>
              </>
            )}
            {abaPrincipal === 'veiculos' && (
              <Button
                type="button"
                onClick={iniciarCriacaoVeiculo}
                className="gap-2 shadow-md shadow-primary/20 uppercase font-bold"
              >
                <Plus className="h-4 w-4" />
                NOVO VEÍCULO
              </Button>
            )}
            {abaPrincipal === 'checklist' && (
              <Button
                type="button"
                onClick={iniciarNovoChecklist}
                className="gap-2 shadow-md shadow-primary/20 uppercase font-bold"
              >
                <Plus className="h-4 w-4" />
                NOVO CHECKLIST
              </Button>
            )}
          </div>
        }
      />

      {/* SUB-MENU DO CONTROLE DE VIAGENS: cada grupo é uma lista suspensa (dropdown) pra economizar espaço */}
      {abaPrincipal === 'viagens' && (
        <div className="flex flex-wrap items-center gap-2 p-2 bg-surface/90 border border-border/30 rounded-2xl backdrop-blur-md shadow-sm">
          {GRUPOS_MENU_VIAGENS.map((grupo) => (
            <DropdownMenuGrupo
              key={grupo.titulo}
              titulo={grupo.titulo}
              itens={grupo.itens}
              subAbaAtiva={subAbaViagens}
              onSelecionarTab={setSubAbaViagens}
              onNavegar={navigate}
            />
          ))}
        </div>
      )}

      {erroLista && (
        <div className="rounded-2xl border border-status-danger/30 bg-status-danger/10 p-4 text-xs font-bold text-status-danger flex items-center justify-between">
          <span>{erroLista}</span>
          <button onClick={() => setErroLista(null)} className="text-status-danger hover:opacity-70 p-1">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ALERTA PISCANTE: checklists de IDA pendentes de VOLTA (placas de ida/volta) — não faz sentido dentro do Controle de Viagens, que é outro contexto */}
      {abaPrincipal !== 'viagens' && checklistsIdaVoltaPendentes.length > 0 && (
        <div className="animate-blink-alert rounded-2xl border-2 border-red-500/50 bg-red-500/15 p-4 flex flex-wrap items-center gap-3 shadow-lg shadow-red-500/10">
          <AlertOctagon className="h-5 w-5 text-red-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-black text-red-400 uppercase">
              CHECKLIST DE VOLTA PENDENTE
            </p>
            <p className="text-[11px] text-red-300 font-semibold normal-case">
              {checklistsIdaVoltaPendentes.map((p, i) => (
                <span key={p.placa}>
                  {i > 0 && ' · '}
                  <button
                    type="button"
                    onClick={() => iniciarChecklistVolta(p.veiculoId)}
                    className="font-mono font-black underline decoration-dotted hover:text-red-100"
                    title="Clique para registrar o checklist de volta"
                  >
                    {p.placa}
                  </button>{' '}
                  saiu às {format(parseISO(p.dataIda), 'HH:mm')} e ainda não fez o checklist de devolução
                </span>
              ))}
            </p>
          </div>
        </div>
      )}

      {/* SELETOR DE CATEGORIA DA FROTA: FROTA LEVE vs FROTA PESADA vs VISÃO CONSOLIDADA */}
      {abaPrincipal !== 'checklist' && abaPrincipal !== 'viagens' && (
      <div className="flex flex-wrap items-center justify-between gap-3 p-2 bg-surface/90 border border-border/30 rounded-2xl backdrop-blur-md shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setCategoriaFrota('leve')
              setTipoFiltro('todos')
            }}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl font-black text-xs transition-all ${
              categoriaFrota === 'leve'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25 ring-2 ring-blue-400'
                : 'text-secondary hover:text-foreground hover:bg-surface-hover/50'
            }`}
          >
            <Car className="h-4 w-4" />
            <span>FROTA LEVE</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                categoriaFrota === 'leve' ? 'bg-white/20 text-white' : 'bg-surface border border-border/40 text-secondary'
              }`}
            >
              {contagemLeves}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setCategoriaFrota('pesado')
              setTipoFiltro('todos')
            }}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl font-black text-xs transition-all ${
              categoriaFrota === 'pesado'
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/25 ring-2 ring-amber-400'
                : 'text-secondary hover:text-foreground hover:bg-surface-hover/50'
            }`}
          >
            <Truck className="h-4 w-4" />
            <span>RODOCAÇAMBA</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                categoriaFrota === 'pesado' ? 'bg-white/20 text-white' : 'bg-surface border border-border/40 text-secondary'
              }`}
            >
              {contagemPesados}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setCategoriaFrota('embarcado')
              setTipoFiltro('todos')
            }}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl font-black text-xs transition-all ${
              categoriaFrota === 'embarcado'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/25 ring-2 ring-purple-400'
                : 'text-secondary hover:text-foreground hover:bg-surface-hover/50'
            }`}
          >
            <Construction className="h-4 w-4" />
            <span>EMBARCADO</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                categoriaFrota === 'embarcado' ? 'bg-white/20 text-white' : 'bg-surface border border-border/40 text-secondary'
              }`}
            >
              {contagemEmbarcados}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setCategoriaFrota('todos')
              setTipoFiltro('todos')
            }}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl font-black text-xs transition-all ${
              categoriaFrota === 'todos'
                ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25 ring-2 ring-primary/40'
                : 'text-secondary hover:text-foreground hover:bg-surface-hover/50'
            }`}
          >
            <Building2 className="h-4 w-4" />
            <span>VISÃO CONSOLIDADA</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                categoriaFrota === 'todos' ? 'bg-black/20 text-white' : 'bg-surface border border-border/40 text-secondary'
              }`}
            >
              {contagemTodos}
            </span>
          </button>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-[11px] font-bold text-secondary px-2">
          {categoriaFrota === 'leve' && <span className="text-blue-400">🚗 EXIBINDO FROTA LEVE (CARROS, MOTOS E UTILITÁRIOS)</span>}
          {categoriaFrota === 'pesado' && <span className="text-amber-400">🚛 EXIBINDO RODOCAÇAMBA (CAVALOS TRATOR, PESADOS E CARRETAS)</span>}
          {categoriaFrota === 'embarcado' && <span className="text-purple-400">🏗️ EXIBINDO EMBARCADOS (MUNCK, LANÇA E PLATAFORMAS)</span>}
          {categoriaFrota === 'todos' && <span>📊 EXIBINDO TODA A FROTA CONSOLIDADA</span>}
        </div>
      </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 0: DASHBOARD GERENCIAL DA FROTA (COM OS 3 GRÁFICOS SOLICITADOS) */}
      {/* ========================================================================= */}
      {abaPrincipal === 'dashboard' && (
        <div className="space-y-6">
          {/* Indicadores Principais em Cards */}
          <div
            className={`grid gap-3 sm:gap-4 ${
              categoriaFrota === 'leve'
                ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'
                : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'
            }`}
          >
            {/* Total da Frota */}
            <Card className="p-4 border-border/30 bg-surface/90">
              <div className="flex items-center justify-between text-secondary">
                <span className="text-[10px] font-black uppercase tracking-wider">TOTAL DA FROTA</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                  <Truck className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-2.5 text-3xl font-black font-mono text-foreground">{metricasFrota.total}</p>
              <div className="mt-1.5 flex items-center justify-between text-[10px] font-bold text-secondary">
                <span className="text-emerald-400 font-black">● {metricasFrota.operantes} OPERANTES</span>
                <span className="text-amber-400 font-black">● {metricasFrota.inoperantes} INOP.</span>
              </div>
            </Card>

            {/* Preventivas Atrasadas */}
            <Card
              onClick={() => {
                setAlertaFiltro('preventiva_atrasada')
                navigate('/frotas?aba=veiculos')
              }}
              className="p-4 border-red-500/30 bg-surface/90 cursor-pointer hover:border-red-500/60 transition-colors"
            >
              <div className="flex items-center justify-between text-red-400">
                <span className="text-[10px] font-black uppercase tracking-wider">PREVENTIVAS</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-500/10 text-red-400 border border-red-500/20">
                  <AlertOctagon className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-2.5 text-3xl font-black font-mono text-red-400">{metricasFrota.preventivaAtrasada}</p>
              <div className="mt-1.5 flex items-center justify-between text-[10px] font-bold text-secondary">
                <span className="text-red-400 font-bold">{metricasFrota.preventivaAtrasada} ATRASADAS</span>
                <span className="text-emerald-400 font-bold">{metricasFrota.total - metricasFrota.preventivaAtrasada} EM DIA</span>
              </div>
            </Card>

            {/* Licenciamento (CRLV) */}
            <Card
              onClick={() => {
                setAlertaFiltro(metricasFrota.docVencido > 0 ? 'doc_vencido' : 'doc_a_vencer')
                navigate('/frotas?aba=veiculos')
              }}
              className="p-4 border-amber-500/30 bg-surface/90 cursor-pointer hover:border-amber-500/60 transition-colors"
            >
              <div className="flex items-center justify-between text-amber-400">
                <span className="text-[10px] font-black uppercase tracking-wider">LICENCIAMENTO (CRLV)</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Clock className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-2.5 text-3xl font-black font-mono text-amber-400">
                {metricasFrota.docVencido + metricasFrota.docAVencer}
              </p>
              <div className="mt-1.5 text-[10px] text-secondary font-bold flex justify-between">
                <span className="text-rose-400">{metricasFrota.docVencido} VENCIDOS</span>
                <span className="text-amber-400">{metricasFrota.docAVencer} A VENCER</span>
              </div>
            </Card>

            {/* Seguro da Frota */}
            <Card
              onClick={() => {
                setAlertaFiltro(metricasFrota.seguroVencido > 0 ? 'seguro_vencido' : 'seguro_a_vencer')
                navigate('/frotas?aba=veiculos')
              }}
              className="p-4 border-indigo-500/30 bg-surface/90 cursor-pointer hover:border-indigo-500/60 transition-colors"
            >
              <div className="flex items-center justify-between text-indigo-400">
                <span className="text-[10px] font-black uppercase tracking-wider">SEGURO DA FROTA</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <ShieldCheck className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-2.5 text-3xl font-black font-mono text-indigo-400">
                {metricasFrota.seguroVencido + metricasFrota.seguroAVencer}
              </p>
              <div className="mt-1.5 text-[10px] text-secondary font-bold flex justify-between">
                <span className="text-rose-400">{metricasFrota.seguroVencido} VENCIDOS</span>
                <span className="text-indigo-300">{metricasFrota.seguroEmDia} VIGENTES</span>
              </div>
            </Card>

            {/* Checklists Realizados */}
            <Card
              onClick={() => navigate('/frotas?aba=checklist')}
              className="p-4 border-cyan-500/30 bg-surface/90 cursor-pointer hover:border-cyan-500/60 transition-colors"
            >
              <div className="flex items-center justify-between text-cyan-400">
                <span className="text-[10px] font-black uppercase tracking-wider">CHECKLISTS REALIZADOS</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  <ClipboardCheck className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-2.5 text-3xl font-black font-mono text-cyan-400">{metricasChecklist.total}</p>
              <div className="mt-1.5 flex items-center justify-between text-[10px] font-bold text-secondary">
                <span className="text-emerald-400 font-black">● {metricasChecklist.aprovados} APROVADOS</span>
                <span className="text-rose-400 font-black">● {metricasChecklist.reprovados} REPROVADOS</span>
              </div>
            </Card>

            {/* Tacógrafo (Apenas para Rodocaçamba / Visão Geral) */}
            {categoriaFrota !== 'leve' && (
              <Card
                onClick={() => {
                  setAlertaFiltro(metricasFrota.tacografoVencido > 0 ? 'tacografo_vencido' : 'tacografo_a_vencer')
                  navigate('/frotas?aba=veiculos')
                }}
                className="p-4 border-purple-500/30 bg-surface/90 cursor-pointer hover:border-purple-500/60 transition-colors"
              >
                <div className="flex items-center justify-between text-purple-400">
                  <span className="text-[10px] font-black uppercase tracking-wider">TACÓGRAFO</span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    <Disc className="h-4 w-4" />
                  </div>
                </div>
                <p className="mt-2.5 text-3xl font-black font-mono text-purple-400">
                  {metricasFrota.tacografoVencido + metricasFrota.tacografoAVencer}
                </p>
                <div className="mt-1.5 text-[10px] text-secondary font-bold flex justify-between">
                  <span className="text-rose-400">{metricasFrota.tacografoVencido} VENCIDOS</span>
                  <span className="text-purple-300">{metricasFrota.tacografoAVencer} A VENCER</span>
                </div>
              </Card>
            )}
          </div>

          {/* ========================================================================= */}
          {/* DISTRIBUIÇÃO DA FROTA POR CATEGORIA */}
          {/* ========================================================================= */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
            {distribuicaoCategorias.map((cat) => (
              <Card
                key={cat.nome}
                className="p-4 border-border/20 bg-surface/90 flex items-center justify-between shadow-sm hover:border-border/40 transition-colors"
              >
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-secondary">
                    {cat.nome}
                  </span>
                  <p className="mt-1 text-2xl font-black font-mono text-foreground">
                    {cat.total} <span className="text-xs text-secondary font-sans font-normal">({cat.pct}%)</span>
                  </p>
                </div>
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-lg border"
                  style={{ backgroundColor: `${cat.cor}15`, borderColor: `${cat.cor}30` }}
                >
                  {cat.icone}
                </div>
              </Card>
            ))}
          </div>

          {/* ========================================================================= */}
          {/* GRÁFICO 1: QUANTOS KM FALTAM PARA FAZER PREVENTIVA POR PLACA */}
          {/* ========================================================================= */}
          <Card className="p-5 border-border/25 bg-surface/90 space-y-4 shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-border/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                  <Gauge className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-foreground uppercase tracking-wide">
                    QUILOMETRAGEM (KM) RESTANTE PARA PRÓXIMA PREVENTIVA
                  </h3>
                  <p className="text-[11px] text-secondary normal-case">
                    Auditoria de KM atual vs limite de revisão por veículo motorizado (Cavalos, Caminhões e Leves)
                  </p>
                </div>
              </div>

              {/* Filtros de Categoria e Visualização */}
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={filtroTipoGraficoKm}
                  onChange={(e) => setFiltroTipoGraficoKm(e.target.value)}
                  aria-label="Filtrar categoria de veículo motorizado"
                  className="h-9 rounded-xl border border-border/25 bg-surface/90 px-3 text-xs font-bold text-foreground focus:border-primary focus:outline-none uppercase cursor-pointer"
                >
                  <option value="todos_motor">MOTORIZADOS ({frotasCategoria.filter(v => v.tipo !== 'carreta').length})</option>
                  <option value="trator">🚜 CAVALOS TRATOR ({frotasCategoria.filter(v => v.tipo === 'trator').length})</option>
                  <option value="pesado">🚚 CAMINHÕES PESADOS ({frotasCategoria.filter(v => v.tipo === 'pesado').length})</option>
                  <option value="leve">🚗 FROTA LEVE ({frotasCategoria.filter(v => v.tipo === 'leve').length})</option>
                  <option value="embarcado">🏗️ EMBARCADOS ({frotasCategoria.filter(v => v.tipo === 'embarcado').length})</option>
                </select>

                <select
                  value={filtroGraficoKm}
                  onChange={(e) => setFiltroGraficoKm(e.target.value as any)}
                  aria-label="Selecionar modo de visualização do gráfico"
                  className="h-9 rounded-xl border border-primary/40 bg-primary/10 px-3 text-xs font-bold text-primary focus:border-primary focus:outline-none uppercase cursor-pointer"
                >
                  <option value="top12">⚡ TOP 12 MAIS PRÓXIMOS DE REVISÃO</option>
                  <option value="top20">⚡ TOP 20 MAIS PRÓXIMOS</option>
                  <option value="criticos">🚨 CRÍTICOS / PRÓXIMOS (≤ 5.000 KM)</option>
                  <option value="todos">📊 TODOS OS VEÍCULOS (ROLÁVEL)</option>
                </select>
              </div>
            </div>

            {dadosGraficoKmPreventiva.length === 0 ? (
              <div className="py-12 text-center text-secondary">
                <Truck className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-xs font-bold text-foreground">NENHUM VEÍCULO ENCONTRADO PARA OS FILTROS SELECIONADOS</p>
              </div>
            ) : (
              <div className="w-full overflow-x-auto pb-2">
                <div
                  className="h-80 pt-2"
                  style={{
                    minWidth: filtroGraficoKm === 'todos' && dadosGraficoKmPreventiva.length > 15
                      ? `${Math.max(1200, dadosGraficoKmPreventiva.length * 45)}px`
                      : '100%',
                  }}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={dadosGraficoKmPreventiva}
                      margin={{ top: 25, right: 25, left: 10, bottom: 25 }}
                      barSize={filtroGraficoKm === 'todos' ? 24 : dadosGraficoKmPreventiva.length <= 12 ? 38 : 28}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                      <XAxis
                        dataKey="placa"
                        tick={{ fill: textColor, fontSize: 11, fontWeight: 'bold' }}
                        axisLine={{ stroke: axisLineColor }}
                        tickLine={false}
                        interval={0}
                      />
                      <YAxis
                        tick={{ fill: textColorSecundario, fontSize: 10, fontFamily: 'monospace' }}
                        axisLine={{ stroke: axisLineColor }}
                        tickLine={false}
                        unit=" KM"
                      />
                      <Tooltip
                        cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                        content={({ active, payload }) => {
                          if (!active || !payload || !payload.length) return null
                          const d = payload[0].payload
                          if (d.status === 'sem_dados') {
                            return (
                              <div className="rounded-xl border border-border/40 bg-surface/95 p-3 shadow-2xl backdrop-blur-md text-xs uppercase font-sans">
                                <p className="font-mono font-black text-primary text-sm flex items-center gap-1">
                                  🚛 {d.placa} · {d.modelo}
                                </p>
                                <div className="mt-2 space-y-1 text-[11px] text-foreground font-mono">
                                  {d.kmUltima > 0 && <p>Última Preventiva: <span className="font-bold text-secondary">{d.kmUltima.toLocaleString('pt-BR')} KM</span></p>}
                                  <p className="font-black pt-1 text-secondary">
                                    ⏳ SEM CHECKLIST REGISTRADO — NÃO DÁ PRA CALCULAR O KM ATUAL
                                  </p>
                                </div>
                              </div>
                            )
                          }
                          return (
                            <div className="rounded-xl border border-border/40 bg-surface/95 p-3 shadow-2xl backdrop-blur-md text-xs uppercase font-sans">
                              <p className="font-mono font-black text-primary text-sm flex items-center gap-1">
                                🚛 {d.placa} · {d.modelo}
                              </p>
                              <div className="mt-2 space-y-1 text-[11px] text-foreground font-mono">
                                <p>KM Atual (Checklist): <span className="font-bold text-foreground">{d.kmAtual.toLocaleString('pt-BR')} KM</span></p>
                                {d.kmUltima > 0 && <p>Última Preventiva: <span className="font-bold text-secondary">{d.kmUltima.toLocaleString('pt-BR')} KM</span></p>}
                                <p>Limite da Preventiva: <span className="font-bold text-foreground">{d.kmMeta.toLocaleString('pt-BR')} KM</span></p>
                                <p className={`font-black pt-1 ${d.status === 'atrasado' ? 'text-red-400' : d.status === 'proximo' ? 'text-amber-400' : 'text-emerald-400'}`}>
                                  {d.status === 'atrasado'
                                    ? d.kmFaltante < 0
                                      ? `🛑 REVISÃO ATRASADA EM ${Math.abs(d.kmFaltante).toLocaleString('pt-BR')} KM`
                                      : `🛑 REVISÃO ATRASADA (VENCEU POR DATA) · FALTAM ${d.kmFaltante.toLocaleString('pt-BR')} KM`
                                    : d.status === 'proximo'
                                    ? `⚠️ ATENÇÃO: FALTAM ${d.kmFaltante.toLocaleString('pt-BR')} KM`
                                    : `✅ EM DIA: FALTAM ${d.kmFaltante.toLocaleString('pt-BR')} KM`}
                                </p>
                              </div>
                            </div>
                          )
                        }}
                      />
                      <Bar dataKey="kmFaltante" radius={[6, 6, 0, 0]}>
                        {dadosGraficoKmPreventiva.length <= 15 && (
                          <LabelList
                            dataKey="kmFaltante"
                            position="top"
                            content={(props: any) => {
                              const { x, y, width, index } = props
                              const entry = dadosGraficoKmPreventiva[index]
                              if (!entry) return null
                              const texto = `${entry.kmFaltante.toLocaleString('pt-BR')} KM`
                              return (
                                <text
                                  x={x + width / 2}
                                  y={y - 6}
                                  textAnchor="middle"
                                  fill={entry.status === 'sem_dados' ? textColorSecundario : textColor}
                                  fontSize={10}
                                  fontWeight="bold"
                                  fontFamily="monospace"
                                >
                                  {texto}
                                </text>
                              )
                            }}
                          />
                        )}
                        {dadosGraficoKmPreventiva.map((entry, index) => {
                          let cor = '#10b981' // Verde (em dia)
                          if (entry.status === 'atrasado') cor = '#ef4444' // Vermelho (atrasado, por KM ou por data)
                          else if (entry.status === 'proximo') cor = '#f59e0b' // Amarelo (próximo de vencer)
                          else if (entry.status === 'sem_dados') cor = '#94a3b8' // Cinza (sem checklist ainda)
                          return <Cell key={`cell-km-${index}`} fill={cor} />
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </Card>

          {/* ========================================================================= */}
          {/* LINHA DE DOIS GRÁFICOS: CHECKLIST POR PESSOA & DIAS PARA VENCIMENTO DO CRLV */}
          {/* ========================================================================= */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* GRÁFICO 2: QUANTOS CHECKLISTS ESTÃO SENDO FEITOS POR PESSOA */}
            <Card className="p-5 border-border/25 bg-surface/90 space-y-4">
              <div className="flex items-center justify-between border-b border-border/10 pb-3">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  <div>
                    <h3 className="text-sm font-black text-foreground uppercase tracking-wide">
                      CHECKLISTS REALIZADOS POR PESSOA
                    </h3>
                    <p className="text-[11px] text-secondary normal-case">
                      Volume de inspeções veiculares por motorista / condutor
                    </p>
                  </div>
                </div>
                <Badge tone="neutral" className="text-[10px] font-black">
                  {dadosGraficoChecklistPessoa.length} CONDUTORES
                </Badge>
              </div>

              {dadosGraficoChecklistPessoa.length === 0 ? (
                <div className="py-12 text-center text-secondary">
                  <ClipboardCheck className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-xs font-bold text-foreground">
                    {categoriaFrota === 'embarcado'
                      ? 'CHECKLIST AINDA NÃO DISPONÍVEL PARA ESTA CATEGORIA'
                      : 'NENHUM CHECKLIST REGISTRADO AINDA'}
                  </p>
                  {categoriaFrota === 'embarcado' && (
                    <p className="mt-1 text-[11px] text-secondary normal-case">
                      O checklist operacional hoje só existe para Frota Leve e Rodocaçamba.
                    </p>
                  )}
                </div>
              ) : (
                <div className="h-80 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={dadosGraficoChecklistPessoa.slice(0, 8)}
                      margin={{ top: 20, right: 20, left: 0, bottom: 8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                      <XAxis
                        type="category"
                        dataKey="nome"
                        interval={0}
                        height={40}
                        axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                        tickLine={false}
                        tick={(props: any) => {
                          // Nome/sobrenome em duas linhas, sem a lista de placas embaixo
                          // (já disponível no tooltip) — mostrar tudo junto no eixo
                          // virava uma mistura ilegível quando a pessoa tinha várias
                          // placas ou nome comprido.
                          const { x, y, payload } = props
                          const palavras = formatarNomeSobrenome(String(payload.value)).split(' ').filter(Boolean)
                          return (
                            <g transform={`translate(${x},${y})`}>
                              {palavras.map((palavra: string, i: number) => (
                                <text
                                  key={i}
                                  x={0}
                                  y={0}
                                  dy={14 + i * 13}
                                  textAnchor="middle"
                                  fill="var(--text-foreground, #f8fafc)"
                                  fontSize={10}
                                  fontWeight="bold"
                                >
                                  {palavra}
                                </text>
                              ))}
                            </g>
                          )
                        }}
                      />
                      <YAxis
                        type="number"
                        allowDecimals={false}
                        tick={{ fill: 'var(--text-secondary, #94a3b8)', fontSize: 10, fontFamily: 'monospace' }}
                        axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                        tickLine={false}
                        width={30}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload || !payload.length) return null
                          const d = payload[0].payload
                          return (
                            <div className="rounded-xl border border-border/40 bg-surface/95 p-3 shadow-2xl backdrop-blur-md text-xs uppercase font-sans">
                              <p className="font-black text-primary text-sm flex items-center gap-1.5">
                                <User className="h-3.5 w-3.5" /> {d.nome}
                              </p>
                              <div className="mt-1.5 space-y-1 text-[11px] font-mono">
                                <p className="text-white font-black">TOTAL: {d.total} VISTORIAS</p>
                                <p className="text-emerald-400">● Aprovados: {d.aprovados}</p>
                                <p className="text-amber-400">● Com Ressalvas: {d.ressalvas}</p>
                                <p className="text-rose-500">● Reprovados: {d.reprovados}</p>
                                <p className="text-secondary pt-1 border-t border-border/10 mt-1.5 normal-case">
                                  🚛 Placas: {d.placas.length ? d.placas.join(', ') : '—'}
                                </p>
                              </div>
                            </div>
                          )
                        }}
                      />
                      <Bar dataKey="total" fill="#6366f1" radius={[6, 6, 0, 0]}>
                        <LabelList
                          dataKey="total"
                          position="top"
                          formatter={(val: any) => `${val}`}
                          style={{ fill: '#cbd5e1', fontSize: '10px', fontWeight: 'bold', fontFamily: 'monospace' }}
                        />
                        {dadosGraficoChecklistPessoa.slice(0, 8).map((_, index) => {
                          const cores = ['#6366f1', '#3b82f6', '#0ea5e9', '#06b6d4', '#10b981', '#8b5cf6']
                          return <Cell key={`cell-pes-${index}`} fill={cores[index % cores.length]} />
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            {/* GRÁFICO 3: QUANTOS DIAS FALTAM PARA O VENCIMENTO DO DOCUMENTO (CRLV) */}
            <Card className="p-5 border-border/25 bg-surface/90 space-y-4">
              <div className="flex items-center justify-between border-b border-border/10 pb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-amber-400" />
                  <div>
                    <h3 className="text-sm font-black text-foreground uppercase tracking-wide">
                      DIAS RESTANTES PARA VENCIMENTO DO CRLV
                    </h3>
                    <p className="text-[11px] text-secondary normal-case">
                      Contagem regressiva de validade da documentação por placa
                    </p>
                  </div>
                </div>
                <Badge tone="warning" className="text-[10px] font-black">
                  {dadosGraficoVencimentoDoc.length} VEÍCULOS COM CRLV
                </Badge>
              </div>

              {dadosGraficoVencimentoDoc.length === 0 ? (
                <div className="py-12 text-center text-secondary">
                  <FileX className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-xs font-bold text-foreground">NENHUM DOCUMENTO CADASTRADO</p>
                </div>
              ) : (
                <div className="h-72 w-full pt-2 overflow-x-auto">
                  <div style={{ minWidth: Math.max(500, dadosGraficoVencimentoDoc.length * 48), height: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={dadosGraficoVencimentoDoc}
                        margin={{ top: 20, right: 16, left: 10, bottom: 55 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                        <XAxis
                          dataKey="placa"
                          tick={{ fill: 'var(--text-secondary, #94a3b8)', fontSize: 10, fontWeight: 'bold' }}
                          axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                          tickLine={false}
                          interval={0}
                          angle={-40}
                          textAnchor="end"
                          height={60}
                        />
                        <YAxis
                          tick={{ fill: 'var(--text-secondary, #94a3b8)', fontSize: 10, fontFamily: 'monospace' }}
                          axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                          tickLine={false}
                          unit=" D"
                        />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (!active || !payload || !payload.length) return null
                            const d = payload[0].payload
                            return (
                              <div className="rounded-xl border border-border/40 bg-surface/95 p-3 shadow-2xl backdrop-blur-md text-xs uppercase font-sans">
                                <p className="font-mono font-black text-primary text-sm">
                                  🚛 {d.placa} · {d.modelo}
                                </p>
                                <div className="mt-1.5 space-y-1 text-[11px] font-mono">
                                  <p className="text-secondary">Data de Vencimento: <span className="font-bold text-foreground">{d.vencimento}</span></p>
                                  <p className={`font-black ${d.crlvPago ? 'text-sky-400' : d.dias < 0 ? 'text-rose-500' : d.dias <= 30 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                    {d.crlvPago
                                      ? '💳 JÁ PAGO (aguardando atualização da data)'
                                      : d.dias < 0
                                      ? `🛑 VENCIDO HÁ ${Math.abs(d.dias)} DIAS`
                                      : d.dias === 0
                                      ? '⚠️ VENCE HOJE!'
                                      : `✅ VENCE EM ${d.dias} DIAS`}
                                  </p>
                                </div>
                              </div>
                            )
                          }}
                        />
                        <Bar dataKey="dias" radius={[6, 6, 0, 0]} maxBarSize={36}>
                          <LabelList
                            dataKey="dias"
                            position="top"
                            formatter={(val: any) => `${val}D`}
                            style={{ fill: '#cbd5e1', fontSize: '9px', fontWeight: 'bold', fontFamily: 'monospace' }}
                          />
                          {dadosGraficoVencimentoDoc.map((entry, index) => {
                            let cor = '#10b981' // Verde (em dia)
                            if (entry.crlvPago) cor = '#0ea5e9' // Azul (já pago, aguardando atualização)
                            else if (entry.dias < 0) cor = '#e11d48' // Vermelho escuro (vencido)
                            else if (entry.dias <= 30) cor = '#f59e0b' // Laranja / Âmbar (a vencer)
                            return <Cell key={`cell-doc-${index}`} fill={cor} />
                          })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </Card>

            {/* GRÁFICO 4: QUANTOS DIAS FALTAM PARA O VENCIMENTO DO TACÓGRAFO */}
            {dadosGraficoVencimentoTacografo.length > 0 && (
              <Card className="p-5 border-border/25 bg-surface/90 space-y-4 lg:col-span-2">
                <div className="flex items-center justify-between border-b border-border/10 pb-3">
                  <div className="flex items-center gap-2">
                    <Disc className="h-5 w-5 text-purple-400" />
                    <div>
                      <h3 className="text-sm font-black text-foreground uppercase tracking-wide">
                        DIAS RESTANTES PARA VENCIMENTO DO TACÓGRAFO (RODOCAÇAMBA & PESADOS)
                      </h3>
                      <p className="text-[11px] text-secondary normal-case">
                        Controle de validade e ensaio periódico dos tacógrafos por veículo
                      </p>
                    </div>
                  </div>
                  <Badge tone="neutral" className="text-[10px] font-black text-purple-400 border-purple-500/30 bg-purple-500/10">
                    {dadosGraficoVencimentoTacografo.length} TACÓGRAFOS MONITORADOS
                  </Badge>
                </div>

                <div className="h-72 w-full pt-2 overflow-x-auto">
                  <div style={{ minWidth: Math.max(500, dadosGraficoVencimentoTacografo.length * 48), height: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={dadosGraficoVencimentoTacografo}
                        margin={{ top: 20, right: 16, left: 10, bottom: 55 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                        <XAxis
                          dataKey="placa"
                          tick={{ fill: 'var(--text-secondary, #94a3b8)', fontSize: 10, fontWeight: 'bold' }}
                          axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                          tickLine={false}
                          interval={0}
                          angle={-40}
                          textAnchor="end"
                          height={60}
                        />
                        <YAxis
                          tick={{ fill: 'var(--text-secondary, #94a3b8)', fontSize: 10, fontFamily: 'monospace' }}
                          axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                          tickLine={false}
                          unit=" D"
                        />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (!active || !payload || !payload.length) return null
                            const d = payload[0].payload
                            return (
                              <div className="rounded-xl border border-border/40 bg-surface/95 p-3 shadow-2xl backdrop-blur-md text-xs uppercase font-sans">
                                <p className="font-mono font-black text-purple-400 text-sm">
                                  ⏱️ {d.placa} · {d.modelo}
                                </p>
                                <div className="mt-1.5 space-y-1 text-[11px] font-mono">
                                  {d.numeroTacografo && (
                                    <p className="text-secondary">Nº Tacógrafo: <span className="font-bold text-foreground">{d.numeroTacografo}</span></p>
                                  )}
                                  {d.emissao && (
                                    <p className="text-secondary">Emissão / Ensaio: <span className="font-bold text-foreground">{d.emissao}</span></p>
                                  )}
                                  <p className="text-secondary">Vencimento: <span className="font-bold text-foreground">{d.vencimento}</span></p>
                                  <p className={`font-black ${d.dias < 0 ? 'text-rose-500' : d.dias <= 30 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                    {d.dias < 0
                                      ? `🛑 VENCIDO HÁ ${Math.abs(d.dias)} DIAS`
                                      : d.dias === 0
                                      ? '⚠️ VENCE HOJE!'
                                      : `✅ VENCE EM ${d.dias} DIAS`}
                                  </p>
                                </div>
                              </div>
                            )
                          }}
                        />
                        <Bar dataKey="dias" radius={[6, 6, 0, 0]} maxBarSize={36}>
                          <LabelList
                            dataKey="dias"
                            position="top"
                            formatter={(val: any) => `${val}D`}
                            style={{ fill: '#cbd5e1', fontSize: '9px', fontWeight: 'bold', fontFamily: 'monospace' }}
                          />
                          {dadosGraficoVencimentoTacografo.map((entry, index) => {
                            let cor = '#10b981' // Verde (em dia)
                            if (entry.dias < 0) cor = '#e11d48' // Vermelho escuro (vencido)
                            else if (entry.dias <= 30) cor = '#f59e0b' // Laranja / Âmbar (a vencer)
                            return <Cell key={`cell-tac-${index}`} fill={cor} />
                          })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 1: VEÍCULOS & FROTA */}
      {/* ========================================================================= */}
      {abaPrincipal === 'veiculos' && (
        <div className="space-y-6">
          {/* Cards de Indicadores da Frota (Filtros Rápidos) */}
          <div
            className={`grid gap-3 sm:gap-4 ${
              categoriaFrota === 'leve'
                ? 'grid-cols-2 sm:grid-cols-2 lg:grid-cols-4'
                : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'
            }`}
          >
            {/* Total da Frota */}
            <button
              type="button"
              onClick={() => setAlertaFiltro('todos')}
              className={`text-left p-4 rounded-2xl border transition-all duration-200 ${
                alertaFiltro === 'todos'
                  ? 'border-primary/50 bg-primary/10 shadow-lg shadow-primary/5 ring-1 ring-primary/40'
                  : 'border-border/30 bg-surface/90 hover:border-border/60'
              }`}
            >
              <div className="flex items-center justify-between text-secondary">
                <span className="text-[10px] font-black uppercase tracking-wider">TOTAL DA FROTA</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                  <Truck className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-2.5 text-3xl font-black font-mono text-foreground">{metricasFrota.total}</p>
              <p className="mt-1 text-[11px] text-secondary font-medium">VEÍCULOS CADASTRADOS</p>
            </button>

            {/* Preventiva Atrasada */}
            <button
              type="button"
              onClick={() => setAlertaFiltro(alertaFiltro === 'preventiva_atrasada' ? 'todos' : 'preventiva_atrasada')}
              className={`text-left p-4 rounded-2xl border transition-all duration-200 ${
                alertaFiltro === 'preventiva_atrasada'
                  ? 'border-red-500 bg-red-500/15 shadow-lg shadow-red-500/10 ring-1 ring-red-500'
                  : 'border-red-500/30 bg-surface/90 hover:border-red-500/50'
              }`}
            >
              <div className="flex items-center justify-between text-red-400">
                <span className="text-[10px] font-black uppercase tracking-wider">PREVENTIVA ATRASADA</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-500/10 text-red-400 border border-red-500/20">
                  <AlertOctagon className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-2.5 text-3xl font-black font-mono text-red-400">{metricasFrota.preventivaAtrasada}</p>
              <p className="mt-1 text-[11px] text-red-300/80 font-medium">REVISÕES FORA DO PRAZO</p>
            </button>

            {/* Licenciamento (CRLV) */}
            <button
              type="button"
              onClick={() => setAlertaFiltro(alertaFiltro === 'doc_vencido' ? 'todos' : 'doc_vencido')}
              className={`text-left p-4 rounded-2xl border transition-all duration-200 ${
                alertaFiltro === 'doc_vencido' || alertaFiltro === 'doc_a_vencer'
                  ? 'border-amber-500 bg-amber-500/15 shadow-lg shadow-amber-500/10 ring-1 ring-amber-500'
                  : 'border-amber-500/30 bg-surface/90 hover:border-amber-500/50'
              }`}
            >
              <div className="flex items-center justify-between text-amber-400">
                <span className="text-[10px] font-black uppercase tracking-wider">LICENCIAMENTO (CRLV)</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Clock className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-2.5 text-3xl font-black font-mono text-amber-400">
                {metricasFrota.docVencido + metricasFrota.docAVencer}
              </p>
              <p className="mt-1 text-[11px] text-amber-300/80 font-medium">
                {metricasFrota.docVencido} VENC. · {metricasFrota.docAVencer} A VENCER
              </p>
            </button>

            {/* Seguro da Frota */}
            <button
              type="button"
              onClick={() => setAlertaFiltro(alertaFiltro === 'seguro_vencido' ? 'todos' : 'seguro_vencido')}
              className={`text-left p-4 rounded-2xl border transition-all duration-200 ${
                alertaFiltro === 'seguro_vencido' || alertaFiltro === 'seguro_a_vencer'
                  ? 'border-indigo-500 bg-indigo-500/15 shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-500'
                  : 'border-indigo-500/30 bg-surface/90 hover:border-indigo-500/50'
              }`}
            >
              <div className="flex items-center justify-between text-indigo-400">
                <span className="text-[10px] font-black uppercase tracking-wider">SEGURO DA FROTA</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <ShieldCheck className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-2.5 text-3xl font-black font-mono text-indigo-400">
                {metricasFrota.seguroVencido + metricasFrota.seguroAVencer}
              </p>
              <p className="mt-1 text-[11px] text-indigo-300/80 font-medium">
                {metricasFrota.seguroVencido} VENC. · {metricasFrota.seguroEmDia} VIGENTES
              </p>
            </button>

            {/* Tacógrafo (Exclusivo Rodocaçamba / Visão Consolidada) */}
            {categoriaFrota !== 'leve' && (
              <button
                type="button"
                onClick={() => setAlertaFiltro(alertaFiltro === 'tacografo_vencido' ? 'todos' : 'tacografo_vencido')}
                className={`text-left p-4 rounded-2xl border transition-all duration-200 ${
                  alertaFiltro === 'tacografo_vencido' || alertaFiltro === 'tacografo_a_vencer'
                    ? 'border-purple-500 bg-purple-500/15 shadow-lg shadow-purple-500/10 ring-1 ring-purple-500'
                    : 'border-purple-500/30 bg-surface/90 hover:border-purple-500/50'
                }`}
              >
                <div className="flex items-center justify-between text-purple-400">
                  <span className="text-[10px] font-black uppercase tracking-wider">TACÓGRAFO</span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    <Disc className="h-4 w-4" />
                  </div>
                </div>
                <p className="mt-2.5 text-3xl font-black font-mono text-purple-400">
                  {metricasFrota.tacografoVencido + metricasFrota.tacografoAVencer}
                </p>
                <p className="mt-1 text-[11px] text-purple-300/80 font-medium">
                  {metricasFrota.tacografoVencido} VENC. · {metricasFrota.tacografoAVencer} A VENCER
                </p>
              </button>
            )}
          </div>

          {/* Barra de Filtros e Busca */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="BUSCAR POR PLACA, MODELO, MARCA, CHASSI OU CLIENTE..."
                className="h-11 w-full rounded-2xl border border-border/25 bg-surface/90 pl-10 pr-9 text-xs text-foreground placeholder:text-secondary/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary uppercase shadow-sm transition-all"
              />
              {busca && (
                <button
                  type="button"
                  onClick={() => setBusca('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary hover:text-foreground p-1"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Filtros em Selects */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={alertaFiltro}
                onChange={(e) => setAlertaFiltro(e.target.value as any)}
                className="h-10 rounded-xl border border-border/25 bg-surface/90 px-3 text-xs font-bold text-foreground focus:border-primary focus:outline-none uppercase cursor-pointer"
              >
                <option value="todos">STATUS: TODOS</option>
                <option value="preventiva_atrasada">⚠️ PREVENTIVAS ATRASADAS</option>
                <option value="doc_vencido">🛑 LICENCIAMENTO VENCIDO</option>
                <option value="doc_a_vencer">⏳ LICENCIAMENTO A VENCER (30D)</option>
                <option value="seguro_vencido">🛑 SEGURO VENCIDO</option>
                <option value="seguro_a_vencer">⏳ SEGURO A VENCER (30D)</option>
              </select>

              <select
                value={tipoFiltro}
                onChange={(e) => setTipoFiltro(e.target.value)}
                className="h-10 rounded-xl border border-border/25 bg-surface/90 px-3 text-xs font-bold text-foreground focus:border-primary focus:outline-none uppercase cursor-pointer"
              >
                {categoriaFrota === 'leve' ? (
                  <>
                    <option value="todos">TODOS OS LEVES ({contagemLeves})</option>
                    <option value="CARRO">CARROS</option>
                    <option value="MOTO">MOTOS</option>
                    <option value="CAMINHONETE">CAMINHONETES</option>
                    <option value="UTILITÁRIO">UTILITÁRIOS</option>
                  </>
                ) : categoriaFrota === 'pesado' ? (
                  <>
                    <option value="todos">TODOS OS PESADOS ({contagemPesados})</option>
                    <option value="trator">CAVALOS TRATOR</option>
                    <option value="pesado">CAMINHÕES PESADOS</option>
                    <option value="carreta">CARRETAS / DOLLYS</option>
                  </>
                ) : categoriaFrota === 'embarcado' ? (
                  <option value="todos">TODOS OS EMBARCADOS ({contagemEmbarcados})</option>
                ) : (
                  <>
                    <option value="todos">TODOS OS TIPOS ({contagemTodos})</option>
                    <option value="leve">FROTA LEVE / UTILITÁRIOS</option>
                    <option value="pesado">CAMINHÕES PESADOS</option>
                    <option value="trator">CAVALOS TRATOR</option>
                    <option value="carreta">CARRETAS / DOLLYS</option>
                    <option value="embarcado">EMBARCADOS (MUNCK/PLATAFORMA)</option>
                  </>
                )}
              </select>
            </div>
          </div>

          {/* Tabela de Veículos */}
          {veiculosFiltrados.length === 0 ? (
            <Card className="p-12 text-center">
              <Truck className="mx-auto mb-3 h-10 w-10 text-secondary/40" />
              <p className="text-base font-bold text-foreground">NENHUM VEÍCULO ENCONTRADO</p>
              <p className="mt-1 text-xs text-secondary">
                {busca || tipoFiltro !== 'todos' || alertaFiltro !== 'todos'
                  ? 'TENTE AJUSTAR OS FILTROS DE BUSCA.'
                  : 'CADASTRE SEUS VEÍCULOS DE FROTA CLICANDO NO BOTÃO "+ NOVO VEÍCULO".'}
              </p>
            </Card>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border/25 bg-surface/80 shadow-sm backdrop-blur-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs uppercase">
                  <thead className="border-b border-border/15 bg-surface/95 text-[11px] font-black text-secondary uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3">VEÍCULO / PLACA</th>
                      <th className="px-4 py-3">SETOR & RESPONSÁVEL</th>
                      <th className="px-4 py-3">MANUTENÇÃO PREVENTIVA</th>
                      <th className="px-4 py-3">
                        {categoriaFrota === 'leve' ? 'DOCUMENTAÇÃO & SEGURO' : 'DOCUMENTAÇÃO, SEGURO & TACÓGRAFO'}
                      </th>
                      <th className="px-3 py-3 text-right">AÇÕES</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/10 font-medium">
                    {veiculosFiltrados.map((v) => {
                      const estaNoPatio = placasNoPatio.has(v.placa.toUpperCase().trim())
                      const statusPrev = getStatusPreventiva(v)
                      const statusDoc = getStatusDocumento(v.vencimentoDocumento)
                      const statusSeg = getStatusSeguro(v.vencimentoSeguro)
                      const statusTac = getStatusTacografo(v.vencimentoTacografo)

                      return (
                        <tr key={v.id} className="hover:bg-surface-hover/40 transition-colors group">
                          {/* Veículo / Placa */}
                          <td
                            className="px-4 py-3 cursor-pointer"
                            onClick={() => setVeiculoDetalhando(v)}
                            title="Ver detalhes do veículo"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-black text-primary text-sm flex items-center gap-1.5 tracking-wider">
                                <span>{v.tipoVeiculo === 'MOTO' ? '🏍️' : v.tipo === 'leve' ? '🚗' : v.tipo === 'embarcado' ? '🏗️' : '🚛'}</span>
                                <span>{v.placa}</span>
                              </span>
                              <div className="flex items-center gap-1">
                                {v.situacao === 'operante' ? (
                                  <span className="rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 text-[9px] font-black">
                                    OPERANTE
                                  </span>
                                ) : (
                                  <span className="rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 text-[9px] font-black">
                                    INOPERANTE
                                  </span>
                                )}
                                {estaNoPatio && (
                                  <span className="rounded-md bg-blue-500/20 text-blue-400 border border-blue-500/30 px-1.5 py-0.5 text-[9px] font-black">
                                    NO PÁTIO
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-[11px] text-foreground font-bold mt-0.5">
                              {v.marcaNome ? `${v.marcaNome} ` : ''}{v.modeloNome || '—'} {v.ano ? `· ${v.ano}` : ''}
                            </div>
                          </td>

                          {/* Setor & Responsável */}
                          <td className="px-4 py-3">
                            {v.setor ? (
                              <div className="inline-flex items-center gap-1">
                                <span className="px-2 py-0.5 rounded-lg bg-primary/10 border border-primary/20 text-primary text-[10px] font-black">
                                  {v.setor}
                                </span>
                              </div>
                            ) : (
                              <span className="text-secondary/40 text-[10px] font-mono">—</span>
                            )}
                            <div className="text-[11px] text-secondary font-bold flex items-center gap-1.5 mt-1">
                              <User className="h-3 w-3 text-secondary/70 shrink-0" />
                              <span className="truncate max-w-[170px]">{v.responsavel || 'NÃO ATRIBUÍDO'}</span>
                            </div>
                          </td>

                          {/* Manutenção Preventiva */}
                          <td className="px-4 py-3">
                            <div>
                              {statusPrev.status === 'atrasada' ? (
                                <span className="inline-flex items-center gap-1 rounded-md bg-red-500/15 border border-red-500/30 px-2 py-0.5 text-[10px] font-black text-red-400">
                                  <AlertOctagon className="h-3 w-3" />
                                  {statusPrev.label}
                                </span>
                              ) : statusPrev.status === 'proxima' ? (
                                <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-black text-amber-400">
                                  <AlertTriangle className="h-3 w-3" />
                                  {statusPrev.label}
                                </span>
                              ) : statusPrev.status === 'em_dia' ? (
                                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                                  <CheckCircle2 className="h-3 w-3" />
                                  {statusPrev.label}
                                </span>
                              ) : (
                                <span className="text-[10px] text-secondary/50 font-semibold">— NÃO INFORMADA</span>
                              )}
                            </div>
                            <div className="text-[10px] text-secondary font-mono mt-1">
                              {v.kmUltimaPreventiva ? `${v.kmUltimaPreventiva.toLocaleString('pt-BR')} KM` : ''}
                              {v.kmUltimaPreventiva && v.dataUltimaPreventiva ? ' · ' : ''}
                              {v.dataUltimaPreventiva ? format(parseISO(v.dataUltimaPreventiva), 'dd/MM/yyyy') : ''}
                            </div>
                          </td>

                          {/* Documento, Seguro & Tacógrafo */}
                          <td className="px-4 py-3">
                            <div className="space-y-1">
                              {/* CRLV */}
                              <div className="flex items-center gap-1.5">
                                <span className="text-[9px] font-bold text-secondary w-9">CRLV:</span>
                                {v.crlvPago ? (
                                  <button
                                    type="button"
                                    onClick={() => alternarCrlvPago(v.id)}
                                    title={`CRLV marcado como pago manualmente (status pela data: ${statusDoc.label}). Clique para desmarcar.`}
                                    className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 text-[9px] font-black text-emerald-400 hover:bg-emerald-500/25 transition-colors cursor-pointer"
                                  >
                                    <Banknote className="h-2.5 w-2.5" />
                                    PAGO
                                  </button>
                                ) : statusDoc.status === 'vencido' ? (
                                  <>
                                    <span className="inline-flex items-center gap-1 rounded-md bg-rose-600/15 border border-rose-600/30 px-1.5 py-0.5 text-[9px] font-black text-rose-500">
                                      <FileX className="h-2.5 w-2.5" />
                                      {statusDoc.label}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => alternarCrlvPago(v.id)}
                                      title="Já paguei — marcar CRLV como pago"
                                      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/25 hover:border-emerald-500/60 transition-colors"
                                    >
                                      <Banknote className="h-3 w-3" />
                                    </button>
                                  </>
                                ) : statusDoc.status === 'a_vencer' ? (
                                  <>
                                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 text-[9px] font-black text-amber-400">
                                      <Clock className="h-2.5 w-2.5" />
                                      {statusDoc.label}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => alternarCrlvPago(v.id)}
                                      title="Já paguei — marcar CRLV como pago"
                                      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/25 hover:border-emerald-500/60 transition-colors"
                                    >
                                      <Banknote className="h-3 w-3" />
                                    </button>
                                  </>
                                ) : statusDoc.status === 'em_dia' ? (
                                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400">
                                    <CheckCircle2 className="h-2.5 w-2.5" />
                                    {statusDoc.label}
                                  </span>
                                ) : (
                                  <span className="text-[9px] text-secondary/50 font-semibold">—</span>
                                )}
                              </div>

                              {/* Seguro */}
                              <div className="flex items-center gap-1.5">
                                <span className="text-[9px] font-bold text-secondary w-9">SEG:</span>
                                {v.seguroOk ? (
                                  <button
                                    type="button"
                                    onClick={() => alternarSeguroOk(v.id)}
                                    title="Seguro regularizado manualmente (ainda sem data de vencimento cadastrada). Clique para desmarcar."
                                    className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 text-[9px] font-black text-emerald-400 hover:bg-emerald-500/25 transition-colors cursor-pointer"
                                  >
                                    <ShieldCheck className="h-2.5 w-2.5" />
                                    OK
                                  </button>
                                ) : statusSeg.status === 'vencido' ? (
                                  <span className="inline-flex items-center gap-1 rounded-md bg-rose-600/15 border border-rose-600/30 px-1.5 py-0.5 text-[9px] font-black text-rose-500">
                                    <ShieldCheck className="h-2.5 w-2.5" />
                                    {statusSeg.label}
                                  </span>
                                ) : statusSeg.status === 'a_vencer' ? (
                                  <span className="inline-flex items-center gap-1 rounded-md bg-indigo-500/15 border border-indigo-500/30 px-1.5 py-0.5 text-[9px] font-black text-indigo-400">
                                    <ShieldCheck className="h-2.5 w-2.5" />
                                    {statusSeg.label}
                                  </span>
                                ) : statusSeg.status === 'em_dia' ? (
                                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400">
                                    <ShieldCheck className="h-2.5 w-2.5" />
                                    {statusSeg.label}
                                  </span>
                                ) : (
                                  <>
                                    <span className="text-[9px] text-secondary/50 font-semibold">— NÃO INFORMADO</span>
                                    <button
                                      type="button"
                                      onClick={() => alternarSeguroOk(v.id)}
                                      title="Já está regularizado — marcar seguro como OK"
                                      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/25 hover:border-emerald-500/60 transition-colors"
                                    >
                                      <ShieldCheck className="h-3 w-3" />
                                    </button>
                                  </>
                                )}
                              </div>

                              {/* Tacógrafo (Exibido para pesados ou quando cadastrado) */}
                              {(v.vencimentoTacografo || v.numeroTacografo || v.tipo !== 'leve') && (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[9px] font-bold text-secondary w-9">TAC:</span>
                                  {statusTac.status === 'vencido' ? (
                                    <span className="inline-flex items-center gap-1 rounded-md bg-rose-600/15 border border-rose-600/30 px-1.5 py-0.5 text-[9px] font-black text-rose-500">
                                      <Disc className="h-2.5 w-2.5" />
                                      {statusTac.label}
                                    </span>
                                  ) : statusTac.status === 'a_vencer' ? (
                                    <span className="inline-flex items-center gap-1 rounded-md bg-purple-500/15 border border-purple-500/30 px-1.5 py-0.5 text-[9px] font-black text-purple-400">
                                      <Disc className="h-2.5 w-2.5" />
                                      {statusTac.label}
                                    </span>
                                  ) : statusTac.status === 'em_dia' ? (
                                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400">
                                      <Disc className="h-2.5 w-2.5" />
                                      {statusTac.label}
                                    </span>
                                  ) : (
                                    <span className="text-[9px] text-secondary/50 font-semibold">— NÃO INFORMADO</span>
                                  )}
                                  {v.numeroTacografo && (
                                    <span className="text-[9px] font-mono text-secondary/70">
                                      (Nº {v.numeroTacografo})
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Ações */}
                          <td className="px-3 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => setVeiculoDetalhando(v)}
                                className="rounded-lg p-1.5 text-secondary hover:text-foreground hover:bg-overlay/10 transition-colors"
                                title="Ver Detalhes"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => iniciarEdicaoVeiculo(v)}
                                className="rounded-lg p-1.5 text-secondary hover:text-foreground hover:bg-overlay/10 transition-colors"
                                title="Editar Veículo"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              {isAdmin && (
                                <button
                                  type="button"
                                  onClick={() => handleExcluirVeiculo(v.id)}
                                  className="rounded-lg p-1.5 text-secondary hover:text-status-danger hover:bg-status-danger/10 transition-colors"
                                  title="Excluir Veículo"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 2: CHECKLIST DA FROTA */}
      {/* ========================================================================= */}
      {abaPrincipal === 'checklist' && (
        <div className="space-y-6">
          {/* Banner Informativo Frota Leve + Rodocaçamba */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs font-bold shadow-sm">
            <div className="flex items-center gap-2.5">
              <span className="p-1.5 rounded-xl bg-emerald-500/20 text-emerald-400">
                <Car className="h-4 w-4" />
              </span>
              <span>
                CHECKLIST OPERACIONAL HABILITADO PARA <strong>FROTA LEVE E RODOCAÇAMBA</strong> ({veiculosFrotaLeveChecklist.length} VEÍCULOS).
              </span>
            </div>
            <span className="hidden sm:inline-block text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 px-2 py-0.5 rounded-md border border-emerald-500/30 text-emerald-400">
              VISTORIAS ATIVAS
            </span>
          </div>

          {/* Métricas do Checklist */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <Card className="p-4 sm:p-5 border-border/30 bg-surface/90">
              <div className="flex items-center justify-between text-secondary">
                <span className="text-[11px] font-black uppercase tracking-wider">TOTAL DE CHECKLISTS</span>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                  <ClipboardCheck className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-3 text-3xl font-black font-mono text-foreground">{metricasChecklist.total}</p>
              <p className="mt-1 text-xs text-secondary font-medium">INSPEÇÕES REGISTRADAS</p>
            </Card>

            <Card className="p-4 sm:p-5 border-emerald-500/20 bg-surface/90">
              <div className="flex items-center justify-between text-secondary">
                <span className="text-[11px] font-black uppercase tracking-wider text-emerald-500">APROVADOS</span>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-3 text-3xl font-black font-mono text-emerald-500">{metricasChecklist.aprovados}</p>
              <p className="mt-1 text-xs text-secondary font-medium">100% LIBERADOS</p>
            </Card>

            <Card className="p-4 sm:p-5 border-amber-500/20 bg-surface/90">
              <div className="flex items-center justify-between text-secondary">
                <span className="text-[11px] font-black uppercase tracking-wider text-amber-400">COM RESSALVAS</span>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Clock className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-3 text-3xl font-black font-mono text-amber-400">{metricasChecklist.comRessalvas}</p>
              <p className="mt-1 text-xs text-secondary font-medium">PEQUENOS REPAROS</p>
            </Card>

            <Card className="p-4 sm:p-5 border-rose-600/20 bg-surface/90">
              <div className="flex items-center justify-between text-secondary">
                <span className="text-[11px] font-black uppercase tracking-wider text-rose-500">REPROVADOS</span>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-600/10 text-rose-500 border border-rose-600/20">
                  <AlertOctagon className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-3 text-3xl font-black font-mono text-rose-500">{metricasChecklist.reprovados}</p>
              <p className="mt-1 text-xs text-secondary font-medium">NECESSITAM OFICINA</p>
            </Card>
          </div>

          {/* Filtros e Busca do Checklist */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary" />
              <input
                value={buscaChecklist}
                onChange={(e) => setBuscaChecklist(e.target.value)}
                placeholder="BUSCAR POR PLACA, MOTORISTA, CLIENTE..."
                className="h-11 w-full rounded-2xl border border-border/25 bg-surface/90 pl-10 pr-9 text-xs text-foreground placeholder:text-secondary/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary uppercase shadow-sm transition-all"
              />
              {buscaChecklist && (
                <button
                  type="button"
                  onClick={() => setBuscaChecklist('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary hover:text-foreground p-1"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <select
                value={filtroResultadoChecklist}
                onChange={(e) => setFiltroResultadoChecklist(e.target.value)}
                className="h-10 rounded-xl border border-border/25 bg-surface/90 px-3 text-xs font-bold text-foreground focus:border-primary focus:outline-none uppercase"
              >
                <option value="todos">TODOS OS RESULTADOS</option>
                <option value="aprovado">APROVADOS (LIBERADOS)</option>
                <option value="aprovado_com_ressalvas">COM RESSALVAS</option>
                <option value="reprovado">REPROVADOS (BLOQUEADOS)</option>
              </select>
            </div>
          </div>

          {/* Listagem de Checklists */}
          {carregandoChecklists && checklistsFiltrados.length === 0 ? (
            <Card className="p-12 text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-secondary/30 border-t-primary" />
              <p className="mt-3 text-xs font-semibold text-secondary">CARREGANDO CHECKLISTS…</p>
            </Card>
          ) : checklistsFiltrados.length === 0 ? (
            <Card className="p-12 text-center">
              <ClipboardCheck className="mx-auto mb-3 h-10 w-10 text-secondary/40" />
              <p className="text-base font-bold text-foreground">NENHUM CHECKLIST REGISTRADO</p>
              <p className="mt-1 text-xs text-secondary">
                {buscaChecklist || filtroResultadoChecklist !== 'todos'
                  ? 'TENTE AJUSTAR OS FILTROS DE BUSCA.'
                  : 'CLIQUE NO BOTÃO "+ NOVO CHECKLIST" PARA REGISTRAR A PRIMEIRA INSPEÇÃO DE VEÍCULO DA FROTA.'}
              </p>
            </Card>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border/25 bg-surface/80 shadow-sm backdrop-blur-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm uppercase">
                  <thead className="border-b border-border/15 bg-surface/95 text-[11px] font-black text-secondary uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3.5">DATA / HORA</th>
                      <th className="px-4 py-3.5">VEÍCULO / PLACA</th>
                      <th className="px-4 py-3.5">MOTORISTA</th>
                      <th className="px-4 py-3.5">KM VISTORIA</th>
                      <th className="px-4 py-3.5">PREVENTIVA</th>
                      <th className="px-4 py-3.5">FOTOS</th>
                      <th className="px-4 py-3.5">STATUS</th>
                      <th className="px-4 py-3.5 text-right">AÇÕES</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/10 font-medium">
                    {checklistsFiltrados.map((chk) => {
                      const dataFormatada = format(parseISO(chk.dataHora), "dd/MM/yyyy 'às' HH:mm")
                      const fotosQtd = [
                        chk.fotos?.painel,
                        chk.fotos?.frente,
                        chk.fotos?.ladoEsquerdo,
                        chk.fotos?.traseira,
                        chk.fotos?.ladoDireito,
                      ].filter(Boolean).length

                      // IDA ainda sem uma VOLTA correspondente depois dela — o
                      // "trecho" fica pendente até o veículo ser devolvido.
                      const pendenteDeVolta =
                        chk.tipoChecklist === 'ida' &&
                        !checklists.some(
                          (c) =>
                            c.placa.toUpperCase().trim() === chk.placa.toUpperCase().trim() &&
                            c.tipoChecklist === 'volta' &&
                            new Date(c.dataHora).getTime() > new Date(chk.dataHora).getTime(),
                        )

                      return (
                        <tr key={chk.id} className="hover:bg-surface-hover/40 transition-colors group">
                          {/* Data / Hora */}
                          <td className="px-4 py-3.5 text-xs text-secondary font-mono">
                            {dataFormatada}
                          </td>

                          {/* Placa / Veículo */}
                          <td
                            className="px-4 py-3.5 cursor-pointer"
                            onClick={() => setChecklistVisualizando(chk)}
                            title="Ver relatório do checklist"
                          >
                            <div className="font-mono font-black text-primary text-sm flex items-center gap-1.5 hover:underline">
                              <span>🚛</span>
                              <span>{chk.placa}</span>
                              {chk.tipoChecklist && (
                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${
                                  chk.tipoChecklist === 'ida'
                                    ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                                    : 'bg-purple-500/10 border-purple-500/30 text-purple-400'
                                }`}>
                                  {chk.tipoChecklist === 'ida' ? 'IDA' : 'VOLTA'}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-secondary font-semibold">
                              {chk.modeloNome || '—'} {chk.clienteNome ? `· ${chk.clienteNome}` : ''}
                            </div>
                          </td>

                          {/* Motorista */}
                          <td className="px-4 py-3.5 text-xs font-bold text-foreground">
                            {chk.motoristaNome}
                          </td>

                          {/* KM */}
                          <td className="px-4 py-3.5 text-xs font-mono font-bold text-foreground">
                            {chk.kmAtual.toLocaleString('pt-BR')} KM
                          </td>

                          {/* Diagnóstico da Preventiva */}
                          <td className="px-4 py-3.5">
                            {chk.statusPreventiva?.status === 'vencida' ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-black text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
                                🛑 VENCIDA
                              </span>
                            ) : chk.statusPreventiva?.status === 'proxima' ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                                ⚠️ PRÓXIMA
                              </span>
                            ) : chk.statusPreventiva?.status === 'em_dia' ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                ✅ EM DIA
                              </span>
                            ) : (
                              <span className="text-[10px] text-secondary/50 font-semibold">—</span>
                            )}
                          </td>

                          {/* Fotos */}
                          <td className="px-4 py-3.5">
                            {fotosQtd > 0 ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                                <Camera className="h-3 w-3" />
                                {fotosQtd}/5 FOTOS
                              </span>
                            ) : (
                              <span className="text-[10px] text-secondary/50 font-semibold">— SEM FOTOS</span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3.5">
                            {pendenteDeVolta ? (
                              <button
                                type="button"
                                onClick={() => iniciarChecklistVolta(chk.veiculoId)}
                                title="Clique para registrar o checklist de volta"
                              >
                                <Badge tone="warning" className="text-[9px] font-black animate-pulse cursor-pointer hover:brightness-110">
                                  PENDENTE (FALTA VOLTA)
                                </Badge>
                              </button>
                            ) : (
                              <>
                                {chk.resultado === 'aprovado' && (
                                  <Badge tone="success" className="text-[9px] font-black">
                                    APROVADO
                                  </Badge>
                                )}
                                {chk.resultado === 'aprovado_com_ressalvas' && (
                                  <Badge tone="warning" className="text-[9px] font-black">
                                    COM RESSALVAS
                                  </Badge>
                                )}
                                {chk.resultado === 'reprovado' && (
                                  <Badge tone="danger" className="text-[9px] font-black">
                                    REPROVADO
                                  </Badge>
                                )}
                              </>
                            )}
                          </td>

                          {/* Ações */}
                          <td className="px-4 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => setChecklistVisualizando(chk)}
                                className="rounded-lg p-1.5 text-secondary hover:text-primary hover:bg-overlay/10 transition-colors"
                                title="Visualizar Relatório de Inspeção"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              {isAdmin && (
                                <button
                                  type="button"
                                  onClick={() => handleExcluirChecklist(chk.id)}
                                  className="rounded-lg p-1.5 text-secondary hover:text-status-danger hover:bg-status-danger/10 transition-colors"
                                  title="Excluir Checklist"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ABA 3: CONTROLE DE VIAGENS */}
      {abaPrincipal === 'viagens' && subAbaViagens === 'viagens' && (
        <div className="space-y-6 print:space-y-3">
          {/* Indicadores Financeiros */}
          {!ocultarTotaisViagem && (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
              <Card className="p-4 border-border/30 bg-surface/90">
                <div className="flex items-center justify-between text-secondary">
                  <span className="text-[10px] font-black uppercase tracking-wider">TOTAL DE FRETES</span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <ArrowUp className="h-3.5 w-3.5" />
                  </div>
                </div>
                <p className="mt-2 text-xl font-black font-mono text-foreground">
                  {metricasViagens.totalFretes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </Card>

              <Card className="p-4 border-border/30 bg-surface/90">
                <div className="flex items-center justify-between text-secondary">
                  <span className="text-[10px] font-black uppercase tracking-wider">ADIANTAMENTOS</span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Banknote className="h-3.5 w-3.5" />
                  </div>
                </div>
                <p className="mt-2 text-xl font-black font-mono text-foreground">
                  {metricasViagens.totalAdiantamentos.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </Card>

              <Card className="p-4 border-amber-500/20 bg-surface/90">
                <div className="flex items-center justify-between text-secondary">
                  <span className="text-[10px] font-black uppercase tracking-wider">SALDO</span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
                    <Gauge className="h-3.5 w-3.5" />
                  </div>
                </div>
                <p className="mt-2 text-xl font-black font-mono text-foreground">
                  {metricasViagens.saldo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </Card>

              <Card className="p-4 border-rose-500/20 bg-surface/90">
                <div className="flex items-center justify-between text-secondary">
                  <span className="text-[10px] font-black uppercase tracking-wider">CUSTO OPERACIONAL</span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/10 text-rose-500">
                    <ArrowDown className="h-3.5 w-3.5" />
                  </div>
                </div>
                <p className="mt-2 text-xl font-black font-mono text-rose-500">
                  {metricasViagens.custoOperacionalTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </Card>

              <Card className="p-4 border-emerald-500/20 bg-surface/90">
                <div className="flex items-center justify-between text-secondary">
                  <span className="text-[10px] font-black uppercase tracking-wider">SALDO LÍQUIDO</span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                    <Banknote className="h-3.5 w-3.5" />
                  </div>
                </div>
                <p className="mt-2 text-xl font-black font-mono text-emerald-500">
                  {metricasViagens.saldoLiquido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </Card>
            </div>
          )}

          {/* Filtros de Viagens */}
          <Card className="p-4 space-y-3 print:hidden">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div>
                <Label className="normal-case text-[10px]">ID da Viagem</Label>
                <div className="relative mt-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-secondary" />
                  <input
                    value={buscaViagem}
                    onChange={(e) => setBuscaViagem(e.target.value)}
                    placeholder="ID..."
                    className="h-10 w-full rounded-xl border border-border/25 bg-surface/90 pl-8 pr-2 text-xs text-foreground placeholder:text-secondary/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary uppercase"
                  />
                </div>
              </div>
              <div>
                <Label className="normal-case text-[10px]">Veículo</Label>
                <Select
                  value={filtroVeiculoIdViagem}
                  onChange={(e) => setFiltroVeiculoIdViagem(e.target.value)}
                  className="mt-1 text-xs font-bold"
                >
                  <option value="">TODOS OS VEÍCULOS</option>
                  {[...frotas].sort((a, b) => a.placa.localeCompare(b.placa)).map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.placa}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label className="normal-case text-[10px]">Cliente</Label>
                <Select
                  value={filtroClienteIdViagem}
                  onChange={(e) => setFiltroClienteIdViagem(e.target.value)}
                  className="mt-1 text-xs font-bold"
                >
                  <option value="">TODOS OS CLIENTES</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label className="normal-case text-[10px]">Centro de Custo</Label>
                <Select
                  value={filtroCentroCustoIdViagem}
                  onChange={(e) => setFiltroCentroCustoIdViagem(e.target.value)}
                  className="mt-1 text-xs font-bold"
                >
                  <option value="">TODOS OS CENTROS</option>
                  {centrosCusto.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label className="normal-case text-[10px]">Status</Label>
                <Select
                  value={filtroStatusViagem}
                  onChange={(e) => setFiltroStatusViagem(e.target.value as typeof filtroStatusViagem)}
                  className="mt-1 text-xs font-bold"
                >
                  <option value="ativas">ATIVAS</option>
                  <option value="todas">TODAS</option>
                  {(Object.keys(STATUS_VIAGEM_INFO) as StatusViagem[]).map((s) => (
                    <option key={s} value={s}>
                      {STATUS_VIAGEM_INFO[s].label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {mostrarFiltrosAvancadosViagem && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-border/15">
                <div>
                  <Label className="normal-case text-[10px]">Coleta De</Label>
                  <Input
                    type="date"
                    value={filtroDataColetaDeViagem}
                    onChange={(e) => setFiltroDataColetaDeViagem(e.target.value)}
                    className="mt-1 text-xs font-bold"
                  />
                </div>
                <div>
                  <Label className="normal-case text-[10px]">Coleta Até</Label>
                  <Input
                    type="date"
                    value={filtroDataColetaAteViagem}
                    onChange={(e) => setFiltroDataColetaAteViagem(e.target.value)}
                    className="mt-1 text-xs font-bold"
                  />
                </div>
                <div>
                  <Label className="normal-case text-[10px]">Tipo de Frete</Label>
                  <Select
                    value={filtroTipoFreteViagem}
                    onChange={(e) => setFiltroTipoFreteViagem(e.target.value as typeof filtroTipoFreteViagem)}
                    className="mt-1 text-xs font-bold"
                  >
                    <option value="todos">TODOS</option>
                    <option value="CIF">CIF (REMETENTE PAGA)</option>
                    <option value="FOB">FOB (DESTINATÁRIO PAGA)</option>
                  </Select>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setOcultarTotaisViagem((v) => !v)}
                className="gap-1.5 text-xs font-bold"
              >
                {ocultarTotaisViagem ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                {ocultarTotaisViagem ? 'MOSTRAR TOTAIS' : 'OCULTAR TOTAIS'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setMostrarFiltrosAvancadosViagem((v) => !v)}
                className="gap-1.5 text-xs font-bold"
              >
                <Filter className="h-3.5 w-3.5" />
                FILTROS AVANÇADOS
              </Button>
              <Button type="button" variant="secondary" onClick={limparFiltrosViagem} className="gap-1.5 text-xs font-bold">
                <RotateCcw className="h-3.5 w-3.5" />
                LIMPAR
              </Button>
              <Button type="button" variant="secondary" onClick={() => window.print()} className="gap-1.5 text-xs font-bold">
                <Printer className="h-3.5 w-3.5" />
                IMPRIMIR
              </Button>
              <Button type="button" onClick={iniciarNovaViagem} className="ml-auto gap-1.5 text-xs font-bold shadow-md shadow-primary/20">
                <Plus className="h-3.5 w-3.5" />
                NOVA VIAGEM
              </Button>
            </div>
          </Card>

          {/* Listagem de Viagens */}
          {carregandoViagens && viagensFiltradas.length === 0 ? (
            <Card className="p-12 text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-secondary/30 border-t-primary" />
              <p className="mt-3 text-xs font-semibold text-secondary">CARREGANDO VIAGENS…</p>
            </Card>
          ) : viagensFiltradas.length === 0 ? (
            <Card className="p-12 text-center">
              <Route className="mx-auto mb-3 h-10 w-10 text-secondary/40" />
              <p className="text-base font-bold text-foreground">NENHUMA VIAGEM ENCONTRADA</p>
              <p className="mt-1 text-xs text-secondary">
                {buscaViagem || filtroStatusViagem !== 'ativas'
                  ? 'TENTE AJUSTAR OS FILTROS DE BUSCA.'
                  : 'CLIQUE NO BOTÃO "+ NOVA VIAGEM" PARA REGISTRAR A PRIMEIRA VIAGEM DA FROTA.'}
              </p>
            </Card>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border/25 bg-surface/80 shadow-sm backdrop-blur-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm uppercase">
                  <thead className="border-b border-border/15 bg-surface/95 text-[11px] font-black text-secondary uppercase tracking-wider">
                    <tr>
                      <ThOrdenavelViagem label="VIAGEM" campo="id" ordenacao={ordenacaoViagem} onClick={alternarOrdenacaoViagem} />
                      <th className="px-4 py-3.5">ROTA</th>
                      <th className="px-4 py-3.5">PLACA</th>
                      <ThOrdenavelViagem label="COLETA" campo="dataColeta" ordenacao={ordenacaoViagem} onClick={alternarOrdenacaoViagem} />
                      <ThOrdenavelViagem label="ENTREGA" campo="dataEntrega" ordenacao={ordenacaoViagem} onClick={alternarOrdenacaoViagem} />
                      <ThOrdenavelViagem label="FRETE" campo="frete" ordenacao={ordenacaoViagem} onClick={alternarOrdenacaoViagem} />
                      <ThOrdenavelViagem label="ADIANT." campo="adiantamento" ordenacao={ordenacaoViagem} onClick={alternarOrdenacaoViagem} />
                      <ThOrdenavelViagem label="SALDO" campo="saldo" ordenacao={ordenacaoViagem} onClick={alternarOrdenacaoViagem} />
                      <th className="px-4 py-3.5">CUSTO</th>
                      <th className="px-4 py-3.5 text-right print:hidden">AÇÕES</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/10 font-medium">
                    {viagensFiltradas.map((v) => {
                      const statusInfo = STATUS_VIAGEM_INFO[v.status]
                      const veiculoDaViagem = frotas.find((f) => f.id === v.veiculoId)
                      const saldoViagem = (v.freteBruto || 0) - (v.adiantamento || 0)
                      return (
                        <tr key={v.id} className="hover:bg-overlay/5 transition-colors align-top">
                          <td className="px-4 py-3">
                            <p className="font-mono font-black text-foreground">#{v.id.slice(0, 8)}</p>
                            <Badge tone={statusInfo.tone} className="mt-1 text-[9px] font-black uppercase">
                              {veiculoDaViagem ? LABEL_TIPO_FROTA[veiculoDaViagem.tipo] : statusInfo.label}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-xs font-bold text-foreground normal-case">
                              {v.cidadeOrigem || v.origem} → {v.cidadeDestino || v.destino}
                            </p>
                            {v.distanciaEstimadaKm != null && (
                              <p className="text-[10px] text-secondary font-mono">
                                {v.distanciaEstimadaKm.toLocaleString('pt-BR')} km
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-block rounded-lg border border-border/25 bg-background/60 px-2 py-1 font-mono font-black text-foreground text-[11px]">
                              {v.placa}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs">
                            {v.dataColetaPrevista ? format(parseISO(v.dataColetaPrevista), 'dd/MM/yyyy') : '—'}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs">
                            {v.dataEntregaPrevista ? format(parseISO(v.dataEntregaPrevista), 'dd/MM/yyyy') : '—'}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs font-black text-foreground">
                            {v.freteBruto != null ? formatarMoeda(v.freteBruto) : '—'}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs font-bold text-primary">
                            {v.adiantamento != null ? formatarMoeda(v.adiantamento) : formatarMoeda(0)}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs font-black text-emerald-500">{formatarMoeda(saldoViagem)}</td>
                          <td className="px-4 py-3 font-mono text-xs text-rose-500">
                            {v.custoOperacional != null ? formatarMoeda(v.custoOperacional) : '—'}
                          </td>
                          <td className="px-4 py-3 print:hidden">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => iniciarEdicaoViagem(v)}
                                className="rounded-lg p-1.5 text-secondary hover:text-primary hover:bg-overlay/10 transition-colors"
                                title="Editar Viagem"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              {isAdmin && (
                                <button
                                  type="button"
                                  onClick={() => handleExcluirViagem(v.id)}
                                  className="rounded-lg p-1.5 text-secondary hover:text-status-danger hover:bg-status-danger/10 transition-colors"
                                  title="Excluir Viagem"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-ABA: ENDEREÇOS FREQUENTES */}
      {abaPrincipal === 'viagens' && subAbaViagens === 'enderecos' && (
        <GerenciadorEnderecosFrequentes
          enderecos={enderecosFrequentes}
          loading={carregandoEnderecosFrequentes}
          refetch={refetchEnderecosFrequentes}
        />
      )}

      {/* SUB-ABA: CENTROS DE CUSTO */}
      {abaPrincipal === 'viagens' && subAbaViagens === 'centros_custo' && (
        <GerenciadorCadastroSimples
          titulo="Centros de Custo"
          subtitulo="Centros de custo usados para classificar as viagens"
          icon={Building2}
          itens={centrosCusto}
          loading={carregandoCentrosCusto}
          refetch={refetchCentrosCusto}
          onCriar={criarCentroCusto}
          onAtualizar={atualizarCentroCusto}
          onExcluir={excluirCentroCusto}
        />
      )}

      {/* SUB-ABA: TIPOS DE CARGA */}
      {abaPrincipal === 'viagens' && subAbaViagens === 'tipos_carga' && (
        <GerenciadorCadastroSimples
          titulo="Tipos de Carga"
          subtitulo="Categorias de carga transportada nas viagens"
          icon={Package}
          itens={tiposCarga}
          loading={carregandoTiposCarga}
          refetch={refetchTiposCarga}
          onCriar={criarTipoCarga}
          onAtualizar={atualizarTipoCarga}
          onExcluir={excluirTipoCarga}
        />
      )}

      {/* SUB-ABA: MARCAS */}
      {abaPrincipal === 'viagens' && subAbaViagens === 'marcas' && (
        <GerenciadorCadastroSimples
          titulo="Marcas"
          subtitulo="Marcas de veículos usadas no cadastro da frota"
          icon={Award}
          itens={marcas}
          loading={false}
          refetch={refetchMarcas}
          onCriar={criarMarca}
          onAtualizar={atualizarMarca}
          onExcluir={excluirMarca}
        />
      )}

      {/* SUB-ABA: MODELOS */}
      {abaPrincipal === 'viagens' && subAbaViagens === 'modelos' && (
        <GerenciadorModelos marcas={marcas} />
      )}

      {/* SUB-ABA: PESSOAS */}
      {abaPrincipal === 'viagens' && subAbaViagens === 'pessoas' && (
        <GerenciadorCadastroSimples
          titulo="Pessoas"
          subtitulo="Contatos vinculáveis às viagens (motoristas, responsáveis por imposto/comissão)"
          icon={Users}
          itens={pessoas}
          loading={carregandoPessoas}
          refetch={refetchPessoas}
          onCriar={criarPessoa}
          onAtualizar={atualizarPessoa}
          onExcluir={excluirPessoa}
        />
      )}

      {/* SUB-ABA: FORMAS DE PAGAMENTO */}
      {abaPrincipal === 'viagens' && subAbaViagens === 'formas_pagamento' && (
        <GerenciadorCadastroSimples
          titulo="Formas de Pagamento"
          subtitulo="Formas de pagamento usadas nos fechamentos financeiros das viagens"
          icon={CreditCard}
          itens={formasPagamento}
          loading={carregandoFormasPagamento}
          refetch={refetchFormasPagamento}
          onCriar={criarFormaPagamento}
          onAtualizar={atualizarFormaPagamento}
          onExcluir={excluirFormaPagamento}
        />
      )}

      {/* SUB-ABA: TIPOS DE LANÇAMENTO */}
      {abaPrincipal === 'viagens' && subAbaViagens === 'tipos_lancamento' && (
        <GerenciadorCadastroSimples
          titulo="Tipos de Lançamento"
          subtitulo="Categorias usadas para classificar lançamentos financeiros das viagens"
          icon={Tag}
          itens={tiposLancamento}
          loading={carregandoTiposLancamento}
          refetch={refetchTiposLancamento}
          onCriar={criarTipoLancamento}
          onAtualizar={atualizarTipoLancamento}
          onExcluir={excluirTipoLancamento}
        />
      )}

      {/* SUB-ABA: CONTAS BANCÁRIAS */}
      {abaPrincipal === 'viagens' && subAbaViagens === 'contas_bancarias' && (
        <GerenciadorContasBancarias
          contas={contasBancarias}
          loading={carregandoContasBancarias}
          onCriar={addConta}
          onAtualizar={updateConta}
          onExcluir={removeConta}
        />
      )}

      {/* SUB-ABA: CONTAS A PAGAR / RECEBER */}
      {abaPrincipal === 'viagens' && subAbaViagens === 'contas_pagar_receber' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <CreditCard className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-black text-foreground uppercase">Contas a Pagar/Receber</h2>
              <p className="text-[11px] text-secondary normal-case">Lançamentos financeiros com centro de custo, vencimento e status</p>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <Card className="p-4 border-rose-500/20 bg-surface/90">
              <div className="flex items-center justify-between text-secondary">
                <span className="text-[10px] font-black uppercase tracking-wider">TOTAL A PAGAR</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/10 text-rose-500">
                  <ArrowDown className="h-3.5 w-3.5" />
                </div>
              </div>
              <p className="mt-2 text-xl font-black font-mono text-rose-500">
                {metricasContasPR.totalPagar.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            </Card>
            <Card className="p-4 border-emerald-500/20 bg-surface/90">
              <div className="flex items-center justify-between text-secondary">
                <span className="text-[10px] font-black uppercase tracking-wider">TOTAL A RECEBER</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                  <ArrowUp className="h-3.5 w-3.5" />
                </div>
              </div>
              <p className="mt-2 text-xl font-black font-mono text-emerald-500">
                {metricasContasPR.totalReceber.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            </Card>
            <Card className="p-4 border-amber-500/20 bg-surface/90">
              <div className="flex items-center justify-between text-secondary">
                <span className="text-[10px] font-black uppercase tracking-wider">VENCIDAS</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5" />
                </div>
              </div>
              <p className="mt-2 text-xl font-black font-mono text-amber-400">{metricasContasPR.vencidas}</p>
            </Card>
            <Card className="p-4 border-border/30 bg-surface/90">
              <div className="flex items-center justify-between text-secondary">
                <span className="text-[10px] font-black uppercase tracking-wider">TOTAL PAGO/RECEBIDO</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </div>
              </div>
              <p className="mt-2 text-xl font-black font-mono text-foreground">
                {metricasContasPR.totalPago.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            </Card>
          </div>

          {/* Filtros + Novo Lançamento */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col sm:flex-row gap-2 flex-1">
              <input
                value={buscaContaPR}
                onChange={(e) => setBuscaContaPR(e.target.value)}
                placeholder="BUSCAR POR DESCRIÇÃO, CENTRO DE CUSTO, FORNECEDOR, PLACA..."
                className="h-10 flex-1 rounded-xl border border-border/25 bg-surface/90 px-3 text-xs text-foreground placeholder:text-secondary/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary uppercase"
              />
              <Select
                value={filtroStatusContaPR}
                onChange={(e) => setFiltroStatusContaPR(e.target.value as typeof filtroStatusContaPR)}
                className="text-xs font-bold sm:max-w-[200px]"
              >
                <option value="todas">TODOS OS STATUS</option>
                <option value="pendente">PENDENTE</option>
                <option value="pago">PAGO</option>
                <option value="atrasado">ATRASADO</option>
                <option value="cancelado">CANCELADO</option>
              </Select>
            </div>
            <Button
              type="button"
              onClick={() => {
                setContaPREditando(null)
                setMostrarModalContaPR(true)
              }}
              className="gap-1.5 text-xs font-bold shadow-md shadow-primary/20"
            >
              <Plus className="h-3.5 w-3.5" />
              NOVO LANÇAMENTO
            </Button>
          </div>

          {/* Listagem */}
          {carregandoContasPR && contasPRFiltradas.length === 0 ? (
            <Card className="p-10 text-center">
              <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-secondary/30 border-t-primary" />
            </Card>
          ) : contasPRFiltradas.length === 0 ? (
            <Card className="p-10 text-center">
              <CreditCard className="mx-auto mb-2 h-8 w-8 text-secondary/40" />
              <p className="text-xs font-bold text-secondary">NENHUM LANÇAMENTO ENCONTRADO</p>
            </Card>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border/25 bg-surface/80 shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm uppercase">
                  <thead className="border-b border-border/15 bg-surface/95 text-[10px] font-black text-secondary uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3">DESCRIÇÃO / CENTRO DE CUSTO</th>
                      <th className="px-4 py-3">TIPO</th>
                      <th className="px-4 py-3">VALOR</th>
                      <th className="px-4 py-3">VENCIMENTO</th>
                      <th className="px-4 py-3">STATUS</th>
                      <th className="px-4 py-3 text-right">AÇÕES</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/10 font-medium">
                    {contasPRFiltradas.map((c) => (
                      <tr key={c.id} className="hover:bg-overlay/5 transition-colors">
                        <td className="px-4 py-3">
                          <p className="text-xs font-bold text-foreground normal-case">{c.descricao || '—'}</p>
                          <p className="text-[10px] text-secondary normal-case">{c.centroCustoNome}</p>
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={c.tipoMovimentacao === 'despesa' ? 'danger' : 'success'} className="text-[9px] font-black">
                            {c.tipoMovimentacao === 'despesa' ? 'A PAGAR' : 'A RECEBER'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs font-black text-foreground">
                          {c.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">{c.dataVencimento.split('-').reverse().join('/')}</td>
                        <td className="px-4 py-3">
                          <Badge
                            tone={
                              c.status === 'pago'
                                ? 'success'
                                : c.status === 'atrasado'
                                ? 'danger'
                                : c.status === 'cancelado'
                                ? 'neutral'
                                : 'warning'
                            }
                            className="text-[9px] font-black"
                          >
                            {c.status.toUpperCase()}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setContaPREditando(c)
                                setMostrarModalContaPR(true)
                              }}
                              className="rounded-lg p-1.5 text-secondary hover:text-primary hover:bg-overlay/10 transition-colors"
                              title="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleExcluirContaPR(c.id)}
                              className="rounded-lg p-1.5 text-secondary hover:text-status-danger hover:bg-status-danger/10 transition-colors"
                              title="Excluir"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {mostrarModalContaPR && createPortal(
        <ModalContaPagarReceber
          contaEditando={contaPREditando}
          centrosCusto={centrosCusto}
          onRefetchCentrosCusto={refetchCentrosCusto}
          tiposLancamento={tiposLancamento}
          onRefetchTiposLancamento={refetchTiposLancamento}
          fornecedores={fornecedores}
          onRefetchFornecedores={refetchFornecedores}
          contasBancarias={contasBancarias}
          veiculos={frotas}
          onClose={() => setMostrarModalContaPR(false)}
        />,
        document.body,
      )}

      {/* SUB-ABA: FINANCEIRO (resumo próprio das viagens — não é o painel gerencial da empresa) */}
      {abaPrincipal === 'viagens' && subAbaViagens === 'financeiro_viagens' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <DollarSign className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-black text-foreground uppercase">Financeiro das Viagens</h2>
              <p className="text-[11px] text-secondary normal-case">
                Resumo calculado a partir das Viagens e das Contas a Pagar/Receber daqui — não é o painel gerencial da empresa
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
            <Card className="p-4 border-blue-500/20 bg-surface/90">
              <div className="flex items-center justify-between text-secondary">
                <span className="text-[10px] font-black uppercase tracking-wider text-blue-400">FATURAMENTO</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
                  <DollarSign className="h-3.5 w-3.5" />
                </div>
              </div>
              <p className="mt-2 text-xl font-black font-mono text-blue-400">
                {metricasFinanceiroViagens.faturamento.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
              <p className="mt-1 text-[10px] text-secondary font-medium">FRETE BRUTO (REGIME COMPETÊNCIA)</p>
            </Card>

            <Card className="p-4 border-emerald-500/20 bg-surface/90">
              <div className="flex items-center justify-between text-secondary">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-500">RECEITAS</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                  <ArrowUp className="h-3.5 w-3.5" />
                </div>
              </div>
              <p className="mt-2 text-xl font-black font-mono text-emerald-500">
                {metricasFinanceiroViagens.receitas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
              <p className="mt-1 text-[10px] text-secondary font-medium">CONTAS A RECEBER JÁ PAGAS (CAIXA)</p>
            </Card>

            <Card className="p-4 border-rose-500/20 bg-surface/90">
              <div className="flex items-center justify-between text-secondary">
                <span className="text-[10px] font-black uppercase tracking-wider text-rose-500">DESPESAS</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/10 text-rose-500">
                  <ArrowDown className="h-3.5 w-3.5" />
                </div>
              </div>
              <p className="mt-2 text-xl font-black font-mono text-rose-500">
                {metricasFinanceiroViagens.despesas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
              <p className="mt-1 text-[10px] text-secondary font-medium">CONTAS A PAGAR JÁ PAGAS (CAIXA)</p>
            </Card>

            <Card className="p-4 border-amber-500/20 bg-surface/90">
              <div className="flex items-center justify-between text-secondary">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">SALDO DE CAIXA</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
                  <Gauge className="h-3.5 w-3.5" />
                </div>
              </div>
              <p
                className={`mt-2 text-xl font-black font-mono ${
                  metricasFinanceiroViagens.saldoCaixa >= 0 ? 'text-amber-400' : 'text-rose-500'
                }`}
              >
                {metricasFinanceiroViagens.saldoCaixa.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
              <p className="mt-1 text-[10px] text-secondary font-medium">RECEITAS − DESPESAS</p>
            </Card>

            <Card className="p-4 border-border/30 bg-surface/90">
              <div className="flex items-center justify-between text-secondary">
                <span className="text-[10px] font-black uppercase tracking-wider">RESULTADO LÍQUIDO</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Banknote className="h-3.5 w-3.5" />
                </div>
              </div>
              <p
                className={`mt-2 text-xl font-black font-mono ${
                  metricasFinanceiroViagens.resultadoLiquido >= 0 ? 'text-emerald-500' : 'text-rose-500'
                }`}
              >
                {metricasFinanceiroViagens.resultadoLiquido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
              <p className="mt-1 text-[10px] text-secondary font-medium">FATURAMENTO − DESPESAS</p>
            </Card>
          </div>

          <Card className="p-4 border-border/20 bg-background/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-[11px] text-secondary normal-case leading-relaxed">
              Pra ver os lançamentos um a um, dar baixa ou editar, use a aba{' '}
              <button
                type="button"
                onClick={() => setSubAbaViagens('contas_pagar_receber')}
                className="font-bold text-primary hover:underline"
              >
                Contas a Pagar/Receber
              </button>
              .
            </p>
            <Button
              type="button"
              onClick={() => {
                setContaPREditando(null)
                setMostrarModalContaPR(true)
              }}
              className="gap-1.5 text-xs font-bold shadow-md shadow-primary/20 shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              NOVO LANÇAMENTO
            </Button>
          </Card>
        </div>
      )}

      {/* SUB-ABA: PÁTIO */}
      {abaPrincipal === 'viagens' && subAbaViagens === 'patio' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Warehouse className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-black text-foreground uppercase">Gestão de Pátio</h2>
              <p className="text-[11px] text-secondary normal-case">
                Veículos de clientes guardados no pátio, com diária e taxímetro por dia
              </p>
            </div>
          </div>

          {/* Toggle Pátio / Histórico */}
          <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-surface/80 border border-border/25 shadow-sm w-full sm:w-fit">
            <button
              type="button"
              onClick={() => setSubAbaPatio('ativos')}
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all flex-1 sm:flex-none ${
                subAbaPatio === 'ativos'
                  ? 'bg-primary text-white shadow-md shadow-primary/20'
                  : 'text-secondary hover:text-foreground hover:bg-surface-hover/50'
              }`}
            >
              <Warehouse className="h-3.5 w-3.5" />
              NO PÁTIO
            </button>
            <button
              type="button"
              onClick={() => setSubAbaPatio('historico')}
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all flex-1 sm:flex-none ${
                subAbaPatio === 'historico'
                  ? 'bg-primary text-white shadow-md shadow-primary/20'
                  : 'text-secondary hover:text-foreground hover:bg-surface-hover/50'
              }`}
            >
              <History className="h-3.5 w-3.5" />
              HISTÓRICO
            </button>
          </div>

          {/* Filtros + Nova Entrada */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col sm:flex-row gap-2 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary" />
                <input
                  value={buscaPatio}
                  onChange={(e) => setBuscaPatio(e.target.value)}
                  placeholder="BUSCAR POR PLACA OU MODELO..."
                  className="h-10 w-full rounded-xl border border-border/25 bg-surface/90 pl-10 pr-3 text-xs text-foreground placeholder:text-secondary/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary uppercase"
                />
              </div>
              <Select
                value={filtroClientePatio}
                onChange={(e) => setFiltroClientePatio(e.target.value)}
                className="text-xs font-bold sm:max-w-[220px]"
              >
                <option value="">TODOS OS CLIENTES</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button type="button" variant="secondary" onClick={handleExportarPatio} className="gap-1.5 text-xs font-bold">
                <Download className="h-3.5 w-3.5" />
                EXPORTAR
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setEstadiaPatioEditando(null)
                  setMostrarModalPatio(true)
                }}
                className="gap-1.5 text-xs font-bold shadow-md shadow-primary/20"
              >
                <Plus className="h-3.5 w-3.5" />
                NOVA ENTRADA
              </Button>
            </div>
          </div>

          {/* Listagem */}
          {carregandoPatio && estadiasPatioFiltradas.length === 0 ? (
            <Card className="p-10 text-center">
              <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-secondary/30 border-t-primary" />
            </Card>
          ) : estadiasPatioFiltradas.length === 0 ? (
            <Card className="p-10 text-center">
              <Warehouse className="mx-auto mb-2 h-8 w-8 text-secondary/40" />
              <p className="text-xs font-bold text-secondary">
                {subAbaPatio === 'ativos' ? 'NENHUM VEÍCULO NO PÁTIO' : 'NENHUM REGISTRO NO HISTÓRICO'}
              </p>
            </Card>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border/25 bg-surface/80 shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm uppercase">
                  <thead className="border-b border-border/15 bg-surface/95 text-[10px] font-black text-secondary uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3">PLACA</th>
                      <th className="px-4 py-3">MODELO/COR</th>
                      <th className="px-4 py-3">CLIENTE</th>
                      <th className="px-4 py-3">ENTRADA</th>
                      <th className="px-4 py-3">PREVISÃO SAÍDA</th>
                      <th className="px-4 py-3">DIAS</th>
                      <th className="px-4 py-3">TAXÍMETRO</th>
                      <th className="px-4 py-3 text-right">AÇÕES</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/10 font-medium">
                    {estadiasPatioFiltradas.map((e) => {
                      const { dias, valor } = calcularDiasEValorPatio(e)
                      const finalizada = Boolean(e.dataHoraSaidaReal)
                      return (
                        <tr key={e.id} className="hover:bg-overlay/5 transition-colors">
                          <td className="px-4 py-3 font-mono font-black text-foreground">{e.placa}</td>
                          <td className="px-4 py-3">
                            <p className="text-xs font-bold text-foreground normal-case">{e.modelo || '—'}</p>
                            <p className="text-[10px] text-secondary normal-case">
                              {[e.marca, e.cor].filter(Boolean).join(' • ') || '—'}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-xs font-bold text-foreground normal-case">{e.clienteNome}</td>
                          <td className="px-4 py-3">
                            <p className="font-mono text-xs">{format(parseISO(e.dataHoraEntrada), 'dd/MM/yyyy')}</p>
                            <p className="text-[10px] text-secondary font-mono">{format(parseISO(e.dataHoraEntrada), 'HH:mm')}</p>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-secondary">
                            {e.previsaoSaida ? format(parseISO(e.previsaoSaida), 'dd/MM/yyyy HH:mm') : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <Badge tone={finalizada ? 'neutral' : 'warning'} className="text-[9px] font-black">
                              {dias} {dias === 1 ? 'DIA' : 'DIAS'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-mono text-sm font-black text-emerald-500">
                              {valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                            <p className="text-[10px] text-secondary font-mono">
                              {e.valorDiaria.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/DIA
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setEstadiaPatioEditando(e)
                                  setMostrarModalPatio(true)
                                }}
                                className="rounded-lg p-1.5 text-secondary hover:text-primary hover:bg-overlay/10 transition-colors"
                                title="Editar"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              {!finalizada && (
                                <button
                                  type="button"
                                  onClick={() => handleFinalizarEstadiaPatio(e)}
                                  className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-[10px] font-black text-emerald-500 hover:bg-emerald-500/20 transition-colors"
                                  title="Finalizar Estadia"
                                >
                                  <LogOut className="h-3.5 w-3.5" />
                                  FINALIZAR
                                </button>
                              )}
                              {isAdmin && (
                                <button
                                  type="button"
                                  onClick={() => handleExcluirEstadiaPatio(e.id)}
                                  className="rounded-lg p-1.5 text-secondary hover:text-status-danger hover:bg-status-danger/10 transition-colors"
                                  title="Excluir"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {mostrarModalPatio && createPortal(
        <ModalEstadiaPatio
          estadiaEditando={estadiaPatioEditando}
          clientes={clientes}
          onRefetchClientes={refetchClientes}
          centrosCusto={centrosCusto}
          onRefetchCentrosCusto={refetchCentrosCusto}
          onClose={() => setMostrarModalPatio(false)}
        />,
        document.body,
      )}

      {/* SUB-ABA: MANUTENÇÃO */}
      {abaPrincipal === 'viagens' && subAbaViagens === 'manutencao' && (
        <ManutencaoViagens
          veiculos={frotas}
          centrosCusto={centrosCusto}
          onRefetchCentrosCusto={refetchCentrosCusto}
          onCriarCentroCusto={criarCentroCusto}
          fornecedores={fornecedores}
          onRefetchFornecedores={refetchFornecedores}
          onCriarFornecedor={criarFornecedor}
          isAdmin={isAdmin}
        />
      )}

      {/* SUB-ABA: CONCILIAÇÃO */}
      {abaPrincipal === 'viagens' && subAbaViagens === 'conciliacao' && (
        <ConciliacaoViagens contasPR={contasPR} contasBancarias={contasBancarias} />
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: CADASTRO / EDIÇÃO DE VEÍCULO DA FROTA */}
      {/* ========================================================================= */}
      {mostrarModalVeiculo && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-xl rounded-2xl border border-border/20 bg-surface shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between border-b border-border/10 px-6 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Truck className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-foreground uppercase">
                    {editandoId ? 'EDITAR VEÍCULO DA FROTA' : 'NOVO VEÍCULO DA FROTA'}
                  </h2>
                  <p className="text-[11px] text-secondary">Dados do caminhão, KM da última preventiva e CRLV</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMostrarModalVeiculo(false)}
                className="rounded-xl p-1.5 text-secondary hover:bg-background hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmitVeiculo)} className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Proprietário da Frota */}
              <div>
                <Label htmlFor="clienteId">Proprietário da Frota *</Label>
                <div className="mt-1 flex items-center justify-between rounded-xl border border-primary/30 bg-primary/10 px-3.5 py-2.5 text-xs font-black text-primary">
                  <span className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" />
                    G VEL DIESEL & TRANSPORTES LTDA
                  </span>
                  <span className="text-[10px] font-bold text-secondary">FROTA PRÓPRIA</span>
                </div>
                <input type="hidden" {...register('clienteId')} value={clienteGvel.id} />
              </div>

              {/* Tipo de Veículo */}
              <TipoVeiculoRadioGroup register={register} name="tipo" />

              {/* Placa e Ano */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="placa">Placa *</Label>
                  <Input
                    id="placa"
                    placeholder="ABC1D23"
                    maxLength={8}
                    {...register('placa', {
                      onChange: (e) => {
                        e.target.value = e.target.value.toUpperCase()
                      },
                    })}
                    className="mt-1 font-mono uppercase font-black text-sm"
                  />
                  <FieldError message={errors.placa?.message} />
                </div>

                <div>
                  <Label htmlFor="ano">Ano *</Label>
                  <Input
                    id="ano"
                    type="number"
                    min={1950}
                    max={anoAtual + 1}
                    {...register('ano', { valueAsNumber: true })}
                    className="mt-1 font-mono text-sm font-bold"
                  />
                  <FieldError message={errors.ano?.message} />
                </div>
              </div>

              {/* Marca e Modelo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Controller
                  name="marcaId"
                  control={control}
                  render={({ field }) => (
                    <QuickCreateSelect
                      label="Marca *"
                      placeholder="Selecione a marca..."
                      options={marcas}
                      value={field.value}
                      onChange={(val) => {
                        field.onChange(val)
                        setValue('modeloId', '')
                      }}
                      onCreate={async (nome: string) => {
                        const nova = await criarMarca(nome)
                        await refetchMarcas()
                        return nova
                      }}
                      error={errors.marcaId?.message}
                    />
                  )}
                />

                <Controller
                  name="modeloId"
                  control={control}
                  render={({ field }) => (
                    <QuickCreateSelect
                      label="Modelo *"
                      placeholder={marcaIdWatch ? 'Selecione o modelo...' : 'Escolha a marca primeiro'}
                      options={modelos}
                      value={field.value}
                      onChange={field.onChange}
                      onCreate={async (nome: string) => {
                        if (!marcaIdWatch) throw new Error('Selecione uma marca primeiro')
                        const novo = await criarModelo(marcaIdWatch, nome)
                        await refetchModelos()
                        return novo
                      }}
                      error={errors.modeloId?.message}
                    />
                  )}
                />
              </div>

              {/* Cor e Chassi */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="cor">Cor *</Label>
                  <Input
                    id="cor"
                    placeholder="Ex: BRANCO"
                    {...register('cor', {
                      onChange: (e) => {
                        e.target.value = e.target.value.toUpperCase()
                      },
                    })}
                    className="mt-1 text-sm uppercase"
                  />
                  <FieldError message={errors.cor?.message} />
                </div>

                <div>
                  <Label htmlFor="chassi">Chassi (opcional)</Label>
                  <Input
                    id="chassi"
                    placeholder="Número do Chassi"
                    {...register('chassi', {
                      onChange: (e) => {
                        e.target.value = e.target.value.toUpperCase()
                      },
                    })}
                    className="mt-1 font-mono text-sm uppercase"
                  />
                </div>
              </div>

              {/* Setor, Responsável e Subtipo */}
              <div className="rounded-2xl border border-primary/20 bg-surface/90 p-4 space-y-3 shadow-sm">
                <div className="flex items-center justify-between border-b border-border/10 pb-2">
                  <span className="text-xs font-black text-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <Building2 className="h-4 w-4 text-primary" /> ALOCAÇÃO OPERACIONAL DA FROTA
                  </span>
                  <span className="text-[10px] text-primary font-bold">SETOR & CONDUTOR</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="setor">Setor / Lotação</Label>
                    <Input
                      id="setor"
                      list="lista-setores-frota"
                      placeholder="Ex: GV MANUTENÇÃO, GV SINOP..."
                      {...register('setor', {
                        onChange: (e) => {
                          e.target.value = e.target.value.toUpperCase()
                        },
                      })}
                      className="mt-1 text-xs uppercase font-bold"
                    />
                    <datalist id="lista-setores-frota">
                      {SETORES_FROTA_LEVE.map((s) => (
                        <option key={s} value={s} />
                      ))}
                    </datalist>
                  </div>

                  <div>
                    <Label htmlFor="responsavel">Responsável / Condutor Principal</Label>
                    <Input
                      id="responsavel"
                      placeholder="Ex: TIAGO, ANDERSON, MORINI, DIRETORIA..."
                      {...register('responsavel', {
                        onChange: (e) => {
                          e.target.value = e.target.value.toUpperCase()
                        },
                      })}
                      className="mt-1 text-xs uppercase font-bold"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="tipoVeiculo">Subtipo / Carroceria</Label>
                  <Select id="tipoVeiculo" {...register('tipoVeiculo')} className="mt-1 text-xs uppercase font-bold">
                    <option value="CARRO">CARRO DE PASSEIO</option>
                    <option value="CAMINHONETE">CAMINHONETE / PICK-UP</option>
                    <option value="UTILITÁRIO">UTILITÁRIO / FURGÃO</option>
                    <option value="MOTO">MOTOCICLETA</option>
                    <option value="CAMINHÃO">CAMINHÃO / PESADO</option>
                    <option value="CARRETA">CARRETA / IMPLEMENTO</option>
                  </Select>
                </div>
              </div>

              {/* SEÇÃO: CONTROLE DE PREVENTIVA (KM DA ÚLTIMA, DATA DA PRÓXIMA E INTERVALO) */}
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                <div className="flex items-center gap-2 text-primary font-black text-xs">
                  <Gauge className="h-4 w-4" />
                  <span>MANUTENÇÃO PREVENTIVA</span>
                </div>
                <p className="text-[10px] text-secondary normal-case">
                  Informe o KM em que a ÚLTIMA preventiva foi feita — o sistema soma o intervalo pra calcular quando vence a próxima. A data já deve ser a da PRÓXIMA preventiva diretamente.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label htmlFor="kmUltimaPreventiva">KM da Última Preventiva</Label>
                    <Input
                      id="kmUltimaPreventiva"
                      type="number"
                      placeholder="Ex: 150000"
                      {...register('kmUltimaPreventiva', {
                        setValueAs: (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
                      })}
                      className="mt-1 text-xs font-mono font-bold"
                    />
                  </div>

                  <div>
                    <Label htmlFor="intervaloPreventivaKm">Intervalo Preventiva (KM)</Label>
                    <Input
                      id="intervaloPreventivaKm"
                      type="number"
                      placeholder="Ex: 10000"
                      {...register('intervaloPreventivaKm', {
                        setValueAs: (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
                      })}
                      className="mt-1 text-xs font-mono font-bold"
                    />
                  </div>

                  <div>
                    <Label htmlFor="dataUltimaPreventiva">Data da Próxima Preventiva</Label>
                    <Input
                      id="dataUltimaPreventiva"
                      type="date"
                      {...register('dataUltimaPreventiva')}
                      className="mt-1 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <Label htmlFor="vencimentoDocumento">Vencimento Licenciamento (CRLV)</Label>
                    <Input
                      id="vencimentoDocumento"
                      type="date"
                      {...register('vencimentoDocumento')}
                      className="mt-1 text-xs font-mono"
                    />
                  </div>

                  <div>
                    <Label htmlFor="vencimentoSeguro">Vencimento do Seguro (Apólice)</Label>
                    <Input
                      id="vencimentoSeguro"
                      type="date"
                      {...register('vencimentoSeguro')}
                      className="mt-1 text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* SEÇÃO: CONTROLE DE TACÓGRAFO (EXCLUSIVO RODOCAÇAMBA & PESADOS) */}
              {tipoWatch !== 'leve' && (
                <div className="rounded-2xl border border-purple-500/30 bg-purple-500/5 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-purple-400 font-black text-xs">
                    <Disc className="h-4 w-4" />
                    <span>CONTROLE DE TACÓGRAFO (RODOCAÇAMBA & PESADOS)</span>
                  </div>
                  <p className="text-[10px] text-secondary normal-case">
                    Cadastro do certificado do ensaio metrológico do tacógrafo e monitoramento de validade.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <Label htmlFor="numeroTacografo">Nº do Tacógrafo / Certificado</Label>
                      <Input
                        id="numeroTacografo"
                        placeholder="Ex: 12461001"
                        {...register('numeroTacografo', {
                          onChange: (e) => {
                            e.target.value = e.target.value.toUpperCase()
                          },
                        })}
                        className="mt-1 text-xs font-mono font-bold uppercase"
                      />
                    </div>

                    <div>
                      <Label htmlFor="emissaoTacografo">Data de Emissão / Ensaio</Label>
                      <Input
                        id="emissaoTacografo"
                        type="date"
                        {...register('emissaoTacografo')}
                        className="mt-1 text-xs font-mono"
                      />
                    </div>

                    <div>
                      <Label htmlFor="vencimentoTacografo">Data de Vencimento</Label>
                      <Input
                        id="vencimentoTacografo"
                        type="date"
                        {...register('vencimentoTacografo')}
                        className="mt-1 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Situação */}
              <div>
                <Label htmlFor="situacao">Situação Operacional *</Label>
                <Select id="situacao" {...register('situacao')} className="mt-1 text-xs uppercase font-bold">
                  <option value="operante">Operante (Em circulação)</option>
                  <option value="inoperante">Inoperante (Parado / Manutenção)</option>
                </Select>
              </div>

              {/* Rodapé */}
              <div className="flex justify-end gap-2.5 pt-3 border-t border-border/15">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setMostrarModalVeiculo(false)}
                  disabled={isSubmitting}
                  className="!h-10 px-5 text-xs font-semibold"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="!h-10 px-6 text-xs font-bold bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20"
                >
                  {isSubmitting ? 'Salvando...' : editandoId ? 'Salvar Alterações' : 'Cadastrar Veículo'}
                </Button>
              </div>
            </form>
          </div>
        </div>,
        document.body,
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: NOVO CHECKLIST DE INSPEÇÃO COM COMPARADOR DE PREVENTIVA */}
      {/* ========================================================================= */}
      {mostrarModalNovoChecklist && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-4 animate-fade-in">
          <div className="w-full max-w-2xl rounded-2xl border border-border/20 bg-surface shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/10 px-5 py-3.5 bg-surface/90">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <ClipboardCheck className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm sm:text-base font-black text-foreground uppercase">NOVO CHECKLIST</h2>
                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-black uppercase">
                      LEVE E RODOCAÇAMBA
                    </span>
                  </div>
                  <p className="text-[10px] sm:text-[11px] text-secondary">Vistoria fotográfica, KM e diagnóstico de preventiva (frota leve e rodocaçamba)</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMostrarModalNovoChecklist(false)}
                className="rounded-xl p-1.5 text-secondary hover:bg-background hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Rodapé (Cancelar/Salvar) fica fora da área com scroll, sempre visível — antes ele
                era o último item dentro do form com scroll e sumia da tela em telas pequenas
                (ou com o teclado aberto no APK), sem indicação de que precisava rolar pra baixo. */}
            <form onSubmit={handleSalvarChecklist} className="flex flex-1 flex-col min-h-0">
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
              {/* ========================================================================= */}
              {/* SEÇÃO 1: DADOS DO VEÍCULO (BUSCA DE PLACA EM PRIMEIRO), CONDUTOR E KM */}
              {/* ========================================================================= */}
              <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-4">
                <div className="flex items-center justify-between border-b border-primary/15 pb-2.5">
                  <span className="text-xs font-black text-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <Car className="h-4 w-4 text-primary" /> 1. VEÍCULO & CONDUTOR
                  </span>
                  <span className="text-[10px] text-primary font-black uppercase">
                    {veiculosFiltradosChecklist.length} VEÍCULOS HABILITADOS
                  </span>
                </div>

                {/* Seletor de Categoria: Todos / Leve / Rodocaçamba — pílula com
                    indicador deslizante animado (mesma linguagem visual de um
                    switch, só que com 3 posições em vez de liga/desliga). */}
                {(() => {
                  const opcoesCategoria: [typeof categoriaChecklistNovo, string][] = [
                    ['todos', 'TODOS'],
                    ['leve', '🚗 LEVE'],
                    ['rodocacamba', '🚛 RODOCAÇAMBA'],
                  ]
                  const indiceAtivo = opcoesCategoria.findIndex(([valor]) => valor === categoriaChecklistNovo)
                  return (
                    <div className="relative flex items-center rounded-full bg-background/60 p-1 w-full max-w-md shadow-inner">
                      <div
                        className="absolute inset-1 rounded-full bg-primary shadow-md shadow-primary/30 transition-transform duration-300 ease-out"
                        style={{
                          width: `calc((100% - 0.5rem) / 3)`,
                          transform: `translateX(${indiceAtivo * 100}%)`,
                        }}
                      />
                      {opcoesCategoria.map(([valor, label]) => (
                        <button
                          key={valor}
                          type="button"
                          onClick={() => {
                            setCategoriaChecklistNovo(valor)
                            setVeiculoChecklistId('')
                            setPlacaBuscaChecklist('')
                          }}
                          className={`relative z-10 flex-1 rounded-full px-3 py-1.5 text-[10px] font-black uppercase whitespace-nowrap transition-colors duration-300 cursor-pointer ${
                            categoriaChecklistNovo === valor ? 'text-white' : 'text-secondary hover:text-foreground'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )
                })()}

                {/* Campo de Busca Direto por Placa */}
                <div ref={containerBuscaPlacaRef} className="relative">
                  <div className="flex items-center justify-between mb-1.5">
                    <Label htmlFor="chkBuscaPlaca" className="text-xs font-bold text-foreground">
                      Selecione ou Busque a Placa *
                    </Label>
                    <span className="text-[10px] text-secondary font-mono">
                      {veiculosFiltradosChecklist.length} veículos habilitados
                    </span>
                  </div>

                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
                    <Input
                      id="chkBuscaPlaca"
                      placeholder="DIGITE A PLACA, MODELO OU RESPONSÁVEL (EX: IXF4J63, SAVEIRO, TIAGO)..."
                      value={placaBuscaChecklist}
                      onFocus={() => {
                        // Só reabre a lista ao focar de novo se já tiver algo digitado —
                        // não faz sentido abrir os 27 veículos de cara ao abrir o modal.
                        if (placaBuscaChecklist.trim()) {
                          setDropdownPlacaAberto(true)
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          if (veiculosFiltradosChecklist.length > 0) {
                            const primeiro = veiculosFiltradosChecklist[0]
                            setVeiculoChecklistId(primeiro.id)
                            setPlacaBuscaChecklist(primeiro.placa)
                            if (primeiro.responsavel && !motoristaChecklist) {
                              setMotoristaChecklist(primeiro.responsavel)
                            }
                            setDropdownPlacaAberto(false)
                          }
                        } else if (e.key === 'Escape') {
                          setDropdownPlacaAberto(false)
                        }
                      }}
                      onChange={(e) => {
                        const val = e.target.value.toUpperCase()
                        setPlacaBuscaChecklist(val)
                        const limpa = val.replace(/[^A-Z0-9]/g, '')
                        setDropdownPlacaAberto(true)
                        const achado = veiculosFrotaLeveChecklist.find(
                          (f) => f.placa.toUpperCase().replace(/[^A-Z0-9]/g, '') === limpa
                        )
                        if (achado) {
                          setVeiculoChecklistId(achado.id)
                          if (achado.responsavel && !motoristaChecklist) {
                            setMotoristaChecklist(achado.responsavel)
                          }
                        } else if (!val) {
                          setVeiculoChecklistId('')
                        }
                      }}
                      className="pl-10 pr-10 font-mono uppercase font-black text-sm tracking-wider border-primary/40 focus:border-primary bg-surface/90 shadow-sm"
                      autoFocus
                    />
                    {placaBuscaChecklist && (
                      <button
                        type="button"
                        onClick={() => {
                          setPlacaBuscaChecklist('')
                          setVeiculoChecklistId('')
                          setDropdownPlacaAberto(false)
                        }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-secondary hover:text-foreground p-1 rounded-md hover:bg-white/5"
                        title="Limpar placa"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {/* Dropdown de Sugestão */}
                  {dropdownPlacaAberto && (
                    <div className="absolute z-40 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-primary/40 bg-surface shadow-2xl backdrop-blur-xl animate-fade-in divide-y divide-border/10 p-1">
                      {veiculosFiltradosChecklist.length === 0 ? (
                        <div className="p-3 text-center text-xs text-secondary font-bold">
                          Nenhum veículo encontrado com o termo &quot;{placaBuscaChecklist}&quot;
                        </div>
                      ) : (
                        veiculosFiltradosChecklist.map((f) => (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => {
                              setVeiculoChecklistId(f.id)
                              setPlacaBuscaChecklist(f.placa)
                              if (f.responsavel) {
                                setMotoristaChecklist(f.responsavel)
                              }
                              setDropdownPlacaAberto(false)
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                              f.id === veiculoChecklistId
                                ? 'bg-primary text-white font-black'
                                : 'hover:bg-primary/10 text-foreground'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <span className={`font-mono font-black px-2 py-0.5 rounded text-xs ${
                                f.id === veiculoChecklistId ? 'bg-black/30 text-white' : 'bg-primary/20 text-primary border border-primary/30'
                              }`}>
                                {f.placa}
                              </span>
                              <div>
                                <span className="font-bold block">
                                  {f.marcaNome} {f.modeloNome} {f.ano ? `(${f.ano})` : ''}
                                </span>
                                {f.setor && (
                                  <span className={`text-[10px] block ${f.id === veiculoChecklistId ? 'text-white/80' : 'text-primary font-bold'}`}>
                                    Setor: {f.setor} {f.responsavel ? `· Resp: ${f.responsavel}` : ''}
                                  </span>
                                )}
                              </div>
                            </div>
                            <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                              f.id === veiculoChecklistId ? 'bg-black/20 text-white' : 'bg-surface border border-border/20 text-secondary'
                            }`}>
                              {f.tipoVeiculo || tipoVeiculoLabel(f.tipo as 'pesado' | 'leve' | 'trator' | 'carreta')}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Banner com Detalhes do Veículo Selecionado */}
                {veiculoChecklistSelecionado && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-primary/30 bg-surface/95 text-xs shadow-sm animate-fade-in">
                    <div className="flex items-center gap-3 font-mono">
                      <span className="px-3 py-1.5 rounded-lg bg-primary text-white font-black text-sm shadow-sm">
                        {veiculoChecklistSelecionado.placa}
                      </span>
                      <div>
                        <p className="font-bold text-foreground text-sm">
                          {veiculoChecklistSelecionado.marcaNome} {veiculoChecklistSelecionado.modeloNome} ({veiculoChecklistSelecionado.ano})
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[11px] font-sans">
                          {veiculoChecklistSelecionado.setor && (
                            <span className="px-1.5 py-0.2 rounded bg-primary/10 border border-primary/20 text-primary font-black uppercase">
                              SETOR: {veiculoChecklistSelecionado.setor}
                            </span>
                          )}
                          {veiculoChecklistSelecionado.responsavel && (
                            <span className="text-secondary font-bold">
                              RESP: <strong className="text-foreground">{veiculoChecklistSelecionado.responsavel}</strong>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-left sm:text-right font-sans">
                      <span className="text-[11px] font-bold text-primary block truncate max-w-[250px]">
                        {veiculoChecklistSelecionado.clienteNome}
                      </span>
                      <span className={`text-[10px] font-black uppercase ${veiculoChecklistSelecionado.situacao === 'operante' ? 'text-emerald-400' : 'text-amber-400'}`}>
                        ● {veiculoChecklistSelecionado.situacao}
                      </span>
                    </div>
                  </div>
                )}

                {/* Tipo: IDA ou VOLTA — só pras placas que exigem checklist nos dois trechos */}
                {veiculoChecklistSelecionado && precisaChecklistIdaVolta(veiculoChecklistSelecionado.placa) && (
                  <div className="p-3.5 rounded-xl border border-primary/30 bg-primary/5 space-y-2">
                    <Label>Este checklist é de: *</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setTipoChecklistNovo('ida')}
                        className={`h-10 rounded-xl text-xs font-black uppercase transition-colors border ${
                          tipoChecklistNovo === 'ida'
                            ? 'bg-primary text-white border-primary shadow-sm'
                            : 'bg-surface border-border/25 text-secondary hover:border-primary/40'
                        }`}
                      >
                        🚗 IDA (SAÍDA)
                      </button>
                      <button
                        type="button"
                        onClick={() => setTipoChecklistNovo('volta')}
                        className={`h-10 rounded-xl text-xs font-black uppercase transition-colors border ${
                          tipoChecklistNovo === 'volta'
                            ? 'bg-primary text-white border-primary shadow-sm'
                            : 'bg-surface border-border/25 text-secondary hover:border-primary/40'
                        }`}
                      >
                        🔁 VOLTA (DEVOLUÇÃO)
                      </button>
                    </div>
                  </div>
                )}

                {/* Motorista & KM */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="chkMotorista">Motorista / Condutor *</Label>
                    <div className="relative mt-1">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary" />
                      <Input
                        id="chkMotorista"
                        placeholder="Nome do motorista"
                        value={motoristaChecklist}
                        onChange={(e) => setMotoristaChecklist(e.target.value.toUpperCase())}
                        className="pl-9 text-xs uppercase font-bold"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="chkKm">Quilometragem Atual do Veículo (KM) *</Label>
                    <div className="relative mt-1">
                      <Gauge className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary" />
                      <Input
                        id="chkKm"
                        type="number"
                        placeholder="Ex: 154200"
                        value={kmChecklist || ''}
                        onChange={(e) => setKmChecklist(Number(e.target.value))}
                        className="pl-9 font-mono text-xs font-bold"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* CARD DE COMPARAÇÃO DE PREVENTIVA EM TEMPO REAL */}
                <div className={`p-3.5 rounded-xl border text-xs transition-all ${
                  comparacaoPreventivaChecklist.status === 'vencida'
                    ? 'border-red-500/40 bg-red-500/10 text-red-300'
                    : comparacaoPreventivaChecklist.status === 'proxima'
                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                    : comparacaoPreventivaChecklist.status === 'em_dia'
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                    : 'border-border/20 bg-overlay/5 text-secondary'
                }`}>
                  <div className="flex items-center gap-2 font-black uppercase text-[11px] mb-1">
                    {comparacaoPreventivaChecklist.status === 'vencida' && <AlertOctagon className="h-4 w-4 text-red-400" />}
                    {comparacaoPreventivaChecklist.status === 'proxima' && <AlertTriangle className="h-4 w-4 text-amber-400" />}
                    {comparacaoPreventivaChecklist.status === 'em_dia' && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                    {comparacaoPreventivaChecklist.status === 'sem_dados' && <Gauge className="h-4 w-4 text-secondary" />}
                    <span>DIAGNÓSTICO AUTOMÁTICO DE PREVENTIVA</span>
                  </div>
                  <p className="normal-case leading-relaxed font-medium">
                    {comparacaoPreventivaChecklist.mensagem}
                  </p>
                  {comparacaoPreventivaChecklist.kmLimite && comparacaoPreventivaChecklist.kmLimite > 0 && (
                    <div className="mt-2 pt-2 border-t border-border/10 flex flex-wrap items-center justify-between text-[10px] font-mono font-bold">
                      {comparacaoPreventivaChecklist.kmUltima && comparacaoPreventivaChecklist.kmUltima > 0 && (
                        <span>Última Rev.: {comparacaoPreventivaChecklist.kmUltima.toLocaleString('pt-BR')} KM</span>
                      )}
                      <span>Limite Rev.: {comparacaoPreventivaChecklist.kmLimite.toLocaleString('pt-BR')} KM</span>
                      {Number(kmChecklist) > 0 && (
                        <span>KM Atual: {Number(kmChecklist).toLocaleString('pt-BR')} KM</span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* ========================================================================= */}
              {/* SEÇÃO 2: FOTOS OBRIGATÓRIAS DE VISTORIA (5 FOTOS) */}
              {/* ========================================================================= */}
              <div className="rounded-2xl border border-border/25 bg-surface/80 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Camera className="h-4 w-4 text-primary animate-pulse" />
                    <span className="text-xs font-black text-foreground uppercase tracking-wide">
                      2. FOTOS DA VISTORIA
                    </span>
                  </div>
                  <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-md ${
                    totalFotosTiradas === 5
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-primary/20 text-primary'
                  }`}>
                    {totalFotosTiradas}/5 CAPTURADAS
                  </span>
                </div>
                <p className="text-[11px] text-secondary normal-case leading-relaxed">
                  Tire as fotos da vistoria: painel/km, frente, lado esquerdo, traseira e lado direito:
                </p>

                {/* Fotos do Veículo */}
                <div>
                  <span className="text-[10px] font-black text-secondary uppercase tracking-wider block mb-2">
                    FOTOS DO VEÍCULO
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                    {/* Painel */}
                    <div className={`rounded-xl border p-2.5 flex flex-col items-center text-center transition-all ${
                      fotosChecklist.painel
                        ? 'border-emerald-500/40 bg-emerald-500/5'
                        : 'border-border/30 bg-surface/80 hover:border-primary/40'
                    }`}>
                      <input
                        ref={inputFotoPainelRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => handleUploadFoto('painel', e)}
                      />
                      <div className="flex items-center justify-between w-full mb-1.5">
                        <span className="text-[9px] font-black text-foreground flex items-center gap-0.5 truncate">
                          <Gauge className="h-2.5 w-2.5 text-primary" /> PAINEL
                        </span>
                        {fotosChecklist.painel && (
                          <span className="text-[8px] font-black text-emerald-400">✓</span>
                        )}
                      </div>

                      {fotosChecklist.painel ? (
                        <div className="relative w-full h-20 rounded-lg overflow-hidden border border-emerald-500/30 group">
                          <img src={fotosChecklist.painel} alt="Painel" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1 transition-opacity">
                            <button
                              type="button"
                              onClick={() => inputFotoPainelRef.current?.click()}
                              className="p-1 rounded bg-white text-black text-[8px] font-bold"
                            >
                              Trocar
                            </button>
                            <button
                              type="button"
                              onClick={() => setFotosChecklist((prev) => ({ ...prev, painel: undefined }))}
                              className="p-1 rounded bg-red-600 text-white text-[8px] font-bold"
                            >
                              <Trash2 className="h-2.5 w-2.5" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => inputFotoPainelRef.current?.click()}
                          className="w-full h-20 rounded-lg border-2 border-dashed border-border/40 hover:border-primary/60 flex flex-col items-center justify-center gap-1 text-secondary hover:text-primary transition-all cursor-pointer bg-overlay/5"
                        >
                          <Camera className="h-4 w-4" />
                          <span className="text-[9px] font-bold">PAINEL</span>
                        </button>
                      )}
                    </div>

                    {/* Frente */}
                    <div className={`rounded-xl border p-2.5 flex flex-col items-center text-center transition-all ${
                      fotosChecklist.frente
                        ? 'border-emerald-500/40 bg-emerald-500/5'
                        : 'border-border/30 bg-surface/80 hover:border-primary/40'
                    }`}>
                      <input
                        ref={inputFotoFrenteRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => handleUploadFoto('frente', e)}
                      />
                      <div className="flex items-center justify-between w-full mb-1.5">
                        <span className="text-[9px] font-black text-foreground flex items-center gap-0.5 truncate">
                          <ArrowUp className="h-2.5 w-2.5 text-emerald-400" /> FRENTE
                        </span>
                        {fotosChecklist.frente && (
                          <span className="text-[8px] font-black text-emerald-400">✓</span>
                        )}
                      </div>

                      {fotosChecklist.frente ? (
                        <div className="relative w-full h-20 rounded-lg overflow-hidden border border-emerald-500/30 group">
                          <img src={fotosChecklist.frente} alt="Frente" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1 transition-opacity">
                            <button
                              type="button"
                              onClick={() => inputFotoFrenteRef.current?.click()}
                              className="p-1 rounded bg-white text-black text-[8px] font-bold"
                            >
                              Trocar
                            </button>
                            <button
                              type="button"
                              onClick={() => setFotosChecklist((prev) => ({ ...prev, frente: undefined }))}
                              className="p-1 rounded bg-red-600 text-white text-[8px] font-bold"
                            >
                              <Trash2 className="h-2.5 w-2.5" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => inputFotoFrenteRef.current?.click()}
                          className="w-full h-20 rounded-lg border-2 border-dashed border-border/40 hover:border-primary/60 flex flex-col items-center justify-center gap-1 text-secondary hover:text-primary transition-all cursor-pointer bg-overlay/5"
                        >
                          <Camera className="h-4 w-4" />
                          <span className="text-[9px] font-bold">FRENTE</span>
                        </button>
                      )}
                    </div>

                    {/* Lado Esquerdo */}
                    <div className={`rounded-xl border p-2.5 flex flex-col items-center text-center transition-all ${
                      fotosChecklist.ladoEsquerdo
                        ? 'border-emerald-500/40 bg-emerald-500/5'
                        : 'border-border/30 bg-surface/80 hover:border-primary/40'
                    }`}>
                      <input
                        ref={inputFotoLadoEsquerdoRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => handleUploadFoto('ladoEsquerdo', e)}
                      />
                      <div className="flex items-center justify-between w-full mb-1.5">
                        <span className="text-[9px] font-black text-foreground flex items-center gap-0.5 truncate">
                          <ArrowLeft className="h-2.5 w-2.5 text-cyan-400" /> LADO ESQ.
                        </span>
                        {fotosChecklist.ladoEsquerdo && (
                          <span className="text-[8px] font-black text-emerald-400">✓</span>
                        )}
                      </div>

                      {fotosChecklist.ladoEsquerdo ? (
                        <div className="relative w-full h-20 rounded-lg overflow-hidden border border-emerald-500/30 group">
                          <img src={fotosChecklist.ladoEsquerdo} alt="Lado Esquerdo" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1 transition-opacity">
                            <button
                              type="button"
                              onClick={() => inputFotoLadoEsquerdoRef.current?.click()}
                              className="p-1 rounded bg-white text-black text-[8px] font-bold"
                            >
                              Trocar
                            </button>
                            <button
                              type="button"
                              onClick={() => setFotosChecklist((prev) => ({ ...prev, ladoEsquerdo: undefined }))}
                              className="p-1 rounded bg-red-600 text-white text-[8px] font-bold"
                            >
                              <Trash2 className="h-2.5 w-2.5" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => inputFotoLadoEsquerdoRef.current?.click()}
                          className="w-full h-20 rounded-lg border-2 border-dashed border-border/40 hover:border-primary/60 flex flex-col items-center justify-center gap-1 text-secondary hover:text-primary transition-all cursor-pointer bg-overlay/5"
                        >
                          <Camera className="h-4 w-4" />
                          <span className="text-[9px] font-bold">LADO ESQ.</span>
                        </button>
                      )}
                    </div>

                    {/* Traseira */}
                    <div className={`rounded-xl border p-2.5 flex flex-col items-center text-center transition-all ${
                      fotosChecklist.traseira
                        ? 'border-emerald-500/40 bg-emerald-500/5'
                        : 'border-border/30 bg-surface/80 hover:border-primary/40'
                    }`}>
                      <input
                        ref={inputFotoTraseiraRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => handleUploadFoto('traseira', e)}
                      />
                      <div className="flex items-center justify-between w-full mb-1.5">
                        <span className="text-[9px] font-black text-foreground flex items-center gap-0.5 truncate">
                          <ArrowDown className="h-2.5 w-2.5 text-amber-400" /> TRASEIRA
                        </span>
                        {fotosChecklist.traseira && (
                          <span className="text-[8px] font-black text-emerald-400">✓</span>
                        )}
                      </div>

                      {fotosChecklist.traseira ? (
                        <div className="relative w-full h-20 rounded-lg overflow-hidden border border-emerald-500/30 group">
                          <img src={fotosChecklist.traseira} alt="Traseira" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1 transition-opacity">
                            <button
                              type="button"
                              onClick={() => inputFotoTraseiraRef.current?.click()}
                              className="p-1 rounded bg-white text-black text-[8px] font-bold"
                            >
                              Trocar
                            </button>
                            <button
                              type="button"
                              onClick={() => setFotosChecklist((prev) => ({ ...prev, traseira: undefined }))}
                              className="p-1 rounded bg-red-600 text-white text-[8px] font-bold"
                            >
                              <Trash2 className="h-2.5 w-2.5" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => inputFotoTraseiraRef.current?.click()}
                          className="w-full h-20 rounded-lg border-2 border-dashed border-border/40 hover:border-primary/60 flex flex-col items-center justify-center gap-1 text-secondary hover:text-primary transition-all cursor-pointer bg-overlay/5"
                        >
                          <Camera className="h-4 w-4" />
                          <span className="text-[9px] font-bold">TRASEIRA</span>
                        </button>
                      )}
                    </div>

                    {/* Lado Direito */}
                    <div className={`rounded-xl border p-2.5 flex flex-col items-center text-center transition-all ${
                      fotosChecklist.ladoDireito
                        ? 'border-emerald-500/40 bg-emerald-500/5'
                        : 'border-border/30 bg-surface/80 hover:border-primary/40'
                    }`}>
                      <input
                        ref={inputFotoLadoDireitoRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => handleUploadFoto('ladoDireito', e)}
                      />
                      <div className="flex items-center justify-between w-full mb-1.5">
                        <span className="text-[9px] font-black text-foreground flex items-center gap-0.5 truncate">
                          <ArrowRight className="h-2.5 w-2.5 text-purple-400" /> LADO DIR.
                        </span>
                        {fotosChecklist.ladoDireito && (
                          <span className="text-[8px] font-black text-emerald-400">✓</span>
                        )}
                      </div>

                      {fotosChecklist.ladoDireito ? (
                        <div className="relative w-full h-20 rounded-lg overflow-hidden border border-emerald-500/30 group">
                          <img src={fotosChecklist.ladoDireito} alt="Lado Direito" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1 transition-opacity">
                            <button
                              type="button"
                              onClick={() => inputFotoLadoDireitoRef.current?.click()}
                              className="p-1 rounded bg-white text-black text-[8px] font-bold"
                            >
                              Trocar
                            </button>
                            <button
                              type="button"
                              onClick={() => setFotosChecklist((prev) => ({ ...prev, ladoDireito: undefined }))}
                              className="p-1 rounded bg-red-600 text-white text-[8px] font-bold"
                            >
                              <Trash2 className="h-2.5 w-2.5" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => inputFotoLadoDireitoRef.current?.click()}
                          className="w-full h-20 rounded-lg border-2 border-dashed border-border/40 hover:border-primary/60 flex flex-col items-center justify-center gap-1 text-secondary hover:text-primary transition-all cursor-pointer bg-overlay/5"
                        >
                          <Camera className="h-4 w-4" />
                          <span className="text-[9px] font-bold">LADO DIR.</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* SEÇÃO 3: OBSERVAÇÕES */}
              <div className="pt-2">
                <div>
                  <Label htmlFor="chkObs">Observações / Ressalvas</Label>
                  <Textarea
                    id="chkObs"
                    placeholder="Descreva detalhes ou avarias encontradas..."
                    value={obsChecklist}
                    onChange={(e) => setObsChecklist(e.target.value)}
                    rows={4}
                    className="mt-1 text-xs resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Rodapé — fixo fora do scroll, sempre visível */}
            <div className="flex shrink-0 justify-end gap-2.5 border-t border-border/15 bg-surface px-4 py-3.5 sm:px-6">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setMostrarModalNovoChecklist(false)}
                disabled={salvandoChecklist}
                className="!h-10 px-5 text-xs font-semibold"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={salvandoChecklist}
                className="!h-10 px-6 text-xs font-bold bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 flex items-center gap-1.5 disabled:opacity-60"
              >
                <CheckCircle2 className="h-4 w-4" />
                {salvandoChecklist ? 'Salvando…' : 'Salvar Checklist'}
              </Button>
            </div>
            </form>
          </div>
        </div>,
        document.body,
      )}

      {/* ========================================================================= */}
      {/* MODAL: DETALHES DO VEÍCULO (DADOS CADASTRADOS + HISTÓRICO DE CHECKLISTS) */}
      {/* ========================================================================= */}
      {veiculoDetalhando && createPortal(
        (() => {
          const v = veiculoDetalhando
          const statusPrev = getStatusPreventiva(v)
          const statusDoc = getStatusDocumento(v.vencimentoDocumento)
          const statusSeg = getStatusSeguro(v.vencimentoSeguro)
          const statusTac = getStatusTacografo(v.vencimentoTacografo)
          const kmAtualVeiculo = ultimasKmsPorPlaca.get(v.placa.toUpperCase().trim()) || 0

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-4 animate-fade-in">
              <div className="w-full max-w-2xl rounded-2xl border border-border/20 bg-surface shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
                <div className="flex items-center justify-between border-b border-border/10 px-6 py-4">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <span className="text-base">{v.tipoVeiculo === 'MOTO' ? '🏍️' : v.tipo === 'leve' ? '🚗' : v.tipo === 'embarcado' ? '🏗️' : '🚛'}</span>
                    </div>
                    <div>
                      <h2 className="text-base font-black text-foreground uppercase font-mono tracking-wider">
                        {v.placa}
                      </h2>
                      <p className="text-[11px] text-secondary uppercase">
                        {v.marcaNome ? `${v.marcaNome} ` : ''}{v.modeloNome || '—'} {v.ano ? `· ${v.ano}` : ''}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setVeiculoDetalhando(null)}
                    className="rounded-xl p-1.5 text-secondary hover:bg-background hover:text-foreground transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-5">
                  {/* Dados Gerais */}
                  <div>
                    <h3 className="text-[11px] font-black text-secondary uppercase tracking-wider mb-2">DADOS CADASTRADOS</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 rounded-xl border border-border/15 bg-overlay/5">
                      <DetalheCampo label="SITUAÇÃO">
                        <Badge tone={v.situacao === 'operante' ? 'success' : 'warning'}>
                          {v.situacao === 'operante' ? 'OPERANTE' : 'INOPERANTE'}
                        </Badge>
                      </DetalheCampo>
                      <DetalheCampo label="TIPO">
                        {v.tipo === 'leve' ? 'Leve' : v.tipo === 'pesado' ? 'Pesado' : v.tipo === 'trator' ? 'Trator' : v.tipo === 'carreta' ? 'Carreta' : 'Embarcado'}
                      </DetalheCampo>
                      <DetalheCampo label="SUBTIPO">{v.tipoVeiculo || '—'}</DetalheCampo>
                      <DetalheCampo label="COR">{v.cor || '—'}</DetalheCampo>
                      <DetalheCampo label="CHASSI">{v.chassi || '—'}</DetalheCampo>
                      <DetalheCampo label="RENAVAM">{v.renavam || '—'}</DetalheCampo>
                      <DetalheCampo label="SETOR">{v.setor || '—'}</DetalheCampo>
                      <DetalheCampo label="RESPONSÁVEL">{v.responsavel || '—'}</DetalheCampo>
                      <DetalheCampo label="CLIENTE">{v.clienteNome || '—'}</DetalheCampo>
                    </div>
                  </div>

                  {/* Manutenção Preventiva */}
                  <div>
                    <h3 className="text-[11px] font-black text-secondary uppercase tracking-wider mb-2">MANUTENÇÃO PREVENTIVA</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 rounded-xl border border-border/15 bg-overlay/5">
                      <DetalheCampo label="STATUS">
                        {statusPrev.status === 'atrasada' ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-red-500/15 border border-red-500/30 px-2 py-0.5 text-[10px] font-black text-red-400">
                            <AlertOctagon className="h-3 w-3" />
                            {statusPrev.label}
                          </span>
                        ) : statusPrev.status === 'proxima' ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-black text-amber-400">
                            <AlertTriangle className="h-3 w-3" />
                            {statusPrev.label}
                          </span>
                        ) : statusPrev.status === 'em_dia' ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" />
                            {statusPrev.label}
                          </span>
                        ) : (
                          <span className="text-[10px] text-secondary/50 font-semibold">— NÃO INFORMADA</span>
                        )}
                      </DetalheCampo>
                      <DetalheCampo label="KM ATUAL (CHECKLIST)">
                        {kmAtualVeiculo > 0 ? `${kmAtualVeiculo.toLocaleString('pt-BR')} KM` : '— SEM CHECKLIST'}
                      </DetalheCampo>
                      <DetalheCampo label="KM ÚLTIMA PREVENTIVA">
                        {v.kmUltimaPreventiva ? `${v.kmUltimaPreventiva.toLocaleString('pt-BR')} KM` : '—'}
                      </DetalheCampo>
                      <DetalheCampo label="DATA PRÓXIMA PREVENTIVA">
                        {v.dataUltimaPreventiva ? format(parseISO(v.dataUltimaPreventiva), 'dd/MM/yyyy') : '—'}
                      </DetalheCampo>
                      <DetalheCampo label="INTERVALO">
                        {v.intervaloPreventivaKm ? `${v.intervaloPreventivaKm.toLocaleString('pt-BR')} KM` : '—'}
                      </DetalheCampo>
                      {statusPrev.kmLimite > 0 && (
                        <DetalheCampo label={statusPrev.kmRestante < 0 ? 'KM ULTRAPASSADO' : 'KM RESTANTE'}>
                          <span className={statusPrev.kmRestante < 0 ? 'text-red-400' : statusPrev.kmRestante <= 5000 ? 'text-amber-400' : 'text-emerald-400'}>
                            {statusPrev.kmRestante < 0
                              ? `-${Math.abs(statusPrev.kmRestante).toLocaleString('pt-BR')} KM`
                              : `${statusPrev.kmRestante.toLocaleString('pt-BR')} KM`}
                          </span>
                        </DetalheCampo>
                      )}
                    </div>
                  </div>

                  {/* Documentação & Seguro */}
                  <div>
                    <h3 className="text-[11px] font-black text-secondary uppercase tracking-wider mb-2">DOCUMENTAÇÃO, SEGURO & TACÓGRAFO</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 rounded-xl border border-border/15 bg-overlay/5">
                      <DetalheCampo label="CRLV">
                        {v.crlvPago ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 text-[9px] font-black text-emerald-400">PAGO</span>
                        ) : (
                          <span className="text-[10px] font-bold">{statusDoc.label}</span>
                        )}
                      </DetalheCampo>
                      <DetalheCampo label="VENCIMENTO CRLV">
                        {v.vencimentoDocumento ? format(parseISO(v.vencimentoDocumento), 'dd/MM/yyyy') : '—'}
                      </DetalheCampo>
                      <DetalheCampo label="SEGURO">
                        {v.seguroOk ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 text-[9px] font-black text-emerald-400">OK</span>
                        ) : (
                          <span className="text-[10px] font-bold">{statusSeg.label}</span>
                        )}
                      </DetalheCampo>
                      <DetalheCampo label="VENCIMENTO SEGURO">
                        {v.vencimentoSeguro ? format(parseISO(v.vencimentoSeguro), 'dd/MM/yyyy') : '—'}
                      </DetalheCampo>
                      <DetalheCampo label="TACÓGRAFO">
                        <span className="text-[10px] font-bold">{statusTac.label}</span>
                      </DetalheCampo>
                      <DetalheCampo label="Nº TACÓGRAFO">{v.numeroTacografo || '—'}</DetalheCampo>
                    </div>
                  </div>

                  {/* Observações */}
                  {v.observacoes && (
                    <div>
                      <h3 className="text-[11px] font-black text-secondary uppercase tracking-wider mb-2">OBSERVAÇÕES</h3>
                      <p className="text-xs text-foreground p-3.5 rounded-xl border border-border/15 bg-overlay/5 normal-case">
                        {v.observacoes}
                      </p>
                    </div>
                  )}

                  {/* Histórico de Checklists */}
                  <div>
                    <h3 className="text-[11px] font-black text-secondary uppercase tracking-wider mb-2">
                      HISTÓRICO DE CHECKLISTS ({checklistsDoVeiculoDetalhando.length})
                    </h3>
                    {checklistsDoVeiculoDetalhando.length === 0 ? (
                      <p className="text-xs text-secondary p-3.5 rounded-xl border border-border/15 bg-overlay/5 normal-case">
                        Nenhum checklist registrado para este veículo ainda.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {checklistsDoVeiculoDetalhando.map((chk) => (
                          <button
                            key={chk.id}
                            type="button"
                            onClick={() => setChecklistVisualizando(chk)}
                            className="w-full flex items-center justify-between gap-2 rounded-xl border border-border/15 bg-overlay/5 hover:bg-overlay/10 hover:border-primary/30 px-3.5 py-2.5 text-left transition-colors"
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                {format(parseISO(chk.dataHora), "dd/MM/yyyy 'às' HH:mm")}
                                {chk.tipoChecklist && (
                                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${
                                    chk.tipoChecklist === 'ida'
                                      ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                                      : 'bg-purple-500/10 border-purple-500/30 text-purple-400'
                                  }`}>
                                    {chk.tipoChecklist === 'ida' ? 'IDA' : 'VOLTA'}
                                  </span>
                                )}
                              </p>
                              <p className="text-[11px] text-secondary truncate">
                                {chk.motoristaNome || 'NÃO IDENTIFICADO'} · {chk.kmAtual.toLocaleString('pt-BR')} KM
                              </p>
                            </div>
                            {chk.resultado === 'aprovado' ? (
                              <Badge tone="success">APROVADO</Badge>
                            ) : chk.resultado === 'aprovado_com_ressalvas' ? (
                              <Badge tone="warning">RESSALVAS</Badge>
                            ) : (
                              <Badge tone="danger">REPROVADO</Badge>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Rodapé */}
                <div className="flex shrink-0 justify-end gap-2.5 border-t border-border/15 bg-surface px-4 py-3.5 sm:px-6">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setVeiculoDetalhando(null)}
                    className="!h-10 px-5 text-xs font-semibold"
                  >
                    Fechar
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      setVeiculoDetalhando(null)
                      iniciarEdicaoVeiculo(v)
                    }}
                    className="!h-10 px-5 text-xs font-bold flex items-center gap-1.5"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Editar Veículo
                  </Button>
                </div>
              </div>
            </div>
          )
        })(),
        document.body,
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: VISUALIZAR RELATÓRIO DO CHECKLIST COM GALERIA DE FOTOS */}
      {/* ========================================================================= */}
      {checklistVisualizando && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-4 animate-fade-in">
          <div className="w-full max-w-xl rounded-2xl border border-border/20 bg-surface shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between border-b border-border/10 px-6 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <ClipboardCheck className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-foreground uppercase flex items-center gap-2">
                    RELATÓRIO DE INSPEÇÃO · {checklistVisualizando.placa}
                    {checklistVisualizando.tipoChecklist && (
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded border ${
                        checklistVisualizando.tipoChecklist === 'ida'
                          ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                          : 'bg-purple-500/10 border-purple-500/30 text-purple-400'
                      }`}>
                        {checklistVisualizando.tipoChecklist === 'ida' ? 'IDA' : 'VOLTA'}
                      </span>
                    )}
                  </h2>
                  <p className="text-[11px] text-secondary">
                    {format(parseISO(checklistVisualizando.dataHora), "dd/MM/yyyy 'às' HH:mm")}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setChecklistVisualizando(null)}
                className="rounded-xl p-1.5 text-secondary hover:bg-background hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Cabeçalho do Laudo */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl border border-border/15 bg-overlay/5">
                <div>
                  <span className="text-[9px] font-black text-secondary uppercase">PLACA</span>
                  <p className="font-mono font-black text-sm text-primary">{checklistVisualizando.placa}</p>
                </div>
                <div>
                  <span className="text-[9px] font-black text-secondary uppercase">MOTORISTA</span>
                  <p className="text-xs font-bold text-foreground">{checklistVisualizando.motoristaNome}</p>
                </div>
                <div>
                  <span className="text-[9px] font-black text-secondary uppercase">QUILOMETRAGEM</span>
                  <p className="text-xs font-mono font-bold text-foreground">
                    {checklistVisualizando.kmAtual.toLocaleString('pt-BR')} KM
                  </p>
                </div>
                <div>
                  <span className="text-[9px] font-black text-secondary uppercase">RESULTADO</span>
                  <div>
                    {checklistVisualizando.resultado === 'aprovado' && (
                      <Badge tone="success" className="text-[9px] font-black">
                        APROVADO
                      </Badge>
                    )}
                    {checklistVisualizando.resultado === 'aprovado_com_ressalvas' && (
                      <Badge tone="warning" className="text-[9px] font-black">
                        COM RESSALVAS
                      </Badge>
                    )}
                    {checklistVisualizando.resultado === 'reprovado' && (
                      <Badge tone="danger" className="text-[9px] font-black">
                        REPROVADO
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Status de Preventiva Gravado */}
              {checklistVisualizando.statusPreventiva && (
                <div className={`p-3 rounded-xl border text-xs font-mono ${
                  checklistVisualizando.statusPreventiva.status === 'vencida'
                    ? 'border-red-500/40 bg-red-500/10 text-red-300'
                    : checklistVisualizando.statusPreventiva.status === 'proxima'
                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                    : checklistVisualizando.statusPreventiva.status === 'em_dia'
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                    : 'border-border/15 bg-overlay/5 text-secondary'
                }`}>
                  <span className="font-sans font-black text-[10px] uppercase block mb-0.5">
                    DIAGNÓSTICO DA PREVENTIVA NA INSPEÇÃO:
                  </span>
                  <p className="text-[11px]">{checklistVisualizando.statusPreventiva.mensagem}</p>
                </div>
              )}

              {/* FOTOS DA VISTORIA */}
              {checklistVisualizando.fotos && (
                <div className="space-y-2">
                  <span className="text-[11px] font-black text-secondary uppercase tracking-wider flex items-center gap-1">
                    <Camera className="h-3.5 w-3.5 text-primary" /> FOTOS REGISTRADAS DA VISTORIA
                  </span>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                    {/* Painel */}
                    {checklistVisualizando.fotos.painel ? (
                      <div
                        onClick={() => setFotoZoom({ url: checklistVisualizando.fotos!.painel!, titulo: 'FOTO DO PAINEL / KM' })}
                        className="relative h-24 rounded-xl border border-border/20 overflow-hidden cursor-pointer group bg-black"
                      >
                        <img src={checklistVisualizando.fotos.painel} alt="Painel" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        <span className="absolute bottom-1 left-1 right-1 text-center bg-black/70 rounded text-[8px] font-bold text-white py-0.5">
                          PAINEL / KM
                        </span>
                      </div>
                    ) : (
                      <div className="h-24 rounded-xl border border-dashed border-border/20 flex flex-col items-center justify-center text-secondary/40 text-[8px] font-bold">
                        SEM FOTO DO PAINEL
                      </div>
                    )}

                    {/* Frente */}
                    {checklistVisualizando.fotos.frente ? (
                      <div
                        onClick={() => setFotoZoom({ url: checklistVisualizando.fotos!.frente!, titulo: 'FOTO DA FRENTE DO VEÍCULO' })}
                        className="relative h-24 rounded-xl border border-border/20 overflow-hidden cursor-pointer group bg-black"
                      >
                        <img src={checklistVisualizando.fotos.frente} alt="Frente" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        <span className="absolute bottom-1 left-1 right-1 text-center bg-black/70 rounded text-[8px] font-bold text-white py-0.5">
                          FRENTE
                        </span>
                      </div>
                    ) : (
                      <div className="h-24 rounded-xl border border-dashed border-border/20 flex flex-col items-center justify-center text-secondary/40 text-[8px] font-bold">
                        SEM FOTO DA FRENTE
                      </div>
                    )}

                    {/* Lado Esquerdo */}
                    {checklistVisualizando.fotos.ladoEsquerdo ? (
                      <div
                        onClick={() => setFotoZoom({ url: checklistVisualizando.fotos!.ladoEsquerdo!, titulo: 'FOTO DO LADO ESQUERDO' })}
                        className="relative h-24 rounded-xl border border-border/20 overflow-hidden cursor-pointer group bg-black"
                      >
                        <img src={checklistVisualizando.fotos.ladoEsquerdo} alt="Lado Esquerdo" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        <span className="absolute bottom-1 left-1 right-1 text-center bg-black/70 rounded text-[8px] font-bold text-white py-0.5">
                          LADO ESQUERDO
                        </span>
                      </div>
                    ) : (
                      <div className="h-24 rounded-xl border border-dashed border-border/20 flex flex-col items-center justify-center text-secondary/40 text-[8px] font-bold">
                        SEM LADO ESQUERDO
                      </div>
                    )}

                    {/* Traseira */}
                    {checklistVisualizando.fotos.traseira ? (
                      <div
                        onClick={() => setFotoZoom({ url: checklistVisualizando.fotos!.traseira!, titulo: 'FOTO DA TRASEIRA' })}
                        className="relative h-24 rounded-xl border border-border/20 overflow-hidden cursor-pointer group bg-black"
                      >
                        <img src={checklistVisualizando.fotos.traseira} alt="Traseira" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        <span className="absolute bottom-1 left-1 right-1 text-center bg-black/70 rounded text-[8px] font-bold text-white py-0.5">
                          TRASEIRA
                        </span>
                      </div>
                    ) : (
                      <div className="h-24 rounded-xl border border-dashed border-border/20 flex flex-col items-center justify-center text-secondary/40 text-[8px] font-bold">
                        SEM FOTO TRASEIRA
                      </div>
                    )}

                    {/* Lado Direito */}
                    {checklistVisualizando.fotos.ladoDireito ? (
                      <div
                        onClick={() => setFotoZoom({ url: checklistVisualizando.fotos!.ladoDireito!, titulo: 'FOTO DO LADO DIREITO' })}
                        className="relative h-24 rounded-xl border border-border/20 overflow-hidden cursor-pointer group bg-black"
                      >
                        <img src={checklistVisualizando.fotos.ladoDireito} alt="Lado Direito" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        <span className="absolute bottom-1 left-1 right-1 text-center bg-black/70 rounded text-[8px] font-bold text-white py-0.5">
                          LADO DIREITO
                        </span>
                      </div>
                    ) : (
                      <div className="h-24 rounded-xl border border-dashed border-border/20 flex flex-col items-center justify-center text-secondary/40 text-[8px] font-bold">
                        SEM LADO DIREITO
                      </div>
                    )}

                  </div>
                </div>
              )}

              {/* Lista dos Itens (checklists antigos, salvos antes da simplificação) */}
              {checklistVisualizando.itens.length > 0 && (
              <div className="space-y-2">
                <span className="text-[11px] font-black text-secondary uppercase tracking-wider">
                  ITENS AUDITADOS
                </span>
                <div className="divide-y divide-border/10 rounded-xl border border-border/15 bg-surface overflow-hidden">
                  {checklistVisualizando.itens.map((it) => (
                    <div key={it.id} className="flex items-center justify-between p-3 text-xs">
                      <div>
                        <span className="text-[9px] text-secondary font-bold uppercase">{it.categoria}</span>
                        <p className="font-bold text-foreground">{it.nome}</p>
                      </div>
                      <div>
                        {it.status === 'conforme' && (
                          <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                            CONFORME
                          </span>
                        )}
                        {it.status === 'nao_conforme' && (
                          <span className="text-[10px] font-black text-rose-500 bg-rose-600/10 px-2 py-0.5 rounded-md border border-rose-600/20">
                            NÃO CONFORME
                          </span>
                        )}
                        {it.status === 'nao_se_aplica' && (
                          <span className="text-[10px] font-bold text-secondary bg-overlay/10 px-2 py-0.5 rounded-md">
                            N/A
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              )}

              {checklistVisualizando.observacoesGerais && (
                <div className="p-3.5 rounded-xl border border-border/15 bg-overlay/5">
                  <span className="text-[10px] font-black text-secondary uppercase">OBSERVAÇÕES GERAIS</span>
                  <p className="mt-1 text-xs text-foreground font-medium italic">
                    "{checklistVisualizando.observacoesGerais}"
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end p-4 border-t border-border/15">
              <Button
                type="button"
                onClick={() => setChecklistVisualizando(null)}
                className="!h-9 px-5 text-xs font-bold"
              >
                Fechar
              </Button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* MODAL 4: ZOOM DE FOTO */}
      {fotoZoom && createPortal(
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4 animate-fade-in"
          onClick={() => setFotoZoom(null)}
        >
          <div className="relative max-w-2xl max-h-[90vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setFotoZoom(null)}
              className="absolute -top-10 right-0 text-white hover:opacity-80 p-2"
            >
              <X className="h-6 w-6" />
            </button>
            <p className="text-white text-xs font-black uppercase mb-2 tracking-wide">{fotoZoom.titulo}</p>
            <div
              className="overflow-hidden rounded-xl shadow-2xl touch-none select-none"
              style={{ cursor: zoomScale > 1 ? 'grab' : 'zoom-in' }}
              onWheel={handleZoomWheel}
              onDoubleClick={handleZoomDoubleClick}
              onPointerDown={handleZoomPointerDown}
              onPointerMove={handleZoomPointerMove}
              onPointerUp={handleZoomPointerUp}
              onPointerCancel={handleZoomPointerUp}
              onPointerLeave={handleZoomPointerUp}
            >
              <img
                src={fotoZoom.url}
                alt={fotoZoom.titulo}
                draggable={false}
                className="max-w-full max-h-[80vh] object-contain"
                style={{
                  transform: `translate(${zoomPos.x}px, ${zoomPos.y}px) scale(${zoomScale})`,
                  transition: zoomDragRef.current || zoomPointersRef.current.size > 0 ? 'none' : 'transform 0.15s ease-out',
                }}
              />
            </div>
            <p className="text-white/60 text-[10px] mt-2 uppercase tracking-wide">
              Toque 2x ou use a roda do mouse pra dar zoom · arraste pra mover
            </p>
          </div>
        </div>,
        document.body,
      )}

      {mostrarModalViagem && createPortal(
        <ModalViagem
          viagemEditando={viagemEditando}
          veiculos={frotas}
          clientes={clientes}
          onRefetchClientes={refetchClientes}
          centrosCusto={centrosCusto}
          onRefetchCentrosCusto={refetchCentrosCusto}
          transportadoras={transportadoras}
          onRefetchTransportadoras={refetchTransportadoras}
          tiposCarga={tiposCarga}
          onRefetchTiposCarga={refetchTiposCarga}
          enderecosFrequentes={enderecosFrequentes}
          onRefetchEnderecosFrequentes={refetchEnderecosFrequentes}
          onClose={() => setMostrarModalViagem(false)}
        />,
        document.body,
      )}
    </div>
  )
}

// ----------------------------------------------------------------------------------
// Subcomponente: Modal de Nova Viagem / Encerrar Viagem
// ----------------------------------------------------------------------------------
function formatarMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// Campos de valor/percentual digitados no padrão pt-BR ("1.500,50") — "." é
// sempre separador de milhar (removido) e a "," vira o ponto decimal do
// JS. `Number("1500,50")` sozinho retorna NaN, por isso não dá pra só
// jogar o texto digitado direto num Number(...).
function parseDecimalPtBr(valor: string): number {
  const limpo = valor.replace(/\./g, '').replace(',', '.')
  return Number(limpo) || 0
}

// Taxímetro do Pátio: dias corridos desde a entrada (até agora, ou até a
// saída real se já finalizada) × valor da diária. Mínimo de 1 dia.
function calcularDiasEValorPatio(estadia: EstadiaPatio): { dias: number; valor: number } {
  const inicio = parseISO(estadia.dataHoraEntrada)
  const fim = estadia.dataHoraSaidaReal ? parseISO(estadia.dataHoraSaidaReal) : new Date()
  const dias = Math.max(1, differenceInDays(fim, inicio))
  return { dias, valor: dias * estadia.valorDiaria }
}

// Converte um ISO (ou vazio) pro formato aceito pelo <input type="datetime-local"> e vice-versa.
function isoParaDatetimeLocal(iso?: string): string {
  if (!iso) return ''
  const data = new Date(iso)
  if (Number.isNaN(data.getTime())) return ''
  const offset = data.getTimezoneOffset()
  const local = new Date(data.getTime() - offset * 60000)
  return local.toISOString().slice(0, 16)
}

function datetimeLocalParaIso(valor: string): string | null {
  if (!valor) return null
  const data = new Date(valor)
  if (Number.isNaN(data.getTime())) return null
  return data.toISOString()
}

// ----------------------------------------------------------------------------------
// Subcomponente: Gerenciador de um cadastro simples (id + nome) — usado pelas
// telas de Centro de Custo e Tipo de Carga do Controle de Viagens.
// ----------------------------------------------------------------------------------
function GerenciadorCadastroSimples({
  titulo,
  subtitulo,
  icon: Icon,
  itens,
  loading,
  refetch,
  onCriar,
  onAtualizar,
  onExcluir,
}: {
  titulo: string
  subtitulo: string
  icon: React.ComponentType<{ className?: string }>
  itens: { id: string; nome: string }[]
  loading: boolean
  refetch: () => Promise<void>
  onCriar: (nome: string) => Promise<unknown>
  onAtualizar: (id: string, nome: string) => Promise<unknown>
  onExcluir: (id: string) => Promise<void>
}) {
  const [busca, setBusca] = useState('')
  const [novoNome, setNovoNome] = useState('')
  const [criando, setCriando] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [nomeEdicao, setNomeEdicao] = useState('')
  const [salvandoId, setSalvandoId] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const itensFiltrados = itens.filter((it) => it.nome.toLowerCase().includes(busca.toLowerCase().trim()))

  async function handleCriar(e: React.FormEvent) {
    e.preventDefault()
    if (!novoNome.trim()) return
    setCriando(true)
    setErro(null)
    try {
      await onCriar(novoNome.trim())
      await refetch()
      setNovoNome('')
    } catch (err) {
      setErro(getErrorMessage(err, 'Erro ao criar registro.'))
    } finally {
      setCriando(false)
    }
  }

  function iniciarEdicao(it: { id: string; nome: string }) {
    setEditandoId(it.id)
    setNomeEdicao(it.nome)
  }

  async function salvarEdicao(id: string) {
    if (!nomeEdicao.trim()) return
    setSalvandoId(id)
    setErro(null)
    try {
      await onAtualizar(id, nomeEdicao.trim())
      await refetch()
      setEditandoId(null)
    } catch (err) {
      setErro(getErrorMessage(err, 'Erro ao salvar alteração.'))
    } finally {
      setSalvandoId(null)
    }
  }

  async function handleExcluir(id: string) {
    if (!confirm('Excluir este registro? Essa ação não pode ser desfeita.')) return
    setSalvandoId(id)
    setErro(null)
    try {
      await onExcluir(id)
      await refetch()
    } catch (err) {
      setErro(getErrorMessage(err, 'Não foi possível excluir. Verifique se não está em uso em alguma viagem.'))
    } finally {
      setSalvandoId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-sm font-black text-foreground uppercase">{titulo}</h2>
          <p className="text-[11px] text-secondary normal-case">{subtitulo}</p>
        </div>
      </div>

      {erro && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-3.5 py-2.5 text-xs font-semibold text-red-400 normal-case">
          {erro}
        </div>
      )}

      <form onSubmit={handleCriar} className="flex gap-2">
        <Input
          placeholder={`NOVO ITEM (EX: ${titulo.toUpperCase()})`}
          value={novoNome}
          onChange={(e) => setNovoNome(e.target.value.toUpperCase())}
          className="text-xs font-bold"
        />
        <Button type="submit" disabled={criando || !novoNome.trim()} className="gap-1.5 text-xs font-bold shrink-0">
          <Plus className="h-3.5 w-3.5" />
          ADICIONAR
        </Button>
      </form>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="BUSCAR..."
          className="h-10 w-full rounded-xl border border-border/25 bg-surface/90 pl-10 pr-3 text-xs text-foreground placeholder:text-secondary/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary uppercase"
        />
      </div>

      {loading && itens.length === 0 ? (
        <Card className="p-10 text-center">
          <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-secondary/30 border-t-primary" />
        </Card>
      ) : itensFiltrados.length === 0 ? (
        <Card className="p-10 text-center">
          <Icon className="mx-auto mb-2 h-8 w-8 text-secondary/40" />
          <p className="text-xs font-bold text-secondary">{itens.length === 0 ? 'NENHUM REGISTRO CADASTRADO' : 'NADA ENCONTRADO PARA A BUSCA'}</p>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/25 bg-surface/80 shadow-sm">
          <div className="divide-y divide-border/10">
            {itensFiltrados.map((it) => (
              <div key={it.id} className="flex items-center gap-2 px-4 py-3">
                {editandoId === it.id ? (
                  <>
                    <Input
                      autoFocus
                      value={nomeEdicao}
                      onChange={(e) => setNomeEdicao(e.target.value.toUpperCase())}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          salvarEdicao(it.id)
                        } else if (e.key === 'Escape') {
                          setEditandoId(null)
                        }
                      }}
                      className="flex-1 text-xs font-bold"
                    />
                    <button
                      type="button"
                      onClick={() => salvarEdicao(it.id)}
                      disabled={salvandoId === it.id}
                      className="rounded-lg p-1.5 text-status-success hover:bg-status-success/10 transition-colors"
                      title="Salvar"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditandoId(null)}
                      className="rounded-lg p-1.5 text-secondary hover:bg-overlay/10 transition-colors"
                      title="Cancelar"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-xs font-bold text-foreground normal-case">{it.nome}</span>
                    <button
                      type="button"
                      onClick={() => iniciarEdicao(it)}
                      className="rounded-lg p-1.5 text-secondary hover:text-primary hover:bg-overlay/10 transition-colors"
                      title="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExcluir(it.id)}
                      disabled={salvandoId === it.id}
                      className="rounded-lg p-1.5 text-secondary hover:text-status-danger hover:bg-status-danger/10 transition-colors"
                      title="Excluir"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ----------------------------------------------------------------------------------
// Subcomponente: Gerenciador de Endereços Frequentes (apelido + endereço + cidade + UF)
// ----------------------------------------------------------------------------------
function GerenciadorEnderecosFrequentes({
  enderecos,
  loading,
  refetch,
}: {
  enderecos: EnderecoFrequente[]
  loading: boolean
  refetch: () => Promise<void>
}) {
  const [busca, setBusca] = useState('')
  const [form, setForm] = useState({ apelido: '', endereco: '', cidade: '', uf: '' })
  const [criando, setCriando] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [formEdicao, setFormEdicao] = useState({ apelido: '', endereco: '', cidade: '', uf: '' })
  const [salvandoId, setSalvandoId] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const enderecosFiltrados = enderecos.filter((e) => {
    const termo = busca.toLowerCase().trim()
    if (!termo) return true
    return (
      e.apelido.toLowerCase().includes(termo) ||
      e.endereco.toLowerCase().includes(termo) ||
      e.cidade.toLowerCase().includes(termo)
    )
  })

  async function handleCriar(e: React.FormEvent) {
    e.preventDefault()
    if (!form.apelido.trim() || !form.endereco.trim() || !form.cidade.trim() || !form.uf.trim()) {
      setErro('Preencha apelido, endereço, cidade e UF.')
      return
    }
    setCriando(true)
    setErro(null)
    try {
      await criarEnderecoFrequente(form)
      await refetch()
      setForm({ apelido: '', endereco: '', cidade: '', uf: '' })
    } catch (err) {
      setErro(getErrorMessage(err, 'Erro ao criar endereço.'))
    } finally {
      setCriando(false)
    }
  }

  function iniciarEdicao(e: EnderecoFrequente) {
    setEditandoId(e.id)
    setFormEdicao({ apelido: e.apelido, endereco: e.endereco, cidade: e.cidade, uf: e.uf })
  }

  async function salvarEdicao(id: string) {
    if (!formEdicao.apelido.trim() || !formEdicao.endereco.trim() || !formEdicao.cidade.trim() || !formEdicao.uf.trim()) return
    setSalvandoId(id)
    setErro(null)
    try {
      await atualizarEnderecoFrequente(id, formEdicao)
      await refetch()
      setEditandoId(null)
    } catch (err) {
      setErro(getErrorMessage(err, 'Erro ao salvar alteração.'))
    } finally {
      setSalvandoId(null)
    }
  }

  async function handleExcluir(id: string) {
    if (!confirm('Excluir este endereço frequente? Essa ação não pode ser desfeita.')) return
    setSalvandoId(id)
    setErro(null)
    try {
      await excluirEnderecoFrequente(id)
      await refetch()
    } catch (err) {
      setErro(getErrorMessage(err, 'Não foi possível excluir.'))
    } finally {
      setSalvandoId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
          <MapPin className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-sm font-black text-foreground uppercase">Endereços Frequentes</h2>
          <p className="text-[11px] text-secondary normal-case">Endereços salvos para agilizar a rota das viagens</p>
        </div>
      </div>

      {erro && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-3.5 py-2.5 text-xs font-semibold text-red-400 normal-case">
          {erro}
        </div>
      )}

      <form onSubmit={handleCriar} className="grid grid-cols-1 sm:grid-cols-5 gap-2">
        <Input
          placeholder="APELIDO"
          value={form.apelido}
          onChange={(e) => setForm((f) => ({ ...f, apelido: e.target.value.toUpperCase() }))}
          className="text-xs font-bold"
        />
        <Input
          placeholder="ENDEREÇO"
          value={form.endereco}
          onChange={(e) => setForm((f) => ({ ...f, endereco: e.target.value.toUpperCase() }))}
          className="text-xs font-bold sm:col-span-2"
        />
        <Input
          placeholder="CIDADE"
          value={form.cidade}
          onChange={(e) => setForm((f) => ({ ...f, cidade: e.target.value.toUpperCase() }))}
          className="text-xs font-bold"
        />
        <div className="flex gap-2">
          <Input
            placeholder="UF"
            maxLength={2}
            value={form.uf}
            onChange={(e) => setForm((f) => ({ ...f, uf: e.target.value.toUpperCase() }))}
            className="text-xs font-bold w-16"
          />
          <Button type="submit" disabled={criando} className="gap-1.5 text-xs font-bold shrink-0 flex-1">
            <Plus className="h-3.5 w-3.5" />
            ADICIONAR
          </Button>
        </div>
      </form>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="BUSCAR..."
          className="h-10 w-full rounded-xl border border-border/25 bg-surface/90 pl-10 pr-3 text-xs text-foreground placeholder:text-secondary/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary uppercase"
        />
      </div>

      {loading && enderecos.length === 0 ? (
        <Card className="p-10 text-center">
          <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-secondary/30 border-t-primary" />
        </Card>
      ) : enderecosFiltrados.length === 0 ? (
        <Card className="p-10 text-center">
          <MapPin className="mx-auto mb-2 h-8 w-8 text-secondary/40" />
          <p className="text-xs font-bold text-secondary">
            {enderecos.length === 0 ? 'NENHUM ENDEREÇO CADASTRADO' : 'NADA ENCONTRADO PARA A BUSCA'}
          </p>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/25 bg-surface/80 shadow-sm">
          <div className="divide-y divide-border/10">
            {enderecosFiltrados.map((e) => (
              <div key={e.id} className="flex flex-col sm:flex-row sm:items-center gap-2 px-4 py-3">
                {editandoId === e.id ? (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 flex-1">
                      <Input
                        autoFocus
                        value={formEdicao.apelido}
                        onChange={(ev) => setFormEdicao((f) => ({ ...f, apelido: ev.target.value.toUpperCase() }))}
                        className="text-xs font-bold"
                      />
                      <Input
                        value={formEdicao.endereco}
                        onChange={(ev) => setFormEdicao((f) => ({ ...f, endereco: ev.target.value.toUpperCase() }))}
                        className="text-xs font-bold sm:col-span-2"
                      />
                      <Input
                        value={formEdicao.cidade}
                        onChange={(ev) => setFormEdicao((f) => ({ ...f, cidade: ev.target.value.toUpperCase() }))}
                        className="text-xs font-bold"
                      />
                    </div>
                    <div className="flex gap-2 items-center">
                      <Input
                        value={formEdicao.uf}
                        maxLength={2}
                        onChange={(ev) => setFormEdicao((f) => ({ ...f, uf: ev.target.value.toUpperCase() }))}
                        className="text-xs font-bold w-16"
                      />
                      <button
                        type="button"
                        onClick={() => salvarEdicao(e.id)}
                        disabled={salvandoId === e.id}
                        className="rounded-lg p-1.5 text-status-success hover:bg-status-success/10 transition-colors"
                        title="Salvar"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditandoId(null)}
                        className="rounded-lg p-1.5 text-secondary hover:bg-overlay/10 transition-colors"
                        title="Cancelar"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-foreground normal-case">{e.apelido}</p>
                      <p className="text-[11px] text-secondary normal-case truncate">
                        {e.endereco}, {e.cidade}/{e.uf}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => iniciarEdicao(e)}
                        className="rounded-lg p-1.5 text-secondary hover:text-primary hover:bg-overlay/10 transition-colors"
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleExcluir(e.id)}
                        disabled={salvandoId === e.id}
                        className="rounded-lg p-1.5 text-secondary hover:text-status-danger hover:bg-status-danger/10 transition-colors"
                        title="Excluir"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ----------------------------------------------------------------------------------
// Subcomponente: Gerenciador de Modelos (escopado por Marca selecionada)
// ----------------------------------------------------------------------------------
function GerenciadorModelos({ marcas }: { marcas: { id: string; nome: string }[] }) {
  const [marcaId, setMarcaId] = useState(marcas[0]?.id || '')
  const { modelos, loading, refetch } = useModelos(marcaId || undefined)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
          <Layers className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-sm font-black text-foreground uppercase">Modelos</h2>
          <p className="text-[11px] text-secondary normal-case">Modelos de veículos, agrupados por marca</p>
        </div>
      </div>

      <div className="max-w-xs">
        <Label className="normal-case text-[11px]">Marca</Label>
        <Select value={marcaId} onChange={(e) => setMarcaId(e.target.value)} className="mt-1 text-xs font-bold">
          <option value="">SELECIONE UMA MARCA</option>
          {marcas.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nome}
            </option>
          ))}
        </Select>
      </div>

      {!marcaId ? (
        <Card className="p-10 text-center">
          <Layers className="mx-auto mb-2 h-8 w-8 text-secondary/40" />
          <p className="text-xs font-bold text-secondary">SELECIONE UMA MARCA PARA VER OS MODELOS</p>
        </Card>
      ) : (
        <GerenciadorCadastroSimples
          titulo={`Modelos`}
          subtitulo="Modelos cadastrados para a marca selecionada"
          icon={Layers}
          itens={modelos}
          loading={loading}
          refetch={refetch}
          onCriar={(nome) => criarModelo(marcaId, nome)}
          onAtualizar={atualizarModelo}
          onExcluir={excluirModelo}
        />
      )}
    </div>
  )
}

// ----------------------------------------------------------------------------------
// Subcomponente: Gerenciador de Contas Bancárias
// ----------------------------------------------------------------------------------
function GerenciadorContasBancarias({
  contas,
  loading,
  onCriar,
  onAtualizar,
  onExcluir,
}: {
  contas: ContaBancaria[]
  loading: boolean
  onCriar: (form: Omit<ContaBancaria, 'id' | 'created_at'>) => Promise<void>
  onAtualizar: (id: string, form: Omit<ContaBancaria, 'id' | 'created_at'>) => Promise<void>
  onExcluir: (id: string) => Promise<void>
}) {
  const [mostrarModal, setMostrarModal] = useState(false)
  const [contaEditando, setContaEditando] = useState<ContaBancaria | null>(null)
  const [excluindoId, setExcluindoId] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  async function handleExcluir(id: string) {
    if (!confirm('Excluir esta conta bancária? Essa ação não pode ser desfeita.')) return
    setExcluindoId(id)
    setErro(null)
    try {
      await onExcluir(id)
    } catch (err) {
      setErro(getErrorMessage(err, 'Não foi possível excluir.'))
    } finally {
      setExcluindoId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
            <Landmark className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-black text-foreground uppercase">Contas Bancárias</h2>
            <p className="text-[11px] text-secondary normal-case">Contas usadas nos fechamentos financeiros das viagens</p>
          </div>
        </div>
        <Button
          type="button"
          onClick={() => {
            setContaEditando(null)
            setMostrarModal(true)
          }}
          className="gap-1.5 text-xs font-bold shadow-md shadow-primary/20 shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
          NOVA CONTA BANCÁRIA
        </Button>
      </div>

      {erro && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-3.5 py-2.5 text-xs font-semibold text-red-400 normal-case">
          {erro}
        </div>
      )}

      {loading && contas.length === 0 ? (
        <Card className="p-10 text-center">
          <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-secondary/30 border-t-primary" />
        </Card>
      ) : contas.length === 0 ? (
        <Card className="p-10 text-center">
          <Landmark className="mx-auto mb-2 h-8 w-8 text-secondary/40" />
          <p className="text-xs font-bold text-secondary">NENHUMA CONTA CADASTRADA</p>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/25 bg-surface/80 shadow-sm">
          <div className="divide-y divide-border/10">
            {contas.map((c) => (
              <div key={c.id} className="flex flex-col sm:flex-row sm:items-center gap-2 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-xs font-black text-foreground normal-case">{c.nome}</p>
                    <Badge tone={c.ativa ? 'success' : 'neutral'} className="text-[9px] font-black">
                      {c.ativa ? 'ATIVO' : 'INATIVO'}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-secondary normal-case truncate">
                    {c.codigo_banco ? `${c.codigo_banco} — ` : ''}{c.banco} · AG {c.agencia || '—'} · CC {c.conta || '—'} · {c.tipo.toUpperCase()}
                    {c.saldo_inicial ? ` · SALDO INICIAL ${c.saldo_inicial.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setContaEditando(c)
                      setMostrarModal(true)
                    }}
                    className="rounded-lg p-1.5 text-secondary hover:text-primary hover:bg-overlay/10 transition-colors"
                    title="Editar"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExcluir(c.id)}
                    disabled={excluindoId === c.id}
                    className="rounded-lg p-1.5 text-secondary hover:text-status-danger hover:bg-status-danger/10 transition-colors"
                    title="Excluir"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {mostrarModal && createPortal(
        <ModalContaBancaria
          contaEditando={contaEditando}
          onCriar={onCriar}
          onAtualizar={onAtualizar}
          onClose={() => setMostrarModal(false)}
        />,
        document.body,
      )}
    </div>
  )
}

// ----------------------------------------------------------------------------------
// Subcomponente: Modal de Nova / Editar Conta Bancária
// ----------------------------------------------------------------------------------
function ModalContaBancaria({
  contaEditando,
  onCriar,
  onAtualizar,
  onClose,
}: {
  contaEditando: ContaBancaria | null
  onCriar: (form: Omit<ContaBancaria, 'id' | 'created_at'>) => Promise<void>
  onAtualizar: (id: string, form: Omit<ContaBancaria, 'id' | 'created_at'>) => Promise<void>
  onClose: () => void
}) {
  const [nome, setNome] = useState(contaEditando?.nome || '')
  const [tipo, setTipo] = useState<ContaBancaria['tipo']>(contaEditando?.tipo || 'corrente')
  const [codigoBanco, setCodigoBanco] = useState(contaEditando?.codigo_banco || '')
  const [banco, setBanco] = useState(contaEditando?.banco || '')
  const [agencia, setAgencia] = useState(contaEditando?.agencia || '')
  const [conta, setConta] = useState(contaEditando?.conta || '')
  const [saldoInicial, setSaldoInicial] = useState(
    contaEditando?.saldo_inicial != null ? contaEditando.saldo_inicial.toFixed(2).replace('.', ',') : '',
  )
  const [ativa, setAtiva] = useState(contaEditando?.ativa ?? true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!nome.trim()) {
      setErro('Informe o nome/apelido da conta.')
      return
    }
    if (!codigoBanco.trim()) {
      setErro('Informe o código do banco.')
      return
    }
    if (!banco.trim()) {
      setErro('Informe o nome do banco.')
      return
    }
    if (!agencia.trim()) {
      setErro('Informe a agência.')
      return
    }
    if (!conta.trim()) {
      setErro('Informe o número da conta.')
      return
    }

    const form: Omit<ContaBancaria, 'id' | 'created_at'> = {
      nome: nome.trim().toUpperCase(),
      tipo,
      codigo_banco: codigoBanco.trim(),
      banco: banco.trim().toUpperCase(),
      agencia: agencia.trim(),
      conta: conta.trim(),
      saldo_inicial: parseDecimalPtBr(saldoInicial),
      ativa,
    }

    setSalvando(true)
    setErro(null)
    try {
      if (contaEditando) {
        await onAtualizar(contaEditando.id, form)
      } else {
        await onCriar(form)
      }
      onClose()
    } catch (err) {
      setErro(getErrorMessage(err, 'Erro ao salvar a conta bancária.'))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
      <div className="w-full max-w-lg rounded-2xl border border-border/20 bg-surface shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between border-b border-border/10 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Landmark className="h-5 w-5" />
            </div>
            <h2 className="text-base font-black text-foreground uppercase">
              {contaEditando ? 'Editar Conta Bancária' : 'Nova Conta Bancária'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-secondary hover:bg-background hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 uppercase">
          {erro && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-3.5 py-2.5 text-xs font-semibold text-red-400 normal-case">
              {erro}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="cbNome" className="normal-case text-[11px]">Nome/Apelido *</Label>
              <Input
                id="cbNome"
                placeholder="EX: ITAÚ PRINCIPAL"
                value={nome}
                onChange={(e) => setNome(e.target.value.toUpperCase())}
                className="text-xs font-bold"
              />
            </div>
            <div>
              <Label htmlFor="cbTipo" className="normal-case text-[11px]">Tipo</Label>
              <Select id="cbTipo" value={tipo} onChange={(e) => setTipo(e.target.value as ContaBancaria['tipo'])} className="text-xs font-bold">
                <option value="corrente">CORRENTE</option>
                <option value="poupanca">POUPANÇA</option>
                <option value="cartao">CARTÃO</option>
                <option value="outro">OUTRO</option>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="cbCodigoBanco" className="normal-case text-[11px]">Código do Banco *</Label>
              <Input
                id="cbCodigoBanco"
                placeholder="EX: 341"
                value={codigoBanco}
                onChange={(e) => setCodigoBanco(e.target.value)}
                className="text-xs font-bold font-mono"
              />
            </div>
            <div>
              <Label htmlFor="cbBanco" className="normal-case text-[11px]">Nome do Banco *</Label>
              <Input
                id="cbBanco"
                placeholder="EX: ITAÚ"
                value={banco}
                onChange={(e) => setBanco(e.target.value.toUpperCase())}
                className="text-xs font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="cbAgencia" className="normal-case text-[11px]">Agência *</Label>
              <Input
                id="cbAgencia"
                placeholder="EX: 0001"
                value={agencia}
                onChange={(e) => setAgencia(e.target.value)}
                className="text-xs font-bold font-mono"
              />
            </div>
            <div>
              <Label htmlFor="cbConta" className="normal-case text-[11px]">Número da Conta *</Label>
              <Input
                id="cbConta"
                placeholder="EX: 12345-6"
                value={conta}
                onChange={(e) => setConta(e.target.value)}
                className="text-xs font-bold font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="cbSaldo" className="normal-case text-[11px]">Saldo Inicial (R$)</Label>
              <Input
                id="cbSaldo"
                type="text"
                inputMode="decimal"
                placeholder="0"
                value={saldoInicial}
                onChange={(e) => setSaldoInicial(e.target.value.replace(/[^0-9.,]/g, ''))}
                className="text-xs font-bold font-mono"
              />
            </div>
            <div>
              <Label htmlFor="cbStatus" className="normal-case text-[11px]">Status</Label>
              <Select
                id="cbStatus"
                value={ativa ? 'ativo' : 'inativo'}
                onChange={(e) => setAtiva(e.target.value === 'ativo')}
                className="text-xs font-bold"
              >
                <option value="ativo">ATIVO</option>
                <option value="inativo">INATIVO</option>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-border/15">
            <Button type="button" variant="secondary" onClick={onClose} disabled={salvando} className="!h-10 px-5 text-xs font-semibold">
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando} className="!h-10 px-6 text-xs font-bold bg-primary hover:bg-primary/90 text-white">
              {salvando ? 'Salvando...' : contaEditando ? 'Salvar Alterações' : 'Cadastrar'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------------------------
// Subcomponente: Modal de Novo Lançamento / Editar Lançamento (Contas a Pagar/Receber)
// ----------------------------------------------------------------------------------
function ModalContaPagarReceber({
  contaEditando,
  centrosCusto,
  onRefetchCentrosCusto,
  tiposLancamento,
  onRefetchTiposLancamento,
  fornecedores,
  onRefetchFornecedores,
  contasBancarias,
  veiculos,
  onClose,
}: {
  contaEditando: ContaPagarReceber | null
  centrosCusto: { id: string; nome: string }[]
  onRefetchCentrosCusto: () => Promise<void>
  tiposLancamento: { id: string; nome: string }[]
  onRefetchTiposLancamento: () => Promise<void>
  fornecedores: { id: string; nome: string }[]
  onRefetchFornecedores: () => Promise<void>
  contasBancarias: { id: string; nome: string }[]
  veiculos: ItemFrotaCadastrada[]
  onClose: () => void
}) {
  const [descricao, setDescricao] = useState(contaEditando?.descricao || '')
  const [centroCustoId, setCentroCustoId] = useState(contaEditando?.centroCustoId || '')
  const [tipoMovimentacao, setTipoMovimentacao] = useState<TipoMovimentacaoConta>(contaEditando?.tipoMovimentacao || 'despesa')
  const [tipoLancamentoId, setTipoLancamentoId] = useState(contaEditando?.tipoLancamentoId || '')
  const [valor, setValor] = useState(contaEditando?.valor != null ? String(contaEditando.valor) : '')
  const [dataLancamento, setDataLancamento] = useState(contaEditando?.dataLancamento || new Date().toISOString().slice(0, 10))
  const [dataVencimento, setDataVencimento] = useState(contaEditando?.dataVencimento || '')
  const [status, setStatus] = useState<StatusContaPagarReceber>(contaEditando?.status || 'pendente')
  const [veiculoId, setVeiculoId] = useState(contaEditando?.veiculoId || '')
  const [fornecedorId, setFornecedorId] = useState(contaEditando?.fornecedorId || '')
  const [contaBancariaId, setContaBancariaId] = useState(contaEditando?.contaBancariaId || '')
  const [observacoes, setObservacoes] = useState(contaEditando?.observacoes || '')
  const [numeroParcelas, setNumeroParcelas] = useState(String(contaEditando?.numeroParcelas || 1))
  const [mostrarDetalhes, setMostrarDetalhes] = useState(false)
  const [mostrarParcelamento, setMostrarParcelamento] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const veiculosOrdenados = useMemo(() => [...veiculos].sort((a, b) => a.placa.localeCompare(b.placa)), [veiculos])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!centroCustoId) {
      setErro('Selecione o centro de custo.')
      return
    }
    if (!tipoLancamentoId) {
      setErro('Selecione o tipo de lançamento.')
      return
    }
    const valorNum = parseDecimalPtBr(valor)
    if (!valor || Number.isNaN(valorNum) || valorNum <= 0) {
      setErro('Informe um valor válido.')
      return
    }
    if (!dataLancamento || !dataVencimento) {
      setErro('Informe a data de lançamento e a data de vencimento.')
      return
    }
    if (dataVencimento < dataLancamento) {
      setErro('A data de vencimento não pode ser antes da data de lançamento.')
      return
    }

    const centro = centrosCusto.find((c) => c.id === centroCustoId)
    const tipo = tiposLancamento.find((t) => t.id === tipoLancamentoId)
    const fornecedor = fornecedores.find((f) => f.id === fornecedorId)
    const veiculo = veiculosOrdenados.find((v) => v.id === veiculoId)
    const contaBanco = contasBancarias.find((c) => c.id === contaBancariaId)

    const input: SalvarContaPagarReceberInput = {
      descricao: descricao.trim() ? descricao.trim().toUpperCase() : undefined,
      centroCustoId,
      centroCustoNome: centro?.nome,
      tipoMovimentacao,
      tipoLancamentoId,
      tipoLancamentoNome: tipo?.nome,
      valor: valorNum,
      dataLancamento,
      dataVencimento,
      status,
      veiculoId: veiculoId || undefined,
      placa: veiculo?.placa,
      fornecedorId: fornecedorId || undefined,
      fornecedorNome: fornecedor?.nome,
      contaBancariaId: contaBancariaId || undefined,
      contaBancariaNome: contaBanco?.nome,
      observacoes: observacoes.trim() ? observacoes.trim().toUpperCase() : undefined,
      numeroParcelas: Number(numeroParcelas) || 1,
    }

    setSalvando(true)
    setErro(null)
    try {
      if (contaEditando) {
        await atualizarContaPagarReceber(contaEditando.id, input)
      } else {
        await criarContaPagarReceber(input)
      }
      onClose()
    } catch (err) {
      setErro(getErrorMessage(err, 'Erro ao salvar o lançamento.'))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
      <div className="w-full max-w-lg rounded-2xl border border-border/20 bg-surface shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between border-b border-border/10 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-foreground uppercase">
                {contaEditando ? 'Editar Lançamento' : 'Novo Lançamento'}
              </h2>
              <p className="text-[11px] text-secondary">Conta a pagar ou a receber</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-secondary hover:bg-background hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 uppercase">
          {erro && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-3.5 py-2.5 text-xs font-semibold text-red-400 normal-case">
              {erro}
            </div>
          )}

          <div>
            <Label htmlFor="lancDescricao">Descrição</Label>
            <Input
              id="lancDescricao"
              placeholder="EX: COMBUSTÍVEL POSTO IPIRANGA"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value.toUpperCase())}
              className="text-xs font-bold"
            />
          </div>

          <QuickCreateSelect
            label="Centro de Custo *"
            placeholder="Selecione o centro de custo..."
            options={centrosCusto}
            value={centroCustoId}
            onChange={setCentroCustoId}
            onCreate={async (nome) => {
              const novo = await criarCentroCusto(nome)
              await onRefetchCentrosCusto()
              return novo
            }}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="lancMovimentacao">Tipo de Movimentação</Label>
              <Select
                id="lancMovimentacao"
                value={tipoMovimentacao}
                onChange={(e) => setTipoMovimentacao(e.target.value as TipoMovimentacaoConta)}
                className="text-xs font-bold"
              >
                <option value="despesa">CONTA A PAGAR (DESPESA)</option>
                <option value="receita">CONTA A RECEBER (RECEITA)</option>
              </Select>
            </div>
            <QuickCreateSelect
              label="Tipo de Lançamento *"
              placeholder="Selecione o tipo de lançamento..."
              options={tiposLancamento}
              value={tipoLancamentoId}
              onChange={setTipoLancamentoId}
              onCreate={async (nome) => {
                const novo = await criarTipoLancamento(nome)
                await onRefetchTiposLancamento()
                return novo
              }}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label htmlFor="lancValor" className="normal-case text-[11px]">Valor (R$)</Label>
              <Input
                id="lancValor"
                type="text"
                inputMode="decimal"
                placeholder="R$ 0,00"
                value={valor}
                onChange={(e) => setValor(e.target.value.replace(/[^0-9.,]/g, ''))}
                className="text-xs font-bold font-mono"
              />
            </div>
            <div>
              <Label htmlFor="lancDataLancamento" className="normal-case text-[11px]">Data de Lançamento *</Label>
              <Input
                id="lancDataLancamento"
                type="date"
                value={dataLancamento}
                onChange={(e) => setDataLancamento(e.target.value)}
                className="text-xs font-bold"
                required
              />
            </div>
            <div>
              <Label htmlFor="lancDataVencimento" className="normal-case text-[11px]">Data de Vencimento *</Label>
              <Input
                id="lancDataVencimento"
                type="date"
                value={dataVencimento}
                onChange={(e) => setDataVencimento(e.target.value)}
                className="text-xs font-bold"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="lancStatus">Status</Label>
              <Select
                id="lancStatus"
                value={status}
                onChange={(e) => setStatus(e.target.value as StatusContaPagarReceber)}
                className="text-xs font-bold"
              >
                <option value="pendente">PENDENTE</option>
                <option value="pago">PAGO</option>
                <option value="atrasado">ATRASADO</option>
                <option value="cancelado">CANCELADO</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="lancVeiculo">Veículo (Opcional)</Label>
              <Select
                id="lancVeiculo"
                value={veiculoId}
                onChange={(e) => setVeiculoId(e.target.value)}
                className="text-xs font-bold"
              >
                <option value="">NENHUM VEÍCULO SELECIONADO</option>
                {veiculosOrdenados.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.placa}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <QuickCreateSelect
              label="Fornecedor / Favorecido (Opcional)"
              placeholder="Selecione o fornecedor/favorecido..."
              options={fornecedores}
              value={fornecedorId}
              onChange={setFornecedorId}
              onCreate={async (nome) => {
                const novo = await criarFornecedor(nome)
                await onRefetchFornecedores()
                return novo
              }}
            />
            <div>
              <Label htmlFor="lancContaBancaria">Conta Bancária (Opcional)</Label>
              <Select
                id="lancContaBancaria"
                value={contaBancariaId}
                onChange={(e) => setContaBancariaId(e.target.value)}
                className="text-xs font-bold"
              >
                <option value="">SELECIONE A CONTA BANCÁRIA</option>
                {contasBancarias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="rounded-xl border border-border/20 overflow-hidden">
            <button
              type="button"
              onClick={() => setMostrarDetalhes((v) => !v)}
              className="flex w-full items-center justify-between px-3.5 py-2.5 bg-background/50 text-xs font-black text-foreground"
            >
              <span>DETALHES ADICIONAIS</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${mostrarDetalhes ? 'rotate-180' : ''}`} />
            </button>
            {mostrarDetalhes && (
              <div className="p-3.5 border-t border-border/15">
                <Label htmlFor="lancObs" className="normal-case text-[11px]">Observações</Label>
                <Textarea
                  id="lancObs"
                  placeholder="OBSERVAÇÕES ADICIONAIS..."
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value.toUpperCase())}
                  className="text-xs"
                  rows={3}
                />
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border/20 overflow-hidden">
            <button
              type="button"
              onClick={() => setMostrarParcelamento((v) => !v)}
              className="flex w-full items-center justify-between px-3.5 py-2.5 bg-background/50 text-xs font-black text-foreground"
            >
              <span className="flex items-center gap-2">
                PARCELAMENTO
                <Badge tone="neutral" className="text-[9px] font-black normal-case">{numeroParcelas}x</Badge>
              </span>
              <ChevronDown className={`h-4 w-4 transition-transform ${mostrarParcelamento ? 'rotate-180' : ''}`} />
            </button>
            {mostrarParcelamento && (
              <div className="p-3.5 border-t border-border/15">
                <Label htmlFor="lancParcelas" className="normal-case text-[11px]">Número de Parcelas</Label>
                <Input
                  id="lancParcelas"
                  type="text"
                  inputMode="numeric"
                  value={numeroParcelas}
                  onChange={(e) => setNumeroParcelas(e.target.value.replace(/\D/g, '') || '1')}
                  className="text-xs font-bold font-mono max-w-[120px]"
                />
                <p className="mt-1.5 text-[10px] text-secondary normal-case">
                  Só informativo por enquanto — cada parcela ainda precisa ser lançada separadamente.
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-border/15">
            <Button type="button" variant="secondary" onClick={onClose} disabled={salvando} className="!h-10 px-5 text-xs font-semibold">
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando} className="!h-10 px-6 text-xs font-bold bg-primary hover:bg-primary/90 text-white">
              {salvando ? 'Salvando...' : 'Salvar Lançamento'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------------------------
// Subcomponente: Modal de Nova Entrada / Editar Estadia no Pátio
// ----------------------------------------------------------------------------------
const VALOR_DIARIA_PADRAO = '60,00'

function ModalEstadiaPatio({
  estadiaEditando,
  clientes,
  onRefetchClientes,
  centrosCusto,
  onRefetchCentrosCusto,
  onClose,
}: {
  estadiaEditando: EstadiaPatio | null
  clientes: Cliente[]
  onRefetchClientes: () => Promise<void>
  centrosCusto: { id: string; nome: string }[]
  onRefetchCentrosCusto: () => Promise<void>
  onClose: () => void
}) {
  const [clienteId, setClienteId] = useState(estadiaEditando?.clienteId || '')
  const [veiculoClienteId, setVeiculoClienteId] = useState(estadiaEditando?.veiculoClienteId || '')
  const [placa, setPlaca] = useState(estadiaEditando?.placa || '')
  const [modelo, setModelo] = useState(estadiaEditando?.modelo || '')
  const [marca, setMarca] = useState(estadiaEditando?.marca || '')
  const [cor, setCor] = useState(estadiaEditando?.cor || '')
  const [dataHoraEntrada, setDataHoraEntrada] = useState(
    isoParaDatetimeLocal(estadiaEditando?.dataHoraEntrada) || isoParaDatetimeLocal(new Date().toISOString()),
  )
  const [previsaoSaida, setPrevisaoSaida] = useState(isoParaDatetimeLocal(estadiaEditando?.previsaoSaida))
  const [valorDiaria, setValorDiaria] = useState(
    estadiaEditando?.valorDiaria != null ? estadiaEditando.valorDiaria.toFixed(2).replace('.', ',') : VALOR_DIARIA_PADRAO,
  )
  const [centroCustoId, setCentroCustoId] = useState(estadiaEditando?.centroCustoId || '')
  const [observacoes, setObservacoes] = useState(estadiaEditando?.observacoes || '')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const { veiculos: veiculosDoCliente, refetch: refetchVeiculosCliente } = useVeiculosClientes(clienteId || undefined)
  const veiculosComoOpcoes = useMemo(
    () => veiculosDoCliente.map((v) => ({ id: v.id, nome: `${v.placa}${v.modelo ? ` — ${v.modelo}` : ''}` })),
    [veiculosDoCliente],
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!clienteId) {
      setErro('Selecione o cliente.')
      return
    }
    if (!placa.trim()) {
      setErro('Selecione ou cadastre o veículo.')
      return
    }
    const dataEntradaIso = datetimeLocalParaIso(dataHoraEntrada)
    if (!dataEntradaIso) {
      setErro('Informe a data e hora de entrada.')
      return
    }
    if (!centroCustoId) {
      setErro('Selecione o centro de custo.')
      return
    }
    const previsaoSaidaIso = datetimeLocalParaIso(previsaoSaida)
    if (previsaoSaidaIso && previsaoSaidaIso < dataEntradaIso) {
      setErro('A previsão de saída não pode ser antes da entrada.')
      return
    }

    const cliente = clientes.find((c) => c.id === clienteId)
    const centro = centrosCusto.find((c) => c.id === centroCustoId)

    const input: SalvarEstadiaPatioInput = {
      clienteId,
      clienteNome: cliente?.nome,
      veiculoClienteId: veiculoClienteId || undefined,
      placa: placa.trim().toUpperCase(),
      modelo: modelo.trim() ? modelo.trim().toUpperCase() : undefined,
      marca: marca.trim() ? marca.trim().toUpperCase() : undefined,
      cor: cor.trim() ? cor.trim().toUpperCase() : undefined,
      dataHoraEntrada: dataEntradaIso,
      previsaoSaida: previsaoSaidaIso,
      valorDiaria: parseDecimalPtBr(valorDiaria),
      centroCustoId,
      centroCustoNome: centro?.nome,
      observacoes: observacoes.trim() ? observacoes.trim().toUpperCase() : undefined,
    }

    setSalvando(true)
    setErro(null)
    try {
      if (estadiaEditando) {
        await atualizarEstadiaPatio(estadiaEditando.id, input)
      } else {
        await criarEstadiaPatio(input)
      }
      onClose()
    } catch (err) {
      setErro(getErrorMessage(err, 'Erro ao salvar a entrada no pátio.'))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
      <div className="w-full max-w-lg rounded-2xl border border-border/20 bg-surface shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between border-b border-border/10 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Warehouse className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-foreground uppercase">
                {estadiaEditando ? 'Editar Entrada no Pátio' : 'Registrar Nova Entrada no Pátio'}
              </h2>
              <p className="text-[11px] text-secondary">Veículo de cliente guardado no pátio</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-secondary hover:bg-background hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 uppercase">
          {erro && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-3.5 py-2.5 text-xs font-semibold text-red-400 normal-case">
              {erro}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <QuickCreateSelect
              label="Cliente *"
              placeholder="Pesquise o cliente..."
              options={clientes}
              value={clienteId}
              onChange={(id) => {
                setClienteId(id)
                setVeiculoClienteId('')
                setPlaca('')
                setModelo('')
                setMarca('')
                setCor('')
              }}
              onCreate={async (nome) => {
                const novo = await criarCliente(nome)
                await onRefetchClientes()
                return novo
              }}
            />

            <QuickCreateSelect
              label="Veículo *"
              placeholder={clienteId ? 'Pesquise o veículo...' : 'Selecione o cliente primeiro'}
              options={veiculosComoOpcoes}
              value={veiculoClienteId}
              onChange={(id) => {
                setVeiculoClienteId(id)
                const v = veiculosDoCliente.find((vv) => vv.id === id)
                if (v) {
                  setPlaca(v.placa)
                  setModelo(v.modelo || '')
                  setMarca(v.marca || '')
                  setCor(v.cor || '')
                }
              }}
              disabled={!clienteId}
              onCreate={async (nomePlaca) => {
                if (!clienteId) throw new Error('Selecione o cliente primeiro.')
                const novo = await criarVeiculoCliente(clienteId, { placa: nomePlaca })
                await refetchVeiculosCliente()
                setPlaca(novo.placa)
                return { id: novo.id, nome: novo.placa }
              }}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label htmlFor="patioPlaca" className="normal-case text-[11px]">Placa</Label>
              <Input
                id="patioPlaca"
                value={placa}
                onChange={(e) => setPlaca(e.target.value.toUpperCase())}
                className="text-xs font-bold font-mono"
              />
            </div>
            <div>
              <Label htmlFor="patioModelo" className="normal-case text-[11px]">Modelo</Label>
              <Input
                id="patioModelo"
                value={modelo}
                onChange={(e) => setModelo(e.target.value.toUpperCase())}
                className="text-xs font-bold"
              />
            </div>
            <div>
              <Label htmlFor="patioCor" className="normal-case text-[11px]">Marca / Cor</Label>
              <div className="flex gap-1.5">
                <Input
                  value={marca}
                  onChange={(e) => setMarca(e.target.value.toUpperCase())}
                  placeholder="MARCA"
                  className="text-xs font-bold"
                />
                <Input
                  value={cor}
                  onChange={(e) => setCor(e.target.value.toUpperCase())}
                  placeholder="COR"
                  className="text-xs font-bold"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="patioEntrada" className="normal-case text-[11px]">Data/Hora de Entrada *</Label>
              <Input
                id="patioEntrada"
                type="datetime-local"
                value={dataHoraEntrada}
                onChange={(e) => setDataHoraEntrada(e.target.value)}
                className="text-xs font-bold"
                required
              />
            </div>
            <div>
              <Label htmlFor="patioPrevisao" className="normal-case text-[11px]">Previsão de Saída</Label>
              <Input
                id="patioPrevisao"
                type="datetime-local"
                value={previsaoSaida}
                onChange={(e) => setPrevisaoSaida(e.target.value)}
                className="text-xs font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="patioDiaria" className="normal-case text-[11px]">Valor da Diária (R$)</Label>
              <Input
                id="patioDiaria"
                type="text"
                inputMode="decimal"
                value={valorDiaria}
                onChange={(e) => setValorDiaria(e.target.value.replace(/[^0-9.,]/g, ''))}
                className="text-xs font-bold font-mono"
              />
              {!estadiaEditando && (
                <p className="mt-1 text-[10px] text-secondary normal-case">
                  Pré-preenchido com {VALOR_DIARIA_PADRAO} de padrão. Edite se necessário.
                </p>
              )}
            </div>
            <QuickCreateSelect
              label="Centro de Custo *"
              placeholder="Selecione o centro de custo..."
              options={centrosCusto}
              value={centroCustoId}
              onChange={setCentroCustoId}
              onCreate={async (nome) => {
                const novo = await criarCentroCusto(nome)
                await onRefetchCentrosCusto()
                return novo
              }}
            />
          </div>

          <div>
            <Label htmlFor="patioObs">Observações</Label>
            <Textarea
              id="patioObs"
              placeholder="OBSERVAÇÕES ADICIONAIS..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value.toUpperCase())}
              className="text-xs"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-border/15">
            <Button type="button" variant="secondary" onClick={onClose} disabled={salvando} className="!h-10 px-5 text-xs font-semibold">
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando} className="!h-10 px-6 text-xs font-bold bg-primary hover:bg-primary/90 text-white">
              {salvando ? 'Salvando...' : estadiaEditando ? 'Salvar Alterações' : 'Confirmar Entrada'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ModalViagem({
  viagemEditando,
  veiculos,
  clientes,
  onRefetchClientes,
  centrosCusto,
  onRefetchCentrosCusto,
  transportadoras,
  onRefetchTransportadoras,
  tiposCarga,
  onRefetchTiposCarga,
  enderecosFrequentes,
  onRefetchEnderecosFrequentes,
  onClose,
}: {
  viagemEditando: RegistroViagem | null
  veiculos: ItemFrotaCadastrada[]
  clientes: Cliente[]
  onRefetchClientes: () => Promise<void>
  centrosCusto: CentroCusto[]
  onRefetchCentrosCusto: () => Promise<void>
  transportadoras: Transportadora[]
  onRefetchTransportadoras: () => Promise<void>
  tiposCarga: TipoCarga[]
  onRefetchTiposCarga: () => Promise<void>
  enderecosFrequentes: EnderecoFrequente[]
  onRefetchEnderecosFrequentes: () => Promise<void>
  onClose: () => void
}) {
  const veiculosOrdenados = useMemo(
    () => [...veiculos].sort((a, b) => a.placa.localeCompare(b.placa)),
    [veiculos],
  )
  const enderecosComoOpcoes = useMemo(
    () => enderecosFrequentes.map((e) => ({ id: e.id, nome: e.apelido })),
    [enderecosFrequentes],
  )

  const veiculoInicial = viagemEditando
    ? veiculosOrdenados.find((v) => v.id === viagemEditando.veiculoId || v.placa === viagemEditando.placa)
    : undefined

  // Participantes
  const [clienteId, setClienteId] = useState(viagemEditando?.clienteId || '')
  const [veiculoId, setVeiculoId] = useState(veiculoInicial?.id || '')
  const [placaManual, setPlacaManual] = useState(viagemEditando?.placa || '')
  const [motoristaNome, setMotoristaNome] = useState(viagemEditando?.motoristaNome || '')
  const [centroCustoId, setCentroCustoId] = useState(viagemEditando?.centroCustoId || '')
  const [transportadoraId, setTransportadoraId] = useState(viagemEditando?.transportadoraId || '')

  // Rota de transporte
  const [enderecoOrigem, setEnderecoOrigem] = useState(viagemEditando?.enderecoOrigem || '')
  const [cidadeOrigem, setCidadeOrigem] = useState(viagemEditando?.cidadeOrigem || '')
  const [ufOrigem, setUfOrigem] = useState(viagemEditando?.ufOrigem || '')
  const [dataColetaPrevista, setDataColetaPrevista] = useState(viagemEditando?.dataColetaPrevista || '')
  const [enderecoDestino, setEnderecoDestino] = useState(viagemEditando?.enderecoDestino || '')
  const [cidadeDestino, setCidadeDestino] = useState(viagemEditando?.cidadeDestino || '')
  const [ufDestino, setUfDestino] = useState(viagemEditando?.ufDestino || '')
  const [dataEntregaPrevista, setDataEntregaPrevista] = useState(viagemEditando?.dataEntregaPrevista || '')
  const [distanciaEstimadaKm, setDistanciaEstimadaKm] = useState(
    viagemEditando?.distanciaEstimadaKm != null ? String(viagemEditando.distanciaEstimadaKm) : '',
  )
  const [tempoEstimadoHoras, setTempoEstimadoHoras] = useState(
    viagemEditando?.tempoEstimadoHoras != null ? String(viagemEditando.tempoEstimadoHoras) : '',
  )

  // Detalhes da carga
  const [tipoCargaId, setTipoCargaId] = useState(viagemEditando?.tipoCargaId || '')
  const [veiculosCarregados, setVeiculosCarregados] = useState<VeiculoCarregado[]>(viagemEditando?.veiculosCarregados || [])
  const [veiculoCarregadoSelecionado, setVeiculoCarregadoSelecionado] = useState('')
  const [pesoCargaToneladas, setPesoCargaToneladas] = useState(
    viagemEditando?.pesoCargaToneladas != null ? String(viagemEditando.pesoCargaToneladas) : '',
  )
  const [volumeM3, setVolumeM3] = useState(viagemEditando?.volumeM3 != null ? String(viagemEditando.volumeM3) : '')

  // Detalhes financeiros
  const [formaCalculoFrete, setFormaCalculoFrete] = useState<FormaCalculoFrete>(viagemEditando?.formaCalculoFrete || 'valor_fixo')
  const [freteBruto, setFreteBruto] = useState(viagemEditando?.freteBruto != null ? String(viagemEditando.freteBruto) : '')
  const [despesasAbater, setDespesasAbater] = useState(viagemEditando?.despesasAbater != null ? String(viagemEditando.despesasAbater) : '')
  const [adiantamento, setAdiantamento] = useState(viagemEditando?.adiantamento != null ? String(viagemEditando.adiantamento) : '')
  const [tipoFrete, setTipoFrete] = useState<TipoFrete>(viagemEditando?.tipoFrete || 'CIF')
  const [percentualImposto, setPercentualImposto] = useState(
    viagemEditando?.percentualImposto != null ? String(viagemEditando.percentualImposto) : '',
  )
  const [pessoaImposto, setPessoaImposto] = useState(viagemEditando?.pessoaImposto || '')
  const [percentualComissao, setPercentualComissao] = useState(
    viagemEditando?.percentualComissao != null ? String(viagemEditando.percentualComissao) : '',
  )
  const [pessoaComissao, setPessoaComissao] = useState(viagemEditando?.pessoaComissao || '')
  const [custoOperacional, setCustoOperacional] = useState(
    viagemEditando?.custoOperacional != null ? String(viagemEditando.custoOperacional) : '',
  )

  // Status e fechamento
  const [status, setStatus] = useState<StatusViagem>(viagemEditando?.status || 'cotada')
  const [observacoes, setObservacoes] = useState(viagemEditando?.observacoes || '')

  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const veiculoSelecionado = veiculosOrdenados.find((v) => v.id === veiculoId)
  const usaPlacaManual = !veiculoId
  const veiculosDisponiveisParaCarga = veiculosOrdenados.filter(
    (v) => v.id !== veiculoId && !veiculosCarregados.some((vc) => vc.veiculoId === v.id),
  )

  // Cálculos financeiros (somente leitura, recalculados a cada mudança)
  const freteBrutoNum = parseDecimalPtBr(freteBruto)
  const despesasAbaterNum = parseDecimalPtBr(despesasAbater)
  const freteLiquido = Math.max(0, freteBrutoNum - despesasAbaterNum)
  const adiantamentoNum = parseDecimalPtBr(adiantamento)
  const saldoReceber = freteLiquido - adiantamentoNum
  const percentualImpostoNum = parseDecimalPtBr(percentualImposto)
  const valorImposto = (freteBrutoNum * percentualImpostoNum) / 100
  const percentualComissaoNum = parseDecimalPtBr(percentualComissao)
  const valorComissao = (freteBrutoNum * percentualComissaoNum) / 100
  const custoOperacionalNum = parseDecimalPtBr(custoOperacional)
  const lucroLiquido = freteLiquido - valorImposto - valorComissao - custoOperacionalNum

  function adicionarVeiculoCarregado() {
    const v = veiculosOrdenados.find((x) => x.id === veiculoCarregadoSelecionado)
    if (!v) return
    setVeiculosCarregados((prev) => [...prev, { veiculoId: v.id, placa: v.placa }])
    setVeiculoCarregadoSelecionado('')
  }

  function removerVeiculoCarregado(idParaRemover: string) {
    setVeiculosCarregados((prev) => prev.filter((vc) => vc.veiculoId !== idParaRemover))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const placaFinal = (veiculoSelecionado?.placa || placaManual).trim().toUpperCase()
    if (!clienteId) {
      setErro('Selecione o cliente.')
      return
    }
    if (!placaFinal) {
      setErro('Selecione o veículo ou informe a placa.')
      return
    }
    if (!motoristaNome.trim()) {
      setErro('Informe o motorista.')
      return
    }
    if (!centroCustoId) {
      setErro('Selecione o centro de custo.')
      return
    }
    if (!enderecoOrigem.trim() || !cidadeOrigem.trim() || !ufOrigem.trim() || !dataColetaPrevista) {
      setErro('Preencha o endereço, cidade, UF e data de coleta da origem.')
      return
    }
    if (!enderecoDestino.trim() || !cidadeDestino.trim() || !ufDestino.trim() || !dataEntregaPrevista) {
      setErro('Preencha o endereço, cidade, UF e data de entrega do destino.')
      return
    }

    const clienteSelecionado = clientes.find((c) => c.id === clienteId)
    const centroCustoSelecionado = centrosCusto.find((c) => c.id === centroCustoId)
    const transportadoraSelecionada = transportadoras.find((t) => t.id === transportadoraId)
    const tipoCargaSelecionado = tiposCarga.find((t) => t.id === tipoCargaId)

    const dataHoraSaida = new Date(`${dataColetaPrevista}T00:00:00`).toISOString()

    const input: SalvarViagemInput = {
      clienteId,
      clienteNome: clienteSelecionado?.nome,
      veiculoId: veiculoSelecionado?.id,
      placa: placaFinal,
      veiculoNome: veiculoSelecionado ? [veiculoSelecionado.marcaNome, veiculoSelecionado.modeloNome].filter(Boolean).join(' ') : undefined,
      motoristaNome: motoristaNome.trim().toUpperCase(),
      centroCustoId,
      centroCustoNome: centroCustoSelecionado?.nome,
      transportadoraId: transportadoraId || undefined,
      transportadoraNome: transportadoraSelecionada?.nome,
      origem: [enderecoOrigem, cidadeOrigem, ufOrigem].filter(Boolean).join(', ').toUpperCase(),
      destino: [enderecoDestino, cidadeDestino, ufDestino].filter(Boolean).join(', ').toUpperCase(),
      enderecoOrigem: enderecoOrigem.trim().toUpperCase(),
      cidadeOrigem: cidadeOrigem.trim().toUpperCase(),
      ufOrigem: ufOrigem.trim().toUpperCase(),
      dataColetaPrevista,
      enderecoDestino: enderecoDestino.trim().toUpperCase(),
      cidadeDestino: cidadeDestino.trim().toUpperCase(),
      ufDestino: ufDestino.trim().toUpperCase(),
      dataEntregaPrevista,
      distanciaEstimadaKm: distanciaEstimadaKm.trim() ? parseDecimalPtBr(distanciaEstimadaKm) : null,
      tempoEstimadoHoras: tempoEstimadoHoras.trim() ? parseDecimalPtBr(tempoEstimadoHoras) : null,
      tipoCargaId: tipoCargaId || undefined,
      tipoCargaNome: tipoCargaSelecionado?.nome,
      veiculosCarregados,
      pesoCargaToneladas: pesoCargaToneladas.trim() ? parseDecimalPtBr(pesoCargaToneladas) : null,
      volumeM3: volumeM3.trim() ? parseDecimalPtBr(volumeM3) : null,
      formaCalculoFrete,
      freteBruto: freteBruto.trim() ? freteBrutoNum : null,
      despesasAbater: despesasAbater.trim() ? despesasAbaterNum : null,
      adiantamento: adiantamento.trim() ? adiantamentoNum : null,
      tipoFrete,
      percentualImposto: percentualImposto.trim() ? percentualImpostoNum : null,
      pessoaImposto: pessoaImposto.trim() ? pessoaImposto.trim().toUpperCase() : undefined,
      percentualComissao: percentualComissao.trim() ? percentualComissaoNum : null,
      pessoaComissao: pessoaComissao.trim() ? pessoaComissao.trim().toUpperCase() : undefined,
      custoOperacional: custoOperacional.trim() ? custoOperacionalNum : null,
      dataHoraSaida,
      status,
      observacoes: observacoes.trim() ? observacoes.trim().toUpperCase() : undefined,
    }

    setSalvando(true)
    setErro(null)
    try {
      if (viagemEditando) {
        await atualizarViagemFrota(viagemEditando.id, input)
      } else {
        await criarViagemFrota(input)
      }
      onClose()
    } catch (err) {
      setErro(getErrorMessage(err, 'Erro ao salvar a viagem.'))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
      <div className="w-full max-w-2xl rounded-2xl border border-border/20 bg-surface shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between border-b border-border/10 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Route className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-foreground uppercase">
                {viagemEditando ? 'EDITAR VIAGEM OPERACIONAL' : 'NOVA VIAGEM OPERACIONAL'}
              </h2>
              <p className="text-[11px] text-secondary">Cotação de frete, rota, carga e financeiro</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-secondary hover:bg-background hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 uppercase">
          {erro && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-3.5 py-2.5 text-xs font-semibold text-red-400 normal-case">
              {erro}
            </div>
          )}

          {/* 1. PARTICIPANTES */}
          <div className="space-y-3">
            <p className="text-xs font-black text-primary uppercase tracking-widest border-b border-border/15 pb-1.5">
              1. Participantes
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <QuickCreateSelect
                label="Cliente *"
                placeholder="Selecione o cliente..."
                options={clientes}
                value={clienteId}
                onChange={setClienteId}
                onCreate={async (nome) => {
                  const novo = await criarCliente(nome)
                  await onRefetchClientes()
                  return novo
                }}
              />

              <div>
                <Label htmlFor="viagemVeiculo">Veículo *</Label>
                <Select
                  id="viagemVeiculo"
                  value={veiculoId}
                  onChange={(e) => setVeiculoId(e.target.value)}
                  className="text-xs font-bold"
                >
                  <option value="">OUTRO VEÍCULO (INFORMAR PLACA)</option>
                  {veiculosOrdenados.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.placa} {v.modeloNome ? `— ${v.modeloNome}` : ''}
                    </option>
                  ))}
                </Select>
                {usaPlacaManual && (
                  <Input
                    placeholder="PLACA (EX: ABC1D23)"
                    value={placaManual}
                    onChange={(e) => setPlacaManual(e.target.value.toUpperCase())}
                    className="mt-2 text-xs font-bold"
                    required
                  />
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="viagemMotorista">Motorista *</Label>
                <div className="relative mt-1">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary" />
                  <Input
                    id="viagemMotorista"
                    placeholder="NOME DO MOTORISTA"
                    value={motoristaNome}
                    onChange={(e) => setMotoristaNome(e.target.value.toUpperCase())}
                    className="pl-9 text-xs font-bold"
                    required
                  />
                </div>
              </div>

              <QuickCreateSelect
                label="Centro de Custo *"
                placeholder="Selecione o centro de custo..."
                options={centrosCusto}
                value={centroCustoId}
                onChange={setCentroCustoId}
                onCreate={async (nome) => {
                  const novo = await criarCentroCusto(nome)
                  await onRefetchCentrosCusto()
                  return novo
                }}
              />
            </div>

            <QuickCreateSelect
              label="Transportadora (Opcional)"
              placeholder="Selecione a transportadora..."
              options={transportadoras}
              value={transportadoraId}
              onChange={setTransportadoraId}
              onCreate={async (nome) => {
                const nova = await criarTransportadora(nome)
                await onRefetchTransportadoras()
                return nova
              }}
            />
          </div>

          {/* 2. ROTA DE TRANSPORTE */}
          <div className="space-y-3">
            <p className="text-xs font-black text-primary uppercase tracking-widest border-b border-border/15 pb-1.5">
              2. Rota de Transporte
            </p>

            <div className="rounded-xl border border-border/20 bg-background/50 p-3 space-y-3">
              <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Origem</p>
              <QuickCreateSelect
                label="Endereço Frequente (Origem)"
                placeholder="Buscar endereço de origem..."
                options={enderecosComoOpcoes}
                value=""
                onChange={(id) => {
                  const enc = enderecosFrequentes.find((e) => e.id === id)
                  if (enc) {
                    setEnderecoOrigem(enc.endereco)
                    setCidadeOrigem(enc.cidade)
                    setUfOrigem(enc.uf)
                  }
                }}
                onCreate={async (apelido) => {
                  const novo = await criarEnderecoFrequente({
                    apelido,
                    endereco: enderecoOrigem,
                    cidade: cidadeOrigem,
                    uf: ufOrigem,
                  })
                  await onRefetchEnderecosFrequentes()
                  return { id: novo.id, nome: novo.apelido }
                }}
              />
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-2">
                  <Label htmlFor="viagemEndOrigem" className="normal-case text-[11px]">Endereço *</Label>
                  <Input
                    id="viagemEndOrigem"
                    placeholder="RUA, NÚMERO, BAIRRO"
                    value={enderecoOrigem}
                    onChange={(e) => setEnderecoOrigem(e.target.value.toUpperCase())}
                    className="text-xs font-bold"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="viagemCidadeOrigem" className="normal-case text-[11px]">Cidade *</Label>
                  <Input
                    id="viagemCidadeOrigem"
                    placeholder="CIDADE"
                    value={cidadeOrigem}
                    onChange={(e) => setCidadeOrigem(e.target.value.toUpperCase())}
                    className="text-xs font-bold"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="viagemUfOrigem" className="normal-case text-[11px]">UF *</Label>
                  <Input
                    id="viagemUfOrigem"
                    placeholder="UF"
                    maxLength={2}
                    value={ufOrigem}
                    onChange={(e) => setUfOrigem(e.target.value.toUpperCase())}
                    className="text-xs font-bold"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="viagemDataColeta" className="normal-case text-[11px]">Data Coleta (Prevista) *</Label>
                  <Input
                    id="viagemDataColeta"
                    type="date"
                    value={dataColetaPrevista}
                    onChange={(e) => setDataColetaPrevista(e.target.value)}
                    className="text-xs font-bold"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border/20 bg-background/50 p-3 space-y-3">
              <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Destino</p>
              <QuickCreateSelect
                label="Endereço Frequente (Destino)"
                placeholder="Buscar endereço de destino..."
                options={enderecosComoOpcoes}
                value=""
                onChange={(id) => {
                  const enc = enderecosFrequentes.find((e) => e.id === id)
                  if (enc) {
                    setEnderecoDestino(enc.endereco)
                    setCidadeDestino(enc.cidade)
                    setUfDestino(enc.uf)
                  }
                }}
                onCreate={async (apelido) => {
                  const novo = await criarEnderecoFrequente({
                    apelido,
                    endereco: enderecoDestino,
                    cidade: cidadeDestino,
                    uf: ufDestino,
                  })
                  await onRefetchEnderecosFrequentes()
                  return { id: novo.id, nome: novo.apelido }
                }}
              />
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-2">
                  <Label htmlFor="viagemEndDestino" className="normal-case text-[11px]">Endereço *</Label>
                  <Input
                    id="viagemEndDestino"
                    placeholder="RUA, NÚMERO, BAIRRO"
                    value={enderecoDestino}
                    onChange={(e) => setEnderecoDestino(e.target.value.toUpperCase())}
                    className="text-xs font-bold"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="viagemCidadeDestino" className="normal-case text-[11px]">Cidade *</Label>
                  <Input
                    id="viagemCidadeDestino"
                    placeholder="CIDADE"
                    value={cidadeDestino}
                    onChange={(e) => setCidadeDestino(e.target.value.toUpperCase())}
                    className="text-xs font-bold"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="viagemUfDestino" className="normal-case text-[11px]">UF *</Label>
                  <Input
                    id="viagemUfDestino"
                    placeholder="UF"
                    maxLength={2}
                    value={ufDestino}
                    onChange={(e) => setUfDestino(e.target.value.toUpperCase())}
                    className="text-xs font-bold"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="viagemDataEntrega" className="normal-case text-[11px]">Data Entrega (Prevista) *</Label>
                  <Input
                    id="viagemDataEntrega"
                    type="date"
                    value={dataEntregaPrevista}
                    onChange={(e) => setDataEntregaPrevista(e.target.value)}
                    className="text-xs font-bold"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="viagemDistancia" className="normal-case text-[11px]">Distância Estimada (KM)</Label>
                <Input
                  id="viagemDistancia"
                  type="text"
                  inputMode="numeric"
                  placeholder="EX: 450"
                  value={distanciaEstimadaKm}
                  onChange={(e) => setDistanciaEstimadaKm(e.target.value.replace(/[^0-9.,]/g, ''))}
                  className="text-xs font-bold font-mono"
                />
              </div>
              <div>
                <Label htmlFor="viagemTempo" className="normal-case text-[11px]">Tempo Estimado (Horas)</Label>
                <Input
                  id="viagemTempo"
                  type="text"
                  inputMode="numeric"
                  placeholder="EX: 8"
                  value={tempoEstimadoHoras}
                  onChange={(e) => setTempoEstimadoHoras(e.target.value.replace(/[^0-9.,]/g, ''))}
                  className="text-xs font-bold font-mono"
                />
              </div>
            </div>
          </div>

          {/* 3. DETALHES DA CARGA */}
          <div className="space-y-3">
            <p className="text-xs font-black text-primary uppercase tracking-widest border-b border-border/15 pb-1.5">
              3. Detalhes da Carga
            </p>

            <QuickCreateSelect
              label="Tipo de Carga"
              placeholder="Selecione o tipo de carga..."
              options={tiposCarga}
              value={tipoCargaId}
              onChange={setTipoCargaId}
              onCreate={async (nome) => {
                const novo = await criarTipoCarga(nome)
                await onRefetchTiposCarga()
                return novo
              }}
            />

            <div>
              <Label className="normal-case text-[11px]">Veículos Carregados</Label>
              <div className="rounded-xl border border-border/20 bg-background/50 p-3 space-y-2">
                <div className="flex gap-2">
                  <Select
                    value={veiculoCarregadoSelecionado}
                    onChange={(e) => setVeiculoCarregadoSelecionado(e.target.value)}
                    className="text-xs font-bold flex-1"
                  >
                    <option value="">PESQUISAR VEÍCULO PARA ADICIONAR À LISTA...</option>
                    {veiculosDisponiveisParaCarga.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.placa} {v.modeloNome ? `— ${v.modeloNome}` : ''}
                      </option>
                    ))}
                  </Select>
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    disabled={!veiculoCarregadoSelecionado}
                    onClick={adicionarVeiculoCarregado}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {veiculosCarregados.length === 0 ? (
                  <p className="text-[11px] text-secondary normal-case italic">Nenhum veículo carregado informado.</p>
                ) : (
                  <div className="space-y-1.5">
                    {veiculosCarregados.map((vc) => (
                      <div
                        key={vc.veiculoId}
                        className="flex items-center justify-between rounded-lg border border-border/20 bg-surface px-3 py-1.5"
                      >
                        <span className="text-xs font-mono font-bold text-foreground">{vc.placa}</span>
                        <button
                          type="button"
                          onClick={() => removerVeiculoCarregado(vc.veiculoId)}
                          className="text-secondary hover:text-status-danger p-0.5"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="viagemPeso" className="normal-case text-[11px]">Peso da Carga (Toneladas)</Label>
                <Input
                  id="viagemPeso"
                  type="text"
                  inputMode="numeric"
                  placeholder="EX: 12.500"
                  value={pesoCargaToneladas}
                  onChange={(e) => setPesoCargaToneladas(e.target.value.replace(/[^0-9.,]/g, ''))}
                  className="text-xs font-bold font-mono"
                />
              </div>
              <div>
                <Label htmlFor="viagemVolume" className="normal-case text-[11px]">Volume (m³)</Label>
                <Input
                  id="viagemVolume"
                  type="text"
                  inputMode="numeric"
                  placeholder="EX: 45"
                  value={volumeM3}
                  onChange={(e) => setVolumeM3(e.target.value.replace(/[^0-9.,]/g, ''))}
                  className="text-xs font-bold font-mono"
                />
              </div>
            </div>
          </div>

          {/* 4. DETALHES FINANCEIROS */}
          <div className="space-y-3">
            <p className="text-xs font-black text-primary uppercase tracking-widest border-b border-border/15 pb-1.5">
              4. Detalhes Financeiros
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label htmlFor="viagemFormaCalculo" className="normal-case text-[11px]">Forma de Cálculo</Label>
                <Select
                  id="viagemFormaCalculo"
                  value={formaCalculoFrete}
                  onChange={(e) => setFormaCalculoFrete(e.target.value as FormaCalculoFrete)}
                  className="text-xs font-bold"
                >
                  <option value="valor_fixo">VALOR FIXO</option>
                  <option value="por_km">POR KM</option>
                  <option value="por_tonelada">POR TONELADA</option>
                  <option value="por_m3">POR M³</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="viagemFreteBruto" className="normal-case text-[11px]">Frete Bruto / Base (R$)</Label>
                <Input
                  id="viagemFreteBruto"
                  type="text"
                  inputMode="numeric"
                  placeholder="R$ 0,00"
                  value={freteBruto}
                  onChange={(e) => setFreteBruto(e.target.value.replace(/[^0-9.,]/g, ''))}
                  className="text-xs font-bold font-mono"
                />
              </div>
              <div>
                <Label htmlFor="viagemDespesas" className="normal-case text-[11px]">Despesas a Abater (R$)</Label>
                <Input
                  id="viagemDespesas"
                  type="text"
                  inputMode="numeric"
                  placeholder="R$ 0,00"
                  value={despesasAbater}
                  onChange={(e) => setDespesasAbater(e.target.value.replace(/[^0-9.,]/g, ''))}
                  className="text-xs font-bold font-mono text-rose-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="normal-case text-[11px]">Valor do Frete Líquido (R$)</Label>
                <div className="h-12 flex items-center rounded-xl border border-border/20 bg-background/50 px-4 text-xs font-mono font-bold text-secondary">
                  {formatarMoeda(freteLiquido)}
                </div>
              </div>
              <div>
                <Label htmlFor="viagemAdiantamento" className="normal-case text-[11px]">Adiantamento (R$)</Label>
                <Input
                  id="viagemAdiantamento"
                  type="text"
                  inputMode="numeric"
                  placeholder="R$ 0,00"
                  value={adiantamento}
                  onChange={(e) => setAdiantamento(e.target.value.replace(/[^0-9.,]/g, ''))}
                  className="text-xs font-bold font-mono"
                />
              </div>
              <div>
                <Label className="normal-case text-[11px]">Saldo a Receber (R$)</Label>
                <div className="h-12 flex items-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 text-xs font-mono font-black text-emerald-500">
                  {formatarMoeda(saldoReceber)}
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="viagemTipoFrete" className="normal-case text-[11px]">Tipo de Frete</Label>
              <Select
                id="viagemTipoFrete"
                value={tipoFrete}
                onChange={(e) => setTipoFrete(e.target.value as TipoFrete)}
                className="text-xs font-bold sm:max-w-xs"
              >
                <option value="CIF">CIF (REMETENTE PAGA)</option>
                <option value="FOB">FOB (DESTINATÁRIO PAGA)</option>
              </Select>
            </div>

            <div className="rounded-xl border border-border/20 bg-background/50 p-3 space-y-3">
              <p className="text-[11px] font-black text-secondary uppercase tracking-widest">Impostos, Comissões e Custos</p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="viagemPercImposto" className="normal-case text-[11px]">% Imposto</Label>
                  <Input
                    id="viagemPercImposto"
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    value={percentualImposto}
                    onChange={(e) => setPercentualImposto(e.target.value.replace(/[^0-9.,]/g, ''))}
                    className="text-xs font-bold font-mono"
                  />
                </div>
                <div>
                  <Label className="normal-case text-[11px]">Valor Total do Imposto (R$)</Label>
                  <div className="h-12 flex items-center rounded-xl border border-border/20 bg-background/50 px-4 text-xs font-mono font-bold text-secondary">
                    {formatarMoeda(valorImposto)}
                  </div>
                </div>
                <div>
                  <Label htmlFor="viagemPessoaImposto" className="normal-case text-[11px]">Pessoa do Imposto (Opcional)</Label>
                  <Input
                    id="viagemPessoaImposto"
                    placeholder="EX: GOVERNO"
                    value={pessoaImposto}
                    onChange={(e) => setPessoaImposto(e.target.value.toUpperCase())}
                    className="text-xs font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="viagemPercComissao" className="normal-case text-[11px]">% Comissão</Label>
                  <Input
                    id="viagemPercComissao"
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    value={percentualComissao}
                    onChange={(e) => setPercentualComissao(e.target.value.replace(/[^0-9.,]/g, ''))}
                    className="text-xs font-bold font-mono"
                  />
                </div>
                <div>
                  <Label className="normal-case text-[11px]">Valor da Comissão (R$)</Label>
                  <div className="h-12 flex items-center rounded-xl border border-border/20 bg-background/50 px-4 text-xs font-mono font-bold text-secondary">
                    {formatarMoeda(valorComissao)}
                  </div>
                </div>
                <div>
                  <Label htmlFor="viagemPessoaComissao" className="normal-case text-[11px]">Pessoa da Comissão / Vendedor (Opcional)</Label>
                  <Input
                    id="viagemPessoaComissao"
                    placeholder="NOME"
                    value={pessoaComissao}
                    onChange={(e) => setPessoaComissao(e.target.value.toUpperCase())}
                    className="text-xs font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="viagemCustoOp" className="normal-case text-[11px]">Custo Operacional (R$)</Label>
                  <Input
                    id="viagemCustoOp"
                    type="text"
                    inputMode="numeric"
                    placeholder="R$ 0,00"
                    value={custoOperacional}
                    onChange={(e) => setCustoOperacional(e.target.value.replace(/[^0-9.,]/g, ''))}
                    className="text-xs font-bold font-mono"
                  />
                </div>
                <div>
                  <Label className="normal-case text-[11px]">Lucro Líquido (R$)</Label>
                  <div className="h-12 flex items-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 text-sm font-mono font-black text-emerald-500">
                    {formatarMoeda(lucroLiquido)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 5. STATUS E FECHAMENTO */}
          <div className="space-y-3">
            <p className="text-xs font-black text-primary uppercase tracking-widest border-b border-border/15 pb-1.5">
              5. Status e Fechamento
            </p>
            <div>
              <Label htmlFor="viagemStatus">Status da Viagem *</Label>
              <Select
                id="viagemStatus"
                value={status}
                onChange={(e) => setStatus(e.target.value as StatusViagem)}
                className="text-xs font-bold sm:max-w-xs"
              >
                {(Object.keys(STATUS_VIAGEM_INFO) as StatusViagem[]).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_VIAGEM_INFO[s].label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="viagemObs">Observações da Viagem</Label>
              <Textarea
                id="viagemObs"
                placeholder="INSTRUÇÕES ESPECIAIS DE CARGA, MANUSEIO OU DESCARGA..."
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value.toUpperCase())}
                className="text-xs"
                rows={3}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-border/15">
            <Button type="button" variant="secondary" onClick={onClose} disabled={salvando} className="!h-10 px-5 text-xs font-semibold">
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando} className="!h-10 px-6 text-xs font-bold bg-primary hover:bg-primary/90 text-white">
              {salvando ? 'Salvando...' : viagemEditando ? 'Salvar Alterações' : 'Registrar Viagem'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
