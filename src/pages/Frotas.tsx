import { useMemo, useState, useRef } from 'react'
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
  Wrench,
  Check,
  Disc,
  MapPin,
  Users,
  AlertTriangle,
  Car,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
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
import { Input, Label, FieldError, Select } from '@/components/ui/Input'
import { QuickCreateSelect } from '@/components/QuickCreateSelect'
import { TipoVeiculoRadioGroup } from '@/components/TipoVeiculoRadioGroup'
import { useClientes } from '@/hooks/useClientes'
import { useMarcas, useModelos, criarMarca, criarModelo } from '@/hooks/useMarcasModelos'
import { useMovimentacoes } from '@/hooks/useMovimentacoes'
import { useAuth } from '@/contexts/AuthContext'
import { tipoVeiculoLabel } from '@/lib/tipoVeiculo'
import { isNativeApp } from '@/lib/isNativeApp'

const anoAtual = new Date().getFullYear()

// ==================== SCHEMAS E TIPOS ====================

const schemaVeiculo = z.object({
  clienteId: z.string().min(1, 'Selecione o cliente').refine((val) => val !== 'todos', 'Selecione um cliente para o veículo'),
  placa: z.string().trim().min(7, 'Placa inválida').max(8, 'Placa inválida'),
  tipo: z.enum(['pesado', 'leve', 'trator', 'carreta']),
  cor: z.string().trim().min(1, 'Informe a cor'),
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
  dataUltimaPreventiva: z.string().optional(),
  kmUltimaPreventiva: z.number().optional(),
  intervaloPreventivaKm: z.number().optional(),
  observacoes: z.string().optional(),
})

type FormVeiculoValues = z.infer<typeof schemaVeiculo>

export interface ItemFrotaCadastrada {
  id: string
  placa: string
  tipo: 'pesado' | 'leve' | 'trator' | 'carreta'
  marcaNome?: string
  modeloNome?: string
  clienteNome?: string
  clienteId?: string
  ano?: number
  cor?: string
  chassi?: string
  situacao: 'operante' | 'inoperante'
  vencimentoDocumento?: string // YYYY-MM-DD
  dataUltimaPreventiva?: string // Data da última preventiva
  kmUltimaPreventiva?: number // KM registrado na última preventiva
  intervaloPreventivaKm?: number // A cada quantos KM faz preventiva (ex: 10000)
  vencimentoPreventiva?: string // compatibilidade anterior
  kmProximaPreventiva?: number // compatibilidade anterior
  observacoes?: string
  createdAt: string
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
  capo?: string              // Foto do Capô aberto / Motor
  interna?: string           // Foto da Interna do Veículo
  frente?: string            // Foto da Frente do Veículo
  ladoEsquerdo?: string      // Foto do Lado Esquerdo
  traseira?: string          // Foto da Traseira do Veículo
  ladoDireito?: string       // Foto do Lado Direito
  pneuDiantEsq?: string      // Foto do Pneu Dianteiro Esquerdo
  pneuDiantDir?: string      // Foto do Pneu Dianteiro Direito
  pneuTrasEsq?: string       // Foto do Pneu Traseiro Esquerdo
  pneuTrasDir?: string       // Foto do Pneu Traseiro Direito
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

const ITENS_PADRAO_CHECKLIST = [
  // Pneus & Rodas
  { id: '1', categoria: 'PNEUS & RODAS', nome: 'Calibragem e estado dos pneus', status: 'conforme' },
  { id: '2', categoria: 'PNEUS & RODAS', nome: 'Pneu estepe e ferramentas', status: 'conforme' },
  { id: '3', categoria: 'PNEUS & RODAS', nome: 'Aperto das porcas das rodas', status: 'conforme' },

  // Iluminação
  { id: '4', categoria: 'ILUMINAÇÃO & ELÉTRICA', nome: 'Faróis alto e baixo', status: 'conforme' },
  { id: '5', categoria: 'ILUMINAÇÃO & ELÉTRICA', nome: 'Lanternas e luzes de freio', status: 'conforme' },
  { id: '6', categoria: 'ILUMINAÇÃO & ELÉTRICA', nome: 'Setas e pisca-alerta', status: 'conforme' },
  { id: '7', categoria: 'ILUMINAÇÃO & ELÉTRICA', nome: 'Luz de ré e alarme sonoro', status: 'conforme' },

  // Fluidos & Mecânica
  { id: '8', categoria: 'FLUIDOS & MOTOR', nome: 'Nível de óleo do motor', status: 'conforme' },
  { id: '9', categoria: 'FLUIDOS & MOTOR', nome: 'Nível da água / líquido do radiador', status: 'conforme' },
  { id: '10', categoria: 'FLUIDOS & MOTOR', nome: 'Freios e freio de estacionamento', status: 'conforme' },
  { id: '11', categoria: 'FLUIDOS & MOTOR', nome: 'Inexistência de vazamentos visíveis', status: 'conforme' },

  // Segurança & Cabine
  { id: '12', categoria: 'SEGURANÇA & CABINE', nome: 'Cintos de segurança operantes', status: 'conforme' },
  { id: '13', categoria: 'SEGURANÇA & CABINE', nome: 'Extintor de incêndio na validade', status: 'conforme' },
  { id: '14', categoria: 'SEGURANÇA & CABINE', nome: 'Limpadores de para-brisa e esguicho', status: 'conforme' },
  { id: '15', categoria: 'SEGURANÇA & CABINE', nome: 'Retrovisores e vidros íntegros', status: 'conforme' },
  { id: '16', categoria: 'SEGURANÇA & CABINE', nome: 'Documentação de bordo e CRLV', status: 'conforme' },
] as const

const STORAGE_FROTAS_KEY = 'gvel_frotas_cadastradas_v1'
const STORAGE_CHECKLISTS_KEY = 'gvel_frotas_checklists_v1'

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
  const { clientes } = useClientes()
  const { marcas, refetch: refetchMarcas } = useMarcas()
  const { movimentacoes } = useMovimentacoes()
  const navigate = useNavigate()

  const isNative = isNativeApp()
  const [searchParams] = useSearchParams()
  const abaParam = searchParams.get('aba')
  const abaPrincipal: 'dashboard' | 'veiculos' | 'checklist' =
    isNative ? 'checklist' : abaParam === 'checklist' ? 'checklist' : abaParam === 'veiculos' ? 'veiculos' : 'dashboard'

  // Lista de veículos de frotas
  const [frotas, setFrotas] = useState<ItemFrotaCadastrada[]>(() => {
    try {
      const salvo = localStorage.getItem(STORAGE_FROTAS_KEY)
      if (salvo) return JSON.parse(salvo)
    } catch {}
    return []
  })

  // Lista de Checklists realizados
  const [checklists, setChecklists] = useState<RegistroChecklist[]>(() => {
    try {
      const salvo = localStorage.getItem(STORAGE_CHECKLISTS_KEY)
      if (salvo) return JSON.parse(salvo)
    } catch {}
    return []
  })

  function salvarFrotas(novas: ItemFrotaCadastrada[]) {
    setFrotas(novas)
    try {
      localStorage.setItem(STORAGE_FROTAS_KEY, JSON.stringify(novas))
      window.dispatchEvent(new Event('frota_updated'))
    } catch {}
  }

  function salvarChecklists(novos: RegistroChecklist[]) {
    setChecklists(novos)
    try {
      localStorage.setItem(STORAGE_CHECKLISTS_KEY, JSON.stringify(novos))
    } catch {}
  }

  // Modais de Veículo
  const [mostrarModalVeiculo, setMostrarModalVeiculo] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [erroLista, setErroLista] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [tipoFiltro, setTipoFiltro] = useState<string>('todos')
  const [clienteFiltro, setClienteFiltro] = useState<string>('todos')
  const [alertaFiltro, setAlertaFiltro] = useState<'todos' | 'preventiva_atrasada' | 'doc_a_vencer' | 'doc_vencido'>('todos')

  // Modais de Checklist
  const [mostrarModalNovoChecklist, setMostrarModalNovoChecklist] = useState(false)
  const [checklistVisualizando, setChecklistVisualizando] = useState<RegistroChecklist | null>(null)
  const [fotoZoom, setFotoZoom] = useState<{ url: string; titulo: string } | null>(null)
  const [buscaChecklist, setBuscaChecklist] = useState('')
  const [filtroResultadoChecklist, setFiltroResultadoChecklist] = useState<string>('todos')

  // Form State para Novo Checklist
  const [veiculoChecklistId, setVeiculoChecklistId] = useState('')
  const [motoristaChecklist, setMotoristaChecklist] = useState('')
  const [kmChecklist, setKmChecklist] = useState<number>(0)
  const [resultadoChecklist, setResultadoChecklist] = useState<'aprovado' | 'aprovado_com_ressalvas' | 'reprovado'>('aprovado')
  const [obsChecklist, setObsChecklist] = useState('')
  const [fotosChecklist, setFotosChecklist] = useState<FotosVistoria>({})
  const [itensChecklistForm, setItensChecklistForm] = useState<ItemChecagem[]>(() =>
    ITENS_PADRAO_CHECKLIST.map((it) => ({
      id: it.id,
      categoria: it.categoria,
      nome: it.nome,
      status: 'conforme',
    })),
  )

  // Refs de inputs de arquivo para disparar a câmera
  const inputFotoPainelRef = useRef<HTMLInputElement>(null)
  const inputFotoCapoRef = useRef<HTMLInputElement>(null)
  const inputFotoInternaRef = useRef<HTMLInputElement>(null)
  const inputFotoFrenteRef = useRef<HTMLInputElement>(null)
  const inputFotoLadoEsquerdoRef = useRef<HTMLInputElement>(null)
  const inputFotoTraseiraRef = useRef<HTMLInputElement>(null)
  const inputFotoLadoDireitoRef = useRef<HTMLInputElement>(null)
  const inputFotoPneuDiantEsqRef = useRef<HTMLInputElement>(null)
  const inputFotoPneuDiantDirRef = useRef<HTMLInputElement>(null)
  const inputFotoPneuTrasEsqRef = useRef<HTMLInputElement>(null)
  const inputFotoPneuTrasDirRef = useRef<HTMLInputElement>(null)

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
  const { modelos, refetch: refetchModelos } = useModelos(marcaIdWatch)

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

  // Helper para status do documento
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

    // Checagem por Data
    const dataPrevStr = v.dataUltimaPreventiva || v.vencimentoPreventiva
    let atrasadaPorData = false
    let dataFormatada = ''
    if (dataPrevStr) {
      try {
        const dataPrev = parseISO(dataPrevStr)
        const hoje = startOfDay(new Date())
        atrasadaPorData = isBefore(dataPrev, hoje)
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

    if (atrasadaPorData) {
      return {
        status: 'atrasada',
        label: `ATRASADA (${dataFormatada})`,
        kmRestante,
        kmLimite,
        atrasada: true,
      }
    }

    if (kmLimite > 0 && kmRestante <= 1000) {
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

  // 1. DADOS DO GRÁFICO 1: KM Restante para Preventiva por Placa
  const dadosGraficoKmPreventiva = useMemo(() => {
    return frotas.map((v) => {
      const placa = v.placa.toUpperCase().trim()
      const kmAtual = ultimasKmsPorPlaca.get(placa) || 0
      const kmUltima = v.kmUltimaPreventiva || 0
      const intervalo = v.intervaloPreventivaKm || 10000
      const kmMeta = kmUltima > 0 ? kmUltima + intervalo : (v.kmProximaPreventiva || (kmAtual > 0 ? kmAtual + 10000 : 10000))
      const kmFaltante = kmMeta - kmAtual

      return {
        placa,
        modelo: v.modeloNome || v.marcaNome || 'VEÍCULO',
        kmAtual,
        kmUltima,
        kmMeta,
        kmFaltante,
        status: kmFaltante < 0 ? 'atrasado' : kmFaltante <= 1500 ? 'proximo' : 'em_dia',
      }
    }).sort((a, b) => a.kmFaltante - b.kmFaltante)
  }, [frotas, ultimasKmsPorPlaca])

  // 2. DADOS DO GRÁFICO 2: Checklists Realizados por Pessoa (Motorista / Condutor)
  const dadosGraficoChecklistPessoa = useMemo(() => {
    const contagem = new Map<string, { total: number; aprovados: number; ressalvas: number; reprovados: number }>()

    checklists.forEach((chk) => {
      const pessoa = (chk.motoristaNome || chk.inspetorNome || 'NÃO IDENTIFICADO').toUpperCase().trim()
      const atual = contagem.get(pessoa) || { total: 0, aprovados: 0, ressalvas: 0, reprovados: 0 }
      atual.total++
      if (chk.resultado === 'aprovado') atual.aprovados++
      else if (chk.resultado === 'aprovado_com_ressalvas') atual.ressalvas++
      else if (chk.resultado === 'reprovado') atual.reprovados++
      contagem.set(pessoa, atual)
    })

    return Array.from(contagem.entries())
      .map(([nome, dados]) => ({
        nome,
        total: dados.total,
        aprovados: dados.aprovados,
        ressalvas: dados.ressalvas,
        reprovados: dados.reprovados,
      }))
      .sort((a, b) => b.total - a.total)
  }, [checklists])

  // 3. DADOS DO GRÁFICO 3: Dias Restantes para Vencimento do CRLV por Placa
  const dadosGraficoVencimentoDoc = useMemo(() => {
    const hoje = startOfDay(new Date())

    return frotas
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
          status: dias < 0 ? 'vencido' : dias <= 30 ? 'a_vencer' : 'em_dia',
        }
      })
      .sort((a, b) => a.dias - b.dias)
  }, [frotas])

  // Métricas da Frota
  const metricasFrota = useMemo(() => {
    const total = frotas.length
    let operantes = 0
    let inoperantes = 0
    let noPatio = 0
    let preventivaAtrasada = 0
    let docAVencer = 0
    let docVencido = 0

    frotas.forEach((v) => {
      if (v.situacao === 'operante') operantes++
      else inoperantes++

      if (placasNoPatio.has(v.placa.toUpperCase().trim())) noPatio++

      const statusPrev = getStatusPreventiva(v)
      if (statusPrev.status === 'atrasada') preventivaAtrasada++

      const statusDoc = getStatusDocumento(v.vencimentoDocumento)
      if (statusDoc.status === 'vencido') docVencido++
      else if (statusDoc.status === 'a_vencer') docAVencer++
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
    }
  }, [frotas, placasNoPatio, ultimasKmsPorPlaca])

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
    return frotas.filter((v) => {
      if (tipoFiltro !== 'todos' && v.tipo !== tipoFiltro) return false
      if (clienteFiltro !== 'todos' && v.clienteId !== clienteFiltro) return false

      if (alertaFiltro === 'preventiva_atrasada') {
        const st = getStatusPreventiva(v)
        if (st.status !== 'atrasada') return false
      } else if (alertaFiltro === 'doc_a_vencer') {
        const st = getStatusDocumento(v.vencimentoDocumento)
        if (st.status !== 'a_vencer') return false
      } else if (alertaFiltro === 'doc_vencido') {
        const st = getStatusDocumento(v.vencimentoDocumento)
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

      return (
        placa.includes(termo) ||
        modelo.includes(termo) ||
        marca.includes(termo) ||
        cliente.includes(termo) ||
        chassi.includes(termo) ||
        cor.includes(termo)
      )
    })
  }, [frotas, tipoFiltro, clienteFiltro, alertaFiltro, busca, ultimasKmsPorPlaca])

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

  // Handlers de Veículo
  function iniciarCriacaoVeiculo() {
    setEditandoId(null)
    reset({
      clienteId: clienteFiltro !== 'todos' ? clienteFiltro : (clientes[0]?.id || ''),
      tipo: 'pesado',
      situacao: 'operante',
      placa: '',
      cor: '',
      chassi: '',
      ano: anoAtual,
      marcaId: '',
      modeloId: '',
      vencimentoDocumento: '',
      dataUltimaPreventiva: '',
      kmUltimaPreventiva: undefined,
      intervaloPreventivaKm: 10000,
      observacoes: '',
    })
    setMostrarModalVeiculo(true)
  }

  function iniciarEdicaoVeiculo(v: ItemFrotaCadastrada) {
    setEditandoId(v.id)
    reset({
      clienteId: v.clienteId || '',
      placa: v.placa,
      tipo: v.tipo,
      cor: v.cor || '',
      chassi: v.chassi ?? '',
      situacao: v.situacao,
      ano: v.ano || anoAtual,
      marcaId: '',
      modeloId: '',
      vencimentoDocumento: v.vencimentoDocumento || '',
      dataUltimaPreventiva: v.dataUltimaPreventiva || v.vencimentoPreventiva || '',
      kmUltimaPreventiva: v.kmUltimaPreventiva,
      intervaloPreventivaKm: v.intervaloPreventivaKm || 10000,
      observacoes: v.observacoes || '',
    })
    setMostrarModalVeiculo(true)
  }

  async function onSubmitVeiculo(values: FormVeiculoValues) {
    setErroLista(null)
    const clienteObj = clientes.find((c) => c.id === values.clienteId)
    const marcaObj = marcas.find((m) => m.id === values.marcaId)
    const modeloObj = modelos.find((m) => m.id === values.modeloId)

    const novoItem: ItemFrotaCadastrada = {
      id: editandoId || `frota_${Date.now()}`,
      placa: values.placa.toUpperCase().trim(),
      tipo: values.tipo,
      cor: values.cor.toUpperCase().trim(),
      chassi: values.chassi?.trim() ? values.chassi.toUpperCase().trim() : undefined,
      situacao: values.situacao,
      ano: values.ano,
      clienteId: values.clienteId,
      clienteNome: clienteObj?.nome || '',
      marcaNome: marcaObj?.nome || '',
      modeloNome: modeloObj?.nome || '',
      vencimentoDocumento: values.vencimentoDocumento || undefined,
      dataUltimaPreventiva: values.dataUltimaPreventiva || undefined,
      kmUltimaPreventiva: values.kmUltimaPreventiva || undefined,
      intervaloPreventivaKm: values.intervaloPreventivaKm || 10000,
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
    if (!confirm('Deseja realmente excluir este veículo da frota?')) return
    salvarFrotas(frotas.filter((f) => f.id !== id))
  }

  // Handlers de Checklist
  function iniciarNovoChecklist() {
    const primeiro = frotas[0]?.id || ''
    setVeiculoChecklistId(primeiro)
    setMotoristaChecklist('')
    setKmChecklist(0)
    setResultadoChecklist('aprovado')
    setObsChecklist('')
    setFotosChecklist({})
    setItensChecklistForm(
      ITENS_PADRAO_CHECKLIST.map((it) => ({
        id: it.id,
        categoria: it.categoria,
        nome: it.nome,
        status: 'conforme',
      })),
    )
    setMostrarModalNovoChecklist(true)
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

  function handleSalvarChecklist(e: React.FormEvent) {
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

    const temNaoConforme = itensChecklistForm.some((it) => it.status === 'nao_conforme')
    let resFinal = resultadoChecklist
    if (temNaoConforme && resultadoChecklist === 'aprovado') {
      resFinal = 'aprovado_com_ressalvas'
    }

    // Se a preventiva estiver vencida por KM, sugerir ressalva caso esteja como aprovado direto
    if (comparacaoPreventivaChecklist.status === 'vencida' && resFinal === 'aprovado') {
      resFinal = 'aprovado_com_ressalvas'
    }

    const novoChecklist: RegistroChecklist = {
      id: `chk_${Date.now()}`,
      veiculoId: veiculoChecklistId,
      placa: veiculo?.placa || 'PLACA',
      modeloNome: veiculo?.modeloNome,
      clienteNome: veiculo?.clienteNome,
      motoristaNome: motoristaChecklist.toUpperCase().trim(),
      inspetorNome: inspetor.toUpperCase(),
      kmAtual: Number(kmChecklist) || 0,
      resultado: resFinal,
      statusPreventiva: comparacaoPreventivaChecklist,
      itens: itensChecklistForm,
      fotos: fotosChecklist,
      observacoesGerais: obsChecklist.trim() || undefined,
      dataHora: new Date().toISOString(),
    }

    salvarChecklists([novoChecklist, ...checklists])
    setMostrarModalNovoChecklist(false)
  }

  function handleExcluirChecklist(id: string) {
    if (!confirm('Deseja excluir este registro de checklist?')) return
    salvarChecklists(checklists.filter((c) => c.id !== id))
  }

  const totalFotosTiradas = [
    fotosChecklist.painel,
    fotosChecklist.capo,
    fotosChecklist.interna,
    fotosChecklist.frente,
    fotosChecklist.ladoEsquerdo,
    fotosChecklist.traseira,
    fotosChecklist.ladoDireito,
    fotosChecklist.pneuDiantEsq,
    fotosChecklist.pneuDiantDir,
    fotosChecklist.pneuTrasEsq,
    fotosChecklist.pneuTrasDir,
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
            : 'VEÍCULOS DA FROTA'
        }
        subtitle={
          abaPrincipal === 'dashboard'
            ? 'KM RESTANTE PARA PREVENTIVA, AUDITORIA DE CHECKLISTS E VENCIMENTO DE DOCUMENTOS'
            : abaPrincipal === 'checklist'
            ? 'INSPEÇÕES VEICULARES, VISTORIAS OPERACIONAIS E LAUDOS DE CONFORMIDADE'
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

      {erroLista && (
        <div className="rounded-2xl border border-status-danger/30 bg-status-danger/10 p-4 text-xs font-bold text-status-danger flex items-center justify-between">
          <span>{erroLista}</span>
          <button onClick={() => setErroLista(null)} className="text-status-danger hover:opacity-70 p-1">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 0: DASHBOARD GERENCIAL DA FROTA (COM OS 3 GRÁFICOS SOLICITADOS) */}
      {/* ========================================================================= */}
      {abaPrincipal === 'dashboard' && (
        <div className="space-y-6">
          {/* Indicadores Principais em Cards */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <Card className="p-4 sm:p-5 border-border/30 bg-surface/90">
              <div className="flex items-center justify-between text-secondary">
                <span className="text-[11px] font-black uppercase tracking-wider">TOTAL DA FROTA</span>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                  <Truck className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-3 text-3xl font-black font-mono text-foreground">{metricasFrota.total}</p>
              <div className="mt-2 flex items-center justify-between text-[10px] font-bold text-secondary">
                <span className="text-emerald-400 font-black">● {metricasFrota.operantes} OPERANTES</span>
                <span className="text-amber-400 font-black">● {metricasFrota.inoperantes} INOP.</span>
              </div>
            </Card>

            <Card className="p-4 sm:p-5 border-blue-500/20 bg-surface/90">
              <div className="flex items-center justify-between text-blue-400">
                <span className="text-[11px] font-black uppercase tracking-wider">STATUS NO PÁTIO</span>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <MapPin className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-3 text-3xl font-black font-mono text-blue-400">{metricasFrota.noPatio}</p>
              <div className="mt-2 flex items-center justify-between text-[10px] font-bold text-secondary">
                <span className="text-blue-300">NO PÁTIO AGORA</span>
                <span className="text-foreground/70">{metricasFrota.foraDoPatio} EM ROTA</span>
              </div>
            </Card>

            <Card
              onClick={() => {
                setAlertaFiltro('preventiva_atrasada')
                navigate('/frotas?aba=veiculos')
              }}
              className="p-4 sm:p-5 border-red-500/30 bg-surface/90 cursor-pointer hover:border-red-500/60 transition-colors"
            >
              <div className="flex items-center justify-between text-red-400">
                <span className="text-[11px] font-black uppercase tracking-wider">PREVENTIVAS ATRASADAS</span>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/10 text-red-400 border border-red-500/20">
                  <AlertOctagon className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-3 text-3xl font-black font-mono text-red-400">{metricasFrota.preventivaAtrasada}</p>
              <p className="mt-1 text-xs text-red-300/80 font-medium">REVISÕES EXPIRADAS ➔</p>
            </Card>

            <Card
              onClick={() => {
                setAlertaFiltro('doc_vencido')
                navigate('/frotas?aba=veiculos')
              }}
              className="p-4 sm:p-5 border-rose-600/30 bg-surface/90 cursor-pointer hover:border-rose-600/60 transition-colors"
            >
              <div className="flex items-center justify-between text-rose-500">
                <span className="text-[11px] font-black uppercase tracking-wider">CRLV VENCIDO / VENCENDO</span>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-600/10 text-rose-500 border border-rose-600/20">
                  <FileX className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-3 text-3xl font-black font-mono text-rose-500">
                {metricasFrota.docVencido + metricasFrota.docAVencer}
              </p>
              <div className="mt-1 text-[10px] text-secondary font-bold flex justify-between">
                <span className="text-rose-400">{metricasFrota.docVencido} VENCIDOS</span>
                <span className="text-amber-400">{metricasFrota.docAVencer} A VENCER</span>
              </div>
            </Card>
          </div>

          {/* ========================================================================= */}
          {/* GRÁFICO 1: QUANTOS KM FALTAM PARA FAZER PREVENTIVA POR PLACA */}
          {/* ========================================================================= */}
          <Card className="p-5 border-border/25 bg-surface/90 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/10 pb-3">
              <div className="flex items-center gap-2">
                <Gauge className="h-5 w-5 text-primary" />
                <div>
                  <h3 className="text-sm font-black text-foreground uppercase tracking-wide">
                    QUILOMETRAGEM (KM) RESTANTE PARA PRÓXIMA PREVENTIVA POR VEÍCULO
                  </h3>
                  <p className="text-[11px] text-secondary normal-case">
                    Comparação de KM atual dos checklists vs KM da última preventiva + intervalo de revisão
                  </p>
                </div>
              </div>
              <Badge tone="neutral" className="text-[10px] font-black self-start sm:self-auto">
                {dadosGraficoKmPreventiva.length} VEÍCULOS AUDITADOS
              </Badge>
            </div>

            {dadosGraficoKmPreventiva.length === 0 ? (
              <div className="py-12 text-center text-secondary">
                <Truck className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-xs font-bold text-foreground">NENHUM VEÍCULO CADASTRADO NA FROTA</p>
              </div>
            ) : (
              <div className="h-80 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={dadosGraficoKmPreventiva}
                    margin={{ top: 20, right: 30, left: 10, bottom: 25 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis
                      dataKey="placa"
                      tick={{ fill: 'var(--text-secondary, #94a3b8)', fontSize: 11, fontWeight: 'bold' }}
                      axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: 'var(--text-secondary, #94a3b8)', fontSize: 10, fontFamily: 'monospace' }}
                      axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                      tickLine={false}
                      unit=" KM"
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload || !payload.length) return null
                        const d = payload[0].payload
                        return (
                          <div className="rounded-xl border border-border/40 bg-surface/95 p-3 shadow-2xl backdrop-blur-md text-xs uppercase font-sans">
                            <p className="font-mono font-black text-primary text-sm flex items-center gap-1">
                              🚛 {d.placa} · {d.modelo}
                            </p>
                            <div className="mt-1.5 space-y-1 text-[11px] text-foreground font-mono">
                              <p>KM Atual (Checklist): <span className="font-bold text-white">{d.kmAtual.toLocaleString('pt-BR')} KM</span></p>
                              {d.kmUltima > 0 && <p>Última Preventiva: <span className="font-bold text-secondary">{d.kmUltima.toLocaleString('pt-BR')} KM</span></p>}
                              <p>Limite da Preventiva: <span className="font-bold text-white">{d.kmMeta.toLocaleString('pt-BR')} KM</span></p>
                              <p className={`font-black ${d.kmFaltante < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                {d.kmFaltante < 0
                                  ? `🛑 ATRASADA EM ${Math.abs(d.kmFaltante).toLocaleString('pt-BR')} KM`
                                  : `✅ FALTAM ${d.kmFaltante.toLocaleString('pt-BR')} KM`}
                              </p>
                            </div>
                          </div>
                        )
                      }}
                    />
                    <Bar dataKey="kmFaltante" radius={[6, 6, 0, 0]}>
                      <LabelList
                        dataKey="kmFaltante"
                        position="top"
                        formatter={(val: any) => `${Number(val).toLocaleString('pt-BR')} KM`}
                        style={{ fill: '#cbd5e1', fontSize: '9px', fontWeight: 'bold', fontFamily: 'monospace' }}
                      />
                      {dadosGraficoKmPreventiva.map((entry, index) => {
                        let cor = '#10b981' // Verde (em dia)
                        if (entry.kmFaltante < 0) cor = '#ef4444' // Vermelho (atrasado)
                        else if (entry.kmFaltante <= 1500) cor = '#f59e0b' // Amarelo (próximo de vencer)
                        return <Cell key={`cell-km-${index}`} fill={cor} />
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
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
                  <p className="text-xs font-bold text-foreground">NENHUM CHECKLIST REGISTRADO AINDA</p>
                </div>
              ) : (
                <div className="h-72 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={dadosGraficoChecklistPessoa.slice(0, 8)}
                      layout="vertical"
                      margin={{ top: 10, right: 30, left: 30, bottom: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
                      <XAxis
                        type="number"
                        tick={{ fill: 'var(--text-secondary, #94a3b8)', fontSize: 10, fontFamily: 'monospace' }}
                        axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                        tickLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="nome"
                        tick={{ fill: 'var(--text-foreground, #f8fafc)', fontSize: 11, fontWeight: 'bold' }}
                        axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                        tickLine={false}
                        width={130}
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
                              </div>
                            </div>
                          )
                        }}
                      />
                      <Bar dataKey="total" fill="#6366f1" radius={[0, 6, 6, 0]}>
                        <LabelList
                          dataKey="total"
                          position="right"
                          formatter={(val: any) => `${val} vistorias`}
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
                <div className="h-72 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={dadosGraficoVencimentoDoc}
                      margin={{ top: 20, right: 30, left: 10, bottom: 25 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                      <XAxis
                        dataKey="placa"
                        tick={{ fill: 'var(--text-secondary, #94a3b8)', fontSize: 11, fontWeight: 'bold' }}
                        axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                        tickLine={false}
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
                                <p className="text-secondary">Data de Vencimento: <span className="font-bold text-white">{d.vencimento}</span></p>
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
                      <Bar dataKey="dias" radius={[6, 6, 0, 0]}>
                        <LabelList
                          dataKey="dias"
                          position="top"
                          formatter={(val: any) => `${val}D`}
                          style={{ fill: '#cbd5e1', fontSize: '9px', fontWeight: 'bold', fontFamily: 'monospace' }}
                        />
                        {dadosGraficoVencimentoDoc.map((entry, index) => {
                          let cor = '#10b981' // Verde (em dia)
                          if (entry.dias < 0) cor = '#e11d48' // Vermelho escuro (vencido)
                          else if (entry.dias <= 30) cor = '#f59e0b' // Laranja / Âmbar (a vencer)
                          return <Cell key={`cell-doc-${index}`} fill={cor} />
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 1: VEÍCULOS & FROTA */}
      {/* ========================================================================= */}
      {abaPrincipal === 'veiculos' && (
        <div className="space-y-6">
          {/* Cards de Indicadores da Frota */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {/* Total da Frota */}
            <button
              type="button"
              onClick={() => setAlertaFiltro('todos')}
              className={`text-left p-4 sm:p-5 rounded-2xl border transition-all duration-200 ${
                alertaFiltro === 'todos'
                  ? 'border-primary/50 bg-primary/10 shadow-lg shadow-primary/5 ring-1 ring-primary/40'
                  : 'border-border/30 bg-surface/90 hover:border-border/60'
              }`}
            >
              <div className="flex items-center justify-between text-secondary">
                <span className="text-[11px] font-black uppercase tracking-wider">TOTAL DA FROTA</span>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                  <Truck className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-3 text-3xl font-black font-mono text-foreground">{metricasFrota.total}</p>
              <p className="mt-1 text-xs text-secondary font-medium">VEÍCULOS CADASTRADOS</p>
            </button>

            {/* Preventiva Atrasada */}
            <button
              type="button"
              onClick={() => setAlertaFiltro(alertaFiltro === 'preventiva_atrasada' ? 'todos' : 'preventiva_atrasada')}
              className={`text-left p-4 sm:p-5 rounded-2xl border transition-all duration-200 ${
                alertaFiltro === 'preventiva_atrasada'
                  ? 'border-red-500 bg-red-500/15 shadow-lg shadow-red-500/10 ring-1 ring-red-500'
                  : 'border-red-500/30 bg-surface/90 hover:border-red-500/50'
              }`}
            >
              <div className="flex items-center justify-between text-red-400">
                <span className="text-[11px] font-black uppercase tracking-wider">PREVENTIVA ATRASADA</span>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/10 text-red-400 border border-red-500/20">
                  <AlertOctagon className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-3 text-3xl font-black font-mono text-red-400">{metricasFrota.preventivaAtrasada}</p>
              <p className="mt-1 text-xs text-red-300/80 font-medium">REVISÕES FORA DO PRAZO</p>
            </button>

            {/* Documento a Vencer */}
            <button
              type="button"
              onClick={() => setAlertaFiltro(alertaFiltro === 'doc_a_vencer' ? 'todos' : 'doc_a_vencer')}
              className={`text-left p-4 sm:p-5 rounded-2xl border transition-all duration-200 ${
                alertaFiltro === 'doc_a_vencer'
                  ? 'border-amber-500 bg-amber-500/15 shadow-lg shadow-amber-500/10 ring-1 ring-amber-500'
                  : 'border-amber-500/30 bg-surface/90 hover:border-amber-500/50'
              }`}
            >
              <div className="flex items-center justify-between text-amber-400">
                <span className="text-[11px] font-black uppercase tracking-wider">DOCUMENTO A VENCER</span>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Clock className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-3 text-3xl font-black font-mono text-amber-400">{metricasFrota.docAVencer}</p>
              <p className="mt-1 text-xs text-amber-300/80 font-medium">VENCE EM ATÉ 30 DIAS</p>
            </button>

            {/* Documento Vencido */}
            <button
              type="button"
              onClick={() => setAlertaFiltro(alertaFiltro === 'doc_vencido' ? 'todos' : 'doc_vencido')}
              className={`text-left p-4 sm:p-5 rounded-2xl border transition-all duration-200 ${
                alertaFiltro === 'doc_vencido'
                  ? 'border-rose-600 bg-rose-600/15 shadow-lg shadow-rose-600/10 ring-1 ring-rose-600'
                  : 'border-rose-600/30 bg-surface/90 hover:border-rose-600/50'
              }`}
            >
              <div className="flex items-center justify-between text-rose-500">
                <span className="text-[11px] font-black uppercase tracking-wider">DOCUMENTO VENCIDO</span>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-600/10 text-rose-500 border border-rose-600/20">
                  <FileX className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-3 text-3xl font-black font-mono text-rose-500">{metricasFrota.docVencido}</p>
              <p className="mt-1 text-xs text-rose-300/80 font-medium">EXPIRADO / REGULARIZAR</p>
            </button>
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
                className="h-10 rounded-xl border border-border/25 bg-surface/90 px-3 text-xs font-bold text-foreground focus:border-primary focus:outline-none uppercase"
              >
                <option value="todos">STATUS: TODOS</option>
                <option value="preventiva_atrasada">⚠️ PREVENTIVAS ATRASADAS</option>
                <option value="doc_a_vencer">⏳ DOCS A VENCER (30D)</option>
                <option value="doc_vencido">🛑 DOCS VENCIDOS</option>
              </select>

              <select
                value={clienteFiltro}
                onChange={(e) => setClienteFiltro(e.target.value)}
                className="h-10 rounded-xl border border-border/25 bg-surface/90 px-3 text-xs font-bold text-foreground focus:border-primary focus:outline-none uppercase"
              >
                <option value="todos">TODOS OS CLIENTES ({clientes.length})</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>

              <select
                value={tipoFiltro}
                onChange={(e) => setTipoFiltro(e.target.value)}
                className="h-10 rounded-xl border border-border/25 bg-surface/90 px-3 text-xs font-bold text-foreground focus:border-primary focus:outline-none uppercase"
              >
                <option value="todos">TODOS OS TIPOS</option>
                <option value="pesado">PESADOS / CAMINHÕES</option>
                <option value="leve">LEVES / UTILITÁRIOS</option>
                <option value="trator">TRATORES / CAVALOS</option>
                <option value="carreta">CARRETAS / IMPLEMENTOS</option>
              </select>
            </div>
          </div>

          {/* Tabela de Veículos */}
          {veiculosFiltrados.length === 0 ? (
            <Card className="p-12 text-center">
              <Truck className="mx-auto mb-3 h-10 w-10 text-secondary/40" />
              <p className="text-base font-bold text-foreground">NENHUM VEÍCULO ENCONTRADO</p>
              <p className="mt-1 text-xs text-secondary">
                {busca || tipoFiltro !== 'todos' || clienteFiltro !== 'todos' || alertaFiltro !== 'todos'
                  ? 'TENTE AJUSTAR OS FILTROS DE BUSCA.'
                  : 'CADASTRE SEUS VEÍCULOS DE FROTA CLICANDO NO BOTÃO "+ NOVO VEÍCULO".'}
              </p>
            </Card>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border/25 bg-surface/80 shadow-sm backdrop-blur-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm uppercase">
                  <thead className="border-b border-border/15 bg-surface/95 text-[11px] font-black text-secondary uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3.5">PLACA</th>
                      <th className="px-4 py-3.5">MODELO / MARCA</th>
                      <th className="px-4 py-3.5">CLIENTE</th>
                      <th className="px-4 py-3.5">ÚLTIMA PREVENTIVA (KM / DATA)</th>
                      <th className="px-4 py-3.5">STATUS PREVENTIVA</th>
                      <th className="px-4 py-3.5">DOCUMENTO / CRLV</th>
                      <th className="px-4 py-3.5">SITUAÇÃO</th>
                      <th className="px-4 py-3.5 text-right">AÇÕES</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/10 font-medium">
                    {veiculosFiltrados.map((v) => {
                      const estaNoPatio = placasNoPatio.has(v.placa.toUpperCase().trim())
                      const statusPrev = getStatusPreventiva(v)
                      const statusDoc = getStatusDocumento(v.vencimentoDocumento)

                      return (
                        <tr key={v.id} className="hover:bg-surface-hover/40 transition-colors group">
                          {/* Placa */}
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-black text-primary text-sm flex items-center gap-1.5">
                                <span>🚛</span>
                                <span>{v.placa}</span>
                              </span>
                              {estaNoPatio && (
                                <span className="rounded-md bg-blue-500/20 text-blue-400 border border-blue-500/30 px-1.5 py-0.2 text-[9px] font-black">
                                  NO PÁTIO
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Modelo / Marca */}
                          <td className="px-4 py-3.5">
                            <div className="font-bold text-foreground text-xs leading-snug">
                              {v.modeloNome || '—'}
                            </div>
                            <div className="text-[11px] text-secondary font-semibold">
                              {v.marcaNome || '—'} · <span className="text-[10px] font-mono">{tipoVeiculoLabel(v.tipo)}</span>
                            </div>
                          </td>

                          {/* Cliente */}
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-1.5 text-xs text-foreground font-semibold">
                              <Building2 className="h-3.5 w-3.5 text-secondary shrink-0" />
                              <span className="truncate max-w-[180px]">{v.clienteNome || '—'}</span>
                            </div>
                          </td>

                          {/* Dados da Última Preventiva */}
                          <td className="px-4 py-3.5">
                            <div className="text-xs font-mono font-bold text-foreground">
                              {v.kmUltimaPreventiva ? `${v.kmUltimaPreventiva.toLocaleString('pt-BR')} KM` : '—'}
                            </div>
                            <div className="text-[10px] text-secondary font-semibold">
                              {v.dataUltimaPreventiva ? format(parseISO(v.dataUltimaPreventiva), 'dd/MM/yyyy') : 'DATA NÃO INFORMADA'}
                            </div>
                          </td>

                          {/* Status da Preventiva */}
                          <td className="px-4 py-3.5">
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
                              <span className="text-[10px] text-secondary/60 font-semibold">— NÃO INFORMADA</span>
                            )}
                          </td>

                          {/* Documento / CRLV */}
                          <td className="px-4 py-3.5">
                            {statusDoc.status === 'vencido' ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-rose-600/15 border border-rose-600/30 px-2 py-0.5 text-[10px] font-black text-rose-500">
                                <FileX className="h-3 w-3" />
                                {statusDoc.label}
                              </span>
                            ) : statusDoc.status === 'a_vencer' ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-black text-amber-400">
                                <Clock className="h-3 w-3" />
                                {statusDoc.label}
                              </span>
                            ) : statusDoc.status === 'em_dia' ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                                <CheckCircle2 className="h-3 w-3" />
                                {statusDoc.label}
                              </span>
                            ) : (
                              <span className="text-[10px] text-secondary/60 font-semibold">— NÃO INFORMADO</span>
                            )}
                          </td>

                          {/* Situação */}
                          <td className="px-4 py-3.5">
                            {v.situacao === 'operante' ? (
                              <Badge tone="success" className="text-[9px] font-black">
                                OPERANTE
                              </Badge>
                            ) : (
                              <Badge tone="warning" className="text-[9px] font-black">
                                INOPERANTE
                              </Badge>
                            )}
                          </td>

                          {/* Ações */}
                          <td className="px-4 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => iniciarEdicaoVeiculo(v)}
                                className="rounded-lg p-1.5 text-secondary hover:text-foreground hover:bg-overlay/10 transition-colors"
                                title="Editar Veículo"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleExcluirVeiculo(v.id)}
                                className="rounded-lg p-1.5 text-secondary hover:text-status-danger hover:bg-status-danger/10 transition-colors"
                                title="Excluir Veículo"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
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
          {checklistsFiltrados.length === 0 ? (
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
                        chk.fotos?.capo,
                        chk.fotos?.interna,
                        chk.fotos?.frente,
                        chk.fotos?.ladoEsquerdo,
                        chk.fotos?.traseira,
                        chk.fotos?.ladoDireito,
                        chk.fotos?.pneuDiantEsq,
                        chk.fotos?.pneuDiantDir,
                        chk.fotos?.pneuTrasEsq,
                        chk.fotos?.pneuTrasDir,
                      ].filter(Boolean).length

                      return (
                        <tr key={chk.id} className="hover:bg-surface-hover/40 transition-colors group">
                          {/* Data / Hora */}
                          <td className="px-4 py-3.5 text-xs text-secondary font-mono">
                            {dataFormatada}
                          </td>

                          {/* Placa / Veículo */}
                          <td className="px-4 py-3.5">
                            <div className="font-mono font-black text-primary text-sm flex items-center gap-1.5">
                              <span>🚛</span>
                              <span>{chk.placa}</span>
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
                                {fotosQtd}/6 FOTOS
                              </span>
                            ) : (
                              <span className="text-[10px] text-secondary/50 font-semibold">— SEM FOTOS</span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3.5">
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
                              <button
                                type="button"
                                onClick={() => handleExcluirChecklist(chk.id)}
                                className="rounded-lg p-1.5 text-secondary hover:text-status-danger hover:bg-status-danger/10 transition-colors"
                                title="Excluir Checklist"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
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
      {/* MODAL 1: CADASTRO / EDIÇÃO DE VEÍCULO DA FROTA */}
      {/* ========================================================================= */}
      {mostrarModalVeiculo && (
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
              {/* Cliente */}
              <div>
                <Label htmlFor="clienteId">Cliente / Proprietário *</Label>
                <Select id="clienteId" {...register('clienteId')} className="mt-1 text-xs uppercase font-bold">
                  <option value="">Selecione o cliente...</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </Select>
                <FieldError message={errors.clienteId?.message} />
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

              {/* SEÇÃO: CONTROLE DE PREVENTIVA (KM DA ÚLTIMA, DATA E INTERVALO) */}
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                <div className="flex items-center gap-2 text-primary font-black text-xs">
                  <Gauge className="h-4 w-4" />
                  <span>DADOS DA ÚLTIMA PREVENTIVA & REVISÃO PERIÓDICA</span>
                </div>
                <p className="text-[10px] text-secondary normal-case">
                  Ao realizar vistorias de checklist, a quilometragem informada será comparada com estes dados para alertar vencimentos.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label htmlFor="kmUltimaPreventiva">KM da Última Preventiva</Label>
                    <Input
                      id="kmUltimaPreventiva"
                      type="number"
                      placeholder="Ex: 150000"
                      {...register('kmUltimaPreventiva', { valueAsNumber: true })}
                      className="mt-1 text-xs font-mono font-bold"
                    />
                  </div>

                  <div>
                    <Label htmlFor="intervaloPreventivaKm">Intervalo Preventiva (KM)</Label>
                    <Input
                      id="intervaloPreventivaKm"
                      type="number"
                      placeholder="Ex: 10000"
                      {...register('intervaloPreventivaKm', { valueAsNumber: true })}
                      className="mt-1 text-xs font-mono font-bold"
                    />
                  </div>

                  <div>
                    <Label htmlFor="dataUltimaPreventiva">Data da Última Preventiva</Label>
                    <Input
                      id="dataUltimaPreventiva"
                      type="date"
                      {...register('dataUltimaPreventiva')}
                      className="mt-1 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="pt-1">
                  <Label htmlFor="vencimentoDocumento">Vencimento do Documento (CRLV)</Label>
                  <Input
                    id="vencimentoDocumento"
                    type="date"
                    {...register('vencimentoDocumento')}
                    className="mt-1 text-xs font-mono"
                  />
                </div>
              </div>

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
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: NOVO CHECKLIST DE INSPEÇÃO COM COMPARADOR DE PREVENTIVA */}
      {/* ========================================================================= */}
      {mostrarModalNovoChecklist && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-4 animate-fade-in">
          <div className="w-full max-w-2xl rounded-2xl border border-border/20 bg-surface shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/10 px-5 py-3.5 bg-surface/90">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <ClipboardCheck className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-black text-foreground uppercase">NOVO CHECKLIST DA FROTA</h2>
                  <p className="text-[10px] sm:text-[11px] text-secondary">Vistoria fotográfica, KM e diagnóstico de preventiva</p>
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

            <form onSubmit={handleSalvarChecklist} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
              {/* SEÇÃO 1: FOTOS OBRIGATÓRIAS DE VISTORIA (INÍCIO DO CHECKLIST) */}
              <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Camera className="h-4 w-4 text-primary animate-pulse" />
                    <span className="text-xs font-black text-foreground uppercase tracking-wide">
                      1. FOTOS DA VISTORIA COMPLETA
                    </span>
                  </div>
                  <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-md ${
                    totalFotosTiradas === 11
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-primary/20 text-primary'
                  }`}>
                    {totalFotosTiradas}/11 CAPTURADAS
                  </span>
                </div>
                <p className="text-[11px] text-secondary normal-case leading-relaxed">
                  Tire as fotos da vistoria: painel/km, motor/capô, interna/cabine, 4 lados do veículo e os 4 pneus:
                </p>

                {/* Subseção A: Compartimento & Cabine */}
                <div>
                  <span className="text-[10px] font-black text-secondary uppercase tracking-wider block mb-2">
                    A. COMPARTIMENTO & INSTRUMENTOS
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Foto 1: Painel */}
                    <div className={`rounded-xl border p-3 flex flex-col items-center text-center transition-all ${
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
                      <div className="flex items-center justify-between w-full mb-2">
                        <span className="text-[10px] font-black text-foreground flex items-center gap-1">
                          <Gauge className="h-3 w-3 text-primary" /> PAINEL / KM
                        </span>
                        {fotosChecklist.painel ? (
                          <span className="flex items-center gap-0.5 text-[9px] font-black text-emerald-400 bg-emerald-500/20 px-1.5 py-0.2 rounded">
                            <Check className="h-2.5 w-2.5" /> OK
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold text-secondary">PENDENTE</span>
                        )}
                      </div>

                      {fotosChecklist.painel ? (
                        <div className="relative w-full h-24 rounded-lg overflow-hidden border border-emerald-500/30 group">
                          <img src={fotosChecklist.painel} alt="Painel" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1 transition-opacity">
                            <button
                              type="button"
                              onClick={() => inputFotoPainelRef.current?.click()}
                              className="p-1 rounded bg-white text-black text-[9px] font-bold"
                            >
                              Trocar
                            </button>
                            <button
                              type="button"
                              onClick={() => setFotosChecklist((prev) => ({ ...prev, painel: undefined }))}
                              className="p-1 rounded bg-red-600 text-white text-[9px] font-bold"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => inputFotoPainelRef.current?.click()}
                          className="w-full h-24 rounded-lg border-2 border-dashed border-border/40 hover:border-primary/60 flex flex-col items-center justify-center gap-1 text-secondary hover:text-primary transition-all cursor-pointer bg-overlay/5"
                        >
                          <Camera className="h-5 w-5" />
                          <span className="text-[10px] font-bold">FOTO PAINEL</span>
                        </button>
                      )}
                    </div>

                    {/* Foto 2: Capô Aberto */}
                    <div className={`rounded-xl border p-3 flex flex-col items-center text-center transition-all ${
                      fotosChecklist.capo
                        ? 'border-emerald-500/40 bg-emerald-500/5'
                        : 'border-border/30 bg-surface/80 hover:border-primary/40'
                    }`}>
                      <input
                        ref={inputFotoCapoRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => handleUploadFoto('capo', e)}
                      />
                      <div className="flex items-center justify-between w-full mb-2">
                        <span className="text-[10px] font-black text-foreground flex items-center gap-1">
                          <Wrench className="h-3 w-3 text-amber-400" /> CAPÔ / MOTOR
                        </span>
                        {fotosChecklist.capo ? (
                          <span className="flex items-center gap-0.5 text-[9px] font-black text-emerald-400 bg-emerald-500/20 px-1.5 py-0.2 rounded">
                            <Check className="h-2.5 w-2.5" /> OK
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold text-secondary">PENDENTE</span>
                        )}
                      </div>

                      {fotosChecklist.capo ? (
                        <div className="relative w-full h-24 rounded-lg overflow-hidden border border-emerald-500/30 group">
                          <img src={fotosChecklist.capo} alt="Capô Aberto" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1 transition-opacity">
                            <button
                              type="button"
                              onClick={() => inputFotoCapoRef.current?.click()}
                              className="p-1 rounded bg-white text-black text-[9px] font-bold"
                            >
                              Trocar
                            </button>
                            <button
                              type="button"
                              onClick={() => setFotosChecklist((prev) => ({ ...prev, capo: undefined }))}
                              className="p-1 rounded bg-red-600 text-white text-[9px] font-bold"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => inputFotoCapoRef.current?.click()}
                          className="w-full h-24 rounded-lg border-2 border-dashed border-border/40 hover:border-primary/60 flex flex-col items-center justify-center gap-1 text-secondary hover:text-primary transition-all cursor-pointer bg-overlay/5"
                        >
                          <Camera className="h-5 w-5" />
                          <span className="text-[10px] font-bold">FOTO CAPÔ</span>
                        </button>
                      )}
                    </div>

                    {/* Foto 3: Interna do Veículo */}
                    <div className={`rounded-xl border p-3 flex flex-col items-center text-center transition-all ${
                      fotosChecklist.interna
                        ? 'border-emerald-500/40 bg-emerald-500/5'
                        : 'border-border/30 bg-surface/80 hover:border-primary/40'
                    }`}>
                      <input
                        ref={inputFotoInternaRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => handleUploadFoto('interna', e)}
                      />
                      <div className="flex items-center justify-between w-full mb-2">
                        <span className="text-[10px] font-black text-foreground flex items-center gap-1">
                          <Car className="h-3 w-3 text-cyan-400" /> INTERNA / CABINE
                        </span>
                        {fotosChecklist.interna ? (
                          <span className="flex items-center gap-0.5 text-[9px] font-black text-emerald-400 bg-emerald-500/20 px-1.5 py-0.2 rounded">
                            <Check className="h-2.5 w-2.5" /> OK
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold text-secondary">PENDENTE</span>
                        )}
                      </div>

                      {fotosChecklist.interna ? (
                        <div className="relative w-full h-24 rounded-lg overflow-hidden border border-emerald-500/30 group">
                          <img src={fotosChecklist.interna} alt="Interna do Veículo" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1 transition-opacity">
                            <button
                              type="button"
                              onClick={() => inputFotoInternaRef.current?.click()}
                              className="p-1 rounded bg-white text-black text-[9px] font-bold"
                            >
                              Trocar
                            </button>
                            <button
                              type="button"
                              onClick={() => setFotosChecklist((prev) => ({ ...prev, interna: undefined }))}
                              className="p-1 rounded bg-red-600 text-white text-[9px] font-bold"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => inputFotoInternaRef.current?.click()}
                          className="w-full h-24 rounded-lg border-2 border-dashed border-border/40 hover:border-primary/60 flex flex-col items-center justify-center gap-1 text-secondary hover:text-primary transition-all cursor-pointer bg-overlay/5"
                        >
                          <Camera className="h-5 w-5" />
                          <span className="text-[10px] font-bold">FOTO INTERNA</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Subseção B: Exterior do Veículo (4 Lados) */}
                <div>
                  <span className="text-[10px] font-black text-secondary uppercase tracking-wider block mb-2">
                    B. EXTERIOR DO VEÍCULO (CARROCERIA)
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
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
                          <ArrowLeft className="h-2.5 w-2.5 text-blue-400" /> LADO ESQ.
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

                {/* Subseção C: Os 4 Pneus do Veículo */}
                <div>
                  <span className="text-[10px] font-black text-secondary uppercase tracking-wider block mb-2">
                    C. FOTOS DOS 4 PNEUS (DIANTEIROS E TRASEIROS)
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {/* Pneu 1: Dianteiro Esquerdo */}
                    <div className={`rounded-xl border p-2.5 flex flex-col items-center text-center transition-all ${
                      fotosChecklist.pneuDiantEsq
                        ? 'border-emerald-500/40 bg-emerald-500/5'
                        : 'border-border/30 bg-surface/80 hover:border-primary/40'
                    }`}>
                      <input
                        ref={inputFotoPneuDiantEsqRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => handleUploadFoto('pneuDiantEsq', e)}
                      />
                      <div className="flex items-center justify-between w-full mb-1.5">
                        <span className="text-[9px] font-black text-foreground flex items-center gap-0.5 truncate">
                          <Disc className="h-2.5 w-2.5 text-blue-400" /> DIANT. ESQ.
                        </span>
                        {fotosChecklist.pneuDiantEsq && (
                          <span className="text-[8px] font-black text-emerald-400">✓</span>
                        )}
                      </div>

                      {fotosChecklist.pneuDiantEsq ? (
                        <div className="relative w-full h-20 rounded-lg overflow-hidden border border-emerald-500/30 group">
                          <img src={fotosChecklist.pneuDiantEsq} alt="Pneu DE" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1 transition-opacity">
                            <button
                              type="button"
                              onClick={() => inputFotoPneuDiantEsqRef.current?.click()}
                              className="p-1 rounded bg-white text-black text-[8px] font-bold"
                            >
                              Trocar
                            </button>
                            <button
                              type="button"
                              onClick={() => setFotosChecklist((prev) => ({ ...prev, pneuDiantEsq: undefined }))}
                              className="p-1 rounded bg-red-600 text-white text-[8px] font-bold"
                            >
                              <Trash2 className="h-2.5 w-2.5" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => inputFotoPneuDiantEsqRef.current?.click()}
                          className="w-full h-20 rounded-lg border-2 border-dashed border-border/40 hover:border-primary/60 flex flex-col items-center justify-center gap-1 text-secondary hover:text-primary transition-all cursor-pointer bg-overlay/5"
                        >
                          <Camera className="h-4 w-4" />
                          <span className="text-[9px] font-bold">DIANT. ESQ.</span>
                        </button>
                      )}
                    </div>

                    {/* Pneu 2: Dianteiro Direito */}
                    <div className={`rounded-xl border p-2.5 flex flex-col items-center text-center transition-all ${
                      fotosChecklist.pneuDiantDir
                        ? 'border-emerald-500/40 bg-emerald-500/5'
                        : 'border-border/30 bg-surface/80 hover:border-primary/40'
                    }`}>
                      <input
                        ref={inputFotoPneuDiantDirRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => handleUploadFoto('pneuDiantDir', e)}
                      />
                      <div className="flex items-center justify-between w-full mb-1.5">
                        <span className="text-[9px] font-black text-foreground flex items-center gap-0.5 truncate">
                          <Disc className="h-2.5 w-2.5 text-blue-400" /> DIANT. DIR.
                        </span>
                        {fotosChecklist.pneuDiantDir && (
                          <span className="text-[8px] font-black text-emerald-400">✓</span>
                        )}
                      </div>

                      {fotosChecklist.pneuDiantDir ? (
                        <div className="relative w-full h-20 rounded-lg overflow-hidden border border-emerald-500/30 group">
                          <img src={fotosChecklist.pneuDiantDir} alt="Pneu DD" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1 transition-opacity">
                            <button
                              type="button"
                              onClick={() => inputFotoPneuDiantDirRef.current?.click()}
                              className="p-1 rounded bg-white text-black text-[8px] font-bold"
                            >
                              Trocar
                            </button>
                            <button
                              type="button"
                              onClick={() => setFotosChecklist((prev) => ({ ...prev, pneuDiantDir: undefined }))}
                              className="p-1 rounded bg-red-600 text-white text-[8px] font-bold"
                            >
                              <Trash2 className="h-2.5 w-2.5" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => inputFotoPneuDiantDirRef.current?.click()}
                          className="w-full h-20 rounded-lg border-2 border-dashed border-border/40 hover:border-primary/60 flex flex-col items-center justify-center gap-1 text-secondary hover:text-primary transition-all cursor-pointer bg-overlay/5"
                        >
                          <Camera className="h-4 w-4" />
                          <span className="text-[9px] font-bold">DIANT. DIR.</span>
                        </button>
                      )}
                    </div>

                    {/* Pneu 3: Traseiro Esquerdo */}
                    <div className={`rounded-xl border p-2.5 flex flex-col items-center text-center transition-all ${
                      fotosChecklist.pneuTrasEsq
                        ? 'border-emerald-500/40 bg-emerald-500/5'
                        : 'border-border/30 bg-surface/80 hover:border-primary/40'
                    }`}>
                      <input
                        ref={inputFotoPneuTrasEsqRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => handleUploadFoto('pneuTrasEsq', e)}
                      />
                      <div className="flex items-center justify-between w-full mb-1.5">
                        <span className="text-[9px] font-black text-foreground flex items-center gap-0.5 truncate">
                          <Disc className="h-2.5 w-2.5 text-blue-400" /> TRAS. ESQ.
                        </span>
                        {fotosChecklist.pneuTrasEsq && (
                          <span className="text-[8px] font-black text-emerald-400">✓</span>
                        )}
                      </div>

                      {fotosChecklist.pneuTrasEsq ? (
                        <div className="relative w-full h-20 rounded-lg overflow-hidden border border-emerald-500/30 group">
                          <img src={fotosChecklist.pneuTrasEsq} alt="Pneu TE" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1 transition-opacity">
                            <button
                              type="button"
                              onClick={() => inputFotoPneuTrasEsqRef.current?.click()}
                              className="p-1 rounded bg-white text-black text-[8px] font-bold"
                            >
                              Trocar
                            </button>
                            <button
                              type="button"
                              onClick={() => setFotosChecklist((prev) => ({ ...prev, pneuTrasEsq: undefined }))}
                              className="p-1 rounded bg-red-600 text-white text-[8px] font-bold"
                            >
                              <Trash2 className="h-2.5 w-2.5" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => inputFotoPneuTrasEsqRef.current?.click()}
                          className="w-full h-20 rounded-lg border-2 border-dashed border-border/40 hover:border-primary/60 flex flex-col items-center justify-center gap-1 text-secondary hover:text-primary transition-all cursor-pointer bg-overlay/5"
                        >
                          <Camera className="h-4 w-4" />
                          <span className="text-[9px] font-bold">TRAS. ESQ.</span>
                        </button>
                      )}
                    </div>

                    {/* Pneu 4: Traseiro Direito */}
                    <div className={`rounded-xl border p-2.5 flex flex-col items-center text-center transition-all ${
                      fotosChecklist.pneuTrasDir
                        ? 'border-emerald-500/40 bg-emerald-500/5'
                        : 'border-border/30 bg-surface/80 hover:border-primary/40'
                    }`}>
                      <input
                        ref={inputFotoPneuTrasDirRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => handleUploadFoto('pneuTrasDir', e)}
                      />
                      <div className="flex items-center justify-between w-full mb-1.5">
                        <span className="text-[9px] font-black text-foreground flex items-center gap-0.5 truncate">
                          <Disc className="h-2.5 w-2.5 text-blue-400" /> TRAS. DIR.
                        </span>
                        {fotosChecklist.pneuTrasDir && (
                          <span className="text-[8px] font-black text-emerald-400">✓</span>
                        )}
                      </div>

                      {fotosChecklist.pneuTrasDir ? (
                        <div className="relative w-full h-20 rounded-lg overflow-hidden border border-emerald-500/30 group">
                          <img src={fotosChecklist.pneuTrasDir} alt="Pneu TD" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1 transition-opacity">
                            <button
                              type="button"
                              onClick={() => inputFotoPneuTrasDirRef.current?.click()}
                              className="p-1 rounded bg-white text-black text-[8px] font-bold"
                            >
                              Trocar
                            </button>
                            <button
                              type="button"
                              onClick={() => setFotosChecklist((prev) => ({ ...prev, pneuTrasDir: undefined }))}
                              className="p-1 rounded bg-red-600 text-white text-[8px] font-bold"
                            >
                              <Trash2 className="h-2.5 w-2.5" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => inputFotoPneuTrasDirRef.current?.click()}
                          className="w-full h-20 rounded-lg border-2 border-dashed border-border/40 hover:border-primary/60 flex flex-col items-center justify-center gap-1 text-secondary hover:text-primary transition-all cursor-pointer bg-overlay/5"
                        >
                          <Camera className="h-4 w-4" />
                          <span className="text-[9px] font-bold">TRAS. DIR.</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* SEÇÃO 2: DADOS DO VEÍCULO, CONDUTOR E COMPARADOR DE PREVENTIVA */}
              <div className="space-y-3">
                <span className="text-xs font-black text-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Truck className="h-4 w-4 text-primary" /> 2. DADOS DA OPERAÇÃO & KM
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="chkVeiculo">Veículo da Frota *</Label>
                    <Select
                      id="chkVeiculo"
                      value={veiculoChecklistId}
                      onChange={(e) => setVeiculoChecklistId(e.target.value)}
                      className="mt-1 text-xs uppercase font-bold"
                      required
                    >
                      <option value="">Selecione o caminhão/veículo...</option>
                      {frotas.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.placa} — {f.modeloNome || f.marcaNome || 'VEÍCULO'} {f.clienteNome ? `(${f.clienteNome})` : ''}
                        </option>
                      ))}
                    </Select>
                  </div>

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

              {/* SEÇÃO 3: ITENS DE VERIFICAÇÃO VEICULAR */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-border/10 pb-2">
                  <h3 className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    3. ITENS DE VERIFICAÇÃO VEICULAR
                  </h3>
                  <span className="text-[10px] text-secondary font-bold">SELECIONE O STATUS</span>
                </div>

                <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                  {itensChecklistForm.map((item, index) => (
                    <div
                      key={item.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl border border-border/15 bg-overlay/5 hover:border-border/30 transition-colors"
                    >
                      <div>
                        <span className="text-[9px] font-black text-secondary uppercase tracking-wider">
                          {item.categoria}
                        </span>
                        <p className="text-xs font-bold text-foreground">{item.nome}</p>
                      </div>

                      {/* Alternador de Status */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            const novos = [...itensChecklistForm]
                            novos[index].status = 'conforme'
                            setItensChecklistForm(novos)
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer ${
                            item.status === 'conforme'
                              ? 'bg-emerald-500 text-white shadow-sm'
                              : 'bg-surface text-secondary hover:text-foreground border border-border/20'
                          }`}
                        >
                          CONFORME
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const novos = [...itensChecklistForm]
                            novos[index].status = 'nao_conforme'
                            setItensChecklistForm(novos)
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer ${
                            item.status === 'nao_conforme'
                              ? 'bg-rose-600 text-white shadow-sm'
                              : 'bg-surface text-secondary hover:text-foreground border border-border/20'
                          }`}
                        >
                          AVARIA / NÃO
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const novos = [...itensChecklistForm]
                            novos[index].status = 'nao_se_aplica'
                            setItensChecklistForm(novos)
                          }}
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                            item.status === 'nao_se_aplica'
                              ? 'bg-overlay/20 text-foreground border border-border/40'
                              : 'bg-surface text-secondary/60 hover:text-secondary border border-border/10'
                          }`}
                        >
                          N/A
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* SEÇÃO 4: RESULTADO E OBSERVAÇÕES */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <Label htmlFor="chkResultado">4. Parecer / Conclusão *</Label>
                  <Select
                    id="chkResultado"
                    value={resultadoChecklist}
                    onChange={(e) => setResultadoChecklist(e.target.value as any)}
                    className="mt-1 text-xs uppercase font-black"
                  >
                    <option value="aprovado">✅ APROVADO (100% LIBERADO)</option>
                    <option value="aprovado_com_ressalvas">⚠️ APROVADO COM RESSALVAS</option>
                    <option value="reprovado">🛑 REPROVADO (NECESSITA MANUTENÇÃO)</option>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="chkObs">Observações / Ressalvas</Label>
                  <Input
                    id="chkObs"
                    placeholder="Descreva detalhes ou avarias encontradas..."
                    value={obsChecklist}
                    onChange={(e) => setObsChecklist(e.target.value)}
                    className="mt-1 text-xs"
                  />
                </div>
              </div>

              {/* Rodapé */}
              <div className="flex justify-end gap-2.5 pt-3 border-t border-border/15">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setMostrarModalNovoChecklist(false)}
                  className="!h-10 px-5 text-xs font-semibold"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="!h-10 px-6 text-xs font-bold bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 flex items-center gap-1.5"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Salvar Checklist
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: VISUALIZAR RELATÓRIO DO CHECKLIST COM GALERIA DE FOTOS */}
      {/* ========================================================================= */}
      {checklistVisualizando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-4 animate-fade-in">
          <div className="w-full max-w-xl rounded-2xl border border-border/20 bg-surface shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between border-b border-border/10 px-6 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <ClipboardCheck className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-foreground uppercase">
                    RELATÓRIO DE INSPEÇÃO · {checklistVisualizando.placa}
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

                    {/* Capô */}
                    {checklistVisualizando.fotos.capo ? (
                      <div
                        onClick={() => setFotoZoom({ url: checklistVisualizando.fotos!.capo!, titulo: 'FOTO DO CAPÔ ABERTO / MOTOR' })}
                        className="relative h-24 rounded-xl border border-border/20 overflow-hidden cursor-pointer group bg-black"
                      >
                        <img src={checklistVisualizando.fotos.capo} alt="Capô" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        <span className="absolute bottom-1 left-1 right-1 text-center bg-black/70 rounded text-[8px] font-bold text-white py-0.5">
                          CAPÔ / MOTOR
                        </span>
                      </div>
                    ) : (
                      <div className="h-24 rounded-xl border border-dashed border-border/20 flex flex-col items-center justify-center text-secondary/40 text-[8px] font-bold">
                        SEM FOTO DO CAPÔ
                      </div>
                    )}

                    {/* Interna */}
                    {checklistVisualizando.fotos.interna ? (
                      <div
                        onClick={() => setFotoZoom({ url: checklistVisualizando.fotos!.interna!, titulo: 'FOTO DA INTERNA / CABINE' })}
                        className="relative h-24 rounded-xl border border-border/20 overflow-hidden cursor-pointer group bg-black"
                      >
                        <img src={checklistVisualizando.fotos.interna} alt="Interna" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        <span className="absolute bottom-1 left-1 right-1 text-center bg-black/70 rounded text-[8px] font-bold text-white py-0.5">
                          INTERNA / CABINE
                        </span>
                      </div>
                    ) : (
                      <div className="h-24 rounded-xl border border-dashed border-border/20 flex flex-col items-center justify-center text-secondary/40 text-[8px] font-bold">
                        SEM FOTO INTERNA
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

                    {/* Pneu Diant. Esq. */}
                    {checklistVisualizando.fotos.pneuDiantEsq ? (
                      <div
                        onClick={() => setFotoZoom({ url: checklistVisualizando.fotos!.pneuDiantEsq!, titulo: 'FOTO DO PNEU DIANTEIRO ESQUERDO' })}
                        className="relative h-24 rounded-xl border border-border/20 overflow-hidden cursor-pointer group bg-black"
                      >
                        <img src={checklistVisualizando.fotos.pneuDiantEsq} alt="Pneu DE" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        <span className="absolute bottom-1 left-1 right-1 text-center bg-black/70 rounded text-[8px] font-bold text-white py-0.5">
                          PNEU DIANT. ESQ.
                        </span>
                      </div>
                    ) : (
                      <div className="h-24 rounded-xl border border-dashed border-border/20 flex flex-col items-center justify-center text-secondary/40 text-[8px] font-bold">
                        SEM PNEU DIANT. ESQ.
                      </div>
                    )}

                    {/* Pneu Diant. Dir. */}
                    {checklistVisualizando.fotos.pneuDiantDir ? (
                      <div
                        onClick={() => setFotoZoom({ url: checklistVisualizando.fotos!.pneuDiantDir!, titulo: 'FOTO DO PNEU DIANTEIRO DIREITO' })}
                        className="relative h-24 rounded-xl border border-border/20 overflow-hidden cursor-pointer group bg-black"
                      >
                        <img src={checklistVisualizando.fotos.pneuDiantDir} alt="Pneu DD" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        <span className="absolute bottom-1 left-1 right-1 text-center bg-black/70 rounded text-[8px] font-bold text-white py-0.5">
                          PNEU DIANT. DIR.
                        </span>
                      </div>
                    ) : (
                      <div className="h-24 rounded-xl border border-dashed border-border/20 flex flex-col items-center justify-center text-secondary/40 text-[8px] font-bold">
                        SEM PNEU DIANT. DIR.
                      </div>
                    )}

                    {/* Pneu Tras. Esq. */}
                    {checklistVisualizando.fotos.pneuTrasEsq ? (
                      <div
                        onClick={() => setFotoZoom({ url: checklistVisualizando.fotos!.pneuTrasEsq!, titulo: 'FOTO DO PNEU TRASEIRO ESQUERDO' })}
                        className="relative h-24 rounded-xl border border-border/20 overflow-hidden cursor-pointer group bg-black"
                      >
                        <img src={checklistVisualizando.fotos.pneuTrasEsq} alt="Pneu TE" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        <span className="absolute bottom-1 left-1 right-1 text-center bg-black/70 rounded text-[8px] font-bold text-white py-0.5">
                          PNEU TRAS. ESQ.
                        </span>
                      </div>
                    ) : (
                      <div className="h-24 rounded-xl border border-dashed border-border/20 flex flex-col items-center justify-center text-secondary/40 text-[8px] font-bold">
                        SEM PNEU TRAS. ESQ.
                      </div>
                    )}

                    {/* Pneu Tras. Dir. */}
                    {checklistVisualizando.fotos.pneuTrasDir ? (
                      <div
                        onClick={() => setFotoZoom({ url: checklistVisualizando.fotos!.pneuTrasDir!, titulo: 'FOTO DO PNEU TRASEIRO DIREITO' })}
                        className="relative h-24 rounded-xl border border-border/20 overflow-hidden cursor-pointer group bg-black"
                      >
                        <img src={checklistVisualizando.fotos.pneuTrasDir} alt="Pneu TD" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        <span className="absolute bottom-1 left-1 right-1 text-center bg-black/70 rounded text-[8px] font-bold text-white py-0.5">
                          PNEU TRAS. DIR.
                        </span>
                      </div>
                    ) : (
                      <div className="h-24 rounded-xl border border-dashed border-border/20 flex flex-col items-center justify-center text-secondary/40 text-[8px] font-bold">
                        SEM PNEU TRAS. DIR.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Lista dos Itens */}
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
        </div>
      )}

      {/* MODAL 4: ZOOM DE FOTO */}
      {fotoZoom && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4 animate-fade-in"
          onClick={() => setFotoZoom(null)}
        >
          <div className="relative max-w-2xl max-h-[90vh] flex flex-col items-center">
            <button
              type="button"
              onClick={() => setFotoZoom(null)}
              className="absolute -top-10 right-0 text-white hover:opacity-80 p-2"
            >
              <X className="h-6 w-6" />
            </button>
            <p className="text-white text-xs font-black uppercase mb-2 tracking-wide">{fotoZoom.titulo}</p>
            <img src={fotoZoom.url} alt={fotoZoom.titulo} className="rounded-xl max-w-full max-h-[80vh] object-contain shadow-2xl" />
          </div>
        </div>
      )}
    </div>
  )
}
