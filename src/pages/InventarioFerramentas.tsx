import { useMemo, useState, useEffect, useRef, useDeferredValue } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Hammer,
  Wrench,
  Plus,
  ArrowUpRight,
  RotateCcw,
  Search,
  Truck,
  CheckCircle2,
  Clock,
  Pencil,
  Trash2,
  X,
  Package,
  Layers,
  LayoutList,
  LayoutGrid,
  Camera,
  Image as ImageIcon,
  Eye,
  Loader2,
  Briefcase,
  Boxes,
  AlertTriangle,
  ClipboardList,
  PackagePlus,
  TrendingDown,
  Laptop,
  Sparkles,
  ShieldAlert,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { isEstoqueAuthorized } from '@/components/layout/nav'
import { CameraWebcamModal } from '@/components/CameraWebcamModal'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { PageHeader } from '@/components/layout/Header'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Label } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import {
  useFerramentas,
  useRetiradasFerramentas,
  criarFerramenta,
  atualizarFerramenta,
  excluirFerramenta,
  registrarRetiradaFerramenta,
  atualizarRetiradaFerramenta,
  excluirRetiradaFerramenta,
  registrarDevolucaoFerramenta,
  reverterDevolucaoFerramenta,
  uploadFotoFerramenta,
} from '@/hooks/useFerramentas'
import { comprimirImagem } from '@/lib/imagem'
import { supabase } from '@/lib/supabase'
import type { Ferramenta, FerramentaRetirada } from '@/lib/types'

export interface ItemCaixa {
  id: string
  nome: string
  quantidade: number
}

export interface CaixaFerramenta {
  id: string
  nome: string
  codigo?: string
  localizacao?: string
  status: 'disponivel' | 'em_uso' | 'manutencao'
  foto_url?: string | null
  itens: ItemCaixa[]
  observacoes?: string
  responsavel?: string
  placa?: string
  data_retirada?: string
  created_at: string
}

export interface ItemConsumo {
  id: string
  codigo: string | null
  nome: string
  categoria: string
  unidade: string
  quantidade_atual: number
  quantidade_minima: number
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
  data_hora: string
}

const STORAGE_CAIXAS_KEY = 'gvel_inventario_caixas_v1'
const STORAGE_CONSUMO_KEY = 'gvel_inventario_consumo_v1'
const STORAGE_BAIXAS_CONSUMO_KEY = 'gvel_inventario_baixas_consumo_v1'

const CATEGORIAS_CONSUMO = [
  'TODAS',
  'LUBRIFICANTES & QUÍMICOS',
  'PARAFUSOS & FIXAÇÃO',
  'ELÉTRICA & FUSÍVEIS',
  'DISCOS & LIXAS',
  'VEDAÇÃO & ANÉIS',
  'MANGUEIRAS & CONEXÕES',
  'EPIS & PROTEÇÃO',
  'LIMPEZA & ESTOPAS',
  'DIVERSOS',
]

const ITENS_CONSUMO_INICIAIS: ItemConsumo[] = [
  {
    id: 'c1',
    codigo: 'LUB-001',
    nome: 'DESENGRIPANTE SPRAY WD-40 (300ML)',
    categoria: 'LUBRIFICANTES & QUÍMICOS',
    unidade: 'UN',
    quantidade_atual: 18,
    quantidade_minima: 5,
    localizacao: 'ARMÁRIO QUÍMICOS - PRAT. 1',
    observacoes: 'Uso geral em desmontagens',
    foto_url: null,
    created_at: new Date().toISOString(),
  },
  {
    id: 'c2',
    codigo: 'LUB-002',
    nome: 'GRAXA AZUL PARA ROLAMENTOS (POTE 1KG)',
    categoria: 'LUBRIFICANTES & QUÍMICOS',
    unidade: 'UN',
    quantidade_atual: 6,
    quantidade_minima: 3,
    localizacao: 'ARMÁRIO QUÍMICOS - PRAT. 2',
    observacoes: 'Linha pesada alta temperatura',
    foto_url: null,
    created_at: new Date().toISOString(),
  },
  {
    id: 'c3',
    codigo: 'FIX-010',
    nome: 'ABRAÇADEIRA DE NYLON 200MM (PCT C/ 100)',
    categoria: 'PARAFUSOS & FIXAÇÃO',
    unidade: 'PCT',
    quantidade_atual: 12,
    quantidade_minima: 4,
    localizacao: 'GAVETEIRO FIXAÇÃO - GAVETA 3',
    observacoes: 'Preta resistente a UV',
    foto_url: null,
    created_at: new Date().toISOString(),
  },
  {
    id: 'c4',
    codigo: 'FIX-011',
    nome: 'FITA ISOLANTE 3M 19MM X 20M',
    categoria: 'ELÉTRICA & FUSÍVEIS',
    unidade: 'RL',
    quantidade_atual: 24,
    quantidade_minima: 6,
    localizacao: 'ARMÁRIO ELÉTRICA - PRAT. 1',
    observacoes: 'Alta isolação antichama',
    foto_url: null,
    created_at: new Date().toISOString(),
  },
  {
    id: 'c5',
    codigo: 'ELT-005',
    nome: 'TERMINAL ILHÓS PRÉ-ISOLADO 2.5MM (PCT 100)',
    categoria: 'ELÉTRICA & FUSÍVEIS',
    unidade: 'PCT',
    quantidade_atual: 8,
    quantidade_minima: 2,
    localizacao: 'GAVETEIRO ELÉTRICA - GAVETA 1',
    observacoes: 'Azul padrão 2.5mm',
    foto_url: null,
    created_at: new Date().toISOString(),
  },
  {
    id: 'c6',
    codigo: 'LIX-001',
    nome: 'DISCO DE CORTE INOX 4.1/2" NORTON',
    categoria: 'DISCOS & LIXAS',
    unidade: 'UN',
    quantidade_atual: 35,
    quantidade_minima: 10,
    localizacao: 'PRATELEIRA DE DISCOS',
    observacoes: 'Espessura 1.0mm',
    foto_url: null,
    created_at: new Date().toISOString(),
  },
  {
    id: 'c7',
    codigo: 'EPI-001',
    nome: 'LUVA NITRÍLICA RESISTENTE TAMANHO G (PAR)',
    categoria: 'EPIS & PROTEÇÃO',
    unidade: 'PAR',
    quantidade_atual: 40,
    quantidade_minima: 15,
    localizacao: 'ARMÁRIO EPIS',
    observacoes: 'Proteção contra óleos e solventes',
    foto_url: null,
    created_at: new Date().toISOString(),
  },
  {
    id: 'c8',
    codigo: 'LMP-001',
    nome: 'ESTOPA BRANCA COSTURADA PARA LIMPEZA (FARDO 1KG)',
    categoria: 'LIMPEZA & ESTOPAS',
    unidade: 'KG',
    quantidade_atual: 15,
    quantidade_minima: 5,
    localizacao: 'ÁREA DE LAVAGEM',
    observacoes: '100% algodão',
    foto_url: null,
    created_at: new Date().toISOString(),
  },
]

const CAIXAS_INICIAIS: CaixaFerramenta[] = [
  {
    id: 'caixa_01',
    nome: 'CAIXA 01 - MECÂNICA PESADA',
    codigo: 'CX-001',
    localizacao: 'BANCADA 01 / OFICINA',
    status: 'disponivel',
    foto_url: null,
    itens: [
      { id: '1', nome: 'JOGO DE CHAVES COMBINADAS 6MM A 32MM (GEDORE)', quantidade: 1 },
      { id: '2', nome: 'CHAVE DE CATRACA 1/2 REVERSÍVEL COM EXTENSÃO', quantidade: 1 },
      { id: '3', nome: 'JOGO DE SOQUETES SEXTAVADOS 10MM A 32MM', quantidade: 1 },
      { id: '4', nome: 'ALICATE DE PRESSÃO MORDAÇA CURVA 10"', quantidade: 1 },
      { id: '5', nome: 'ALICATE UNIVERSAL 8" ISOLADO 1000V', quantidade: 1 },
      { id: '6', nome: 'MARTELO BOLA 500G COM CABO DE FIBRA', quantidade: 1 },
      { id: '7', nome: 'TALHADEIRA 3/4" OCTOGONAL', quantidade: 2 },
    ],
    observacoes: 'Kit completo para desmontagem de eixos e suspensão',
    created_at: new Date().toISOString(),
  },
  {
    id: 'caixa_02',
    nome: 'CAIXA 02 - ELÉTRICA & INJEÇÃO',
    codigo: 'CX-002',
    localizacao: 'ARMÁRIO ELÉTRICA / GAVETA A2',
    status: 'disponivel',
    foto_url: null,
    itens: [
      { id: '1', nome: 'MULTÍMETRO DIGITAL AUTOMOTIVO MINIPA COM TRUE RMS', quantidade: 1 },
      { id: '2', nome: 'CANETA DE POLARIDADE 12V/24V COM DISPLAY', quantidade: 1 },
      { id: '3', nome: 'ALICATE DECAPADOR E CRIMPADOR AUTOMÁTICO', quantidade: 1 },
      { id: '4', nome: 'JOGO DE CHAVES DE FENDA E PHILLIPS ISOLADAS', quantidade: 1 },
      { id: '5', nome: 'FERRO DE SOLDA 60W 110V/220V COM SUPORTE', quantidade: 1 },
      { id: '6', nome: 'TESTADOR DE RELÉS AUTOMOTIVOS', quantidade: 1 },
    ],
    observacoes: 'Kit exclusivo para diagnóstico e chicotes elétricos',
    created_at: new Date().toISOString(),
  },
  {
    id: 'caixa_03',
    nome: 'CAIXA 03 - PNEUMÁTICA & PNEUS',
    codigo: 'CX-003',
    localizacao: 'BOX DE PNEUS / PAREDE SUL',
    status: 'disponivel',
    foto_url: null,
    itens: [
      { id: '1', nome: 'CHAVE DE IMPACTO PNEUMÁTICA 3/4" PISTOLA', quantidade: 1 },
      { id: '2', nome: 'SOQUETE DE IMPACTO 32MM LONGO PARA RODA', quantidade: 1 },
      { id: '3', nome: 'SOQUETE DE IMPACTO 33MM LONGO PARA RODA', quantidade: 1 },
      { id: '4', nome: 'CALIBRADOR DE PNEUS DIGITAL COM GATILHO', quantidade: 1 },
      { id: '5', nome: 'ESPATULA PARA PNEU CAMINHÃO 30"', quantidade: 2 },
      { id: '6', nome: 'ENGATE RÁPIDO PNEUMÁTICO 1/2"', quantidade: 2 },
    ],
    observacoes: 'Kit para socorro de borracharia e troca de rodas',
    created_at: new Date().toISOString(),
  },
]

const CATEGORIAS_FERRAMENTAS = [
  'TODAS',
  'CHAVES E SOQUETES',
  'PNEUMÁTICA',
  'ELÉTRICA E BATERIA',
  'HIDRÁULICA',
  'MEDIÇÃO E DIAGNÓSTICO',
  'CORTE E DESBASTE',
  'GERAL',
]

const CATEGORIAS_ESPECIAIS = [
  'TODAS',
  'SACADORES E EXTRATORES',
  'GABARITOS E TRAVAS',
  'SCANNERS E DIAGNÓSTICO',
  'TORQUÍMETROS ESPECIAIS',
  'HIDRÁULICA PESADA',
  'ESPECIAL MOTORES',
  'GERAL',
]

const CATEGORIAS_INSUMOS = [
  'TODAS',
  'QUÍMICOS E SPRAYS',
  'ABRASIVOS E DISCOS',
  'FIXAÇÃO E PARAFUSOS',
  'EPI E SEGURANÇA',
  'SOLDA E CONSUMÍVEIS',
  'LIMPEZA E ESTOPA',
  'GERAL',
]

const CATEGORIAS_SUGERIDAS = Array.from(
  new Set([...CATEGORIAS_FERRAMENTAS, ...CATEGORIAS_ESPECIAIS, ...CATEGORIAS_INSUMOS])
)

export type AbaEstoque = 'ferramentas' | 'especiais' | 'insumos' | 'em_uso' | 'historico' | 'caixas'

function ScrollContainer({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const isDownRef = useRef(false)
  const startXRef = useRef(0)
  const scrollLeftRef = useRef(0)
  const isDraggingRef = useRef(false)

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return
    isDownRef.current = true
    isDraggingRef.current = false
    startXRef.current = e.pageX - containerRef.current.offsetLeft
    scrollLeftRef.current = containerRef.current.scrollLeft
  }

  const handleMouseLeave = () => {
    isDownRef.current = false
    isDraggingRef.current = false
  }

  const handleMouseUp = () => {
    isDownRef.current = false
    setTimeout(() => {
      isDraggingRef.current = false
    }, 50)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDownRef.current || !containerRef.current) return
    e.preventDefault()
    const x = e.pageX - containerRef.current.offsetLeft
    const walk = (x - startXRef.current) * 1.6
    if (Math.abs(walk) > 4) {
      isDraggingRef.current = true
    }
    containerRef.current.scrollLeft = scrollLeftRef.current - walk
  }

  const handleWheel = (e: React.WheelEvent) => {
    if (!containerRef.current) return
    if (e.deltaY !== 0) {
      containerRef.current.scrollLeft += e.deltaY * 0.8
    }
  }

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseLeave={handleMouseLeave}
      onMouseUp={handleMouseUp}
      onMouseMove={handleMouseMove}
      onWheel={handleWheel}
      className={`overflow-x-auto select-none no-scrollbar cursor-grab active:cursor-grabbing ${className}`}
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      {children}
    </div>
  )
}

export function InventarioFerramentas() {
  const { user, perfil, perfilLoading } = useAuth()
  const userRef = perfil || { email: user?.email }
  const canAccess = perfil?.nivel === 'admin' || isEstoqueAuthorized(userRef)

  const [searchParams, setSearchParams] = useSearchParams()
  const abaParam = searchParams.get('aba')

  const [abaAtiva, setAbaAtivaState] = useState<'estoque' | 'em_uso' | 'historico' | 'caixas' | 'consumo'>(() => {
    if (abaParam && ['estoque', 'em_uso', 'historico', 'caixas', 'consumo'].includes(abaParam)) {
      return abaParam as 'estoque' | 'em_uso' | 'historico' | 'caixas' | 'consumo'
    }
    return 'estoque'
  })

  useEffect(() => {
    if (abaParam && ['estoque', 'em_uso', 'historico', 'caixas', 'consumo'].includes(abaParam)) {
      setAbaAtivaState(abaParam as 'estoque' | 'em_uso' | 'historico' | 'caixas' | 'consumo')
    } else if (!abaParam) {
      setAbaAtivaState('estoque')
    }
  }, [abaParam])

  const setAbaAtiva = (novaAba: 'estoque' | 'em_uso' | 'historico' | 'caixas' | 'consumo') => {
    setAbaAtivaState(novaAba)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (novaAba === 'estoque') {
        next.delete('aba')
      } else {
        next.set('aba', novaAba)
      }
      return next
    })
  }

  const [tipoFiltro, setTipoFiltro] = useState<'ferramentas' | 'especiais' | 'insumos'>('ferramentas')
  const [busca, setBusca] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState('TODAS')
  const [modoVisualizacao, setModoVisualizacao] = useState<'lista' | 'grid'>('lista')

  // Caixas de Ferramentas State
  const [caixas, setCaixas] = useState<CaixaFerramenta[]>(CAIXAS_INICIAIS)
  const [buscaCaixas, setBuscaCaixas] = useState('')
  const [statusFiltroCaixas, setStatusFiltroCaixas] = useState<'TODOS' | 'disponivel' | 'em_uso' | 'manutencao'>('TODOS')
  const [modalCaixaAberto, setModalCaixaAberto] = useState(false)
  const [caixaEditando, setCaixaEditando] = useState<CaixaFerramenta | null>(null)
  const [modalRetiradaCaixaAberto, setModalRetiradaCaixaAberto] = useState(false)
  const [caixaParaRetirar, setCaixaParaRetirar] = useState<CaixaFerramenta | null>(null)

  // Uso e Consumo State
  const [itensConsumo, setItensConsumo] = useState<ItemConsumo[]>(ITENS_CONSUMO_INICIAIS)
  const [baixasConsumo, setBaixasConsumo] = useState<RegistroBaixaConsumo[]>([])

  // Carregar dados do localStorage de forma assíncrona para não bloquear o primeiro render
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const rawCaixas = localStorage.getItem(STORAGE_CAIXAS_KEY)
        if (rawCaixas) setCaixas(JSON.parse(rawCaixas))
      } catch {}
      try {
        const rawConsumo = localStorage.getItem(STORAGE_CONSUMO_KEY)
        if (rawConsumo) setItensConsumo(JSON.parse(rawConsumo))
      } catch {}
      try {
        const rawBaixas = localStorage.getItem(STORAGE_BAIXAS_CONSUMO_KEY)
        if (rawBaixas) setBaixasConsumo(JSON.parse(rawBaixas))
      } catch {}
    }, 50)
    return () => clearTimeout(timer)
  }, [])

  function salvarCaixas(novasCaixas: CaixaFerramenta[]) {
    setCaixas(novasCaixas)
    try {
      localStorage.setItem(STORAGE_CAIXAS_KEY, JSON.stringify(novasCaixas))
    } catch {}
  }

  function salvarItensConsumo(novosItens: ItemConsumo[]) {
    setItensConsumo(novosItens)
    try {
      localStorage.setItem(STORAGE_CONSUMO_KEY, JSON.stringify(novosItens))
    } catch {}
  }

  function salvarBaixasConsumo(novasBaixas: RegistroBaixaConsumo[]) {
    setBaixasConsumo(novasBaixas)
    try {
      localStorage.setItem(STORAGE_BAIXAS_CONSUMO_KEY, JSON.stringify(novasBaixas))
    } catch {}
  }

  const [buscaConsumo, setBuscaConsumo] = useState('')
  const deferredBusca = useDeferredValue(busca)
  const deferredBuscaCaixas = useDeferredValue(buscaCaixas)
  const deferredBuscaConsumo = useDeferredValue(buscaConsumo)

  const [categoriaConsumoFiltro, setCategoriaConsumoFiltro] = useState('TODAS')
  const [subAbaConsumo, setSubAbaConsumo] = useState<'estoque' | 'historico'>('estoque')
  const [modalItemConsumoAberto, setModalItemConsumoAberto] = useState(false)
  const [itemConsumoEditando, setItemConsumoEditando] = useState<ItemConsumo | null>(null)
  const [modalBaixaConsumoAberto, setModalBaixaConsumoAberto] = useState(false)
  const [itemConsumoParaBaixa, setItemConsumoParaBaixa] = useState<ItemConsumo | null>(null)
  const [modalEntradaConsumoAberto, setModalEntradaConsumoAberto] = useState(false)
  const [itemConsumoParaEntrada, setItemConsumoParaEntrada] = useState<ItemConsumo | null>(null)

  const itensConsumoFiltrados = useMemo(() => {
    const termo = deferredBuscaConsumo.trim().toLowerCase()
    return itensConsumo.filter((item) => {
      const matchBusca =
        !termo ||
        item.nome.toLowerCase().includes(termo) ||
        (item.codigo && item.codigo.toLowerCase().includes(termo)) ||
        (item.localizacao && item.localizacao.toLowerCase().includes(termo))

      const matchCat =
        categoriaConsumoFiltro === 'TODAS' ||
        item.categoria.toUpperCase() === categoriaConsumoFiltro.toUpperCase()

      return matchBusca && matchCat
    })
  }, [itensConsumo, deferredBuscaConsumo, categoriaConsumoFiltro])

  const alertasEstoqueBaixoCount = useMemo(() => {
    return itensConsumo.filter((item) => item.quantidade_atual <= item.quantidade_minima).length
  }, [itensConsumo])

  const metricasConsumo = useMemo(() => {
    const totalItens = itensConsumo.length
    const totalUnidades = itensConsumo.reduce((acc, it) => acc + (it.quantidade_atual || 0), 0)
    const emAlerta = itensConsumo.filter((it) => it.quantidade_atual <= it.quantidade_minima).length
    const totalBaixas = baixasConsumo.length
    return { totalItens, totalUnidades, emAlerta, totalBaixas }
  }, [itensConsumo, baixasConsumo])

  // Hooks de ferramentas e retiradas
  const { ferramentas, loading: loadingFerramentas, refetch: refetchFerramentas } = useFerramentas()
  const { retiradas, loading: loadingRetiradas, refetch: refetchRetiradas } = useRetiradasFerramentas()

  // Lista de veículos cadastrados para autocomplete de placas
  const [veiculosLista, setVeiculosLista] = useState<{ id: string; placa: string }[]>([])

  useEffect(() => {
    supabase
      .from('veiculos')
      .select('id, placa')
      .order('placa', { ascending: true })
      .then(({ data }) => {
        if (data) setVeiculosLista(data)
      })
  }, [])

  // Modais
  const [modalFerramentaAberto, setModalFerramentaAberto] = useState(false)
  const [ferramentaEditando, setFerramentaEditando] = useState<Ferramenta | null>(null)

  const [modalRetiradaAberto, setModalRetiradaAberto] = useState(false)
  const [ferramentaSelecionadaParaRetirada, setFerramentaSelecionadaParaRetirada] = useState<Ferramenta | null>(null)

  const [modalDevolucaoAberto, setModalDevolucaoAberto] = useState(false)
  const [retiradaParaDevolver, setRetiradaParaDevolver] = useState<FerramentaRetirada | null>(null)
  const [modalEditarRetiradaAberto, setModalEditarRetiradaAberto] = useState(false)
  const [retiradaEditando, setRetiradaEditando] = useState<FerramentaRetirada | null>(null)
  const [fotoModalUrl, setFotoModalUrl] = useState<{ url: string; titulo: string } | null>(null)
  const [ferramentaHistorico, setFerramentaHistorico] = useState<Ferramenta | null>(null)

  // Mensagens de erro/sucesso
  const [mensagemErro, setMensagemErro] = useState<string | null>(null)

  // Métricas
  const metricas = useMemo(() => {
    const totalItens = ferramentas.reduce((acc, f) => acc + (f.quantidade_total || 0), 0)
    const disponiveis = ferramentas.reduce((acc, f) => acc + (f.quantidade_disponivel || 0), 0)
    const emUso = retiradas.filter((r) => r.status === 'em_uso').reduce((acc, r) => acc + (r.quantidade || 0), 0)
    const retiradasAtivasCount = retiradas.filter((r) => r.status === 'em_uso').length

    return {
      totalTipos: ferramentas.length,
      totalItens,
      disponiveis,
      emUso,
      retiradasAtivasCount,
      totalHistorico: retiradas.length,
    }
  }, [ferramentas, retiradas])

  const [limiteExibicao, setLimiteExibicao] = useState(30)
  const [limiteHistorico, setLimiteHistorico] = useState(30)
  const [limiteCaixas, setLimiteCaixas] = useState(30)
  const [limiteConsumo, setLimiteConsumo] = useState(30)
  const [limiteHistoricoConsumo, setLimiteHistoricoConsumo] = useState(30)

  // Ferramentas comuns vs especiais vs insumos
  const ferramentasComuns = useMemo(() => {
    return ferramentas.filter(
      (f) => f.tipo_ferramenta !== 'especial' && !f.categoria?.toUpperCase().includes('ESPECIAL') && !f.categoria?.toUpperCase().includes('INSUMO')
    )
  }, [ferramentas])

  const ferramentasEspeciais = useMemo(() => {
    return ferramentas.filter(
      (f) => f.tipo_ferramenta === 'especial' || f.categoria?.toUpperCase().includes('ESPECIAL')
    )
  }, [ferramentas])

  const ferramentasInsumos = useMemo(() => {
    return ferramentas.filter(
      (f) => f.categoria?.toUpperCase().includes('INSUMO')
    )
  }, [ferramentas])

  // Categorias ativas para o tipo selecionado (Ferramentas, Ferramentas Especiais, Insumos)
  const categoriasAtivas = useMemo(() => {
    if (tipoFiltro === 'ferramentas') {
      const customCats = Array.from(new Set(ferramentasComuns.map((f) => f.categoria?.toUpperCase()).filter(Boolean))) as string[]
      return Array.from(new Set([...CATEGORIAS_FERRAMENTAS, ...customCats]))
    }
    if (tipoFiltro === 'especiais') {
      const customCats = Array.from(new Set(ferramentasEspeciais.map((f) => f.categoria?.toUpperCase()).filter(Boolean))) as string[]
      return Array.from(new Set([...CATEGORIAS_ESPECIAIS, ...customCats]))
    }
    if (tipoFiltro === 'insumos') {
      const customCats = Array.from(new Set(itensConsumo.map((i) => i.categoria?.toUpperCase()).filter(Boolean))) as string[]
      return Array.from(new Set([...CATEGORIAS_INSUMOS, ...customCats]))
    }
    return ['TODAS']
  }, [tipoFiltro, ferramentasComuns, ferramentasEspeciais, itensConsumo])

  // Filtragem da lista ativa de acordo com o tipoFiltro
  const ferramentasFiltradas = useMemo(() => {
    const termo = deferredBusca.trim().toLowerCase()
    const baseList =
      tipoFiltro === 'especiais'
        ? ferramentasEspeciais
        : tipoFiltro === 'insumos'
        ? (ferramentasInsumos.length > 0 ? ferramentasInsumos : ferramentas.filter((f) => f.categoria?.toUpperCase().includes('INSUMO')))
        : ferramentasComuns

    return baseList.filter((f) => {
      const matchBusca =
        !termo ||
        f.nome.toLowerCase().includes(termo) ||
        (f.codigo && f.codigo.toLowerCase().includes(termo)) ||
        (f.localizacao && f.localizacao.toLowerCase().includes(termo))

      const matchCat =
        categoriaFiltro === 'TODAS' ||
        (f.categoria && f.categoria.toUpperCase() === categoriaFiltro.toUpperCase())

      return matchBusca && matchCat
    })
  }, [tipoFiltro, ferramentasComuns, ferramentasEspeciais, ferramentasInsumos, ferramentas, deferredBusca, categoriaFiltro])

  // Retiradas ativas
  const retiradasAtivas = useMemo(() => {
    return retiradas.filter((r) => r.status === 'em_uso')
  }, [retiradas])

  // Caixas Filtradas
  const caixasFiltradas = useMemo(() => {
    const termo = deferredBuscaCaixas.trim().toLowerCase()
    return caixas.filter((c) => {
      const matchBusca =
        !termo ||
        c.nome.toLowerCase().includes(termo) ||
        (c.codigo && c.codigo.toLowerCase().includes(termo)) ||
        (c.placa && c.placa.toLowerCase().includes(termo)) ||
        (c.responsavel && c.responsavel.toLowerCase().includes(termo))

      const matchStatus = statusFiltroCaixas === 'TODOS' || c.status === statusFiltroCaixas
      return matchBusca && matchStatus
    })
  }, [caixas, deferredBuscaCaixas, statusFiltroCaixas])

  // Recarrega tudo
  const recarregarDados = async () => {
    await Promise.all([refetchFerramentas(), refetchRetiradas()])
  }

  // Deletar ferramenta
  const handleExcluirFerramenta = async (f: Ferramenta) => {
    if (!confirm(`DESEJA REALMENTE EXCLUIR A FERRAMENTA "${f.nome.toUpperCase()}" DO CATÁLOGO?`)) return
    try {
      setMensagemErro(null)
      await excluirFerramenta(f.id)
      await recarregarDados()
    } catch (err) {
      setMensagemErro(err instanceof Error ? err.message : 'ERRO AO EXCLUIR FERRAMENTA.')
    }
  }

  // Reverter devolução / baixa (voltar para em uso)
  const handleReverterDevolucao = async (r: FerramentaRetirada) => {
    if (!confirm(`DESEJA RESTAURAR A RETIRADA DE "${r.ferramenta?.nome || 'FERRAMENTA'}" PARA O STATUS "EM USO NO MOMENTO"?`)) return
    try {
      setMensagemErro(null)
      await reverterDevolucaoFerramenta(r.id)
      await recarregarDados()
      setAbaAtiva('em_uso')
    } catch (err) {
      setMensagemErro(err instanceof Error ? err.message : 'ERRO AO RESTAURAR RETIRADA.')
    }
  }

  if (perfilLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center uppercase">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-secondary/30 border-t-primary" />
      </div>
    )
  }

  if (!canAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 space-y-4 uppercase">
        <div className="h-16 w-16 rounded-2xl bg-status-danger/10 border border-status-danger/30 flex items-center justify-center text-status-danger">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <div className="space-y-1.5 max-w-md">
          <h2 className="text-xl font-black text-foreground tracking-tight">ACESSO RESTRITO</h2>
          <p className="text-xs text-secondary leading-relaxed">
            O MÓDULO DE ESTOQUE É RESTRITO EXCLUSIVAMENTE AO USUÁRIO AUTORIZADO (INVENTARIO@GVELDIESEL.COM).
          </p>
        </div>
        <Button onClick={() => (window.location.href = '/')} variant="secondary" size="md" className="uppercase font-bold text-xs">
          VOLTAR AO INÍCIO
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-5 animate-fade-in pb-12 uppercase max-w-full overflow-x-hidden">
      {/* Cabeçalho */}
      <PageHeader
        title="ESTOQUE"
        subtitle="CONTROLE DE FERRAMENTAS, CONSUMÍVEIS, CAIXAS E PATRIMÔNIO"
        actions={
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setFerramentaSelecionadaParaRetirada(null)
                setModalRetiradaAberto(true)
              }}
              className="w-full !px-3 !py-2 border-primary/30 text-foreground hover:border-primary uppercase font-bold text-[11px] sm:text-xs gap-1.5"
            >
              <ArrowUpRight className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="truncate">RETIRAR</span>
            </Button>
            <Button
              type="button"
              onClick={() => {
                setFerramentaEditando(null)
                setModalFerramentaAberto(true)
              }}
              className="w-full !px-3 !py-2 uppercase font-bold text-[11px] sm:text-xs gap-1.5"
            >
              <Plus className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">NOVA FERRAMENTA</span>
            </Button>
          </div>
        }
      />

      {mensagemErro && (
        <div className="rounded-xl border border-status-danger/30 bg-status-danger/10 p-4 text-sm text-status-danger flex items-center justify-between uppercase">
          <span>{mensagemErro}</span>
          <button onClick={() => setMensagemErro(null)} className="text-status-danger hover:opacity-75">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Cards de Métricas Superiores */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
        {/* Catálogo */}
        <div className="relative overflow-hidden rounded-2xl border border-border/30 bg-surface/90 p-3 sm:p-5 shadow-sm hover:border-primary/40 transition-all backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-secondary truncate">
              Catálogo Geral
            </span>
            <div className="flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
              <Hammer className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl sm:text-3xl font-black font-mono tracking-tight text-foreground">
            {loadingFerramentas ? '—' : metricas.totalTipos}
          </p>
          <div className="mt-1 flex items-center justify-between text-[10px] sm:text-xs text-secondary font-medium truncate">
            <span className="truncate">{metricas.totalItens} UNID. TOTAIS</span>
            <span className="text-[9px] sm:text-[10px] text-primary/80 font-bold uppercase shrink-0">ATIVO</span>
          </div>
        </div>

        {/* Disponíveis */}
        <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-surface/90 p-3 sm:p-5 shadow-sm hover:border-emerald-500/40 transition-all backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-emerald-500 truncate">
              No Estoque
            </span>
            <div className="flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shrink-0">
              <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl sm:text-3xl font-black font-mono tracking-tight text-emerald-500">
            {loadingFerramentas ? '—' : metricas.disponiveis}
          </p>
          <div className="mt-1 flex items-center justify-between text-[10px] sm:text-xs text-secondary font-medium truncate">
            <span className="truncate">PARA RETIRADA</span>
            <span className="text-[9px] sm:text-[10px] text-emerald-500 font-bold uppercase shrink-0">LIVRES</span>
          </div>
        </div>

        {/* Em Uso */}
        <div className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-surface/90 p-3 sm:p-5 shadow-sm hover:border-amber-500/40 transition-all backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-amber-500 truncate">
              Em Uso
            </span>
            <div className="flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 shrink-0">
              <Truck className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl sm:text-3xl font-black font-mono tracking-tight text-amber-500">
            {loadingRetiradas ? '—' : metricas.emUso}
          </p>
          <div className="mt-1 flex items-center justify-between text-[10px] sm:text-xs text-secondary font-medium truncate">
            <span className="truncate">{metricas.retiradasAtivasCount} ATIVAS</span>
            <span className="text-[9px] sm:text-[10px] text-amber-500 font-bold uppercase shrink-0">CAMPO</span>
          </div>
        </div>

        {/* Histórico */}
        <div className="relative overflow-hidden rounded-2xl border border-border/30 bg-surface/90 p-3 sm:p-5 shadow-sm hover:border-border/60 transition-all backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-secondary truncate">
              Movimentações
            </span>
            <div className="flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-overlay/10 text-secondary border border-border/20 shrink-0">
              <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl sm:text-3xl font-black font-mono tracking-tight text-foreground">
            {loadingRetiradas ? '—' : metricas.totalHistorico}
          </p>
          <div className="mt-1 flex items-center justify-between text-[10px] sm:text-xs text-secondary font-medium truncate">
            <span className="truncate">HISTÓRICO</span>
            <span className="text-[9px] sm:text-[10px] text-secondary font-bold uppercase shrink-0">TOTAL</span>
          </div>
        </div>
      </div>

      {/* Barra de Abas Principal (5 Abas Originais do Fluxo de Trabalho do Estoque) */}
      <ScrollContainer className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-surface/80 border border-border/25 shadow-sm backdrop-blur-md">
        <button
          type="button"
          onClick={() => setAbaAtiva('estoque')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap shrink-0 ${
            abaAtiva === 'estoque'
              ? 'bg-primary text-white shadow-md shadow-primary/20'
              : 'text-secondary hover:text-foreground hover:bg-surface-hover/50'
          }`}
        >
          <Package className="h-4 w-4" />
          ESTOQUE DE FERRAMENTAS
          <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
            abaAtiva === 'estoque' ? 'bg-white/20 text-white' : 'bg-overlay/10 text-secondary'
          }`}>
            {ferramentas.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setAbaAtiva('em_uso')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap shrink-0 ${
            abaAtiva === 'em_uso'
              ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
              : 'text-secondary hover:text-foreground hover:bg-surface-hover/50'
          }`}
        >
          <Truck className="h-4 w-4" />
          EM USO NO MOMENTO
          {metricas.retiradasAtivasCount > 0 && (
            <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
              abaAtiva === 'em_uso' ? 'bg-white/25 text-white' : 'bg-amber-500/20 text-amber-500'
            }`}>
              {metricas.retiradasAtivasCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setAbaAtiva('historico')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap shrink-0 ${
            abaAtiva === 'historico'
              ? 'bg-primary text-white shadow-md shadow-primary/20'
              : 'text-secondary hover:text-foreground hover:bg-surface-hover/50'
          }`}
        >
          <Clock className="h-4 w-4" />
          HISTÓRICO DE RETIRADAS
        </button>

        <button
          type="button"
          onClick={() => setAbaAtiva('caixas')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap shrink-0 ${
            abaAtiva === 'caixas'
              ? 'bg-primary text-white shadow-md shadow-primary/20'
              : 'text-secondary hover:text-foreground hover:bg-surface-hover/50'
          }`}
        >
          <Briefcase className="h-4 w-4" />
          CAIXAS DE FERRAMENTAS
          <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
            abaAtiva === 'caixas' ? 'bg-white/20 text-white' : 'bg-overlay/10 text-secondary'
          }`}>
            {caixas.length}
          </span>
          {caixas.filter((c) => c.status === 'em_uso').length > 0 && (
            <span className="rounded-full bg-amber-500/20 px-1.5 py-0.2 text-[10px] font-black text-amber-500">
              {caixas.filter((c) => c.status === 'em_uso').length} em uso
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setAbaAtiva('consumo')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap shrink-0 ${
            abaAtiva === 'consumo'
              ? 'bg-primary text-white shadow-md shadow-primary/20'
              : 'text-secondary hover:text-foreground hover:bg-surface-hover/50'
          }`}
        >
          <Boxes className="h-4 w-4" />
          USO E CONSUMO
          <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
            abaAtiva === 'consumo' ? 'bg-white/20 text-white' : 'bg-overlay/10 text-secondary'
          }`}>
            {itensConsumo.length}
          </span>
          {alertasEstoqueBaixoCount > 0 && (
            <span className="rounded-full bg-red-500/20 px-1.5 py-0.2 text-[10px] font-black text-red-400">
              {alertasEstoqueBaixoCount} alerta
            </span>
          )}
        </button>
      </ScrollContainer>

      {/* ==================== ABA 1: ESTOQUE DE FERRAMENTAS ==================== */}
      {abaAtiva === 'estoque' && (
        <div className="space-y-4">
          {/* Barra de Filtros: Linha 1 (Tipos + Categorias) & Linha 2 (Busca + Alternador) */}
          <div className="space-y-3">
            {/* Linha 1: 3 Abas de Tipos e Filtro de Categoria em destaque */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
              {/* 3 Abas de Tipos (Ferramentas, Ferramentas Especiais, Insumos) */}
              <ScrollContainer className="flex items-center gap-1.5 p-1 rounded-2xl bg-surface/80 border border-border/20 shadow-sm shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setTipoFiltro('ferramentas')
                    setCategoriaFiltro('TODAS')
                  }}
                  className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 uppercase ${
                    tipoFiltro === 'ferramentas'
                      ? 'bg-primary text-white shadow-sm shadow-primary/20'
                      : 'text-secondary hover:text-foreground hover:bg-surface-hover/50'
                  }`}
                >
                  <Hammer className="h-3.5 w-3.5" />
                  FERRAMENTAS
                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                    tipoFiltro === 'ferramentas' ? 'bg-white/20 text-white' : 'bg-overlay/10 text-secondary'
                  }`}>
                    {ferramentasComuns.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTipoFiltro('especiais')
                    setCategoriaFiltro('TODAS')
                  }}
                  className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 uppercase ${
                    tipoFiltro === 'especiais'
                      ? 'bg-primary text-white shadow-sm shadow-primary/20'
                      : 'text-secondary hover:text-foreground hover:bg-surface-hover/50'
                  }`}
                >
                  <Wrench className="h-3.5 w-3.5" />
                  FERRAMENTAS ESPECIAIS
                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                    tipoFiltro === 'especiais' ? 'bg-white/20 text-white' : 'bg-overlay/10 text-secondary'
                  }`}>
                    {ferramentasEspeciais.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTipoFiltro('insumos')
                    setCategoriaFiltro('TODAS')
                  }}
                  className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 uppercase ${
                    tipoFiltro === 'insumos'
                      ? 'bg-primary text-white shadow-sm shadow-primary/20'
                      : 'text-secondary hover:text-foreground hover:bg-surface-hover/50'
                  }`}
                >
                  <Boxes className="h-3.5 w-3.5" />
                  INSUMOS
                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                    tipoFiltro === 'insumos' ? 'bg-white/20 text-white' : 'bg-overlay/10 text-secondary'
                  }`}>
                    {itensConsumo.length}
                  </span>
                </button>
              </ScrollContainer>

              {/* Filtro de Categoria (Totalmente Visível e em Destaque) */}
              <div className="w-full md:w-80 shrink-0">
                <select
                  value={categoriaFiltro}
                  onChange={(e) => setCategoriaFiltro(e.target.value)}
                  className="h-11 w-full rounded-2xl border border-border/25 bg-surface/90 px-3.5 text-xs font-bold text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary uppercase shadow-sm cursor-pointer transition-all"
                >
                  <option value="TODAS">TODAS AS CATEGORIAS ({categoriasAtivas.length - 1})</option>
                  {categoriasAtivas
                    .filter((c) => c !== 'TODAS')
                    .map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {/* Linha 2: Busca e Alternador de Grade/Lista */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary" />
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar por nome, código ou localização..."
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

              {/* Alternador Lista / Grade */}
              <div className="flex items-center rounded-2xl border border-border/25 bg-surface/90 p-1 shrink-0 shadow-sm">
                <button
                  type="button"
                  onClick={() => setModoVisualizacao('lista')}
                  className={`rounded-xl p-2 transition-colors cursor-pointer ${
                    modoVisualizacao === 'lista'
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-secondary hover:text-foreground'
                  }`}
                  title="Visualização em Lista"
                  aria-label="Visualização em Lista"
                >
                  <LayoutList className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setModoVisualizacao('grid')}
                  className={`rounded-xl p-2 transition-colors cursor-pointer ${
                    modoVisualizacao === 'grid'
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-secondary hover:text-foreground'
                  }`}
                  title="Visualização em Grade"
                  aria-label="Visualização em Grade"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Lista do Estoque */}
          {loadingFerramentas ? (
            <div className="flex min-h-[30vh] items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-secondary/30 border-t-primary" />
            </div>
          ) : ferramentasFiltradas.length === 0 ? (
            <Card className="p-12 text-center uppercase">
              <Hammer className="mx-auto mb-3 h-10 w-10 text-secondary/40" />
              <p className="text-base font-bold text-foreground">Nenhuma ferramenta encontrada</p>
              <p className="mt-1 text-xs text-secondary">
                {busca || categoriaFiltro !== 'TODAS'
                  ? 'Tente alterar os filtros de busca.'
                  : 'Cadastre sua primeira ferramenta clicando no botão "Nova Ferramenta".'}
              </p>
            </Card>
          ) : modoVisualizacao === 'lista' ? (
            <div className="space-y-2">
              {/* Desktop: Lista / Tabela de Estoque em Grid */}
              <div className="hidden md:block overflow-hidden rounded-2xl border border-border/25 bg-surface/70 shadow-sm backdrop-blur-sm">
                <div className="grid grid-cols-[130px_minmax(220px,1fr)_160px_160px_130px_140px] items-center gap-3 border-b border-border/15 bg-surface/90 px-4 py-3 text-[11px] font-black text-secondary uppercase tracking-wider">
                  <div>CÓDIGO</div>
                  <div>FERRAMENTA / DESCRIÇÃO</div>
                  <div>CATEGORIA</div>
                  <div>LOCALIZAÇÃO</div>
                  <div className="text-center">ESTOQUE</div>
                  <div className="text-right">AÇÕES</div>
                </div>

                <div className="divide-y divide-border/10">
                  {ferramentasFiltradas.slice(0, limiteExibicao).map((f) => {
                    const total = f.quantidade_total || 1
                    const disp = f.quantidade_disponivel || 0
                    const emUsoQtd = total - disp
                    const semEstoque = disp <= 0
                    const percentualDisp = Math.max(0, Math.min(100, Math.round((disp / total) * 100)))

                    return (
                      <div
                        key={f.id}
                        className="grid grid-cols-[130px_minmax(220px,1fr)_160px_160px_130px_140px] items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-hover/30 group"
                      >
                        {/* CÓDIGO & FOTO */}
                        <div className="flex items-center gap-2.5 min-w-0">
                          {f.foto_url ? (
                            <button
                              type="button"
                              onClick={() => setFotoModalUrl({ url: f.foto_url!, titulo: f.nome })}
                              className="relative group/thumb h-9 w-9 shrink-0 overflow-hidden rounded-xl border border-primary/30 bg-background shadow-sm cursor-pointer hover:border-primary transition-all"
                              title="Ver foto ampliada"
                            >
                              <img
                                src={f.foto_url}
                                alt={f.nome}
                                loading="lazy"
                                decoding="async"
                                className="h-full w-full object-cover group-hover/thumb:scale-110 transition-transform duration-200"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-opacity">
                                <Eye className="h-3.5 w-3.5 text-white" />
                              </div>
                            </button>
                          ) : (
                            <div className="h-9 w-9 shrink-0 flex items-center justify-center rounded-xl border border-border/20 bg-background text-secondary/50">
                              <Hammer className="h-4 w-4" />
                            </div>
                          )}
                          <span className="inline-flex rounded-lg bg-background border border-border/30 px-2 py-0.5 text-xs font-mono font-bold text-foreground truncate max-w-[85px]">
                            {f.codigo || 'S/ CÓD'}
                          </span>
                        </div>

                        {/* FERRAMENTA / DESCRIÇÃO */}
                        <div
                          className="min-w-0 pr-2 cursor-pointer group/item"
                          onClick={() => setFerramentaHistorico(f)}
                          title="Clique para ver o histórico de saídas e placas desta ferramenta"
                        >
                          <div className="font-bold text-foreground text-xs leading-snug truncate group-hover/item:text-primary transition-colors flex items-center gap-1.5">
                            <span>{f.nome}</span>
                            <span className="text-[10px] text-primary/80 opacity-0 group-hover/item:opacity-100 transition-opacity font-semibold">
                              (ver saídas 🔍)
                            </span>
                          </div>
                          {f.observacoes && (
                            <div className="text-[11px] text-secondary line-clamp-1 italic mt-0.5 truncate font-normal">
                              "{f.observacoes}"
                            </div>
                          )}
                        </div>

                        {/* CATEGORIA */}
                        <div className="truncate cursor-pointer" onClick={() => setFerramentaHistorico(f)}>
                          <span className="rounded-lg bg-overlay/5 border border-border/20 px-2.5 py-1 text-[10px] font-black text-secondary tracking-wider truncate inline-block max-w-full hover:border-primary/40 transition-colors">
                            {f.categoria || 'GERAL'}
                          </span>
                        </div>

                        {/* LOCALIZAÇÃO */}
                        <div className="truncate cursor-pointer" onClick={() => setFerramentaHistorico(f)}>
                          {f.localizacao ? (
                            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5 truncate">
                              <Layers className="h-3.5 w-3.5 text-secondary shrink-0" />
                              <span className="truncate">{f.localizacao}</span>
                            </span>
                          ) : (
                            <span className="text-xs text-secondary/50">—</span>
                          )}
                        </div>

                        {/* ESTOQUE DISP. COM BARRA VISUAL */}
                        <div className="flex flex-col items-center cursor-pointer" onClick={() => setFerramentaHistorico(f)}>
                          <div className="flex items-center gap-1">
                            <span className={`text-sm font-black font-mono tabular-nums ${semEstoque ? 'text-status-danger' : 'text-emerald-500'}`}>
                              {disp}
                            </span>
                            <span className="text-xs text-secondary font-mono">/ {total}</span>
                          </div>
                          {/* Mini barra de estoque */}
                          <div className="w-16 h-1 bg-border/20 rounded-full overflow-hidden mt-1">
                            <div
                              className={`h-full transition-all duration-300 ${
                                semEstoque ? 'bg-status-danger w-0' : disp === total ? 'bg-emerald-500' : 'bg-amber-500'
                              }`}
                              style={{ width: `${percentualDisp}%` }}
                            />
                          </div>
                          {emUsoQtd > 0 && (
                            <span className="text-[9px] font-black text-amber-500 mt-0.5">
                              {emUsoQtd} em uso
                            </span>
                          )}
                        </div>

                        {/* AÇÕES */}
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            type="button"
                            size="md"
                            disabled={semEstoque}
                            onClick={(e) => {
                              e.stopPropagation()
                              setFerramentaSelecionadaParaRetirada(f)
                              setModalRetiradaAberto(true)
                            }}
                            className="!h-8 !px-3 !text-xs gap-1 uppercase font-bold bg-primary hover:bg-primary/90 text-white shadow-sm"
                          >
                            <ArrowUpRight className="h-3.5 w-3.5" />
                            RETIRAR
                          </Button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setFerramentaEditando(f)
                              setModalFerramentaAberto(true)
                            }}
                            className="rounded-lg p-1.5 text-secondary hover:bg-overlay/10 hover:text-foreground transition-colors cursor-pointer"
                            title="Editar Ferramenta"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleExcluirFerramenta(f)
                            }}
                            className="rounded-lg p-1.5 text-secondary hover:bg-status-danger/10 hover:text-status-danger transition-colors cursor-pointer"
                            title="Excluir Ferramenta"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Mobile: Lista Compacta e Fluida */}
              <div className="md:hidden space-y-2.5">
                {ferramentasFiltradas.slice(0, limiteExibicao).map((f) => {
                  const total = f.quantidade_total || 1
                  const disp = f.quantidade_disponivel || 0
                  const emUsoQtd = total - disp
                  const semEstoque = disp <= 0

                  return (
                    <div
                      key={f.id}
                      onClick={() => setFerramentaHistorico(f)}
                      className="rounded-2xl border border-border/25 bg-surface/80 p-3.5 space-y-2.5 transition-all shadow-sm cursor-pointer hover:border-primary/40 active:scale-[0.99]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded-lg bg-background border border-border/30 px-2 py-0.5 text-[11px] font-mono font-bold text-foreground">
                            {f.codigo || 'S/ CÓD'}
                          </span>
                          <span className="rounded-lg bg-overlay/5 border border-border/20 px-2 py-0.5 text-[10px] font-black uppercase text-secondary tracking-wider">
                            {f.categoria || 'GERAL'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className={`text-sm font-black font-mono tabular-nums ${semEstoque ? 'text-status-danger' : 'text-emerald-500'}`}>
                            {disp}
                          </span>
                          <span className="text-xs text-secondary font-mono">/ {total}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {f.foto_url ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setFotoModalUrl({ url: f.foto_url!, titulo: f.nome })
                            }}
                            className="h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-primary/30 shadow-sm"
                          >
                            <img src={f.foto_url} alt={f.nome} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                          </button>
                        ) : (
                          <div className="h-11 w-11 shrink-0 flex items-center justify-center rounded-xl bg-background border border-border/20 text-secondary/50">
                            <Hammer className="h-5 w-5" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-xs text-foreground truncate">{f.nome}</p>
                          {f.localizacao && (
                            <p className="text-[11px] text-secondary font-medium truncate mt-0.5">
                              📍 {f.localizacao}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-border/10">
                        {emUsoQtd > 0 ? (
                          <span className="text-[10px] font-black text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                            {emUsoQtd} em uso
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-emerald-500">Pronta no estoque</span>
                        )}

                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                            type="button"
                            size="md"
                            disabled={semEstoque}
                            onClick={(e) => {
                              e.stopPropagation()
                              setFerramentaSelecionadaParaRetirada(f)
                              setModalRetiradaAberto(true)
                            }}
                            className="!h-8 !px-3 !text-xs gap-1 uppercase font-bold"
                          >
                            <ArrowUpRight className="h-3.5 w-3.5" />
                            RETIRAR
                          </Button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setFerramentaEditando(f)
                              setModalFerramentaAberto(true)
                            }}
                            className="p-1.5 rounded-lg text-secondary hover:text-foreground"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleExcluirFerramenta(f)
                            }}
                            className="p-1.5 rounded-lg text-secondary hover:text-red-400"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Botão Carregar Mais no Modo Lista */}
              {ferramentasFiltradas.length > limiteExibicao && (
                <div className="pt-3 text-center">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setLimiteExibicao((prev) => prev + 40)}
                    className="!py-2.5 !px-5 text-xs font-black uppercase tracking-wider gap-2 border-primary/30 text-primary hover:border-primary w-full sm:w-auto"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    CARREGAR MAIS (+40 DE {ferramentasFiltradas.length - limiteExibicao} RESTANTES)
                  </Button>
                </div>
              )}
            </div>
          ) : (
            /* Modo Grade (Grid) */
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {ferramentasFiltradas.slice(0, limiteExibicao).map((f) => {
                  const total = f.quantidade_total || 1
                  const disp = f.quantidade_disponivel || 0
                  const emUsoQtd = total - disp
                  const semEstoque = disp <= 0
                  const percentualDisp = Math.max(0, Math.min(100, Math.round((disp / total) * 100)))

                  return (
                    <Card
                      key={f.id}
                      onClick={() => setFerramentaHistorico(f)}
                      className="p-4 flex flex-col justify-between border border-border/25 bg-surface/80 hover:border-primary/40 transition-all shadow-sm group relative overflow-hidden cursor-pointer"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2.5">
                          <span className="rounded-lg bg-background border border-border/30 px-2 py-0.5 text-[11px] font-mono font-bold text-foreground">
                            {f.codigo || 'S/ CÓD'}
                          </span>
                          <span className="rounded-lg bg-overlay/5 border border-border/20 px-2 py-0.5 text-[10px] font-black text-secondary tracking-wider">
                            {f.categoria || 'GERAL'}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 my-2">
                          {f.foto_url ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setFotoModalUrl({ url: f.foto_url!, titulo: f.nome })
                              }}
                              className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-primary/30 shadow-sm"
                            >
                              <img src={f.foto_url} alt={f.nome} loading="lazy" decoding="async" className="h-full w-full object-cover group-hover:scale-105 transition-transform" />
                            </button>
                          ) : (
                            <div className="h-14 w-14 shrink-0 flex items-center justify-center rounded-xl bg-background border border-border/20 text-secondary/40 text-2xl">
                              🔧
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <h4 className="font-bold text-xs text-foreground uppercase truncate group-hover:text-primary transition-colors">
                              {f.nome}
                            </h4>
                            {f.localizacao && (
                              <p className="text-[11px] text-secondary font-medium truncate mt-0.5">
                                📍 {f.localizacao}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Barra de Estoque */}
                        <div className="my-2.5 rounded-xl bg-background/60 border border-border/15 p-2.5 space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-[10px] font-bold text-secondary uppercase">Disponibilidade</span>
                            <span className="font-mono font-black text-foreground">
                              {disp} <span className="text-secondary font-normal">/ {total}</span>
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-border/20 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-300 ${
                                semEstoque ? 'bg-status-danger w-0' : disp === total ? 'bg-emerald-500' : 'bg-amber-500'
                              }`}
                              style={{ width: `${percentualDisp}%` }}
                            />
                          </div>
                          {emUsoQtd > 0 && (
                            <p className="text-[10px] font-black text-amber-500 text-right">
                              {emUsoQtd} em uso agora
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-border/10 flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                        <Button
                          type="button"
                          size="md"
                          disabled={semEstoque}
                          onClick={(e) => {
                            e.stopPropagation()
                            setFerramentaSelecionadaParaRetirada(f)
                            setModalRetiradaAberto(true)
                          }}
                          className="!h-8 !px-3 !text-xs gap-1 uppercase font-bold flex-1 mr-2"
                        >
                          <ArrowUpRight className="h-3.5 w-3.5" />
                          RETIRAR
                        </Button>
                        <div className="flex items-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setFerramentaEditando(f)
                              setModalFerramentaAberto(true)
                            }}
                            className="p-1.5 rounded-lg text-secondary hover:text-foreground"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleExcluirFerramenta(f)
                            }}
                            className="p-1.5 rounded-lg text-secondary hover:text-red-400"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </div>

              {/* Botão Carregar Mais no Modo Grade */}
              {ferramentasFiltradas.length > limiteExibicao && (
                <div className="pt-3 text-center">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setLimiteExibicao((prev) => prev + 40)}
                    className="!py-2.5 !px-5 text-xs font-black uppercase tracking-wider gap-2 border-primary/30 text-primary hover:border-primary w-full sm:w-auto"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    CARREGAR MAIS (+40 DE {ferramentasFiltradas.length - limiteExibicao} RESTANTES)
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ==================== ABA 2: EM USO NO MOMENTO ==================== */}
      {abaAtiva === 'em_uso' && (
        <div className="space-y-4 uppercase">
          {loadingRetiradas ? (
            <div className="flex min-h-[30vh] items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-secondary/30 border-t-primary" />
            </div>
          ) : retiradasAtivas.length === 0 ? (
            <div className="space-y-4">
              <Card className="p-8 text-center uppercase space-y-3">
                <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
                <p className="text-base font-bold text-foreground">NENHUMA FERRAMENTA EM USO NO MOMENTO</p>
                <p className="text-sm text-secondary font-medium max-w-lg mx-auto">
                  TODAS AS FERRAMENTAS ESTÃO COM STATUS DEVOLVIDO/ESTOQUE. SE VOCÊ REGISTROU A BAIXA/DEVOLUÇÃO E QUER QUE ELAS VOLTEM A APARECER AQUI, RESTAURE-AS COM 1 CLIQUE ABAIXO:
                </p>
              </Card>

              {retiradas.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-secondary flex items-center gap-1.5">
                      <Clock className="h-4 w-4 text-primary" />
                      ÚLTIMAS RETIRADAS FINALIZADAS (CLIQUE PARA VOLTAR PARA EM USO):
                    </span>
                    <Button
                      type="button"
                      variant="secondary"
                      size="md"
                      onClick={() => setAbaAtiva('historico')}
                      className="text-[11px] font-black uppercase gap-1.5 border-border/30 hover:border-primary"
                    >
                      <Clock className="h-3.5 w-3.5" />
                      Ver Histórico Completo ({retiradas.length})
                    </Button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {retiradas.slice(0, 6).map((r) => (
                      <Card key={r.id} className="p-4 border-border/20 bg-surface/90 flex flex-col justify-between shadow-sm hover:border-primary/40 transition-all">
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="flex items-center gap-1 rounded-lg bg-primary/20 px-2.5 py-1 text-xs font-mono font-bold text-primary">
                              <Truck className="h-3.5 w-3.5" />
                              {r.placa}
                            </span>
                            <span className="text-[10px] text-secondary font-bold font-mono">
                              {r.data_hora_retirada ? format(new Date(r.data_hora_retirada), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : ''}
                            </span>
                          </div>
                          <h4 className="mt-2.5 text-sm font-bold text-foreground uppercase">{r.ferramenta?.nome || 'FERRAMENTA'}</h4>
                          <p className="text-xs text-secondary mt-1">
                            RESPONSÁVEL: <strong className="text-foreground font-bold">{r.responsavel}</strong>
                          </p>
                          {r.observacoes_retirada && (
                            <p className="text-[11px] text-secondary italic mt-1 line-clamp-1">"{r.observacoes_retirada}"</p>
                          )}
                        </div>
                        <div className="mt-3 pt-3 border-t border-border/10 flex items-center gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => {
                              setRetiradaEditando(r)
                              setModalEditarRetiradaAberto(true)
                            }}
                            className="!h-8 px-2 text-xs font-bold uppercase gap-1 border-primary/30 text-primary hover:border-primary shrink-0"
                            title="Editar retirada"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            onClick={() => handleReverterDevolucao(r)}
                            className="flex-1 !h-8 text-xs font-black uppercase gap-1.5 bg-amber-500 hover:bg-amber-600 text-black shadow-sm"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            RESTAURAR PARA EM USO AGORA
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {retiradasAtivas.map((r) => {
                const dataFormatada = format(new Date(r.data_hora_retirada), "dd/MM/yyyy 'ÀS' HH:mm", { locale: ptBR })

                return (
                  <Card key={r.id} className="p-5 border-amber-500/30 flex flex-col justify-between uppercase">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-1 rounded-lg bg-primary/20 px-2.5 py-1 text-xs font-mono font-bold text-primary">
                            <Truck className="h-3.5 w-3.5" />
                            {r.placa}
                          </span>
                          <Badge tone="warning" className="text-[11px] uppercase font-bold">
                            {r.quantidade} UN.
                          </Badge>
                        </div>
                        <span className="text-[11px] text-secondary flex items-center gap-1 uppercase font-medium">
                          <Clock className="h-3 w-3" />
                          {dataFormatada}
                        </span>
                      </div>

                      <h3 className="mt-3 text-base font-bold text-foreground uppercase">
                        {r.ferramenta?.nome || 'FERRAMENTA'}
                      </h3>

                      <div className="mt-2 flex items-center gap-2">
                        {(r.foto_responsavel_url || r.foto_url) ? (
                          <button
                            type="button"
                            onClick={() =>
                              setFotoModalUrl({
                                url: r.foto_responsavel_url || r.foto_url || '',
                                titulo: `Foto do Responsável: ${r.responsavel}`,
                              })
                            }
                            className="relative group shrink-0"
                            title="Clique para ver a foto ampliada"
                          >
                            <img
                              src={r.foto_responsavel_url || r.foto_url || ''}
                              alt={r.responsavel}
                              loading="lazy"
                              decoding="async"
                              className="h-9 w-9 rounded-full object-cover border-2 border-primary/40 group-hover:border-primary transition-all shadow-sm"
                            />
                            <div className="absolute inset-0 rounded-full bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                              <Eye className="h-3.5 w-3.5 text-white" />
                            </div>
                          </button>
                        ) : (
                          <div className="h-9 w-9 rounded-full bg-surface border border-border/30 flex items-center justify-center text-xs font-black text-secondary shrink-0">
                            {r.responsavel.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <p className="text-xs text-secondary uppercase font-medium">
                          RESPONSÁVEL: <strong className="text-foreground font-bold">{r.responsavel}</strong>
                        </p>
                      </div>

                      {r.observacoes_retirada && (
                        <p className="mt-2 text-xs text-secondary italic bg-background/50 p-2 rounded-lg uppercase">
                          "{r.observacoes_retirada}"
                        </p>
                      )}
                    </div>

                    <div className="mt-4 pt-4 border-t border-border/10 flex items-center justify-between gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          setRetiradaEditando(r)
                          setModalEditarRetiradaAberto(true)
                        }}
                        className="gap-1.5 text-xs border-primary/30 text-foreground hover:bg-primary/10 hover:border-primary uppercase font-bold"
                      >
                        <Pencil className="h-3.5 w-3.5 text-primary" />
                        EDITAR
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          setRetiradaParaDevolver(r)
                          setModalDevolucaoAberto(true)
                        }}
                        className="gap-1.5 text-xs border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10 hover:border-emerald-500 uppercase font-bold"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        REGISTRAR DEVOLUÇÃO
                      </Button>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ==================== ABA 3: HISTÓRICO GERAL ==================== */}
      {abaAtiva === 'historico' && (
        <Card className="overflow-hidden uppercase">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm uppercase">
              <thead className="border-b border-border/10 bg-overlay/5 text-[11px] font-bold uppercase tracking-wider text-secondary">
                <tr>
                  <th className="px-4 py-3">FERRAMENTA</th>
                  <th className="px-4 py-3">PLACA / CAMINHÃO</th>
                  <th className="px-4 py-3">RESPONSÁVEL</th>
                  <th className="px-4 py-3">QTD</th>
                  <th className="px-4 py-3">DATA RETIRADA</th>
                  <th className="px-4 py-3">DATA DEVOLUÇÃO</th>
                  <th className="px-4 py-3">STATUS</th>
                  <th className="px-4 py-3 text-right">AÇÕES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/5">
                {retiradas.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-sm text-secondary font-medium uppercase">
                      NENHUM HISTÓRICO REGISTRADO AINDA.
                    </td>
                  </tr>
                ) : (
                  retiradas.slice(0, limiteHistorico).map((r) => {
                    const dataRet = format(new Date(r.data_hora_retirada), "dd/MM/yyyy HH:mm", { locale: ptBR })
                    const dataDev = r.data_hora_devolucao
                      ? format(new Date(r.data_hora_devolucao), "dd/MM/yyyy HH:mm", { locale: ptBR })
                      : '—'

                    return (
                      <tr key={r.id} className="hover:bg-overlay/[0.02] transition-colors uppercase">
                        <td className="px-4 py-3">
                          <p className="font-bold text-foreground uppercase">{r.ferramenta?.nome || 'FERRAMENTA'}</p>
                          {r.ferramenta?.codigo && (
                            <span className="text-[10px] font-mono text-secondary font-semibold">{r.ferramenta.codigo}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono font-bold text-primary">{r.placa}</span>
                        </td>
                        <td className="px-4 py-3 text-secondary font-medium">
                          <div className="flex items-center gap-2">
                            {(r.foto_responsavel_url || r.foto_url) && (
                              <button
                                type="button"
                                onClick={() =>
                                  setFotoModalUrl({
                                    url: r.foto_responsavel_url || r.foto_url || '',
                                    titulo: `Foto do Responsável: ${r.responsavel}`,
                                  })
                                }
                                className="shrink-0"
                                title="Ver foto do responsável"
                              >
                                <img
                                  src={r.foto_responsavel_url || r.foto_url || ''}
                                  alt={r.responsavel}
                                  loading="lazy"
                                  decoding="async"
                                  className="h-6 w-6 rounded-full object-cover border border-primary/40 hover:scale-110 transition-transform"
                                />
                              </button>
                            )}
                            <span>{r.responsavel}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-bold text-foreground">{r.quantidade}</td>
                        <td className="px-4 py-3 text-xs text-secondary font-medium">{dataRet}</td>
                        <td className="px-4 py-3 text-xs text-secondary font-medium">{dataDev}</td>
                        <td className="px-4 py-3">
                          {r.status === 'em_uso' && (
                            <Badge tone="warning" className="text-[10px] uppercase font-black tracking-wide">
                              🔄 EM USO (VAI E VOLTA)
                            </Badge>
                          )}
                          {r.status === 'devolvido' && (
                            <Badge tone="success" className="text-[10px] uppercase font-black tracking-wide">
                              ✓ DEVOLVIDO
                            </Badge>
                          )}
                          {(r.observacoes_retirada?.includes('[SAÍDA DEFINITIVA') || r.status === 'baixa_definitiva') && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-black text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/30">
                              🛑 NÃO VOLTA (BAIXA TOTAL)
                            </span>
                          )}
                          {r.status === 'avaria_perda' && !r.observacoes_retirada?.includes('[SAÍDA DEFINITIVA') && (
                            <Badge tone="danger" className="text-[10px] uppercase font-black tracking-wide">
                              AVARIA / PERDA
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              type="button"
                              variant="secondary"
                              size="md"
                              onClick={() => {
                                setRetiradaEditando(r)
                                setModalEditarRetiradaAberto(true)
                              }}
                              className="!h-7 px-2 text-[10px] font-black uppercase tracking-wider gap-1 border-primary/30 text-primary hover:border-primary"
                              title="Editar registro"
                            >
                              <Pencil className="h-3 w-3" />
                              EDITAR
                            </Button>
                            {r.status !== 'em_uso' ? (
                              <Button
                                type="button"
                                variant="secondary"
                                size="md"
                                onClick={() => handleReverterDevolucao(r)}
                                className="!h-7 px-2.5 text-[10px] font-black uppercase tracking-wider gap-1 border-amber-500/30 text-amber-400 hover:border-amber-500"
                                title="Restaurar de volta para a lista Em Uso no Momento"
                              >
                                <RotateCcw className="h-3 w-3" />
                                RESTAURAR
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                variant="secondary"
                                size="md"
                                onClick={() => {
                                  setRetiradaParaDevolver(r)
                                  setModalDevolucaoAberto(true)
                                }}
                                className="!h-7 px-2.5 text-[10px] font-black uppercase tracking-wider gap-1 border-emerald-500/30 text-emerald-500 hover:border-emerald-500"
                              >
                                <CheckCircle2 className="h-3 w-3" />
                                DAR BAIXA
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Botão Carregar Mais no Histórico */}
          {retiradas.length > limiteHistorico && (
            <div className="p-3 text-center border-t border-border/10">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setLimiteHistorico((prev) => prev + 40)}
                className="!py-2 !px-5 text-xs font-black uppercase tracking-wider gap-2 border-primary/30 text-primary hover:border-primary w-full sm:w-auto"
              >
                <Sparkles className="h-3.5 w-3.5" />
                CARREGAR MAIS HISTÓRICO (+40 DE {retiradas.length - limiteHistorico} RESTANTES)
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* ==================== ABA 4: CAIXAS DE FERRAMENTAS ==================== */}
      {abaAtiva === 'caixas' && (
        <div className="space-y-4 uppercase">
          {/* Barra de Filtros e Busca de Caixas */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary" />
              <input
                value={buscaCaixas}
                onChange={(e) => setBuscaCaixas(e.target.value)}
                placeholder="BUSCAR CAIXA POR NOME, CÓDIGO OU PLACA..."
                className="h-10 w-full rounded-xl border border-border/10 bg-surface pl-9 pr-4 text-sm text-foreground placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary uppercase"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 bg-overlay/5 p-1 rounded-xl">
                {(['TODOS', 'disponivel', 'em_uso', 'manutencao'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFiltroCaixas(st)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors uppercase cursor-pointer ${
                      statusFiltroCaixas === st
                        ? 'bg-primary text-white shadow-sm'
                        : 'text-secondary hover:text-foreground'
                    }`}
                  >
                    {st === 'TODOS'
                      ? 'TODAS'
                      : st === 'disponivel'
                      ? 'DISPONÍVEIS'
                      : st === 'em_uso'
                      ? 'EM USO'
                      : 'MANUTENÇÃO'}
                  </button>
                ))}
              </div>

              <Button
                type="button"
                onClick={() => {
                  setCaixaEditando(null)
                  setModalCaixaAberto(true)
                }}
                className="gap-2 text-xs font-bold uppercase shadow-md shadow-primary/20"
              >
                <Plus className="h-4 w-4" />
                NOVA CAIXA
              </Button>
            </div>
          </div>

          {/* Grid de Cards de Caixas de Ferramentas */}
          {caixasFiltradas.length === 0 ? (
            <Card className="p-8 text-center text-sm text-secondary font-medium">
              NENHUMA CAIXA DE FERRAMENTAS ENCONTRADA.
            </Card>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {caixasFiltradas.slice(0, limiteCaixas).map((caixa) => {
                  const totalItensNaCaixa = caixa.itens.reduce((acc, it) => acc + (it.quantidade || 1), 0)
                  return (
                    <Card
                      key={caixa.id}
                      className="p-5 flex flex-col justify-between border border-border/20 hover:border-primary/40 transition-all shadow-md group relative overflow-hidden bg-surface"
                    >
                      <div>
                        {/* Topo do Card com Foto ou Ícone + Status */}
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-3">
                            {caixa.foto_url ? (
                              <button
                                type="button"
                                onClick={() => setFotoModalUrl({ url: caixa.foto_url!, titulo: caixa.nome })}
                                className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-primary/20 hover:border-primary transition-all group/foto cursor-pointer"
                              >
                                <img
                                  src={caixa.foto_url}
                                  alt={caixa.nome}
                                  loading="lazy"
                                  decoding="async"
                                  className="h-full w-full object-cover"
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/foto:opacity-100 flex items-center justify-center transition-opacity text-white">
                                  <Eye className="h-4 w-4" />
                                </div>
                              </button>
                            ) : (
                              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 font-bold text-xl">
                                🧰
                              </div>
                            )}

                            <div className="min-w-0">
                              <h3 className="font-bold text-foreground text-sm leading-tight uppercase group-hover:text-primary transition-colors">
                                {caixa.nome}
                              </h3>
                              <div className="flex items-center gap-2 mt-1">
                                {caixa.codigo && (
                                  <span className="font-mono text-[11px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                                    {caixa.codigo}
                                  </span>
                                )}
                                {caixa.localizacao && (
                                  <span className="text-[10px] text-secondary font-medium">
                                    📍 {caixa.localizacao}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Status Badge */}
                          <div>
                            {caixa.status === 'disponivel' && (
                              <Badge tone="success" className="text-[10px] font-bold">
                                DISPONÍVEL
                              </Badge>
                            )}
                            {caixa.status === 'em_uso' && (
                              <Badge tone="warning" className="text-[10px] font-bold">
                                EM USO
                              </Badge>
                            )}
                            {caixa.status === 'manutencao' && (
                              <Badge tone="danger" className="text-[10px] font-bold">
                                MANUTENÇÃO
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Informações de Uso (Se estiver em uso) */}
                        {caixa.status === 'em_uso' && (
                          <div className="mb-3 rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-xs space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-secondary font-semibold">CAMINHÃO / PLACA:</span>
                              <span className="font-mono font-bold text-primary">{caixa.placa || 'NÃO INFORMADA'}</span>
                            </div>
                            {caixa.responsavel && (
                              <div className="flex items-center justify-between">
                                <span className="text-secondary font-semibold">RESPONSÁVEL:</span>
                                <span className="font-bold text-foreground">{caixa.responsavel}</span>
                              </div>
                            )}
                            {caixa.data_retirada && (
                              <div className="flex items-center justify-between text-[11px] text-secondary pt-0.5">
                                <span>RETIRADA EM:</span>
                                <span>{format(new Date(caixa.data_retirada), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Lista de Ferramentas dentro da Caixa */}
                        <div className="mt-3 border-t border-border/10 pt-3">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[11px] font-bold text-secondary uppercase">
                              FERRAMENTAS INCLUSAS ({totalItensNaCaixa} ITENS):
                            </span>
                          </div>
                          <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                            {caixa.itens.map((it) => (
                              <div
                                key={it.id}
                                className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-background/60 border border-border/5"
                              >
                                <span className="text-foreground font-medium truncate pr-2">
                                  • {it.nome}
                                </span>
                                <span className="font-bold text-primary shrink-0 text-[11px]">
                                  {it.quantidade}x
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {caixa.observacoes && (
                          <p className="mt-2 text-[11px] text-secondary italic line-clamp-2">
                            "{caixa.observacoes}"
                          </p>
                        )}
                      </div>

                      {/* Botões de Ação do Card */}
                      <div className="mt-4 pt-3 border-t border-border/10 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setCaixaEditando(caixa)
                              setModalCaixaAberto(true)
                            }}
                            className="h-8 w-8 text-secondary hover:text-foreground"
                            title="Editar Caixa"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm(`Excluir a caixa "${caixa.nome}"?`)) {
                                salvarCaixas(caixas.filter((c) => c.id !== caixa.id))
                              }
                            }}
                            className="h-8 w-8 text-secondary hover:text-status-danger"
                            title="Excluir Caixa"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="flex items-center gap-2">
                          {caixa.status === 'disponivel' ? (
                            <Button
                              type="button"
                              size="md"
                              onClick={() => {
                                setCaixaParaRetirar(caixa)
                                setModalRetiradaCaixaAberto(true)
                              }}
                              className="!h-8 px-3 text-xs uppercase font-bold gap-1.5 shadow-sm"
                            >
                              <ArrowUpRight className="h-3.5 w-3.5" />
                              RETIRAR CAIXA
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              variant="secondary"
                              size="md"
                              onClick={() => {
                                salvarCaixas(
                                  caixas.map((c) =>
                                    c.id === caixa.id
                                      ? { ...c, status: 'disponivel', placa: undefined, responsavel: undefined, data_retirada: undefined }
                                      : c,
                                  ),
                                )
                              }}
                              className="!h-8 px-3 text-xs uppercase font-bold gap-1.5 border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              DEVOLVER
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </div>

              {/* Botão Carregar Mais Caixas */}
              {caixasFiltradas.length > limiteCaixas && (
                <div className="pt-2 text-center">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setLimiteCaixas((prev) => prev + 30)}
                    className="!py-2 !px-5 text-xs font-black uppercase tracking-wider gap-2 border-primary/30 text-primary hover:border-primary w-full sm:w-auto"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    CARREGAR MAIS CAIXAS (+30 DE {caixasFiltradas.length - limiteCaixas} RESTANTES)
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ==================== ABA 5: USO E CONSUMO ==================== */}
      {abaAtiva === 'consumo' && (
        <div className="space-y-4 uppercase">
          {/* Métricas rápidas de consumo */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card className="p-3.5 sm:p-4 bg-surface/80">
              <div className="flex items-center justify-between text-secondary">
                <span className="text-[11px] font-bold uppercase tracking-wider">ITENS CADASTRADOS</span>
                <Boxes className="h-4 w-4 text-primary" />
              </div>
              <p className="mt-2 text-xl sm:text-2xl font-black tabular-nums text-foreground">
                {metricasConsumo.totalItens}
              </p>
              <p className="text-[10px] text-secondary font-semibold mt-0.5">VARIEDADES DE INSUMOS</p>
            </Card>

            <Card className="p-3.5 sm:p-4 bg-surface/80">
              <div className="flex items-center justify-between text-secondary">
                <span className="text-[11px] font-bold uppercase tracking-wider">TOTAL EM ESTOQUE</span>
                <Package className="h-4 w-4 text-emerald-500" />
              </div>
              <p className="mt-2 text-xl sm:text-2xl font-black tabular-nums text-emerald-500">
                {metricasConsumo.totalUnidades}
              </p>
              <p className="text-[10px] text-secondary font-semibold mt-0.5">UNIDADES DISPONÍVEIS</p>
            </Card>

            <Card className={`p-3.5 sm:p-4 ${metricasConsumo.emAlerta > 0 ? 'border-red-500/30 bg-red-500/5' : 'bg-surface/80'}`}>
              <div className="flex items-center justify-between text-secondary">
                <span className={`text-[11px] font-bold uppercase tracking-wider ${metricasConsumo.emAlerta > 0 ? 'text-red-400' : ''}`}>
                  ESTOQUE BAIXO
                </span>
                <AlertTriangle className={`h-4 w-4 ${metricasConsumo.emAlerta > 0 ? 'text-red-400' : 'text-secondary'}`} />
              </div>
              <p className={`mt-2 text-xl sm:text-2xl font-black tabular-nums ${metricasConsumo.emAlerta > 0 ? 'text-red-400' : 'text-foreground'}`}>
                {metricasConsumo.emAlerta}
              </p>
              <p className="text-[10px] text-secondary font-semibold mt-0.5">PREVISTO REPOSIÇÃO</p>
            </Card>

            <Card className="p-3.5 sm:p-4 bg-surface/80">
              <div className="flex items-center justify-between text-secondary">
                <span className="text-[11px] font-bold uppercase tracking-wider">BAIXAS REGISTRADAS</span>
                <TrendingDown className="h-4 w-4 text-amber-500" />
              </div>
              <p className="mt-2 text-xl sm:text-2xl font-black tabular-nums text-amber-500">
                {metricasConsumo.totalBaixas}
              </p>
              <p className="text-[10px] text-secondary font-semibold mt-0.5">SAÍDAS DE CONSUMO</p>
            </Card>
          </div>

          {/* Barra de Filtros, Sub-abas e Ações */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-overlay/5 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setSubAbaConsumo('estoque')}
                  className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition-colors uppercase cursor-pointer flex items-center gap-1.5 ${
                    subAbaConsumo === 'estoque'
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-secondary hover:text-foreground'
                  }`}
                >
                  <Boxes className="h-3.5 w-3.5" />
                  ESTOQUE DE INSUMOS
                </button>
                <button
                  type="button"
                  onClick={() => setSubAbaConsumo('historico')}
                  className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition-colors uppercase cursor-pointer flex items-center gap-1.5 ${
                    subAbaConsumo === 'historico'
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-secondary hover:text-foreground'
                  }`}
                >
                  <ClipboardList className="h-3.5 w-3.5" />
                  HISTÓRICO DE CONSUMOS ({baixasConsumo.length})
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setItemConsumoParaBaixa(null)
                  setModalBaixaConsumoAberto(true)
                }}
                className="gap-2 text-xs font-bold uppercase border-amber-500/30 text-amber-500 hover:bg-amber-500/10"
              >
                <TrendingDown className="h-4 w-4" />
                REGISTRAR CONSUMO
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setItemConsumoEditando(null)
                  setModalItemConsumoAberto(true)
                }}
                className="gap-2 text-xs font-bold uppercase shadow-md shadow-primary/20"
              >
                <Plus className="h-4 w-4" />
                NOVO INSUMO
              </Button>
            </div>
          </div>

          {/* Sub-Aba 1: Estoque de Insumos */}
          {subAbaConsumo === 'estoque' && (
            <div className="space-y-4">
              {/* Barra de Busca e Categorias */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative flex-1 max-w-md">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary" />
                  <input
                    value={buscaConsumo}
                    onChange={(e) => setBuscaConsumo(e.target.value)}
                    placeholder="BUSCAR INSUMO POR NOME, CÓDIGO OU LOCALIZAÇÃO..."
                    className="h-10 w-full rounded-xl border border-border/10 bg-surface pl-9 pr-4 text-sm text-foreground placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary uppercase"
                  />
                </div>

                {/* Filtro de Categorias */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-xl">
                  {CATEGORIAS_CONSUMO.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategoriaConsumoFiltro(cat)}
                      className={`whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                        categoriaConsumoFiltro === cat
                          ? 'bg-primary/20 border-primary text-primary shadow-sm'
                          : 'bg-surface border-border/20 text-secondary hover:border-border/60 hover:text-foreground'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Grid de Insumos */}
              {itensConsumoFiltrados.length === 0 ? (
                <Card className="p-8 text-center text-sm text-secondary font-medium">
                  NENHUM ITEM DE CONSUMO ENCONTRADO.
                </Card>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {itensConsumoFiltrados.slice(0, limiteConsumo).map((item) => {
                      const isAlerta = item.quantidade_atual <= item.quantidade_minima
                      const isZerado = item.quantidade_atual === 0
                      return (
                        <Card
                          key={item.id}
                          className={`p-4 flex flex-col justify-between border transition-all shadow-md group relative overflow-hidden bg-surface ${
                            isZerado
                              ? 'border-red-500/40 bg-red-500/5'
                              : isAlerta
                              ? 'border-amber-500/40 bg-amber-500/5'
                              : 'border-border/20 hover:border-primary/40'
                          }`}
                        >
                          <div>
                            {/* Topo do Card */}
                            <div className="flex items-start justify-between gap-3 mb-2.5">
                              <div className="flex items-center gap-2.5 min-w-0">
                                {item.foto_url ? (
                                  <button
                                    type="button"
                                    onClick={() => setFotoModalUrl({ url: item.foto_url!, titulo: item.nome })}
                                    className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-primary/20 hover:border-primary transition-all group/foto cursor-pointer"
                                  >
                                    <img
                                      src={item.foto_url}
                                      alt={item.nome}
                                      loading="lazy"
                                      decoding="async"
                                      className="h-full w-full object-cover"
                                    />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/foto:opacity-100 flex items-center justify-center transition-opacity text-white">
                                      <Eye className="h-3.5 w-3.5" />
                                    </div>
                                  </button>
                                ) : (
                                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 font-bold text-lg">
                                    📦
                                  </div>
                                )}

                                <div className="min-w-0">
                                  <span className="text-[9px] font-black uppercase text-secondary tracking-widest block truncate">
                                    {item.categoria}
                                  </span>
                                  <h3 className="font-bold text-foreground text-xs leading-tight uppercase truncate mt-0.5">
                                    {item.nome}
                                  </h3>
                                  {item.codigo && (
                                    <span className="font-mono text-[10px] text-primary font-bold">[{item.codigo}]</span>
                                  )}
                                </div>
                              </div>

                              {/* Badge de Alerta */}
                              <div>
                                {isZerado ? (
                                  <Badge tone="danger" className="text-[9px] font-black uppercase">
                                    ZERADO
                                  </Badge>
                                ) : isAlerta ? (
                                  <Badge tone="warning" className="text-[9px] font-black uppercase">
                                    REPOSIÇÃO
                                  </Badge>
                                ) : (
                                  <Badge tone="success" className="text-[9px] font-black uppercase">
                                    NORMAL
                                  </Badge>
                                )}
                              </div>
                            </div>

                            {/* Quantidade e Estoque Mínimo */}
                            <div className="my-3 rounded-xl bg-background/50 border border-border/15 p-3 space-y-2">
                              <div className="flex items-end justify-between">
                                <div>
                                  <span className="text-[10px] font-bold text-secondary uppercase block">ESTOQUE ATUAL</span>
                                  <span className="text-2xl font-black font-mono text-foreground">
                                    {item.quantidade_atual}{' '}
                                    <span className="text-xs font-semibold text-secondary">{item.unidade}</span>
                                  </span>
                                </div>
                                <div className="text-right">
                                  <span className="text-[10px] font-bold text-secondary uppercase block">MÍNIMO</span>
                                  <span className="text-xs font-bold font-mono text-secondary">
                                    {item.quantidade_minima} {item.unidade}
                                  </span>
                                </div>
                              </div>

                              {/* Barra de Progresso de Nível */}
                              <div className="w-full h-1.5 bg-border/20 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    isZerado
                                      ? 'w-0'
                                      : isAlerta
                                      ? 'bg-amber-500'
                                      : 'bg-emerald-500'
                                  }`}
                                  style={{
                                    width: `${Math.min(100, Math.max(8, (item.quantidade_atual / (item.quantidade_minima * 2.5 || 10)) * 100))}%`,
                                  }}
                                />
                              </div>

                              {item.localizacao && (
                                <p className="text-[10px] text-secondary font-medium truncate pt-1 border-t border-border/10">
                                  📍 {item.localizacao}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Ações do Insumo */}
                          <div className="pt-2 border-t border-border/10 flex items-center justify-between gap-1.5">
                            <div className="flex items-center gap-1">
                              <Button
                                type="button"
                                variant="secondary"
                                size="md"
                                onClick={() => {
                                  setItemConsumoParaBaixa(item)
                                  setModalBaixaConsumoAberto(true)
                                }}
                                disabled={item.quantidade_atual <= 0}
                                className="!h-8 px-2.5 text-[11px] uppercase font-bold gap-1 border-amber-500/30 text-amber-500 hover:bg-amber-500/10 disabled:opacity-30"
                                title="Dar baixa de consumo"
                              >
                                <TrendingDown className="h-3.5 w-3.5" />
                                BAIXAR
                              </Button>

                              <Button
                                type="button"
                                variant="secondary"
                                size="md"
                                onClick={() => {
                                  setItemConsumoParaEntrada(item)
                                  setModalEntradaConsumoAberto(true)
                                }}
                                className="!h-8 px-2.5 text-[11px] uppercase font-bold gap-1 border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10"
                                title="Adicionar entrada ao estoque"
                              >
                                <Plus className="h-3.5 w-3.5" />
                                REPOR
                              </Button>
                            </div>

                            <div className="flex items-center gap-0.5">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setItemConsumoEditando(item)
                                  setModalItemConsumoAberto(true)
                                }}
                                className="h-8 w-8 text-secondary hover:text-foreground"
                                title="Editar Insumo"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  if (confirm(`Deseja excluir o insumo "${item.nome}"?`)) {
                                    salvarItensConsumo(itensConsumo.filter((i) => i.id !== item.id))
                                  }
                                }}
                                className="h-8 w-8 text-secondary hover:text-red-400"
                                title="Excluir Insumo"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        </Card>
                      )
                    })}
                  </div>

                  {/* Botão Carregar Mais Insumos */}
                  {itensConsumoFiltrados.length > limiteConsumo && (
                    <div className="pt-2 text-center">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setLimiteConsumo((prev) => prev + 30)}
                        className="!py-2 !px-5 text-xs font-black uppercase tracking-wider gap-2 border-primary/30 text-primary hover:border-primary w-full sm:w-auto"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        CARREGAR MAIS INSUMOS (+30 DE {itensConsumoFiltrados.length - limiteConsumo} RESTANTES)
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Sub-Aba 2: Histórico de Consumos */}
          {subAbaConsumo === 'historico' && (
            <Card className="overflow-hidden border-border/10 uppercase">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border/10 bg-overlay/5 text-xs text-secondary font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3">ITEM DE CONSUMO</th>
                      <th className="px-4 py-3">QTD CONSUMIDA</th>
                      <th className="px-4 py-3">RESPONSÁVEL</th>
                      <th className="px-4 py-3">CAMINHÃO / PLACA</th>
                      <th className="px-4 py-3">MOTIVO / APLICAÇÃO</th>
                      <th className="px-4 py-3">DATA E HORA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/5 font-medium">
                    {baixasConsumo.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-sm text-secondary font-medium">
                          NENHUM REGISTRO DE CONSUMO REALIZADO ATÉ O MOMENTO.
                        </td>
                      </tr>
                    ) : (
                      baixasConsumo.slice(0, limiteHistoricoConsumo).map((bx) => (
                        <tr key={bx.id} className="hover:bg-overlay/5 transition-colors">
                          <td className="px-4 py-3 font-bold text-foreground">
                            <div className="flex items-center gap-2">
                              <span>📦</span>
                              <span>{bx.item_nome}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-black font-mono text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">
                              −{bx.quantidade} {bx.unidade}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2 font-semibold text-foreground">
                              {bx.foto_responsavel_url ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setFotoModalUrl({
                                      url: bx.foto_responsavel_url!,
                                      titulo: `Responsável: ${bx.responsavel}`,
                                    })
                                  }
                                  className="h-6 w-6 rounded-full overflow-hidden border border-primary/40 hover:scale-110 transition-transform cursor-pointer"
                                >
                                  <img
                                    src={bx.foto_responsavel_url}
                                    alt={bx.responsavel}
                                    loading="lazy"
                                    decoding="async"
                                    className="h-full w-full object-cover"
                                  />
                                </button>
                              ) : (
                                <span className="text-xs">👤</span>
                              )}
                              <span>{bx.responsavel}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono font-bold text-primary">
                            {bx.placa ? `🚛 ${bx.placa}` : '—'}
                          </td>
                          <td className="px-4 py-3 text-xs text-secondary max-w-xs truncate">
                            {bx.motivo || '—'}
                          </td>
                          <td className="px-4 py-3 text-xs text-secondary font-mono">
                            {format(new Date(bx.data_hora), "dd/MM/yyyy 'ÀS' HH:mm", { locale: ptBR })}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Botão Carregar Mais Histórico de Consumo */}
              {baixasConsumo.length > limiteHistoricoConsumo && (
                <div className="p-3 text-center border-t border-border/10">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setLimiteHistoricoConsumo((prev) => prev + 40)}
                    className="!py-2 !px-5 text-xs font-black uppercase tracking-wider gap-2 border-primary/30 text-primary hover:border-primary w-full sm:w-auto"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    CARREGAR MAIS HISTÓRICO (+40 DE {baixasConsumo.length - limiteHistoricoConsumo} RESTANTES)
                  </Button>
                </div>
              )}
            </Card>
          )}
        </div>
      )}

      {/* ==================== MODAL: NOVO / EDITAR ITEM DE CONSUMO ==================== */}
      {modalItemConsumoAberto && (
        <ModalItemConsumo
          item={itemConsumoEditando}
          onClose={() => setModalItemConsumoAberto(false)}
          onSalvo={(salvo) => {
            if (itemConsumoEditando) {
              salvarItensConsumo(itensConsumo.map((it) => (it.id === salvo.id ? salvo : it)))
            } else {
              salvarItensConsumo([salvo, ...itensConsumo])
            }
            setModalItemConsumoAberto(false)
          }}
        />
      )}

      {/* ==================== MODAL: BAIXA / CONSUMO DE INSUMO ==================== */}
      {modalBaixaConsumoAberto && (
        <ModalBaixaConsumo
          itemPreSelecionado={itemConsumoParaBaixa}
          itensDisponiveis={itensConsumo.filter((it) => it.quantidade_atual > 0)}
          veiculos={veiculosLista}
          retiradas={retiradas}
          onClose={() => setModalBaixaConsumoAberto(false)}
          onSucesso={(novaBaixa) => {
            // Atualiza o estoque decrementando a quantidade
            salvarItensConsumo(
              itensConsumo.map((it) =>
                it.id === novaBaixa.item_id
                  ? { ...it, quantidade_atual: Math.max(0, it.quantidade_atual - novaBaixa.quantidade) }
                  : it
              )
            )
            salvarBaixasConsumo([novaBaixa, ...baixasConsumo])
            setModalBaixaConsumoAberto(false)
          }}
        />
      )}

      {/* ==================== MODAL: ENTRADA / REPOSIÇÃO DE ESTOQUE ==================== */}
      {modalEntradaConsumoAberto && itemConsumoParaEntrada && (
        <ModalEntradaConsumo
          item={itemConsumoParaEntrada}
          onClose={() => setModalEntradaConsumoAberto(false)}
          onSucesso={(qtdAdicionada) => {
            salvarItensConsumo(
              itensConsumo.map((it) =>
                it.id === itemConsumoParaEntrada.id
                  ? { ...it, quantidade_atual: it.quantidade_atual + qtdAdicionada }
                  : it
              )
            )
            setModalEntradaConsumoAberto(false)
          }}
        />
      )}
      {modalFerramentaAberto && (
        <ModalFerramenta
          ferramenta={ferramentaEditando}
          onClose={() => setModalFerramentaAberto(false)}
          onSalvo={async () => {
            setModalFerramentaAberto(false)
            await recarregarDados()
          }}
        />
      )}

      {/* ==================== MODAL: RETIRAR FERRAMENTA (VINCULAR AO CAMINHÃO) ==================== */}
      {modalRetiradaAberto && (
        <ModalRetirada
          ferramentaPreSelecionada={ferramentaSelecionadaParaRetirada}
          ferramentasDisponiveis={ferramentas.filter((f) => f.quantidade_disponivel > 0)}
          veiculos={veiculosLista}
          retiradas={retiradas}
          onClose={() => setModalRetiradaAberto(false)}
          onSucesso={async () => {
            setModalRetiradaAberto(false)
            await recarregarDados()
          }}
        />
      )}

      {/* ==================== MODAL: REGISTRAR DEVOLUÇÃO ==================== */}
      {modalDevolucaoAberto && retiradaParaDevolver && (
        <ModalDevolucao
          retirada={retiradaParaDevolver}
          onClose={() => setModalDevolucaoAberto(false)}
          onSucesso={async () => {
            setModalDevolucaoAberto(false)
            await recarregarDados()
          }}
        />
      )}

      {/* ==================== MODAL: EDITAR RETIRADA ==================== */}
      {modalEditarRetiradaAberto && retiradaEditando && (
        <ModalEditarRetirada
          retirada={retiradaEditando}
          ferramentas={ferramentas}
          veiculos={veiculosLista}
          onClose={() => setModalEditarRetiradaAberto(false)}
          onSucesso={async () => {
            setModalEditarRetiradaAberto(false)
            await recarregarDados()
          }}
        />
      )}

      {/* ==================== MODAL: NOVA / EDITAR CAIXA DE FERRAMENTAS ==================== */}
      {modalCaixaAberto && (
        <ModalCaixaFerramenta
          caixa={caixaEditando}
          ferramentasDisponiveis={ferramentas}
          onClose={() => setModalCaixaAberto(false)}
          onSalvo={async (novaCaixa) => {
            if (caixaEditando) {
              salvarCaixas(caixas.map((c) => (c.id === novaCaixa.id ? novaCaixa : c)))
            } else {
              salvarCaixas([novaCaixa, ...caixas])
            }
            setModalCaixaAberto(false)
          }}
        />
      )}

      {/* ==================== MODAL: RETIRAR CAIXA DE FERRAMENTAS ==================== */}
      {modalRetiradaCaixaAberto && caixaParaRetirar && (
        <ModalRetiradaCaixa
          caixa={caixaParaRetirar}
          veiculos={veiculosLista}
          onClose={() => setModalRetiradaCaixaAberto(false)}
          onSucesso={async (dadosRetirada) => {
            salvarCaixas(
              caixas.map((c) =>
                c.id === caixaParaRetirar.id
                  ? {
                      ...c,
                      status: 'em_uso',
                      placa: dadosRetirada.placa,
                      responsavel: dadosRetirada.responsavel,
                      data_retirada: new Date().toISOString(),
                    }
                  : c,
              ),
            )
            setModalRetiradaCaixaAberto(false)
          }}
        />
      )}

      {/* ==================== MODAL: VISUALIZADOR DE FOTO AMPLIADA ==================== */}
      {fotoModalUrl && (
        <div
          onClick={() => setFotoModalUrl(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-fade-in cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-h-[85vh] max-w-lg w-full overflow-hidden rounded-3xl border border-border/20 bg-surface shadow-2xl animate-scale-in"
          >
            <div className="flex items-center justify-between border-b border-border/10 p-4 bg-overlay/5">
              <h3 className="font-bold text-foreground truncate pr-2 uppercase text-sm">
                {fotoModalUrl.titulo}
              </h3>
              <button
                type="button"
                onClick={() => setFotoModalUrl(null)}
                className="rounded-xl p-1.5 text-secondary hover:bg-overlay/10 hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 flex items-center justify-center bg-background/60">
              <img
                src={fotoModalUrl.url}
                alt={fotoModalUrl.titulo}
                className="max-h-[65vh] w-auto rounded-2xl object-contain shadow-md"
              />
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL: HISTÓRICO DE SAÍDAS DA FERRAMENTA ==================== */}
      {ferramentaHistorico && (
        <ModalHistoricoFerramenta
          ferramenta={ferramentaHistorico}
          retiradas={retiradas}
          onClose={() => setFerramentaHistorico(null)}
          onRetirar={(f) => {
            setFerramentaSelecionadaParaRetirada(f)
            setModalRetiradaAberto(true)
          }}
        />
      )}
    </div>
  )
}

// ----------------------------------------------------------------------------------
// Subcomponente: Modal de Histórico de Saídas da Ferramenta
// ----------------------------------------------------------------------------------
function ModalHistoricoFerramenta({
  ferramenta,
  retiradas,
  onClose,
  onRetirar,
}: {
  ferramenta: Ferramenta
  retiradas: FerramentaRetirada[]
  onClose: () => void
  onRetirar: (f: Ferramenta) => void
}) {
  const [busca, setBusca] = useState('')

  const historico = useMemo(() => {
    return retiradas.filter((r) => r.ferramenta_id === ferramenta.id)
  }, [retiradas, ferramenta.id])

  const filtrado = useMemo(() => {
    if (!busca.trim()) return historico
    const t = busca.toLowerCase().trim()
    return historico.filter((r) => {
      return (
        (r.placa && r.placa.toLowerCase().includes(t)) ||
        (r.responsavel && r.responsavel.toLowerCase().includes(t)) ||
        (r.observacoes_retirada && r.observacoes_retirada.toLowerCase().includes(t))
      )
    })
  }, [historico, busca])

  const total = ferramenta.quantidade_total || 1
  const disp = ferramenta.quantidade_disponivel || 0
  const emUso = Math.max(0, total - disp)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-fade-in">
      <div className="relative flex flex-col max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-3xl border border-border/25 bg-surface shadow-2xl animate-scale-in">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-border/15 p-5 bg-overlay/5">
          <div className="flex items-center gap-3.5 min-w-0">
            {ferramenta.foto_url ? (
              <img
                src={ferramenta.foto_url}
                alt={ferramenta.nome}
                className="h-12 w-12 rounded-2xl object-cover border border-border/30 shrink-0"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20 shrink-0">
                <Hammer className="h-6 w-6" />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="rounded-lg bg-background border border-border/30 px-2 py-0.5 text-xs font-mono font-bold text-foreground">
                  {ferramenta.codigo || 'S/ CÓD'}
                </span>
                <span className="rounded-lg bg-overlay/5 border border-border/20 px-2 py-0.5 text-[10px] font-black uppercase text-secondary tracking-wider">
                  {ferramenta.categoria || 'GERAL'}
                </span>
              </div>
              <h2 className="text-base font-black text-foreground uppercase truncate mt-0.5">
                {ferramenta.nome}
              </h2>
              {ferramenta.localizacao && (
                <p className="text-[11px] text-secondary font-medium">📍 {ferramenta.localizacao}</p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-secondary hover:bg-overlay/10 hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Resumo de Estoque & Busca */}
        <div className="p-5 pb-3 border-b border-border/10 space-y-3 bg-background/50">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl border border-border/15 bg-surface p-2.5">
              <span className="text-[10px] font-black text-secondary uppercase">Disponível</span>
              <p className="text-lg font-black font-mono text-emerald-500">{disp}</p>
            </div>
            <div className="rounded-2xl border border-border/15 bg-surface p-2.5">
              <span className="text-[10px] font-black text-secondary uppercase">Em Uso</span>
              <p className="text-lg font-black font-mono text-amber-500">{emUso}</p>
            </div>
            <div className="rounded-2xl border border-border/15 bg-surface p-2.5">
              <span className="text-[10px] font-black text-secondary uppercase">Total</span>
              <p className="text-lg font-black font-mono text-foreground">{total}</p>
            </div>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="FILTRAR HISTÓRICO POR PLACA OU MECÂNICO..."
              className="h-10 w-full rounded-xl border border-border/25 bg-surface pl-10 pr-4 text-xs uppercase text-foreground placeholder:text-secondary/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
            />
          </div>
        </div>

        {/* Lista de Saídas / Histórico */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-secondary flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-primary" />
              Histórico de Saídas ({filtrado.length})
            </span>
          </div>

          {filtrado.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/30 p-8 text-center bg-overlay/5">
              <Clock className="mx-auto h-8 w-8 text-secondary/40 mb-2" />
              <p className="text-xs font-black uppercase text-foreground">Nenhuma saída encontrada</p>
              <p className="text-[11px] text-secondary mt-0.5">
                {busca ? 'Tente buscar por outro termo.' : 'Esta ferramenta ainda não possui saídas registradas.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filtrado.map((r) => {
                const emUsoAgora = r.status === 'em_uso'
                return (
                  <div
                    key={r.id}
                    className="rounded-2xl border border-border/20 bg-surface/90 p-3.5 space-y-2.5 hover:border-primary/30 transition-all shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Placa */}
                        <div className="flex items-center gap-1.5 rounded-lg bg-background border border-border/30 px-2.5 py-1">
                          <Truck className="h-3.5 w-3.5 text-primary" />
                          <span className="text-xs font-black font-mono text-foreground">
                            {r.placa || 'SEM PLACA'}
                          </span>
                        </div>

                        {/* Quantidade */}
                        <span className="rounded-lg bg-overlay/5 border border-border/20 px-2 py-0.5 text-[11px] font-bold text-secondary">
                          {r.quantidade || 1} un
                        </span>
                      </div>

                      {/* Status */}
                      {emUsoAgora ? (
                        <span className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 text-[10px] font-black text-amber-400 uppercase tracking-wider">
                          ● EM USO NO MOMENTO
                        </span>
                      ) : (
                        <span className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 text-[10px] font-black text-emerald-400 uppercase tracking-wider">
                          ✓ DEVOLVIDA
                        </span>
                      )}
                    </div>

                    {/* Quem Solicitou Retirada */}
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-border/10">
                      <div>
                        <span className="text-[10px] font-bold text-secondary uppercase block">
                          Quem Solicitou Retirada:
                        </span>
                        <span className="font-black text-foreground uppercase flex items-center gap-1.5 mt-0.5">
                          <span className="h-2 w-2 rounded-full bg-primary" />
                          {r.responsavel || 'NÃO INFORMADO'}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] font-bold text-secondary uppercase block">Data de Saída:</span>
                        <span className="text-[11px] font-mono text-foreground font-semibold">
                          {r.data_hora_retirada
                            ? format(new Date(r.data_hora_retirada), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                            : '—'}
                        </span>
                      </div>
                    </div>

                    {/* Data de Devolução se houver */}
                    {r.data_hora_devolucao && (
                      <div className="text-[11px] text-emerald-400 font-medium bg-emerald-500/5 rounded-xl px-2.5 py-1.5 border border-emerald-500/15 flex items-center justify-between">
                        <span>Devolvido em:</span>
                        <span className="font-mono font-bold">
                          {format(new Date(r.data_hora_devolucao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                    )}

                    {/* Observações */}
                    {r.observacoes_retirada && (
                      <p className="text-[11px] text-secondary italic bg-background/50 rounded-xl p-2 border border-border/10">
                        "{r.observacoes_retirada}"
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="flex items-center justify-between border-t border-border/15 p-4 bg-overlay/5">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            className="!h-9 px-4 text-xs font-bold uppercase"
          >
            Fechar
          </Button>

          {disp > 0 && (
            <Button
              type="button"
              onClick={() => {
                onClose()
                onRetirar(ferramenta)
              }}
              className="!h-9 px-4 text-xs font-black uppercase gap-1.5 shadow-md shadow-primary/20"
            >
              <ArrowUpRight className="h-4 w-4" />
              Retirar Esta Ferramenta
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------------------------
// Subcomponente: Modal de Cadastro / Edição de Ferramenta
// ----------------------------------------------------------------------------------
function ModalFerramenta({
  ferramenta,
  onClose,
  onSalvo,
}: {
  ferramenta: Ferramenta | null
  onClose: () => void
  onSalvo: () => Promise<void>
}) {
  const [nome, setNome] = useState(ferramenta?.nome || '')
  const [codigo, setCodigo] = useState(ferramenta?.codigo || '')
  const [categoria, setCategoria] = useState(ferramenta?.categoria || 'GERAL')
  const [quantidadeTotal, setQuantidadeTotal] = useState(String(ferramenta?.quantidade_total || 1))
  const [localizacao, setLocalizacao] = useState(ferramenta?.localizacao || '')
  const [observacoes, setObservacoes] = useState(ferramenta?.observacoes || '')
  
  // Foto da Ferramenta
  const [fotoUrl, setFotoUrl] = useState(ferramenta?.foto_url || '')
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [processandoFoto, setProcessandoFoto] = useState(false)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galeriaInputRef = useRef<HTMLInputElement>(null)

  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const handleFotoSelecionada = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setProcessandoFoto(true)
    setErro(null)
    try {
      const comprimida = await comprimirImagem(file)
      setFotoFile(comprimida)
      setFotoUrl(URL.createObjectURL(comprimida))
    } catch (err) {
      console.error('Erro ao processar imagem:', err)
      setErro('NÃO FOI POSSÍVEL PROCESSAR A FOTO.')
    } finally {
      setProcessandoFoto(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome.trim()) {
      setErro('INFORME O NOME DA FERRAMENTA.')
      return
    }

    setSalvando(true)
    setErro(null)

    try {
      let finalFotoUrl: string | null = fotoUrl || null
      if (fotoFile) {
        finalFotoUrl = await uploadFotoFerramenta(fotoFile)
      }

      if (ferramenta) {
        await atualizarFerramenta(ferramenta.id, {
          nome: nome.toUpperCase(),
          codigo: codigo.toUpperCase(),
          categoria: categoria.toUpperCase(),
          quantidade_total: Number(quantidadeTotal) || 1,
          localizacao: localizacao.toUpperCase(),
          observacoes: observacoes.toUpperCase(),
          foto_url: finalFotoUrl,
        })
      } else {
        await criarFerramenta({
          nome: nome.toUpperCase(),
          codigo: codigo.toUpperCase(),
          categoria: categoria.toUpperCase(),
          quantidade_total: Number(quantidadeTotal) || 1,
          localizacao: localizacao.toUpperCase(),
          observacoes: observacoes.toUpperCase(),
          foto_url: finalFotoUrl,
        })
      }
      await onSalvo()
    } catch (err) {
      setErro(err instanceof Error ? err.message.toUpperCase() : 'ERRO AO SALVAR FERRAMENTA.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 uppercase backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl border border-border/10 bg-surface p-6 shadow-2xl animate-scale-in">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Hammer className="h-5 w-5" />
            </div>
            <h2 className="text-base font-bold text-foreground uppercase">
              {ferramenta ? 'EDITAR FERRAMENTA' : 'NOVA FERRAMENTA'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-secondary hover:bg-overlay/10 hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {erro && <p className="mb-4 text-sm text-status-danger uppercase font-bold">{erro}</p>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="nome" className="uppercase font-bold">NOME DA FERRAMENTA *</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="EX: CHAVE DE IMPACTO 1/2, TORQUÍMETRO, SCANNER..."
              required
              className="uppercase font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="codigo" className="uppercase font-bold">CÓDIGO / PATRIMÔNIO</Label>
              <Input
                id="codigo"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="EX: FER-012"
                className="uppercase font-medium"
              />
            </div>
            <div>
              <Label htmlFor="categoria" className="uppercase font-bold">CATEGORIA</Label>
              <Input
                id="categoria"
                list="lista-categorias-sugeridas"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                placeholder="EX: INSUMOS, PNEUMÁTICA..."
                className="uppercase font-medium"
              />
              <datalist id="lista-categorias-sugeridas">
                {CATEGORIAS_SUGERIDAS.filter((c) => c !== 'TODAS').map((cat) => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="qtd" className="uppercase font-bold">QUANTIDADE TOTAL</Label>
              <Input
                id="qtd"
                type="number"
                min="1"
                value={quantidadeTotal}
                onChange={(e) => setQuantidadeTotal(e.target.value)}
                required
                className="font-medium"
              />
            </div>
            <div>
              <Label htmlFor="local" className="uppercase font-bold">LOCALIZAÇÃO / GAVETA</Label>
              <Input
                id="local"
                value={localizacao}
                onChange={(e) => setLocalizacao(e.target.value)}
                placeholder="EX: ARMÁRIO 02"
                className="uppercase font-medium"
              />
            </div>
          </div>

          {/* FOTO DA FERRAMENTA */}
          <div className="space-y-2 rounded-2xl border border-border/20 bg-background/40 p-3.5">
            <Label className="uppercase font-bold text-xs text-secondary flex items-center justify-between">
              <span>FOTO DA FERRAMENTA</span>
              {fotoUrl && <span className="text-[10px] text-emerald-400 font-black">FOTO SELECIONADA</span>}
            </Label>

            {/* Inputs Ocultos de Arquivo */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFotoSelecionada}
            />
            <input
              ref={galeriaInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFotoSelecionada}
            />

            {fotoUrl ? (
              <div className="relative flex items-center gap-3 rounded-xl border border-border/30 bg-surface/80 p-2.5">
                <img
                  src={fotoUrl}
                  alt="Foto da Ferramenta"
                  className="h-16 w-16 rounded-xl object-cover border border-border/30 bg-background shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-foreground truncate">IMAGEM ANEXADA</p>
                  <p className="text-[10px] text-secondary mt-0.5">
                    {fotoFile ? `${(fotoFile.size / 1024).toFixed(0)} KB (Pronta p/ salvar)` : 'Imagem vinculada'}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="text-[10px] font-bold text-primary hover:underline"
                    >
                      Trocar foto
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFotoUrl('')
                    setFotoFile(null)
                  }}
                  className="rounded-xl p-2 text-secondary hover:bg-status-danger/10 hover:text-status-danger transition-colors cursor-pointer"
                  title="Remover foto"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={processandoFoto}
                  onClick={() => cameraInputRef.current?.click()}
                  className="gap-2 text-xs font-bold border-border/30 hover:border-primary/40 text-foreground"
                >
                  {processandoFoto ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : (
                    <Camera className="h-4 w-4 text-primary" />
                  )}
                  <span>CÂMERA</span>
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  disabled={processandoFoto}
                  onClick={() => galeriaInputRef.current?.click()}
                  className="gap-2 text-xs font-bold border-border/30 hover:border-primary/40 text-foreground"
                >
                  {processandoFoto ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : (
                    <ImageIcon className="h-4 w-4 text-primary" />
                  )}
                  <span>GALERIA</span>
                </Button>
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="obs" className="uppercase font-bold">OBSERVAÇÕES</Label>
            <Input
              id="obs"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="MARCA, ESTADO DE CONSERVAÇÃO, ETC."
              className="uppercase font-medium"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border/10">
            <Button type="button" variant="secondary" onClick={onClose} disabled={salvando} className="uppercase font-semibold">
              CANCELAR
            </Button>
            <Button type="submit" disabled={salvando} className="uppercase font-bold">
              {salvando ? 'SALVANDO...' : ferramenta ? 'SALVAR ALTERAÇÕES' : 'CADASTRAR'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------------------------
// Subcomponente: Modal de Retirada de Ferramenta (Wizard 3 Passos com Múltiplas Ferramentas)
// ----------------------------------------------------------------------------------
interface ItemRetirada {
  ferramenta: Ferramenta
  quantidade: number
}

function getFotoSalvaMecanico(nome: string, retiradas?: FerramentaRetirada[]): string | null {
  if (!nome || !nome.trim()) return null
  const limpo = nome.trim().toUpperCase()
  try {
    const storageMap = JSON.parse(localStorage.getItem('gvel_fotos_mecanicos') || '{}')
    if (storageMap[limpo]) return storageMap[limpo]
  } catch (e) {
    // ignore
  }
  if (retiradas) {
    const encontrada = retiradas.find(
      (r) => r.responsavel?.toUpperCase().trim() === limpo && (r.foto_responsavel_url || r.foto_url)
    )
    if (encontrada) {
      return encontrada.foto_responsavel_url || encontrada.foto_url || null
    }
  }
  return null
}

function salvarFotoMecanico(nome: string, url: string) {
  if (!nome || !nome.trim() || !url) return
  try {
    const limpo = nome.trim().toUpperCase()
    const storageMap = JSON.parse(localStorage.getItem('gvel_fotos_mecanicos') || '{}')
    storageMap[limpo] = url
    localStorage.setItem('gvel_fotos_mecanicos', JSON.stringify(storageMap))
  } catch (e) {
    // ignore
  }
}

function ModalRetirada({
  ferramentaPreSelecionada,
  ferramentasDisponiveis,
  veiculos,
  retiradas,
  onClose,
  onSucesso,
}: {
  ferramentaPreSelecionada: Ferramenta | null
  ferramentasDisponiveis: Ferramenta[]
  veiculos: { id: string; placa: string }[]
  retiradas?: FerramentaRetirada[]
  onClose: () => void
  onSucesso: () => Promise<void>
}) {
  const [step, setStep] = useState(1)
  const [itensSelecionados, setItensSelecionados] = useState<ItemRetirada[]>(() => {
    if (ferramentaPreSelecionada) {
      return [{ ferramenta: ferramentaPreSelecionada, quantidade: 1 }]
    }
    return []
  })
  const [placasSelecionadas, setPlacasSelecionadas] = useState<string[]>([])
  const [responsavel, setResponsavel] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [fotoUrl, setFotoUrl] = useState<string | null>(null)
  const [fotoOrigem, setFotoOrigem] = useState<'nova' | 'salva' | null>(null)
  const [processandoFoto, setProcessandoFoto] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [abrirWebcamModal, setAbrirWebcamModal] = useState(false)

  const [tipoSaida, setTipoSaida] = useState<'temporaria' | 'definitiva'>('temporaria')
  const [motivoBaixa, setMotivoBaixa] = useState('INSTALAÇÃO DEFINITIVA NO CAMINHÃO')
  const [motivoBaixaOutro, setMotivoBaixaOutro] = useState('')

  const cameraInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Lista de mecânicos conhecidos com foto para sugestão rápida
  const mecanicosConhecidos = useMemo(() => {
    const mapa = new Map<string, string | null>()
    try {
      const storageMap = JSON.parse(localStorage.getItem('gvel_fotos_mecanicos') || '{}')
      Object.entries(storageMap).forEach(([nome, url]) => {
        if (typeof url === 'string') mapa.set(nome.toUpperCase().trim(), url)
      })
    } catch (e) {
      // ignore
    }
    if (retiradas) {
      retiradas.forEach((r) => {
        const n = r.responsavel?.toUpperCase().trim()
        if (n && !mapa.has(n)) {
          mapa.set(n, r.foto_responsavel_url || r.foto_url || null)
        } else if (n && !mapa.get(n) && (r.foto_responsavel_url || r.foto_url)) {
          mapa.set(n, r.foto_responsavel_url || r.foto_url || null)
        }
      })
    }
    return Array.from(mapa.entries()).map(([nome, foto]) => ({ nome, foto }))
  }, [retiradas])

  function handleResponsavelChange(nome: string) {
    setResponsavel(nome)
    setErro(null)
    // Se o usuário não tirou foto nesta sessão, busca foto salva automaticamente
    if (!fotoFile) {
      const salva = getFotoSalvaMecanico(nome, retiradas)
      if (salva) {
        setFotoUrl(salva)
        setFotoOrigem('salva')
      } else if (fotoOrigem === 'salva') {
        setFotoUrl(null)
        setFotoOrigem(null)
      }
    }
  }

  function selecionarMecanico(nome: string, foto: string | null) {
    setResponsavel(nome)
    setErro(null)
    if (foto && !fotoFile) {
      setFotoUrl(foto)
      setFotoOrigem('salva')
    }
  }

  function adicionarItem(f: Ferramenta) {
    setItensSelecionados((prev) => {
      const jaExiste = prev.find((item) => item.ferramenta.id === f.id)
      if (jaExiste) {
        return prev.map((item) =>
          item.ferramenta.id === f.id
            ? { ...item, quantidade: Math.min(f.quantidade_disponivel, item.quantidade + 1) }
            : item
        )
      }
      return [...prev, { ferramenta: f, quantidade: 1 }]
    })
    setErro(null)
  }

  function removerItem(ferramentaId: string) {
    setItensSelecionados((prev) => prev.filter((item) => item.ferramenta.id !== ferramentaId))
  }

  function ajustarQtdItem(ferramentaId: string, delta: number) {
    setItensSelecionados((prev) =>
      prev.map((item) => {
        if (item.ferramenta.id === ferramentaId) {
          const maxQtd = item.ferramenta.quantidade_disponivel || 1
          return { ...item, quantidade: Math.max(1, Math.min(maxQtd, item.quantidade + delta)) }
        }
        return item
      })
    )
  }

  async function handleFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setProcessandoFoto(true)
    setErro(null)
    try {
      const comprimida = await comprimirImagem(file)
      setFotoFile(comprimida)
      setFotoUrl(URL.createObjectURL(comprimida))
      setFotoOrigem('nova')
    } catch (err) {
      console.error('Erro ao processar foto:', err)
      setErro('Não foi possível processar a foto.')
    } finally {
      setProcessandoFoto(false)
    }
  }

  function removerFoto() {
    setFotoFile(null)
    setFotoUrl(null)
    setFotoOrigem(null)
    if (cameraInputRef.current) cameraInputRef.current.value = ''
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = async () => {
    if (itensSelecionados.length === 0) {
      setErro('Selecione ao menos uma ferramenta.')
      return
    }
    if (!responsavel.trim()) {
      setErro('Informe o nome do responsável.')
      return
    }
    setSalvando(true)
    setErro(null)
    try {
      let finalFotoUrl: string | null = fotoUrl || null
      if (fotoFile) {
        finalFotoUrl = await uploadFotoFerramenta(fotoFile)
      }

      // Salva no cadastro local para próximas retiradas
      if (finalFotoUrl && responsavel.trim()) {
        salvarFotoMecanico(responsavel.trim(), finalFotoUrl)
      }

      const veiculoEncontrado = veiculos.find((v) => placasSelecionadas.includes(v.placa.toUpperCase()))
      const placaString = placasSelecionadas.join(' / ')
      const respUpper = responsavel.toUpperCase().trim()
      const obsUpper = observacoes ? observacoes.toUpperCase() : undefined

      const motivoFinal =
        tipoSaida === 'definitiva'
          ? motivoBaixa === 'OUTRO'
            ? motivoBaixaOutro.trim() || 'OUTRO MOTIVO'
            : motivoBaixa
          : undefined

      await Promise.all(
        itensSelecionados.map((item) =>
          registrarRetiradaFerramenta({
            ferramenta_id: item.ferramenta.id,
            veiculo_id: veiculoEncontrado?.id || null,
            placa: placaString,
            responsavel: respUpper,
            quantidade: item.quantidade,
            tipo_saida: tipoSaida,
            motivo_baixa: motivoFinal,
            observacoes_retirada: obsUpper,
            foto_responsavel_url: finalFotoUrl,
            foto_url: finalFotoUrl,
          })
        )
      )
      await onSucesso()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao registrar retirada.')
    } finally {
      setSalvando(false)
    }
  }

  // estados para campo de placa manual
  const [placaInput, setPlacaInput] = useState('')

  function adicionarPlaca(p: string) {
    const limpa = p.trim().toUpperCase()
    if (!limpa) return
    const partes = limpa.split(/[,;/ ]+/).map((s) => s.trim().toUpperCase()).filter(Boolean)
    setPlacasSelecionadas((prev) => Array.from(new Set([...prev, ...partes])))
    setPlacaInput('')
  }

  function removerPlaca(p: string) {
    setPlacasSelecionadas((prev) => prev.filter((item) => item !== p))
  }

  function handleKeyDownPlaca(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',' || e.key === ';') {
      e.preventDefault()
      adicionarPlaca(placaInput)
    }
  }

  // Etapa inicial
  const stepInicial = 1

  function avancar() {
    setErro(null)
    if (step === 1 && itensSelecionados.length === 0) {
      setErro('Selecione ao menos uma ferramenta.')
      return
    }
    if (step === 2) {
      const finalPlacas = [...placasSelecionadas]
      if (placaInput.trim()) adicionarPlaca(placaInput)
      if (finalPlacas.length === 0 && !placaInput.trim()) {
        setErro('Selecione ao menos um caminhão.')
        return
      }
    }
    setStep((s) => s + 1)
  }

  const [buscaFerramenta, setBuscaFerramenta] = useState('')

  const ferramentasFiltradas = useMemo(() => {
    if (!buscaFerramenta.trim()) return []
    const termo = buscaFerramenta.trim().toLowerCase()
    return ferramentasDisponiveis.filter(
      (f) =>
        f.nome.toLowerCase().includes(termo) ||
        (f.codigo && f.codigo.toLowerCase().includes(termo))
    )
  }, [ferramentasDisponiveis, buscaFerramenta])

  const STEP_LABELS = ['Ferramentas', 'Caminhão', 'Finalizar']
  const stepLabel = (i: number) => i + 1

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-border/15 bg-surface shadow-2xl flex flex-col overflow-hidden" style={{ maxHeight: '90vh' }}>

        {/* ── Cabeçalho + barra de progresso ── */}
        <div className="px-6 pt-5 pb-4 border-b border-border/10 shrink-0">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-secondary mb-0.5">
                Etapa {step} de {STEP_LABELS.length}
              </p>
              <h2 className="text-xl font-black text-foreground leading-tight">
                {step === 1 && 'Quais ferramentas?'}
                {step === 2 && 'Para qual caminhão?'}
                {step === 3 && 'Quem está retirando?'}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-xl text-secondary hover:bg-background hover:text-foreground transition-colors shrink-0 mt-0.5"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Barra de progresso segmentada */}
          <div className="flex gap-1.5">
            {STEP_LABELS.map((label, i) => {
              const s = stepLabel(i)
              return (
                <div key={label} className="flex-1 space-y-1">
                  <div className={`h-1 rounded-full transition-all duration-500 ${
                    step > s ? 'bg-primary' : step === s ? 'bg-primary/50' : 'bg-border/25'
                  }`} />
                  <p className={`text-[9px] font-bold uppercase tracking-wider leading-none ${
                    step === s ? 'text-primary' : step > s ? 'text-secondary/60' : 'text-secondary/30'
                  }`}>{label}</p>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Conteúdo da etapa ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {erro && (
            <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/30 px-3 py-2.5 text-xs font-semibold text-red-400 flex items-center gap-2">
              <X className="h-3.5 w-3.5 shrink-0" />{erro}
            </div>
          )}

          {/* ETAPA 1 — Múltiplas Ferramentas com busca */}
          {step === 1 && (
            <div className="space-y-4">
              {/* Campo de Busca */}
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary pointer-events-none" />
                <Input
                  value={buscaFerramenta}
                  onChange={(e) => setBuscaFerramenta(e.target.value)}
                  placeholder="Buscar ferramenta para adicionar..."
                  className="pl-10 pr-9 py-2.5 text-sm bg-background border-border/30 rounded-xl"
                  autoFocus
                />
                {buscaFerramenta && (
                  <button
                    type="button"
                    onClick={() => setBuscaFerramenta('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary hover:text-foreground p-1"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Ferramentas Selecionadas */}
              {itensSelecionados.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase tracking-widest text-secondary">
                      Selecionadas ({itensSelecionados.length})
                    </p>
                    <span className="text-[10px] font-bold text-primary">
                      {itensSelecionados.reduce((acc, it) => acc + it.quantidade, 0)} unidade(s) total
                    </span>
                  </div>

                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {itensSelecionados.map(({ ferramenta, quantidade }) => (
                      <div
                        key={ferramenta.id}
                        className="rounded-xl border border-primary/40 bg-primary/10 p-3 flex items-center justify-between gap-3 shadow-sm"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-foreground truncate">{ferramenta.nome}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {ferramenta.codigo && (
                              <span className="text-[10px] text-secondary font-mono">[{ferramenta.codigo}]</span>
                            )}
                            <span className="text-[10px] text-secondary">
                              · máx: {ferramenta.quantidade_disponivel} disp.
                            </span>
                          </div>
                        </div>

                        {/* Stepper de Quantidade individual */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => ajustarQtdItem(ferramenta.id, -1)}
                            disabled={quantidade <= 1}
                            className="h-7 w-7 rounded-lg bg-surface border border-border/30 flex items-center justify-center text-sm font-bold text-foreground hover:bg-surface/80 disabled:opacity-30 transition-all"
                          >
                            −
                          </button>
                          <span className="w-6 text-center font-mono text-sm font-black text-foreground">
                            {quantidade}
                          </span>
                          <button
                            type="button"
                            onClick={() => ajustarQtdItem(ferramenta.id, 1)}
                            disabled={quantidade >= (ferramenta.quantidade_disponivel || 1)}
                            className="h-7 w-7 rounded-lg bg-surface border border-border/30 flex items-center justify-center text-sm font-bold text-foreground hover:bg-surface/80 disabled:opacity-30 transition-all"
                          >
                            +
                          </button>

                          <button
                            type="button"
                            onClick={() => removerItem(ferramenta.id)}
                            className="h-7 w-7 ml-1 rounded-lg text-secondary hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center transition-all"
                            title="Remover ferramenta"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Resultados da busca */}
              {buscaFerramenta.trim() !== '' && (
                <div className="space-y-2 pt-1 border-t border-border/10">
                  <p className="text-[10px] font-black uppercase tracking-widest text-secondary">
                    Resultados ({ferramentasFiltradas.length})
                  </p>
                  {ferramentasFiltradas.length > 0 ? (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {ferramentasFiltradas.map((f) => {
                        const jaSelecionada = itensSelecionados.some((it) => it.ferramenta.id === f.id)
                        return (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => {
                              adicionarItem(f)
                              setBuscaFerramenta('')
                            }}
                            className={`w-full flex items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-left transition-all border ${
                              jaSelecionada
                                ? 'bg-primary/15 border-primary/50 text-foreground'
                                : 'bg-background/60 border-border/20 text-secondary hover:border-border/50 hover:text-foreground'
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold truncate">{f.nome}</p>
                              {f.codigo && <p className="text-[10px] text-secondary font-mono mt-0.5">[{f.codigo}]</p>}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs font-black font-mono text-secondary">
                                {f.quantidade_disponivel}x disp.
                              </span>
                              <span className="text-[10px] font-bold uppercase bg-primary/20 text-primary px-2 py-0.5 rounded-md">
                                {jaSelecionada ? '+ Mais 1' : '+ Adicionar'}
                              </span>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="py-6 text-center text-xs text-secondary bg-background/30 rounded-xl border border-dashed border-border/20">
                      Nenhuma ferramenta encontrada com esse termo.
                    </div>
                  )}
                </div>
              )}

              {/* Mensagem quando nenhuma ferramenta foi selecionada e nada foi buscado */}
              {buscaFerramenta.trim() === '' && itensSelecionados.length === 0 && (
                <div className="py-8 text-center text-xs text-secondary bg-background/20 rounded-xl border border-dashed border-border/20 px-4">
                  🔍 Digite no campo acima para pesquisar e adicionar as ferramentas que deseja retirar.
                </div>
              )}
            </div>
          )}

          {/* ETAPA 2 — Caminhão */}
          {step === 2 && (
            <div className="space-y-4">
              {/* Campo de Busca / Digitação de Placa */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black uppercase tracking-widest text-secondary">
                  Buscar ou Digitar Placa *
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary pointer-events-none" />
                    <Input
                      value={placaInput}
                      onChange={(e) => setPlacaInput(e.target.value.toUpperCase())}
                      onKeyDown={handleKeyDownPlaca}
                      placeholder="Digite a placa (ex: ABC1D23)..."
                      className="pl-10 pr-9 py-2.5 font-mono text-sm uppercase bg-background border-border/30 rounded-xl"
                      autoFocus
                    />
                    {placaInput && (
                      <button
                        type="button"
                        onClick={() => setPlacaInput('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary hover:text-foreground p-1"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={() => adicionarPlaca(placaInput)}
                    disabled={!placaInput.trim()}
                    className="shrink-0 !h-10 px-4 text-xs font-bold"
                  >
                    + Adicionar
                  </Button>
                </div>
              </div>

              {/* Placas Selecionadas */}
              {placasSelecionadas.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-secondary">
                    Placa(s) Selecionada(s) ({placasSelecionadas.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {placasSelecionadas.map((p) => (
                      <span
                        key={p}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/15 border border-primary/40 text-primary font-mono text-xs font-bold shadow-sm"
                      >
                        🚛 {p}
                        <button
                          type="button"
                          onClick={() => removerPlaca(p)}
                          className="hover:text-red-400 p-0.5 rounded transition-colors"
                          title="Remover placa"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Sugestões baseadas na digitação */}
              {placaInput.trim() !== '' && (
                <div className="space-y-2 pt-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-secondary">
                    Sugestões encontradas
                  </p>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {veiculos
                      .filter((v) => v.placa.toUpperCase().includes(placaInput.trim()))
                      .map((v) => {
                        const sel = placasSelecionadas.includes(v.placa.toUpperCase())
                        return (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => {
                              if (sel) {
                                removerPlaca(v.placa.toUpperCase())
                              } else {
                                adicionarPlaca(v.placa.toUpperCase())
                              }
                            }}
                            className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border transition-all text-left ${
                              sel
                                ? 'bg-primary/15 border-primary/50 text-primary'
                                : 'bg-background/60 border-border/20 text-secondary hover:border-border/50 hover:text-foreground'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <Truck className={`h-4 w-4 shrink-0 ${sel ? 'text-primary' : 'text-secondary/50'}`} />
                              <span className="font-mono text-xs font-bold">{v.placa}</span>
                            </div>
                            <span className="text-[10px] font-bold uppercase">
                              {sel ? '✓ Selecionado' : '+ Selecionar'}
                            </span>
                          </button>
                        )
                      })}

                    {/* Opção de adicionar como nova placa se não for correspondência exata */}
                    {!veiculos.some((v) => v.placa.toUpperCase() === placaInput.trim()) && (
                      <button
                        type="button"
                        onClick={() => adicionarPlaca(placaInput)}
                        className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border border-dashed border-primary/40 bg-primary/5 text-primary hover:bg-primary/10 transition-all text-left"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-xs">➕</span>
                          <span className="font-mono text-xs font-bold">Usar placa: {placaInput.trim()}</span>
                        </div>
                        <span className="text-[10px] font-bold uppercase">+ Adicionar</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Mensagem quando não digitou nada e ainda não selecionou */}
              {placaInput.trim() === '' && placasSelecionadas.length === 0 && (
                <div className="py-8 text-center text-xs text-secondary bg-background/20 rounded-xl border border-dashed border-border/20 px-4">
                  🚛 Digite a placa do caminhão no campo acima para pesquisar ou adicionar.
                </div>
              )}
            </div>
          )}

          {/* ETAPA 3 — Responsável + Foto + Resumo de Múltiplos Itens + Observações */}
          {step === 3 && (
            <div className="space-y-4">
              {/* Resumo compacto de Itens e Caminhões */}
              <div className="rounded-xl bg-background/50 border border-border/20 px-4 py-3 space-y-2.5">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-secondary">
                      Ferramentas a retirar ({itensSelecionados.length})
                    </span>
                    <span className="text-[10px] font-bold text-primary">
                      Total: {itensSelecionados.reduce((acc, it) => acc + it.quantidade, 0)} un.
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                    {itensSelecionados.map(({ ferramenta, quantidade }) => (
                      <span
                        key={ferramenta.id}
                        className="inline-flex items-center gap-1 text-[11px] font-bold bg-primary/15 text-primary px-2 py-0.5 rounded-lg border border-primary/30"
                      >
                        🔧 {ferramenta.nome} ({quantidade}x)
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-border/10">
                  <span className="text-[10px] font-black uppercase tracking-widest text-secondary block mb-1">
                    Caminhão(ões)
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {placasSelecionadas.map((p) => (
                      <span key={p} className="font-mono text-[11px] font-bold text-foreground bg-surface px-2 py-0.5 rounded border border-border/20">
                        🚛 {p}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* TIPO DE SAÍDA: VAI E VOLTA (EMPRÉSTIMO) OU NÃO VOLTA (SAÍDA TOTAL / BAIXA DEFINITIVA) */}
              <div className="space-y-2">
                <label className="block text-[11px] font-black text-secondary uppercase tracking-widest">
                  Tipo de Saída da Ferramenta *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTipoSaida('temporaria')}
                    className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                      tipoSaida === 'temporaria'
                        ? 'border-amber-500/80 bg-amber-500/10 shadow-sm'
                        : 'border-border/20 bg-background/50 hover:border-border/50'
                    }`}
                  >
                    <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                      tipoSaida === 'temporaria' ? 'bg-amber-500 text-black' : 'bg-surface text-secondary'
                    }`}>
                      <RotateCcw className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black text-foreground uppercase">
                          Vai e Volta (Empréstimo)
                        </span>
                        {tipoSaida === 'temporaria' && (
                          <span className="text-[9px] font-black text-amber-400">✓</span>
                        )}
                      </div>
                      <p className="text-[11px] text-secondary mt-0.5 leading-snug">
                        Uso temporário. A ferramenta sairá e retornará para a oficina após o serviço.
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTipoSaida('definitiva')}
                    className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                      tipoSaida === 'definitiva'
                        ? 'border-rose-500/80 bg-rose-500/10 shadow-sm'
                        : 'border-border/20 bg-background/50 hover:border-border/50'
                    }`}
                  >
                    <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                      tipoSaida === 'definitiva' ? 'bg-rose-600 text-white' : 'bg-surface text-secondary'
                    }`}>
                      <Trash2 className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black text-foreground uppercase">
                          Não Volta (Saída Total / Baixa)
                        </span>
                        {tipoSaida === 'definitiva' && (
                          <span className="text-[9px] font-black text-rose-400">✓</span>
                        )}
                      </div>
                      <p className="text-[11px] text-secondary mt-0.5 leading-snug">
                        Baixa definitiva. A ferramenta não retorna e é descontada do estoque total.
                      </p>
                    </div>
                  </button>
                </div>

                {/* Se for saída definitiva (não volta), seleciona o motivo da baixa */}
                {tipoSaida === 'definitiva' && (
                  <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/5 space-y-2 animate-fade-in">
                    <label className="block text-[10px] font-black text-rose-400 uppercase tracking-widest">
                      Motivo da Saída Definitiva / Baixa *
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {[
                        'INSTALAÇÃO DEFINITIVA NO CAMINHÃO',
                        'ENTREGA AO CLIENTE / MOTORISTA',
                        'DESCARTE / SUCATA / AVARIADA',
                        'PERDA / EXTRAVIO',
                        'OUTRO',
                      ].map((mot) => (
                        <button
                          key={mot}
                          type="button"
                          onClick={() => setMotivoBaixa(mot)}
                          className={`px-2.5 py-1.5 rounded-lg text-left text-[11px] font-bold border transition-all cursor-pointer ${
                            motivoBaixa === mot
                              ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                              : 'bg-surface text-secondary hover:text-foreground border-border/20'
                          }`}
                        >
                          {mot === 'OUTRO' ? '✏️ OUTRO MOTIVO' : mot}
                        </button>
                      ))}
                    </div>

                    {motivoBaixa === 'OUTRO' && (
                      <Input
                        placeholder="Especifique o motivo da baixa..."
                        value={motivoBaixaOutro}
                        onChange={(e) => setMotivoBaixaOutro(e.target.value.toUpperCase())}
                        className="text-xs uppercase mt-2"
                        autoFocus
                      />
                    )}
                  </div>
                )}
              </div>

              {/* Responsável */}
              <div>
                <label htmlFor="resp" className="block text-[11px] font-black text-secondary uppercase tracking-widest mb-1.5">
                  Nome do Responsável *
                </label>
                <Input
                  id="resp"
                  list="mecanicos-sugestoes-retirada"
                  value={responsavel}
                  onChange={(e) => handleResponsavelChange(e.target.value)}
                  placeholder="Mecânico ou motorista que está retirando..."
                  autoFocus
                  className="text-sm"
                />
                <datalist id="mecanicos-sugestoes-retirada">
                  {mecanicosConhecidos.map((m) => (
                    <option key={m.nome} value={m.nome} />
                  ))}
                </datalist>

                {/* Mecânicos Frequentes com Foto para seleção rápida */}
                {mecanicosConhecidos.length > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="text-[9px] uppercase font-black tracking-wider text-secondary mr-0.5">Mecânicos:</span>
                    {mecanicosConhecidos.slice(0, 5).map((m) => {
                      const isSel = responsavel.toUpperCase().trim() === m.nome
                      return (
                        <button
                          type="button"
                          key={m.nome}
                          onClick={() => selecionarMecanico(m.nome, m.foto)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all ${
                            isSel
                              ? 'bg-primary/20 border-primary text-primary shadow-sm'
                              : 'bg-background/60 border-border/20 text-secondary hover:border-primary/40 hover:text-foreground'
                          }`}
                        >
                          {m.foto ? (
                            <img src={m.foto} alt={m.nome} loading="lazy" decoding="async" className="h-4 w-4 rounded-full object-cover shrink-0" />
                          ) : (
                            <span className="text-[10px]">👤</span>
                          )}
                          <span>{m.nome}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Foto da Pessoa / Responsável */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-black text-secondary uppercase tracking-widest">
                    Foto da Pessoa / Responsável
                  </label>
                  <span className="text-[10px] text-secondary font-medium">opcional</span>
                </div>

                {/* Modal de Câmera do Notebook / Webcam Ao Vivo */}
                {abrirWebcamModal && (
                  <CameraWebcamModal
                    titulo="Câmera do Notebook / Webcam"
                    subtitulo="Posicione a pessoa no centro e clique em Capturar Foto"
                    onCapture={(file, url) => {
                      setFotoFile(file)
                      setFotoUrl(url)
                      setFotoOrigem('nova')
                    }}
                    onClose={() => setAbrirWebcamModal(false)}
                  />
                )}

                {/* Inputs de arquivo ocultos */}
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFotoChange}
                  className="hidden"
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFotoChange}
                  className="hidden"
                />

                {processandoFoto ? (
                  <div className="flex items-center justify-center gap-2 p-4 rounded-xl border border-dashed border-primary/40 bg-primary/5 text-primary text-xs font-semibold">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processando foto...
                  </div>
                ) : fotoUrl ? (
                  <div className="relative flex items-center gap-3 p-3 rounded-xl border border-primary/40 bg-primary/10">
                    <img
                      src={fotoUrl}
                      alt="Responsável"
                      className="h-16 w-16 rounded-xl object-cover border border-primary/30 shadow-sm shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-black uppercase text-primary tracking-wider bg-primary/20 px-2 py-0.5 rounded">
                          {fotoOrigem === 'salva' ? 'FOTO DO CADASTRO ✓' : 'FOTO ANEXADA ✓'}
                        </span>
                      </div>
                      <p className="text-xs text-secondary truncate mt-1">
                        {fotoOrigem === 'salva'
                          ? 'Foto recuperada automaticamente deste mecânico'
                          : 'Foto capturada com sucesso'}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        <button
                          type="button"
                          onClick={() => setAbrirWebcamModal(true)}
                          className="text-[11px] text-primary hover:underline font-semibold flex items-center gap-1"
                        >
                          <Camera className="h-3 w-3" /> Abrir Câmera
                        </button>
                        <span className="text-secondary">·</span>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="text-[11px] text-primary hover:underline font-semibold flex items-center gap-1"
                        >
                          <ImageIcon className="h-3 w-3" /> Trocar por Arquivo
                        </button>
                        <span className="text-secondary">·</span>
                        <button
                          type="button"
                          onClick={removerFoto}
                          className="text-[11px] text-red-400 hover:underline font-semibold"
                        >
                          Remover
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setAbrirWebcamModal(true)}
                      className="flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl border border-primary/50 bg-primary/10 hover:bg-primary/20 text-primary transition-all group active:scale-98 shadow-sm cursor-pointer"
                    >
                      <Camera className="h-4 w-4 shrink-0 group-hover:scale-110 transition-transform" />
                      <span className="text-xs font-black uppercase">Câmera</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl border border-dashed border-border/40 bg-background/60 hover:bg-surface hover:border-primary/50 text-foreground transition-all group active:scale-98 cursor-pointer"
                    >
                      <ImageIcon className="h-4 w-4 text-secondary group-hover:text-primary transition-colors shrink-0" />
                      <span className="text-xs font-bold uppercase">Galeria / Arquivo</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Observações */}
              <div>
                <label htmlFor="obs" className="block text-[11px] font-black text-secondary uppercase tracking-widest mb-1.5">
                  Observações <span className="font-normal normal-case text-secondary/40">(opcional)</span>
                </label>
                <Input
                  id="obs"
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Ex: manutenção preventiva, troca de pneu..."
                  className="text-sm"
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Rodapé com navegação ── */}
        <div className="shrink-0 px-6 py-4 border-t border-border/10 flex gap-3">
          {step > stepInicial ? (
            <button
              type="button"
              onClick={() => { setErro(null); setStep((s) => s - 1) }}
              disabled={salvando}
              className="h-11 px-5 rounded-xl border border-border/30 bg-background text-sm font-semibold text-secondary hover:text-foreground hover:border-border/60 disabled:opacity-40 transition-all"
            >
              ← Voltar
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="h-11 px-5 rounded-xl border border-border/30 bg-background text-sm font-semibold text-secondary hover:text-foreground hover:border-border/60 transition-all"
            >
              Cancelar
            </button>
          )}

          {step < 3 ? (
            <button
              type="button"
              onClick={avancar}
              className="flex-1 h-11 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-sm transition-all"
            >
              Próximo →
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={salvando || !responsavel.trim() || itensSelecionados.length === 0}
              className={`flex-1 h-11 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg ${
                tipoSaida === 'definitiva'
                  ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                  : 'bg-primary hover:bg-primary/90 shadow-primary/20'
              }`}
            >
              {salvando ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Registrando...
                </>
              ) : tipoSaida === 'definitiva' ? (
                <>
                  <Trash2 className="h-4 w-4" /> Confirmar Baixa Total (Não Volta) ({itensSelecionados.length})
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4" /> Confirmar Saída (Vai e Volta) ({itensSelecionados.length})
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------------------------
// Subcomponente: Modal de Devolução de Ferramenta
// ----------------------------------------------------------------------------------
function ModalDevolucao({
  retirada,
  onClose,
  onSucesso,
}: {
  retirada: FerramentaRetirada
  onClose: () => void
  onSucesso: () => Promise<void>
}) {
  const [statusDevolucao, setStatusDevolucao] = useState<'devolvido' | 'avaria_perda'>('devolvido')
  const [observacoes, setObservacoes] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSalvando(true)
    setErro(null)

    try {
      await registrarDevolucaoFerramenta({
        retiradaId: retirada.id,
        status: statusDevolucao,
        observacoes_devolucao: observacoes.toUpperCase(),
      })
      await onSucesso()
    } catch (err) {
      setErro(err instanceof Error ? err.message.toUpperCase() : 'ERRO AO REGISTRAR DEVOLUÇÃO.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 uppercase">
      <div className="w-full max-w-md rounded-2xl border border-border/10 bg-surface p-6 shadow-2xl animate-scale-in">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-500">
              <RotateCcw className="h-4 w-4" />
            </div>
            <h2 className="text-base font-bold text-foreground uppercase">REGISTRAR DEVOLUÇÃO</h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-secondary hover:bg-overlay/10 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {erro && <p className="mb-4 text-sm text-status-danger uppercase font-bold">{erro}</p>}

        {/* Resumo da Retirada */}
        <div className="mb-4 rounded-xl border border-border/10 bg-background p-3.5 space-y-1.5 text-xs text-secondary uppercase font-medium">
          <p>
            FERRAMENTA: <strong className="text-foreground font-bold">{retirada.ferramenta?.nome?.toUpperCase() || 'FERRAMENTA'}</strong>
          </p>
          <p>
            PLACA DO CAMINHÃO: <strong className="text-primary font-mono font-bold">{retirada.placa}</strong>
          </p>
          <p>
            RESPONSÁVEL: <strong className="text-foreground font-bold">{retirada.responsavel}</strong> ({retirada.quantidade} UN.)
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="condicao" className="uppercase font-bold">CONDIÇÃO DA DEVOLUÇÃO</Label>
            <select
              id="condicao"
              value={statusDevolucao}
              onChange={(e) => setStatusDevolucao(e.target.value as 'devolvido' | 'avaria_perda')}
              className="h-10 w-full rounded-xl border border-border/10 bg-background px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary uppercase font-medium"
            >
              <option value="devolvido">DEVOLVIDA EM BOM ESTADO (RETORNA AO ESTOQUE)</option>
              <option value="avaria_perda">COM AVARIA / PERDA / DESGASTE (BAIXA DO ESTOQUE)</option>
            </select>
          </div>

          <div>
            <Label htmlFor="obsDev" className="uppercase font-bold">OBSERVAÇÕES DA DEVOLUÇÃO</Label>
            <Input
              id="obsDev"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="EX: DEVOLVIDO LIMPO, SEM DANOS..."
              className="uppercase"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={salvando} className="uppercase font-semibold">
              CANCELAR
            </Button>
            <Button type="submit" disabled={salvando} className="bg-emerald-600 hover:bg-emerald-500 uppercase font-bold">
              {salvando ? 'SALVANDO...' : 'CONFIRMAR DEVOLUÇÃO'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------------------------
// Subcomponente: Modal de Edição de Retirada / Saída de Ferramenta
// ----------------------------------------------------------------------------------
function ModalEditarRetirada({
  retirada,
  ferramentas,
  veiculos,
  onClose,
  onSucesso,
}: {
  retirada: FerramentaRetirada
  ferramentas: Ferramenta[]
  veiculos: { id: string; placa: string }[]
  onClose: () => void
  onSucesso: () => Promise<void>
}) {
  const [ferramentaId, setFerramentaId] = useState(retirada.ferramenta_id)
  const [placa, setPlaca] = useState(retirada.placa || '')
  const [responsavel, setResponsavel] = useState(retirada.responsavel || '')
  const [quantidade, setQuantidade] = useState(retirada.quantidade || 1)

  const dataInicial = useMemo(() => {
    try {
      if (retirada.data_hora_retirada) {
        const d = new Date(retirada.data_hora_retirada)
        return format(d, "yyyy-MM-dd'T'HH:mm")
      }
    } catch {}
    return format(new Date(), "yyyy-MM-dd'T'HH:mm")
  }, [retirada.data_hora_retirada])

  const [dataHoraRetirada, setDataHoraRetirada] = useState(dataInicial)
  const [observacoes, setObservacoes] = useState(
    retirada.observacoes_retirada ? retirada.observacoes_retirada.replace(/\[FOTO:.*?\]/g, '').trim() : ''
  )
  const [fotoUrl, setFotoUrl] = useState<string | null>(retirada.foto_responsavel_url || retirada.foto_url || null)
  const [abrirWebcamModal, setAbrirWebcamModal] = useState(false)
  const [comprimindoFoto, setComprimindoFoto] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [excluindo, setExcluindo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFotoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      setComprimindoFoto(true)
      const compressed = await comprimirImagem(file)
      const url = await uploadFotoFerramenta(compressed)
      setFotoUrl(url)
    } catch (err) {
      console.error(err)
      setErro('ERRO AO PROCESSAR IMAGEM.')
    } finally {
      setComprimindoFoto(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleWebcamFoto = (blob: Blob) => {
    const file = new File([blob], `foto-retirada-${Date.now()}.jpg`, { type: 'image/jpeg' })
    uploadFotoFerramenta(file).then((url) => {
      setFotoUrl(url)
    }).catch((err) => {
      console.error(err)
      setErro('ERRO AO SALVAR FOTO DA CÂMERA.')
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!responsavel.trim()) {
      setErro('INFORME O NOME DO RESPONSÁVEL.')
      return
    }
    if (!placa.trim()) {
      setErro('INFORME A PLACA OU DESTINO.')
      return
    }
    if (quantidade < 1) {
      setErro('A QUANTIDADE DEVE SER NO MÍNIMO 1.')
      return
    }

    setSalvando(true)
    setErro(null)

    try {
      let isoDate: string | undefined = undefined
      if (dataHoraRetirada) {
        isoDate = new Date(dataHoraRetirada).toISOString()
      }

      await atualizarRetiradaFerramenta({
        id: retirada.id,
        ferramenta_id: ferramentaId,
        placa: placa.toUpperCase(),
        responsavel: responsavel.toUpperCase(),
        quantidade: Number(quantidade),
        observacoes_retirada: observacoes.toUpperCase(),
        data_hora_retirada: isoDate,
        foto_responsavel_url: fotoUrl,
        foto_url: fotoUrl,
      })

      await onSucesso()
    } catch (err) {
      setErro(err instanceof Error ? err.message.toUpperCase() : 'ERRO AO ATUALIZAR RETIRADA.')
    } finally {
      setSalvando(false)
    }
  }

  const handleExcluir = async () => {
    if (!confirm(`DESEJA REALMENTE EXCLUIR ESTE REGISTRO DE RETIRADA?\n\nSE A FERRAMENTA ESTIVER EM USO, A QUANTIDADE SERÁ RESTAURADA NO ESTOQUE AUTOMATICAMENTE.`)) {
      return
    }

    setExcluindo(true)
    setErro(null)

    try {
      await excluirRetiradaFerramenta(retirada.id)
      await onSucesso()
    } catch (err) {
      setErro(err instanceof Error ? err.message.toUpperCase() : 'ERRO AO EXCLUIR RETIRADA.')
    } finally {
      setExcluindo(false)
    }
  }

  const DESTINOS_RAPIDOS = [
    'USO / E / CONSUMO / PESADA',
    'USO / E / CONSUMO / FUNILARIA',
    'USO / E / CONSUMO / ELÉTRICA',
    'OFICINA',
    'BORRACHARIA',
    'SOCORRO',
  ]

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 uppercase overflow-y-auto py-6">
        <div className="w-full max-w-lg rounded-2xl border border-border/20 bg-surface p-6 shadow-2xl animate-scale-in max-h-[92vh] flex flex-col justify-between">
          <div className="shrink-0 mb-4 flex items-center justify-between border-b border-border/10 pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 text-primary">
                <Pencil className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground uppercase">EDITAR RETIRADA / SAÍDA</h2>
                <p className="text-[11px] text-secondary font-medium">MODIFIQUE OS DADOS DO REGISTRO OU QUANTIDADE</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-md text-secondary hover:bg-overlay/10 hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {erro && (
            <div className="mb-4 rounded-xl border border-status-danger/30 bg-status-danger/10 p-3 text-xs text-status-danger uppercase font-bold">
              {erro}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto pr-1 flex-1">
            {/* Seleção de Ferramenta */}
            <div>
              <Label htmlFor="ferramentaEdit" className="uppercase font-bold text-xs">
                Ferramenta
              </Label>
              <select
                id="ferramentaEdit"
                value={ferramentaId}
                onChange={(e) => setFerramentaId(e.target.value)}
                className="mt-1 h-10 w-full rounded-xl border border-border/20 bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary uppercase font-bold"
              >
                {ferramentas.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome} {f.codigo ? `(${f.codigo})` : ''} — DISP: {f.quantidade_disponivel} / TOTAL: {f.quantidade_total}
                  </option>
                ))}
              </select>
            </div>

            {/* Placa / Caminhão ou Setor */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label htmlFor="placaEdit" className="uppercase font-bold text-xs">
                  Placa / Caminhão ou Destino *
                </Label>
              </div>
              <Input
                id="placaEdit"
                value={placa}
                onChange={(e) => setPlaca(e.target.value.toUpperCase())}
                placeholder="EX: RGC7A66 OU USO / E / CONSUMO / PESADA"
                className="uppercase font-mono text-xs font-bold"
                required
              />

              {/* Botões Rápidos de Destino */}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {DESTINOS_RAPIDOS.map((dest) => (
                  <button
                    key={dest}
                    type="button"
                    onClick={() => setPlaca(dest)}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md border transition-all ${
                      placa === dest
                        ? 'bg-primary/20 border-primary text-primary'
                        : 'bg-background/60 border-border/20 text-secondary hover:text-foreground hover:border-border/50'
                    }`}
                  >
                    {dest}
                  </button>
                ))}
              </div>

              {/* Sugestões de Veículos Cadastrados */}
              {veiculos.length > 0 && placa.trim().length >= 2 && !DESTINOS_RAPIDOS.includes(placa) && (
                <div className="mt-2 flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                  {veiculos
                    .filter((v) => v.placa.toUpperCase().includes(placa.trim().toUpperCase()))
                    .slice(0, 5)
                    .map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setPlaca(v.placa)}
                        className="text-[10px] font-mono font-bold bg-primary/10 text-primary border border-primary/30 px-2 py-0.5 rounded"
                      >
                        🚛 {v.placa}
                      </button>
                    ))}
                </div>
              )}
            </div>

            {/* Responsável e Quantidade */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="respEdit" className="uppercase font-bold text-xs">
                  Responsável *
                </Label>
                <Input
                  id="respEdit"
                  value={responsavel}
                  onChange={(e) => setResponsavel(e.target.value.toUpperCase())}
                  placeholder="NOME DO RESPONSÁVEL"
                  className="mt-1 uppercase text-xs font-bold"
                  required
                />
              </div>

              <div>
                <Label htmlFor="qtdEdit" className="uppercase font-bold text-xs">
                  Quantidade Retirada *
                </Label>
                <Input
                  id="qtdEdit"
                  type="number"
                  min="1"
                  value={quantidade}
                  onChange={(e) => setQuantidade(Math.max(1, parseInt(e.target.value) || 1))}
                  className="mt-1 font-mono text-xs font-bold"
                  required
                />
              </div>
            </div>

            {/* Data / Hora Retirada */}
            <div>
              <Label htmlFor="dataEdit" className="uppercase font-bold text-xs">
                Data e Hora da Retirada
              </Label>
              <Input
                id="dataEdit"
                type="datetime-local"
                value={dataHoraRetirada}
                onChange={(e) => setDataHoraRetirada(e.target.value)}
                className="mt-1 font-mono text-xs"
              />
            </div>

            {/* Foto do Responsável / Comprovante */}
            <div>
              <Label className="uppercase font-bold text-xs mb-1.5 block">
                Foto do Responsável / Comprovante
              </Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFotoFile}
                className="hidden"
              />

              {fotoUrl ? (
                <div className="flex items-center gap-3 p-2.5 rounded-xl border border-border/20 bg-background/50">
                  <img
                    src={fotoUrl}
                    alt="Foto do Responsável"
                    className="h-12 w-12 rounded-xl object-cover border border-primary/40"
                  />
                  <div className="flex-1 space-y-1">
                    <p className="text-[11px] font-bold text-foreground uppercase">Foto Registrada</p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setAbrirWebcamModal(true)}
                        className="text-[10px] text-primary hover:underline font-bold flex items-center gap-1"
                      >
                        <Camera className="h-3 w-3" /> Tirar Nova Foto
                      </button>
                      <span className="text-secondary text-[10px]">·</span>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-[10px] text-primary hover:underline font-bold flex items-center gap-1"
                      >
                        <ImageIcon className="h-3 w-3" /> Trocar
                      </button>
                      <span className="text-secondary text-[10px]">·</span>
                      <button
                        type="button"
                        onClick={() => setFotoUrl(null)}
                        className="text-[10px] text-rose-400 hover:underline font-bold"
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAbrirWebcamModal(true)}
                    className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary transition-all text-xs font-bold cursor-pointer"
                  >
                    <Camera className="h-4 w-4" /> Câmera
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={comprimindoFoto}
                    className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-border/20 bg-background hover:bg-surface text-secondary hover:text-foreground transition-all text-xs font-bold cursor-pointer"
                  >
                    {comprimindoFoto ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ImageIcon className="h-4 w-4" />
                    )}
                    Galeria / Arquivo
                  </button>
                </div>
              )}
            </div>

            {/* Observações */}
            <div>
              <Label htmlFor="obsRetEdit" className="uppercase font-bold text-xs">
                Observações
              </Label>
              <Input
                id="obsRetEdit"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="OBSERVAÇÕES ADICIONAIS..."
                className="mt-1 uppercase text-xs"
              />
            </div>

            {/* Rodapé de Botões */}
            <div className="pt-3 border-t border-border/10 flex items-center justify-between gap-2 shrink-0">
              <Button
                type="button"
                variant="secondary"
                onClick={handleExcluir}
                disabled={salvando || excluindo}
                className="text-xs border-rose-500/30 text-rose-400 hover:bg-rose-500/10 hover:border-rose-500 uppercase font-bold gap-1"
              >
                {excluindo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                EXCLUIR
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={onClose}
                  disabled={salvando || excluindo}
                  className="uppercase font-bold text-xs"
                >
                  CANCELAR
                </Button>
                <Button
                  type="submit"
                  disabled={salvando || excluindo}
                  className="bg-primary hover:bg-primary/90 text-white uppercase font-bold text-xs gap-1.5"
                >
                  {salvando ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> SALVANDO...
                    </>
                  ) : (
                    'SALVAR ALTERAÇÕES'
                  )}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {abrirWebcamModal && (
        <CameraWebcamModal
          onCapture={handleWebcamFoto}
          onClose={() => setAbrirWebcamModal(false)}
        />
      )}
    </>
  )
}

// ----------------------------------------------------------------------------------
// Subcomponente: Modal de Cadastro / Edição de Caixa de Ferramentas
// ----------------------------------------------------------------------------------
function ModalCaixaFerramenta({
  caixa,
  ferramentasDisponiveis,
  onClose,
  onSalvo,
}: {
  caixa: CaixaFerramenta | null
  ferramentasDisponiveis: Ferramenta[]
  onClose: () => void
  onSalvo: (caixa: CaixaFerramenta) => Promise<void>
}) {
  const [nome, setNome] = useState(caixa?.nome || '')
  const [codigo, setCodigo] = useState(caixa?.codigo || '')
  const [localizacao, setLocalizacao] = useState(caixa?.localizacao || '')
  const [status, setStatus] = useState<'disponivel' | 'em_uso' | 'manutencao'>(caixa?.status || 'disponivel')
  const [observacoes, setObservacoes] = useState(caixa?.observacoes || '')
  const [itens, setItens] = useState<ItemCaixa[]>(
    caixa?.itens || [
      { id: '1', nome: 'Jogo de Chaves Combinadas', quantidade: 1 },
      { id: '2', nome: 'Alicate de Pressão', quantidade: 1 },
    ],
  )

  // Novo item para adicionar
  const [novoItemNome, setNovoItemNome] = useState('')
  const [novoItemQtd, setNovoItemQtd] = useState('1')

  // Foto da Caixa
  const [fotoUrl, setFotoUrl] = useState(caixa?.foto_url || '')
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [processandoFoto, setProcessandoFoto] = useState(false)
  const [abrirWebcamModal, setAbrirWebcamModal] = useState(false)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galeriaInputRef = useRef<HTMLInputElement>(null)

  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const handleFotoSelecionada = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setProcessandoFoto(true)
    setErro(null)
    try {
      const comprimida = await comprimirImagem(file)
      setFotoFile(comprimida)
      setFotoUrl(URL.createObjectURL(comprimida))
    } catch (err) {
      console.error('Erro ao processar imagem:', err)
      setErro('Não foi possível processar a foto.')
    } finally {
      setProcessandoFoto(false)
    }
  }

  function adicionarItemNaCaixa() {
    if (!novoItemNome.trim()) return
    const novoItem: ItemCaixa = {
      id: String(Date.now()),
      nome: novoItemNome.trim().toUpperCase(),
      quantidade: Math.max(1, Number(novoItemQtd) || 1),
    }
    setItens((prev) => [...prev, novoItem])
    setNovoItemNome('')
    setNovoItemQtd('1')
  }

  function removerItemDaCaixa(id: string) {
    setItens((prev) => prev.filter((it) => it.id !== id))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome.trim()) {
      setErro('Informe o nome da caixa de ferramentas.')
      return
    }

    setSalvando(true)
    setErro(null)

    try {
      let finalFotoUrl: string | null = fotoUrl || null
      if (fotoFile) {
        finalFotoUrl = await uploadFotoFerramenta(fotoFile)
      }

      const dadosSalvar: CaixaFerramenta = {
        id: caixa?.id || `caixa_${Date.now()}`,
        nome: nome.trim().toUpperCase(),
        codigo: codigo.trim().toUpperCase() || undefined,
        localizacao: localizacao.trim().toUpperCase() || undefined,
        status: status,
        foto_url: finalFotoUrl,
        itens: itens,
        observacoes: observacoes.trim() || undefined,
        responsavel: caixa?.responsavel,
        placa: caixa?.placa,
        data_retirada: caixa?.data_retirada,
        created_at: caixa?.created_at || new Date().toISOString(),
      }

      await onSalvo(dadosSalvar)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar caixa de ferramentas.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl max-h-[90vh] flex flex-col rounded-2xl border border-border/30 bg-surface p-6 shadow-2xl animate-scale-in">
        {/* Cabeçalho */}
        <div className="mb-4 flex items-center justify-between border-b border-border/20 pb-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary border border-primary/20 text-xl">
              🧰
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">
                {caixa ? 'Editar Caixa de Ferramentas' : 'Nova Caixa de Ferramentas'}
              </h2>
              <p className="text-xs text-secondary">Monte e organize kits e caixas completas da oficina</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-secondary hover:bg-background hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {erro && (
          <div className="mb-3 rounded-xl bg-status-danger/10 border border-status-danger/30 p-3 text-xs font-semibold text-status-danger shrink-0">
            {erro}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto pr-1 flex-1">
          {/* Nome e Código */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label htmlFor="nomeCaixa" className="block text-xs font-bold text-foreground uppercase tracking-wide mb-1">
                Nome da Caixa / Kit *
              </label>
              <Input
                id="nomeCaixa"
                value={nome}
                onChange={(e) => setNome(e.target.value.toUpperCase())}
                placeholder="Ex: CAIXA 01 - MECÂNICA PESADA"
                required
                className="uppercase"
              />
            </div>
            <div>
              <label htmlFor="codCaixa" className="block text-xs font-bold text-foreground uppercase tracking-wide mb-1">
                Código / Tag
              </label>
              <Input
                id="codCaixa"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                placeholder="Ex: CX-001"
                className="uppercase font-mono"
              />
            </div>
          </div>

          {/* Localização e Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="locCaixa" className="block text-xs font-bold text-foreground uppercase tracking-wide mb-1">
                Localização na Oficina
              </label>
              <Input
                id="locCaixa"
                value={localizacao}
                onChange={(e) => setLocalizacao(e.target.value.toUpperCase())}
                placeholder="Ex: ARMÁRIO A1 / BANCADA 02"
                className="uppercase"
              />
            </div>
            <div>
              <label htmlFor="stCaixa" className="block text-xs font-bold text-foreground uppercase tracking-wide mb-1">
                Status Inicial
              </label>
              <select
                id="stCaixa"
                value={status}
                onChange={(e) => setStatus(e.target.value as 'disponivel' | 'em_uso' | 'manutencao')}
                className="h-10 w-full rounded-xl border border-border/40 bg-background px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="disponivel">🟢 DISPONÍVEL NA OFICINA</option>
                <option value="em_uso">🟡 EM USO NO CAMINHÃO</option>
                <option value="manutencao">🔴 EM MANUTENÇÃO / REVISÃO</option>
              </select>
            </div>
          </div>

          {/* Foto da Caixa */}
          <div>
            <label className="block text-xs font-bold text-foreground uppercase tracking-wide mb-1.5">
              Foto da Caixa de Ferramentas
            </label>

            {abrirWebcamModal && (
              <CameraWebcamModal
                titulo="Câmera do Notebook / Webcam"
                subtitulo="Fotografar caixa ou kit de ferramentas"
                onCapture={(file, url) => {
                  setFotoFile(file)
                  setFotoUrl(url)
                }}
                onClose={() => setAbrirWebcamModal(false)}
              />
            )}

            <input
              type="file"
              ref={cameraInputRef}
              accept="image/*"
              onChange={handleFotoSelecionada}
              className="hidden"
            />
            <input
              type="file"
              ref={galeriaInputRef}
              accept="image/*"
              onChange={handleFotoSelecionada}
              className="hidden"
            />

            <div className="flex items-center gap-3">
              {fotoUrl ? (
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-primary/40 bg-background group">
                  <img src={fotoUrl} alt="Preview" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => {
                      setFotoUrl('')
                      setFotoFile(null)
                    }}
                    className="absolute inset-0 bg-black/60 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-dashed border-border/40 bg-background/50 text-secondary">
                  <ImageIcon className="h-6 w-6 opacity-40" />
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => setAbrirWebcamModal(true)}
                  disabled={processandoFoto}
                  className="!h-9 text-xs font-bold gap-1.5 uppercase text-primary border-primary/30 hover:bg-primary/10"
                >
                  <Laptop className="h-4 w-4" />
                  Notebook
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={processandoFoto}
                  className="!h-9 text-xs font-bold gap-1.5 uppercase"
                >
                  <Camera className="h-4 w-4 text-primary" />
                  Câmera
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => galeriaInputRef.current?.click()}
                  disabled={processandoFoto}
                  className="!h-9 text-xs font-bold gap-1.5 uppercase"
                >
                  <ImageIcon className="h-4 w-4 text-primary" />
                  Galeria
                </Button>
                {processandoFoto && <span className="text-xs text-secondary flex items-center gap-1"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Otimizando...</span>}
              </div>
            </div>
          </div>

          {/* Gerenciador de Ferramentas Inclusas */}
          <div className="border-t border-border/20 pt-3">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-foreground uppercase tracking-wide">
                Ferramentas Inclusas na Caixa ({itens.length})
              </label>
              <span className="text-[11px] text-secondary">monte o inventário deste kit</span>
            </div>

            {/* Input para adicionar nova ferramenta */}
            <div className="flex gap-2 mb-2">
              <div className="flex-1">
                <Input
                  list="sugestoes-itens-caixa"
                  value={novoItemNome}
                  onChange={(e) => setNovoItemNome(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      adicionarItemNaCaixa()
                    }
                  }}
                  placeholder="Nome do item (ex: Alicate Universal Gedore)..."
                  className="text-xs uppercase"
                />
                <datalist id="sugestoes-itens-caixa">
                  {ferramentasDisponiveis.map((f) => (
                    <option key={f.id} value={f.nome} />
                  ))}
                </datalist>
              </div>

              <div className="w-20 shrink-0">
                <Input
                  type="number"
                  min="1"
                  value={novoItemQtd}
                  onChange={(e) => setNovoItemQtd(e.target.value)}
                  placeholder="Qtd"
                  className="text-xs text-center font-bold"
                />
              </div>

              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={adicionarItemNaCaixa}
                disabled={!novoItemNome.trim()}
                className="shrink-0 !h-10 px-3 text-xs font-bold uppercase"
              >
                + Adicionar
              </Button>
            </div>

            {/* Lista dos Itens Já Adicionados */}
            <div className="max-h-36 overflow-y-auto space-y-1 rounded-xl bg-background/50 border border-border/20 p-2">
              {itens.length === 0 ? (
                <p className="text-xs text-secondary text-center py-2">Nenhum item adicionado à caixa ainda.</p>
              ) : (
                itens.map((it) => (
                  <div
                    key={it.id}
                    className="flex items-center justify-between py-1 px-2.5 rounded-lg bg-surface border border-border/10 text-xs"
                  >
                    <span className="text-foreground font-medium truncate pr-2">• {it.nome}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-bold text-primary text-[11px] bg-primary/10 px-2 py-0.5 rounded">
                        {it.quantidade} un.
                      </span>
                      <button
                        type="button"
                        onClick={() => removerItemDaCaixa(it.id)}
                        className="text-secondary hover:text-status-danger transition-colors p-0.5 rounded"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Observações */}
          <div>
            <label htmlFor="obsCaixa" className="block text-xs font-bold text-foreground uppercase tracking-wide mb-1">
              Observações / Instruções
            </label>
            <Input
              id="obsCaixa"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Ex: Verificar calibragem do torquímetro mensalmente..."
              className="text-xs"
            />
          </div>

          {/* Rodapé do Modal */}
          <div className="flex justify-end gap-2.5 pt-3 border-t border-border/20 shrink-0">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={salvando}
              className="!h-10 px-5 rounded-xl text-xs font-semibold"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={salvando}
              className="!h-10 px-6 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20"
            >
              {salvando ? 'Salvando...' : 'Salvar Caixa de Ferramentas'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------------------------
// Subcomponente: Modal de Retirada de Caixa de Ferramentas (Vinculação ao Caminhão)
// ----------------------------------------------------------------------------------
function ModalRetiradaCaixa({
  caixa,
  veiculos,
  onClose,
  onSucesso,
}: {
  caixa: CaixaFerramenta
  veiculos: { id: string; placa: string }[]
  onClose: () => void
  onSucesso: (dados: { placa: string; responsavel: string; observacoes?: string }) => Promise<void>
}) {
  const [placasSelecionadas, setPlacasSelecionadas] = useState<string[]>([])
  const [placaInput, setPlacaInput] = useState('')
  const [responsavel, setResponsavel] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  function adicionarPlaca(p: string) {
    const limpa = p.trim().toUpperCase()
    if (!limpa) return
    const partes = limpa.split(/[,;/ ]+/).map((s) => s.trim().toUpperCase()).filter(Boolean)
    setPlacasSelecionadas((prev) => Array.from(new Set([...prev, ...partes])))
    setPlacaInput('')
  }

  function removerPlaca(p: string) {
    setPlacasSelecionadas((prev) => prev.filter((item) => item !== p))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    let listaFinalPlacas = [...placasSelecionadas]
    if (placaInput.trim()) {
      const partes = placaInput.split(/[,;/ ]+/).map((s) => s.trim().toUpperCase()).filter(Boolean)
      listaFinalPlacas = Array.from(new Set([...listaFinalPlacas, ...partes]))
    }

    if (listaFinalPlacas.length === 0) {
      setErro('Informe ao menos uma placa de caminhão.')
      return
    }
    if (!responsavel.trim()) {
      setErro('Informe o nome do responsável.')
      return
    }

    setSalvando(true)
    setErro(null)
    try {
      await onSucesso({
        placa: placasSelecionadas.join(' / '),
        responsavel: responsavel.trim().toUpperCase(),
        observacoes: observacoes.trim() || undefined,
      })
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao registrar retirada.')
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-border/30 bg-surface p-6 shadow-2xl animate-scale-in">
        {/* Cabeçalho */}
        <div className="mb-4 flex items-center justify-between border-b border-border/20 pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary border border-primary/20">
              <ArrowUpRight className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Retirar Caixa de Ferramentas</h2>
              <p className="text-xs text-secondary">{caixa.nome}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-secondary hover:bg-background hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {erro && (
          <div className="mb-4 rounded-xl bg-status-danger/10 border border-status-danger/30 p-3 text-xs font-semibold text-status-danger">
            {erro}
          </div>
        )}

        {/* Resumo dos Itens na Caixa */}
        <div className="mb-4 rounded-xl border border-border/20 bg-background/60 p-3 text-xs space-y-1">
          <span className="font-bold text-secondary uppercase block mb-1">
            📦 Itens Inclusos nesta Caixa ({caixa.itens.length}):
          </span>
          <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
            {caixa.itens.map((it) => (
              <span key={it.id} className="text-[11px] bg-surface px-2 py-0.5 rounded border border-border/10 text-foreground">
                {it.nome} ({it.quantidade}x)
              </span>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Placa(s) do Caminhão */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="placaCaixa" className="text-xs font-bold text-foreground uppercase tracking-wide">
                Placa(s) do Caminhão *
              </label>
              <span className="text-[11px] text-secondary">pode adicionar mais de uma</span>
            </div>

            {placasSelecionadas.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {placasSelecionadas.map((p) => (
                  <span
                    key={p}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/30 text-primary font-mono text-xs font-bold"
                  >
                    🚛 {p}
                    <button type="button" onClick={() => removerPlaca(p)} className="hover:text-status-danger">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Input
                id="placaCaixa"
                list="placas-sugestoes-caixa"
                value={placaInput}
                onChange={(e) => setPlacaInput(e.target.value.toUpperCase())}
                placeholder="Digite a placa (ex: ABC1D23)..."
                className="flex-1 font-mono uppercase text-sm"
              />
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => adicionarPlaca(placaInput)}
                disabled={!placaInput.trim()}
                className="shrink-0 !h-10 px-3.5 text-xs font-bold uppercase"
              >
                + Adicionar
              </Button>
            </div>
            <datalist id="placas-sugestoes-caixa">
              {veiculos.map((v) => (
                <option key={v.id} value={v.placa} />
              ))}
            </datalist>

            {veiculos.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] uppercase font-bold text-secondary mr-1">Rápidos:</span>
                {veiculos.slice(0, 6).map((v) => {
                  const jaAdd = placasSelecionadas.includes(v.placa.toUpperCase())
                  return (
                    <button
                      type="button"
                      key={v.id}
                      onClick={() => (jaAdd ? removerPlaca(v.placa.toUpperCase()) : adicionarPlaca(v.placa.toUpperCase()))}
                      className={`text-[11px] px-2.5 py-0.5 rounded-full font-mono font-medium border transition-all ${
                        jaAdd
                          ? 'bg-primary/20 border-primary text-primary'
                          : 'bg-background/60 border-border/30 text-secondary hover:text-foreground hover:border-primary/50'
                      }`}
                    >
                      {jaAdd ? `✓ ${v.placa}` : `+ ${v.placa}`}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Responsável */}
          <div>
            <label htmlFor="respCaixa" className="block text-xs font-bold text-foreground uppercase tracking-wide mb-1.5">
              Responsável (Mecânico / Motorista) *
            </label>
            <Input
              id="respCaixa"
              value={responsavel}
              onChange={(e) => setResponsavel(e.target.value)}
              placeholder="Nome de quem está retirando a caixa..."
              required
              className="text-sm"
            />
          </div>

          {/* Observações */}
          <div>
            <label htmlFor="obsRetCaixa" className="block text-xs font-bold text-foreground uppercase tracking-wide mb-1.5">
              Observações / Motivo <span className="text-secondary font-normal lowercase">(opcional)</span>
            </label>
            <Input
              id="obsRetCaixa"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Ex: Atendimento de socorro, manutenção na estrada..."
              className="text-sm"
            />
          </div>

          {/* Rodapé */}
          <div className="flex justify-end gap-2.5 pt-3 border-t border-border/20">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={salvando}
              className="!h-10 px-5 rounded-xl text-xs font-semibold"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={salvando}
              className="!h-10 px-6 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20"
            >
              {salvando ? 'Registrando...' : 'Confirmar Retirada'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------------------------
// Subcomponente: Modal de Cadastro / Edição de Item de Uso e Consumo
// ----------------------------------------------------------------------------------
function ModalItemConsumo({
  item,
  onClose,
  onSalvo,
}: {
  item: ItemConsumo | null
  onClose: () => void
  onSalvo: (salvo: ItemConsumo) => void
}) {
  const [nome, setNome] = useState(item?.nome || '')
  const [codigo, setCodigo] = useState(item?.codigo || '')
  const [categoria, setCategoria] = useState(item?.categoria || 'LUBRIFICANTES & QUÍMICOS')
  const [unidade, setUnidade] = useState(item?.unidade || 'UN')
  const [quantidadeAtual, setQuantidadeAtual] = useState(item?.quantidade_atual ?? 10)
  const [quantidadeMinima, setQuantidadeMinima] = useState(item?.quantidade_minima ?? 3)
  const [localizacao, setLocalizacao] = useState(item?.localizacao || '')
  const [observacoes, setObservacoes] = useState(item?.observacoes || '')
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [fotoUrl, setFotoUrl] = useState<string | null>(item?.foto_url || null)
  const [salvando, setSalvando] = useState(false)
  const [processandoFoto, setProcessandoFoto] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const cameraInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setProcessandoFoto(true)
    setErro(null)
    try {
      const comprimida = await comprimirImagem(file)
      setFotoFile(comprimida)
      setFotoUrl(URL.createObjectURL(comprimida))
    } catch {
      setErro('Não foi possível processar a foto.')
    } finally {
      setProcessandoFoto(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome.trim()) {
      setErro('Informe o nome do insumo.')
      return
    }
    setSalvando(true)
    setErro(null)
    try {
      let finalFotoUrl: string | null = fotoUrl
      if (fotoFile) {
        finalFotoUrl = await uploadFotoFerramenta(fotoFile)
      }

      const itemPronto: ItemConsumo = {
        id: item?.id || `insumo_${Date.now()}`,
        codigo: codigo.trim() ? codigo.trim().toUpperCase() : null,
        nome: nome.trim().toUpperCase(),
        categoria: categoria.toUpperCase(),
        unidade: unidade.trim().toUpperCase() || 'UN',
        quantidade_atual: Number(quantidadeAtual) || 0,
        quantidade_minima: Number(quantidadeMinima) || 0,
        localizacao: localizacao.trim() ? localizacao.trim().toUpperCase() : null,
        observacoes: observacoes.trim() ? observacoes.trim().toUpperCase() : null,
        foto_url: finalFotoUrl,
        created_at: item?.created_at || new Date().toISOString(),
      }

      onSalvo(itemPronto)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar item.')
    } finally {
      setSalvando(false)
    }
  }

  const UNIDADES_SUGERIDAS = ['UN', 'CX', 'RL', 'LT', 'KG', 'PAR', 'PCT', 'M']

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
      <div className="w-full max-w-lg rounded-2xl border border-border/20 bg-surface shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between border-b border-border/10 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Boxes className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-foreground uppercase">
                {item ? 'EDITAR INSUMO DE CONSUMO' : 'NOVO INSUMO DE USO E CONSUMO'}
              </h2>
              <p className="text-[11px] text-secondary">Itens de desgaste, químicos, fixação e EPIs</p>
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

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {erro && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-3.5 py-2.5 text-xs font-semibold text-red-400">
              {erro}
            </div>
          )}

          {/* Nome e Código */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label htmlFor="nomeInsumo" className="block text-[11px] font-black text-secondary uppercase tracking-widest mb-1">
                Nome do Insumo / Material *
              </label>
              <Input
                id="nomeInsumo"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Luva Nitrílica, Desengripante WD-40..."
                required
                autoFocus
                className="text-sm"
              />
            </div>
            <div>
              <label htmlFor="codInsumo" className="block text-[11px] font-black text-secondary uppercase tracking-widest mb-1">
                Código / Ref.
              </label>
              <Input
                id="codInsumo"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                placeholder="Ex: INS-012"
                className="font-mono text-sm uppercase"
              />
            </div>
          </div>

          {/* Categoria e Unidade */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="catInsumo" className="block text-[11px] font-black text-secondary uppercase tracking-widest mb-1">
                Categoria
              </label>
              <select
                id="catInsumo"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="h-10 w-full rounded-xl border border-border/20 bg-background px-3 text-xs font-bold text-foreground uppercase focus:border-primary focus:outline-none"
              >
                {CATEGORIAS_CONSUMO.filter((c) => c !== 'TODAS').map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-black text-secondary uppercase tracking-widest mb-1">
                Unidade de Medida
              </label>
              <div className="flex flex-wrap gap-1.5">
                {UNIDADES_SUGERIDAS.map((u) => (
                  <button
                    type="button"
                    key={u}
                    onClick={() => setUnidade(u)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all ${
                      unidade === u
                        ? 'bg-primary text-white shadow-sm'
                        : 'bg-background border border-border/20 text-secondary hover:text-foreground'
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Quantidades: Atual e Mínima */}
          <div className="grid grid-cols-2 gap-3 bg-background/50 border border-border/20 rounded-xl p-3">
            <div>
              <label htmlFor="qtdAtual" className="block text-[11px] font-black text-secondary uppercase tracking-widest mb-1">
                Quantidade Inicial / Atual
              </label>
              <Input
                id="qtdAtual"
                type="number"
                min="0"
                value={quantidadeAtual}
                onChange={(e) => setQuantidadeAtual(Number(e.target.value))}
                className="font-mono text-base font-bold"
              />
            </div>
            <div>
              <label htmlFor="qtdMin" className="block text-[11px] font-black text-secondary uppercase tracking-widest mb-1">
                Estoque Mínimo (Alerta)
              </label>
              <Input
                id="qtdMin"
                type="number"
                min="0"
                value={quantidadeMinima}
                onChange={(e) => setQuantidadeMinima(Number(e.target.value))}
                className="font-mono text-base font-bold"
              />
            </div>
          </div>

          {/* Localização */}
          <div>
            <label htmlFor="locInsumo" className="block text-[11px] font-black text-secondary uppercase tracking-widest mb-1">
              Localização / Prateleira
            </label>
            <Input
              id="locInsumo"
              value={localizacao}
              onChange={(e) => setLocalizacao(e.target.value)}
              placeholder="Ex: Armário A, Prateleira 2, Gaveta Elétrica..."
              className="text-sm"
            />
          </div>

          {/* Foto do Insumo */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-black text-secondary uppercase tracking-widest">
              Foto do Insumo <span className="font-normal lowercase text-secondary/50">(opcional)</span>
            </label>
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleFotoChange} className="hidden" />
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFotoChange} className="hidden" />

            {processandoFoto ? (
              <div className="flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-primary/40 text-primary text-xs font-semibold">
                <Loader2 className="h-4 w-4 animate-spin" />
                Processando imagem...
              </div>
            ) : fotoUrl ? (
              <div className="flex items-center gap-3 p-2.5 rounded-xl border border-primary/30 bg-primary/10">
                <img src={fotoUrl} alt="Insumo" className="h-12 w-12 rounded-lg object-cover border border-primary/30" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-foreground truncate">Foto anexada</p>
                  <button
                    type="button"
                    onClick={() => {
                      setFotoFile(null)
                      setFotoUrl(null)
                    }}
                    className="text-[11px] text-red-400 hover:underline font-semibold"
                  >
                    Remover Foto
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-dashed border-border/30 bg-background/60 hover:bg-primary/10 text-foreground text-xs font-bold transition-all"
                >
                  <Camera className="h-4 w-4 text-primary" />
                  Câmera
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-dashed border-border/30 bg-background/60 hover:bg-primary/10 text-foreground text-xs font-bold transition-all"
                >
                  <ImageIcon className="h-4 w-4 text-secondary" />
                  Galeria
                </button>
              </div>
            )}
          </div>

          {/* Observações */}
          <div>
            <label htmlFor="obsInsumo" className="block text-[11px] font-black text-secondary uppercase tracking-widest mb-1">
              Observações
            </label>
            <Input
              id="obsInsumo"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Ex: Marca recomendada, especificações técnicas..."
              className="text-sm"
            />
          </div>

          {/* Rodapé */}
          <div className="flex justify-end gap-2.5 pt-3 border-t border-border/15">
            <Button type="button" variant="secondary" onClick={onClose} disabled={salvando} className="!h-10 px-5 text-xs font-semibold">
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando || !nome.trim()} className="!h-10 px-6 text-xs font-bold bg-primary hover:bg-primary/90 text-white">
              {salvando ? 'Salvando...' : item ? 'Salvar Alterações' : 'Cadastrar Insumo'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------------------------
// Subcomponente: Modal de Baixa / Consumo de Insumo
// ----------------------------------------------------------------------------------
function ModalBaixaConsumo({
  itemPreSelecionado,
  itensDisponiveis,
  veiculos,
  retiradas,
  onClose,
  onSucesso,
}: {
  itemPreSelecionado: ItemConsumo | null
  itensDisponiveis: ItemConsumo[]
  veiculos: { id: string; placa: string }[]
  retiradas?: FerramentaRetirada[]
  onClose: () => void
  onSucesso: (baixa: RegistroBaixaConsumo) => void
}) {
  const [itemId, setItemId] = useState(itemPreSelecionado?.id || itensDisponiveis[0]?.id || '')
  const [quantidade, setQuantidade] = useState(1)
  const [responsavel, setResponsavel] = useState('')
  const [placa, setPlaca] = useState('')
  const [motivo, setMotivo] = useState('')
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [fotoUrl, setFotoUrl] = useState<string | null>(null)
  const [fotoOrigem, setFotoOrigem] = useState<'salva' | 'nova' | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [processandoFoto, setProcessandoFoto] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const cameraInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const itemAtual = itensDisponiveis.find((it) => it.id === itemId) ?? itemPreSelecionado
  const maxQtd = itemAtual?.quantidade_atual || 1

  // Mecânicos com foto para sugestão
  const mecanicosConhecidos = useMemo(() => {
    const mapa = new Map<string, string | null>()
    try {
      const storageMap = JSON.parse(localStorage.getItem('gvel_fotos_mecanicos') || '{}')
      Object.entries(storageMap).forEach(([nome, url]) => {
        if (typeof url === 'string') mapa.set(nome.toUpperCase().trim(), url)
      })
    } catch {}
    if (retiradas) {
      retiradas.forEach((r) => {
        const n = r.responsavel?.toUpperCase().trim()
        if (n && !mapa.has(n)) mapa.set(n, r.foto_responsavel_url || r.foto_url || null)
      })
    }
    return Array.from(mapa.entries()).map(([nome, foto]) => ({ nome, foto }))
  }, [retiradas])

  function handleResponsavelChange(nome: string) {
    setResponsavel(nome)
    setErro(null)
    if (!fotoFile) {
      const salva = getFotoSalvaMecanico(nome, retiradas)
      if (salva) {
        setFotoUrl(salva)
        setFotoOrigem('salva')
      } else if (fotoOrigem === 'salva') {
        setFotoUrl(null)
        setFotoOrigem(null)
      }
    }
  }

  function selecionarMecanico(nome: string, foto: string | null) {
    setResponsavel(nome)
    setErro(null)
    if (foto && !fotoFile) {
      setFotoUrl(foto)
      setFotoOrigem('salva')
    }
  }

  async function handleFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setProcessandoFoto(true)
    setErro(null)
    try {
      const comprimida = await comprimirImagem(file)
      setFotoFile(comprimida)
      setFotoUrl(URL.createObjectURL(comprimida))
      setFotoOrigem('nova')
    } catch {
      setErro('Não foi possível processar a foto.')
    } finally {
      setProcessandoFoto(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!itemAtual) {
      setErro('Selecione o insumo.')
      return
    }
    if (!responsavel.trim()) {
      setErro('Informe o responsável.')
      return
    }
    if (quantidade <= 0 || quantidade > itemAtual.quantidade_atual) {
      setErro(`Quantidade inválida (máx: ${itemAtual.quantidade_atual}).`)
      return
    }

    setSalvando(true)
    setErro(null)
    try {
      let finalFotoUrl: string | null = fotoUrl
      if (fotoFile) {
        finalFotoUrl = await uploadFotoFerramenta(fotoFile)
      }
      if (finalFotoUrl && responsavel.trim()) {
        salvarFotoMecanico(responsavel.trim(), finalFotoUrl)
      }

      const novaBaixa: RegistroBaixaConsumo = {
        id: `baixa_${Date.now()}`,
        item_id: itemAtual.id,
        item_nome: itemAtual.nome,
        unidade: itemAtual.unidade,
        quantidade,
        responsavel: responsavel.trim().toUpperCase(),
        foto_responsavel_url: finalFotoUrl,
        placa: placa.trim() ? placa.trim().toUpperCase() : null,
        motivo: motivo.trim() ? motivo.trim().toUpperCase() : null,
        data_hora: new Date().toISOString(),
      }

      onSucesso(novaBaixa)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao registrar baixa de consumo.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
      <div className="w-full max-w-md rounded-2xl border border-border/20 bg-surface shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between border-b border-border/10 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
              <TrendingDown className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-foreground uppercase">REGISTRAR SAÍDA / CONSUMO</h2>
              <p className="text-[11px] text-secondary">Baixa definitiva de insumo do estoque</p>
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

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {erro && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-3.5 py-2.5 text-xs font-semibold text-red-400">
              {erro}
            </div>
          )}

          {/* Seleção do Insumo */}
          <div>
            <label htmlFor="selItemConsumo" className="block text-[11px] font-black text-secondary uppercase tracking-widest mb-1">
              Insumo / Material *
            </label>
            <select
              id="selItemConsumo"
              value={itemId}
              onChange={(e) => {
                setItemId(e.target.value)
                setQuantidade(1)
              }}
              className="h-10 w-full rounded-xl border border-border/20 bg-background px-3 text-xs font-bold text-foreground uppercase focus:border-primary focus:outline-none"
            >
              {itensDisponiveis.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.nome} ({it.quantidade_atual} {it.unidade} disp.)
                </option>
              ))}
            </select>
          </div>

          {/* Stepper de Quantidade */}
          {itemAtual && (
            <div className="rounded-xl bg-background/50 border border-border/20 p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-secondary uppercase tracking-widest">
                  Quantidade a Consumir
                </span>
                <span className="text-[10px] text-secondary">
                  Disp: {itemAtual.quantidade_atual} {itemAtual.unidade}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setQuantidade((q) => Math.max(1, q - 1))}
                  disabled={quantidade <= 1}
                  className="h-10 w-10 rounded-xl bg-surface border border-border/30 font-bold text-lg text-foreground hover:bg-surface/80 disabled:opacity-30 transition-all"
                >
                  −
                </button>
                <div className="flex-1 text-center font-mono text-2xl font-black text-foreground">
                  {quantidade} <span className="text-xs font-semibold text-secondary">{itemAtual.unidade}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setQuantidade((q) => Math.min(maxQtd, q + 1))}
                  disabled={quantidade >= maxQtd}
                  className="h-10 w-10 rounded-xl bg-surface border border-border/30 font-bold text-lg text-foreground hover:bg-surface/80 disabled:opacity-30 transition-all"
                >
                  +
                </button>
              </div>
            </div>
          )}

          {/* Responsável */}
          <div>
            <label htmlFor="respConsumo" className="block text-[11px] font-black text-secondary uppercase tracking-widest mb-1">
              Quem está retirando? *
            </label>
            <Input
              id="respConsumo"
              list="mecanicos-sugestoes-consumo"
              value={responsavel}
              onChange={(e) => handleResponsavelChange(e.target.value)}
              placeholder="Mecânico ou motorista..."
              required
              className="text-sm"
            />
            <datalist id="mecanicos-sugestoes-consumo">
              {mecanicosConhecidos.map((m) => (
                <option key={m.nome} value={m.nome} />
              ))}
            </datalist>

            {mecanicosConhecidos.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-[9px] uppercase font-bold text-secondary mr-0.5">Rápidos:</span>
                {mecanicosConhecidos.slice(0, 4).map((m) => (
                  <button
                    type="button"
                    key={m.nome}
                    onClick={() => selecionarMecanico(m.nome, m.foto)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border border-border/30 bg-background/60 hover:border-primary hover:text-primary transition-all"
                  >
                    {m.foto ? (
                      <img src={m.foto} alt={m.nome} className="h-3.5 w-3.5 rounded-full object-cover shrink-0" />
                    ) : (
                      <span>👤</span>
                    )}
                    <span>{m.nome}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Foto da Pessoa */}
          <div className="space-y-1">
            <label className="block text-[11px] font-black text-secondary uppercase tracking-widest">
              Foto do Responsável
            </label>
            <input ref={cameraInputRef} type="file" accept="image/*" capture="user" onChange={handleFotoChange} className="hidden" />
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFotoChange} className="hidden" />

            {processandoFoto ? (
              <div className="flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-primary/40 text-primary text-xs font-semibold">
                <Loader2 className="h-4 w-4 animate-spin" />
                Processando foto...
              </div>
            ) : fotoUrl ? (
              <div className="flex items-center gap-3 p-2.5 rounded-xl border border-primary/30 bg-primary/10">
                <img src={fotoUrl} alt="Responsável" className="h-12 w-12 rounded-xl object-cover border border-primary/30 shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-[9px] font-black uppercase text-primary tracking-wider bg-primary/20 px-1.5 py-0.5 rounded">
                    {fotoOrigem === 'salva' ? 'FOTO DO CADASTRO ✓' : 'FOTO ANEXADA ✓'}
                  </span>
                  <div className="flex gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="text-[11px] text-primary hover:underline font-semibold"
                    >
                      Tirar outra
                    </button>
                    <span className="text-secondary">·</span>
                    <button
                      type="button"
                      onClick={() => {
                        setFotoFile(null)
                        setFotoUrl(null)
                        setFotoOrigem(null)
                      }}
                      className="text-[11px] text-red-400 hover:underline font-semibold"
                    >
                      Remover
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-dashed border-border/30 bg-background/60 hover:bg-primary/10 text-foreground text-xs font-bold transition-all"
                >
                  <Camera className="h-3.5 w-3.5 text-primary" />
                  Tirar Foto
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-dashed border-border/30 bg-background/60 hover:bg-primary/10 text-foreground text-xs font-bold transition-all"
                >
                  <ImageIcon className="h-3.5 w-3.5 text-secondary" />
                  Galeria
                </button>
              </div>
            )}
          </div>

          {/* Caminhão / Placa */}
          <div>
            <label htmlFor="placaConsumo" className="block text-[11px] font-black text-secondary uppercase tracking-widest mb-1">
              Caminhão / Placa <span className="font-normal lowercase text-secondary/50">(opcional)</span>
            </label>
            <Input
              id="placaConsumo"
              list="placas-sugestoes-consumo"
              value={placa}
              onChange={(e) => setPlaca(e.target.value.toUpperCase())}
              placeholder="Ex: ABC1D23"
              className="font-mono text-sm uppercase"
            />
            <datalist id="placas-sugestoes-consumo">
              {veiculos.map((v) => (
                <option key={v.id} value={v.placa} />
              ))}
            </datalist>
          </div>

          {/* Motivo / Aplicação */}
          <div>
            <label htmlFor="motivoConsumo" className="block text-[11px] font-black text-secondary uppercase tracking-widest mb-1">
              Motivo / Aplicação <span className="font-normal lowercase text-secondary/50">(opcional)</span>
            </label>
            <Input
              id="motivoConsumo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex: Troca de mangueira, vedação de carcaça..."
              className="text-sm"
            />
          </div>

          {/* Rodapé */}
          <div className="flex justify-end gap-2.5 pt-3 border-t border-border/15">
            <Button type="button" variant="secondary" onClick={onClose} disabled={salvando} className="!h-10 px-5 text-xs font-semibold">
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={salvando || !responsavel.trim()}
              className="!h-10 px-6 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/20"
            >
              {salvando ? 'Registrando...' : 'Confirmar Saída / Consumo'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------------------------
// Subcomponente: Modal de Entrada / Reposição de Estoque de Insumo
// ----------------------------------------------------------------------------------
function ModalEntradaConsumo({
  item,
  onClose,
  onSucesso,
}: {
  item: ItemConsumo
  onClose: () => void
  onSucesso: (qtd: number) => void
}) {
  const [quantidadeAdicionar, setQuantidadeAdicionar] = useState(10)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (quantidadeAdicionar <= 0) return
    onSucesso(quantidadeAdicionar)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
      <div className="w-full max-w-sm rounded-2xl border border-border/20 bg-surface shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-border/10 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
              <PackagePlus className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-black text-foreground uppercase">REPOR ESTOQUE</h2>
              <p className="text-[10px] text-secondary">Adicionar novas unidades</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-xl p-1 text-secondary hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-xl bg-background/50 border border-border/20 p-3 space-y-1">
            <span className="text-[10px] font-bold text-secondary uppercase block">ITEM</span>
            <p className="font-bold text-xs text-foreground uppercase">{item.nome}</p>
            <p className="text-[11px] text-secondary font-mono">
              Estoque Atual: <span className="font-bold text-foreground">{item.quantidade_atual} {item.unidade}</span>
            </p>
          </div>

          <div>
            <label htmlFor="qtdAdd" className="block text-[11px] font-black text-secondary uppercase tracking-widest mb-1.5">
              Quantidade a Adicionar ({item.unidade}) *
            </label>
            <div className="flex items-center gap-2">
              <Input
                id="qtdAdd"
                type="number"
                min="1"
                value={quantidadeAdicionar}
                onChange={(e) => setQuantidadeAdicionar(Math.max(1, Number(e.target.value)))}
                required
                autoFocus
                className="font-mono text-xl font-black text-center"
              />
            </div>
            <div className="flex items-center gap-1.5 mt-2">
              <span className="text-[10px] uppercase font-bold text-secondary mr-1">Rápido:</span>
              {[5, 10, 20, 50].map((v) => (
                <button
                  type="button"
                  key={v}
                  onClick={() => setQuantidadeAdicionar(v)}
                  className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-background border border-border/30 hover:border-emerald-500 hover:text-emerald-500 transition-all"
                >
                  +{v}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-2.5 text-center">
            <p className="text-xs text-emerald-500 font-bold">
              Novo Estoque: <span className="font-mono text-sm">{item.quantidade_atual + quantidadeAdicionar} {item.unidade}</span>
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border/10">
            <Button type="button" variant="secondary" onClick={onClose} className="!h-9 px-4 text-xs font-semibold">
              Cancelar
            </Button>
            <Button type="submit" className="!h-9 px-5 text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-white">
              Confirmar Entrada
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
