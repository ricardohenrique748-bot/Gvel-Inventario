import { useMemo, useState } from 'react'
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
} from 'lucide-react'
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
import { tipoVeiculoLabel } from '@/lib/tipoVeiculo'

const anoAtual = new Date().getFullYear()

const schema = z.object({
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
  vencimentoPreventiva: z.string().optional(),
  observacoes: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

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
  vencimentoPreventiva?: string // YYYY-MM-DD
  observacoes?: string
  createdAt: string
}

const STORAGE_FROTAS_KEY = 'gvel_frotas_cadastradas_v1'

export function Frotas() {
  const { clientes } = useClientes()
  const { marcas, refetch: refetchMarcas } = useMarcas()
  const { movimentacoes } = useMovimentacoes()

  // Inicia vazio por padrão
  const [frotas, setFrotas] = useState<ItemFrotaCadastrada[]>(() => {
    try {
      const salvo = localStorage.getItem(STORAGE_FROTAS_KEY)
      if (salvo) return JSON.parse(salvo)
    } catch {}
    return []
  })

  function salvarFrotas(novas: ItemFrotaCadastrada[]) {
    setFrotas(novas)
    try {
      localStorage.setItem(STORAGE_FROTAS_KEY, JSON.stringify(novas))
    } catch {}
  }

  const [mostrarModal, setMostrarModal] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [erroLista, setErroLista] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [tipoFiltro, setTipoFiltro] = useState<string>('todos')
  const [clienteFiltro, setClienteFiltro] = useState<string>('todos')
  const [alertaFiltro, setAlertaFiltro] = useState<'todos' | 'preventiva_atrasada' | 'doc_a_vencer' | 'doc_vencido'>('todos')

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { clienteId: '', tipo: 'pesado', situacao: 'operante', ano: anoAtual },
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

  // Helper para verificar status de documento
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

  // Helper para verificar status de preventiva
  function getStatusPreventiva(dataStr?: string) {
    if (!dataStr) return { status: 'nao_informado', label: 'NÃO INFORMADA', atrasada: false }
    try {
      const dataPrev = parseISO(dataStr)
      const hoje = startOfDay(new Date())
      const atrasada = isBefore(dataPrev, hoje)
      const dias = differenceInDays(dataPrev, hoje)

      if (atrasada) {
        return {
          status: 'atrasada',
          label: `ATRASADA (${Math.abs(dias)}D ATRÁS)`,
          atrasada: true,
        }
      }
      return {
        status: 'em_dia',
        label: `PROGRAMADA (${format(dataPrev, 'dd/MM/yyyy')})`,
        atrasada: false,
      }
    } catch {
      return { status: 'nao_informado', label: 'DATA INVÁLIDA', atrasada: false }
    }
  }

  // Métricas
  const metricas = useMemo(() => {
    const total = frotas.length
    let preventivaAtrasada = 0
    let docAVencer = 0
    let docVencido = 0

    frotas.forEach((v) => {
      // Preventiva atrasada
      const statusPrev = getStatusPreventiva(v.vencimentoPreventiva)
      if (statusPrev.status === 'atrasada') {
        preventivaAtrasada++
      }

      // Documento
      const statusDoc = getStatusDocumento(v.vencimentoDocumento)
      if (statusDoc.status === 'vencido') {
        docVencido++
      } else if (statusDoc.status === 'a_vencer') {
        docAVencer++
      }
    })

    return {
      total,
      preventivaAtrasada,
      docAVencer,
      docVencido,
    }
  }, [frotas])

  // Filtragem
  const veiculosFiltrados = useMemo(() => {
    return frotas.filter((v) => {
      if (tipoFiltro !== 'todos' && v.tipo !== tipoFiltro) return false
      if (clienteFiltro !== 'todos' && v.clienteId !== clienteFiltro) return false

      if (alertaFiltro === 'preventiva_atrasada') {
        const st = getStatusPreventiva(v.vencimentoPreventiva)
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
  }, [frotas, tipoFiltro, clienteFiltro, alertaFiltro, busca])

  function iniciarCriacao() {
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
      vencimentoPreventiva: '',
      observacoes: '',
    })
    setMostrarModal(true)
  }

  function iniciarEdicao(v: ItemFrotaCadastrada) {
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
      vencimentoPreventiva: v.vencimentoPreventiva || '',
      observacoes: v.observacoes || '',
    })
    setMostrarModal(true)
  }

  async function onSubmit(values: FormValues) {
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
      vencimentoPreventiva: values.vencimentoPreventiva || undefined,
      observacoes: values.observacoes?.trim() || undefined,
      createdAt: new Date().toISOString(),
    }

    if (editandoId) {
      salvarFrotas(frotas.map((f) => (f.id === editandoId ? novoItem : f)))
    } else {
      salvarFrotas([novoItem, ...frotas])
    }

    setMostrarModal(false)
  }

  async function handleExcluir(id: string) {
    if (!confirm('Deseja realmente excluir este veículo da frota?')) return
    salvarFrotas(frotas.filter((f) => f.id !== id))
  }

  return (
    <div className="space-y-6 animate-fade-in uppercase pb-12">
      {/* Cabeçalho */}
      <PageHeader
        title="GESTÃO DE FROTAS"
        subtitle="CADASTRO DE CAMINHÕES, PREVENTIVAS E CONTROLE DE DOCUMENTAÇÃO"
        actions={
          <Button
            type="button"
            onClick={iniciarCriacao}
            className="gap-2 shadow-md shadow-primary/20 uppercase font-bold"
          >
            <Plus className="h-4 w-4" />
            NOVO VEÍCULO
          </Button>
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

      {/* Cards de Métricas Solicitados */}
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
          <p className="mt-3 text-3xl font-black font-mono text-foreground">{metricas.total}</p>
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
          <p className="mt-3 text-3xl font-black font-mono text-red-400">{metricas.preventivaAtrasada}</p>
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
          <p className="mt-3 text-3xl font-black font-mono text-amber-400">{metricas.docAVencer}</p>
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
          <p className="mt-3 text-3xl font-black font-mono text-rose-500">{metricas.docVencido}</p>
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
          {/* Filtro de Alerta */}
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

          {/* Cliente */}
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

          {/* Tipo */}
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

      {/* Listagem da Frota */}
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
                  <th className="px-4 py-3.5">PREVENTIVA</th>
                  <th className="px-4 py-3.5">DOCUMENTO / CRLV</th>
                  <th className="px-4 py-3.5">SITUAÇÃO</th>
                  <th className="px-4 py-3.5 text-right">AÇÕES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/10 font-medium">
                {veiculosFiltrados.map((v) => {
                  const estaNoPatio = placasNoPatio.has(v.placa.toUpperCase().trim())
                  const statusPrev = getStatusPreventiva(v.vencimentoPreventiva)
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

                      {/* Preventiva */}
                      <td className="px-4 py-3.5">
                        {statusPrev.status === 'atrasada' ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-red-500/15 border border-red-500/30 px-2 py-0.5 text-[10px] font-black text-red-400">
                            <AlertOctagon className="h-3 w-3" />
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
                            onClick={() => iniciarEdicao(v)}
                            className="rounded-lg p-1.5 text-secondary hover:text-foreground hover:bg-overlay/10 transition-colors"
                            title="Editar Veículo"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExcluir(v.id)}
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

      {/* Modal de Cadastro / Edição com Manutenção e Documentos */}
      {mostrarModal && (
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
                  <p className="text-[11px] text-secondary">Dados do caminhão, vencimento de preventiva e documentos</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMostrarModal(false)}
                className="rounded-xl p-1.5 text-secondary hover:bg-background hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto p-6 space-y-4">
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

              {/* Seção de Controle de Datas: Preventiva e Documento */}
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                <div className="flex items-center gap-2 text-primary font-black text-xs">
                  <Calendar className="h-4 w-4" />
                  <span>MANUTENÇÃO PREVENTIVA & VENCIMENTO DE DOCUMENTO</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="vencimentoPreventiva">Próxima Preventiva</Label>
                    <Input
                      id="vencimentoPreventiva"
                      type="date"
                      {...register('vencimentoPreventiva')}
                      className="mt-1 text-xs font-mono"
                    />
                  </div>

                  <div>
                    <Label htmlFor="vencimentoDocumento">Vencimento do Documento (CRLV)</Label>
                    <Input
                      id="vencimentoDocumento"
                      type="date"
                      {...register('vencimentoDocumento')}
                      className="mt-1 text-xs font-mono"
                    />
                  </div>
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
                  onClick={() => setMostrarModal(false)}
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
    </div>
  )
}
