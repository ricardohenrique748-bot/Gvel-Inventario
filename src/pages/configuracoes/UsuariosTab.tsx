import { useState, useMemo, useRef } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Pencil,
  Plus,
  Trash2,
  X,
  KeyRound,
  Copy,
  Check,
  Minus,
  Shield,
  ShieldCheck,
  BarChart3,
  Wrench,
  Truck,
  ClipboardCheck,
  Hammer,
  DollarSign,
  Columns3,
  UserCheck,
  ShoppingCart,
  FileBarChart,
  Settings,
  ShieldAlert,
  Building2,
  Users,
  Bell,
  Camera,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { Input, Label, FieldError, Select } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useUsuarios, criarUsuario, excluirUsuario, atualizarUsuario, resetarSenha, uploadFotoUsuario } from '@/hooks/useUsuarios'
import { useAuth } from '@/contexts/AuthContext'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { RecortarFotoModal } from '@/components/RecortarFotoModal'
import { formatDate } from '@/lib/format'
import { MODULOS_SISTEMA, TODOS_MODULOS_IDS, MODULOS_PADRAO_USUARIO, getModulosUsuario, type ModuloSistema } from '@/lib/permissoes'
import type { Usuario } from '@/lib/types'

const ICONES_MODULOS: Record<string, React.ElementType> = {
  BarChart3,
  Wrench,
  Truck,
  ClipboardCheck,
  Hammer,
  DollarSign,
  Columns3,
  UserCheck,
  ShoppingCart,
  FileBarChart,
  Settings,
  Building2,
  Users,
  Bell,
}

const schema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome'),
  email: z.string().trim().email('E-mail inválido'),
  senha: z.string().min(6, 'Mínimo de 6 caracteres'),
  telefone: z.string().optional(),
  nivel: z.enum(['admin', 'usuario']),
  empresa_id: z.string().optional(),
  modulos: z.array(z.string()).optional(),
})

type FormValues = z.infer<typeof schema>

const editSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome'),
  telefone: z.string().optional(),
  nivel: z.enum(['admin', 'usuario']),
  empresa_id: z.string().optional(),
  modulos: z.array(z.string()).optional(),
})

type EditFormValues = z.infer<typeof editSchema>

interface ModulosSelectorProps {
  nivel: 'admin' | 'usuario'
  selected: string[]
  onChange: (modulos: string[]) => void
}

function ModulosSelector({ nivel, selected, onChange }: ModulosSelectorProps) {
  const isAdmin = nivel === 'admin'

  const toggleModulo = (id: string, subIds?: string[]) => {
    if (isAdmin) return
    const hasSub = Array.isArray(subIds) && subIds.length > 0
    const areAllSubsSelected = hasSub ? subIds.every((s) => selected.includes(s)) : selected.includes(id)

    if (areAllSubsSelected) {
      // Se todos estavam selecionados, remove o pai e todos os filhos
      const idsParaRemover = [id, ...(subIds || [])]
      onChange(selected.filter((m) => !idsParaRemover.includes(m)))
    } else {
      // Se não estavam todos selecionados, marca o pai e TODOS os filhos
      const idsParaAdicionar = [id, ...(subIds || [])]
      onChange(Array.from(new Set([...selected, ...idsParaAdicionar])))
    }
  }

  const toggleSubModulo = (subId: string, parentId: string, allSubIds: string[]) => {
    if (isAdmin) return
    let updated: string[]

    if (selected.includes(subId)) {
      // Desmarcando este sub-módulo
      updated = selected.filter((m) => m !== subId)
      // Se não sobrou nenhum outro sub-módulo selecionado, desmarca também o pai
      const sobrouAlgum = allSubIds.some((s) => s !== subId && updated.includes(s))
      if (!sobrouAlgum) {
        updated = updated.filter((m) => m !== parentId)
      }
    } else {
      // Marcando este sub-módulo: adiciona o sub-módulo e garante que o pai esteja na lista
      updated = Array.from(new Set([...selected, subId, parentId]))
    }

    onChange(updated)
  }

  const selecionarTodos = () => onChange(TODOS_MODULOS_IDS)
  const selecionarPadrao = () => onChange(MODULOS_PADRAO_USUARIO)
  const limparTodos = () => onChange([])

  const renderCardModulo = (modulo: ModuloSistema) => {
    const Icon = ICONES_MODULOS[modulo.iconeNome] || Shield
    const hasSub = Array.isArray(modulo.subModulos) && modulo.subModulos.length > 0
    const subIds = hasSub ? modulo.subModulos!.map((s) => s.id) : []
    const totalSubsSelecionados = subIds.filter((s) => selected.includes(s)).length
    const isAllSubsChecked = hasSub && totalSubsSelecionados === subIds.length
    const isParentChecked = isAdmin || (hasSub ? totalSubsSelecionados > 0 : selected.includes(modulo.id))

    return (
      <div
        key={modulo.id}
        className={`flex flex-col justify-between rounded-2xl border transition-all duration-200 overflow-hidden ${
          isAdmin
            ? 'border-primary/30 bg-primary/5 opacity-85'
            : isParentChecked
            ? 'border-primary/50 bg-gradient-to-b from-surface via-surface to-primary/5 text-foreground shadow-lg shadow-black/20'
            : 'border-border/15 bg-surface/50 text-secondary hover:border-border/40 hover:bg-surface'
        }`}
      >
        {/* Cabeçalho do Card */}
        <div
          onClick={() => toggleModulo(modulo.id, subIds)}
          className="flex items-start justify-between gap-3 p-3.5 select-none cursor-pointer"
        >
          <div className="flex items-start gap-3 min-w-0">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${
                isParentChecked
                  ? 'bg-primary/20 text-primary border border-primary/30'
                  : 'bg-background text-secondary border border-border/15'
              }`}
            >
              <Icon className="h-4 w-4" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-xs font-bold uppercase tracking-tight truncate text-foreground">
                  {modulo.label}
                </p>
                {hasSub && !isAdmin && totalSubsSelecionados > 0 && (
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${
                    isAllSubsChecked
                      ? 'bg-primary/20 text-primary border-primary/30'
                      : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                  }`}>
                    {totalSubsSelecionados}/{subIds.length} abas
                  </span>
                )}
              </div>
              <p className="text-[11px] text-secondary leading-tight mt-0.5 line-clamp-2">
                {modulo.descricao}
              </p>
            </div>
          </div>

          <div className="mt-0.5 shrink-0 pl-1">
            {isAdmin || isAllSubsChecked || (!hasSub && isParentChecked) ? (
              <div className="h-5 w-5 rounded-md bg-primary flex items-center justify-center text-white shadow-sm shadow-primary/40">
                <Check className="h-3.5 w-3.5 stroke-[3]" />
              </div>
            ) : totalSubsSelecionados > 0 ? (
              <div className="h-5 w-5 rounded-md bg-primary/20 border border-primary/50 flex items-center justify-center text-primary">
                <Minus className="h-3.5 w-3.5 stroke-[3]" />
              </div>
            ) : (
              <div className="h-5 w-5 rounded-md border border-secondary/30 bg-background/50 hover:border-secondary transition-colors" />
            )}
          </div>
        </div>

        {/* Sub-Abas Detalhadas em Pills Chips */}
        {hasSub && (
          <div className="border-t border-border/10 bg-background/40 p-2.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold uppercase tracking-wider text-secondary">
                Abas e Telas:
              </span>
              {!isAdmin && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleModulo(modulo.id, subIds)
                  }}
                  className="text-[9px] font-bold text-primary hover:underline uppercase"
                >
                  {isAllSubsChecked ? 'Desmarcar Todas' : 'Marcar Todas'}
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {modulo.subModulos!.map((sub) => {
                const isSubChecked = isAdmin || selected.includes(sub.id)

                return (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleSubModulo(sub.id, modulo.id, subIds)
                    }}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-tight transition-all cursor-pointer ${
                      isAdmin
                        ? 'bg-primary text-white border border-primary cursor-default'
                        : isSubChecked
                        ? 'bg-primary text-white border border-primary shadow-sm shadow-primary/30'
                        : 'bg-surface/50 border border-border/15 text-secondary/60 hover:border-border/40 hover:text-foreground'
                    }`}
                  >
                    {isSubChecked ? (
                      <Check className="h-3 w-3 text-white stroke-[3]" />
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-secondary/30" />
                    )}
                    <span>{sub.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border/20 bg-background/60 p-4 sm:p-5">
      {/* Cabeçalho do Seletor */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 border-b border-border/10 pb-3.5">
        <div>
          <Label className="!mb-0 text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
            <Shield className="h-4 w-4 text-primary" />
            Permissões de Acesso aos Módulos
          </Label>
          <p className="text-[11px] text-secondary mt-0.5">
            {isAdmin
              ? 'Administradores possuem acesso mestre a todas as telas e abas do sistema.'
              : 'Defina com precisão quais telas e sub-abas este usuário poderá acessar:'}
          </p>
        </div>

        {!isAdmin && (
          <div className="flex items-center gap-2 self-end sm:self-auto bg-surface/80 border border-border/15 px-2.5 py-1 rounded-xl">
            <button
              type="button"
              onClick={selecionarTodos}
              className="text-[10px] font-bold uppercase text-primary hover:underline transition-colors"
            >
              Marcar Todos
            </button>
            <span className="text-secondary/30">|</span>
            <button
              type="button"
              onClick={selecionarPadrao}
              className="text-[10px] font-bold uppercase text-secondary hover:text-foreground transition-colors"
            >
              Padrão
            </button>
            <span className="text-secondary/30">|</span>
            <button
              type="button"
              onClick={limparTodos}
              className="text-[10px] font-bold uppercase text-secondary hover:text-foreground transition-colors"
            >
              Limpar
            </button>
          </div>
        )}
      </div>

      {/* Grid Clean em 2 Colunas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {MODULOS_SISTEMA.map(renderCardModulo)}
      </div>
    </div>
  )
}

export function UsuariosTab() {
  const { perfil, user } = useAuth()
  const { empresas, empresaAtiva } = useEmpresa()
  const isAdmin = perfil?.nivel === 'admin' || user?.email === 'ricardo_h.16@hotmail.com' || user?.email === 'victor@gveldiesel.com'
  const { usuarios, loading, refetch } = useUsuarios()
  const [filtroEmpresa, setFiltroEmpresa] = useState<string>('TODAS')
  const [mostrarForm, setMostrarForm] = useState(false)
  const [excluindoId, setExcluindoId] = useState<string | null>(null)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [erroLista, setErroLista] = useState<string | null>(null)
  const [resetandoId, setResetandoId] = useState<string | null>(null)
  const [senhaTemporariaModal, setSenhaTemporariaModal] = useState<{ nome: string; senha: string } | null>(null)
  const [copiado, setCopiado] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      nivel: 'usuario',
      empresa_id: empresaAtiva?.id || empresas[0]?.id || 'gvel_diesel',
      modulos: MODULOS_PADRAO_USUARIO,
    },
  })

  const nivelWatch = watch('nivel')

  const usuariosFiltrados = useMemo(() => {
    if (filtroEmpresa === 'TODAS') return usuarios
    return usuarios.filter((u) => (u.empresa_id || 'gvel_diesel') === filtroEmpresa)
  }, [usuarios, filtroEmpresa])

  // Regra fundamental: Apenas administradores podem gerenciar usuários
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] text-center p-6 space-y-3 uppercase">
        <div className="h-14 w-14 rounded-2xl bg-status-danger/10 border border-status-danger/30 flex items-center justify-center text-status-danger">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <div className="space-y-1 max-w-md">
          <h3 className="text-base font-bold text-foreground tracking-tight">Acesso Exclusivo para Administradores</h3>
          <p className="text-xs text-secondary leading-relaxed">
            Apenas administradores do sistema possuem permissão para cadastrar, editar permissões ou alterar dados de usuários.
          </p>
        </div>
      </div>
    )
  }

  async function onSubmit(values: FormValues) {
    try {
      await criarUsuario({
        ...values,
        empresa_id: values.empresa_id || empresaAtiva?.id || 'gvel_diesel',
        modulos: values.nivel === 'admin' ? TODOS_MODULOS_IDS : values.modulos || MODULOS_PADRAO_USUARIO,
      })
      await refetch()
      reset({
        nivel: 'usuario',
        empresa_id: empresaAtiva?.id || empresas[0]?.id || 'gvel_diesel',
        modulos: MODULOS_PADRAO_USUARIO,
      })
      setMostrarForm(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Não foi possível criar o usuário.'
      const isPermissaoAdmin = msg.includes('administradores') || msg.includes('403')
      setError('email', {
        message: isPermissaoAdmin
          ? 'Seu usuário não tem nível "admin" no banco. Acesse o SQL Editor do Supabase e execute: UPDATE public.usuarios SET nivel = \'admin\' WHERE email = \'seu@email.com\';'
          : msg,
      })
    }
  }

  async function handleExcluir(id: string, nome: string) {
    if (!confirm(`Excluir o usuário "${nome}"? Essa ação não pode ser desfeita.`)) return
    setErroLista(null)
    setExcluindoId(id)
    try {
      await excluirUsuario(id)
      await refetch()
    } catch (err) {
      setErroLista(err instanceof Error ? err.message : 'Não foi possível excluir o usuário.')
    } finally {
      setExcluindoId(null)
    }
  }

  async function handleResetar(id: string, nome: string) {
    if (!confirm(`Resetar a senha de "${nome}" para a senha padrão "123456"?`)) return
    setErroLista(null)
    setResetandoId(id)
    try {
      const senha = await resetarSenha(id, '123456')
      setSenhaTemporariaModal({ nome, senha })
      setCopiado(false)
    } catch (err) {
      setErroLista(err instanceof Error ? err.message : 'Não foi possível resetar a senha.')
    } finally {
      setResetandoId(null)
    }
  }

  async function copiarSenha(senha: string) {
    await navigator.clipboard.writeText(senha)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <>
      <div className="space-y-5">
        {/* Barra Superior com Filtro por Empresa e Ação de Novo Usuário */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface/60 p-4 rounded-2xl border border-border/10">
          <div>
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wide flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Usuários e Permissões
            </h2>
            <p className="text-xs text-secondary mt-0.5">
              Gerencie usuários vinculados por empresa e defina permissões de acesso
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
            {/* Seletor de Filtro de Empresa */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-secondary uppercase tracking-wider whitespace-nowrap">
                Empresa:
              </span>
              <Select
                value={filtroEmpresa}
                onChange={(e) => setFiltroEmpresa(e.target.value)}
                className="text-xs h-9 min-w-44 bg-background"
              >
                <option value="TODAS">Todas as Empresas ({usuarios.length})</option>
                {empresas.map((emp) => {
                  const count = usuarios.filter((u) => (u.empresa_id || 'gvel_diesel') === emp.id).length
                  return (
                    <option key={emp.id} value={emp.id}>
                      {emp.nome} ({count})
                    </option>
                  )
                })}
              </Select>
            </div>

            {!mostrarForm && (
              <Button
                type="button"
                onClick={() => {
                  reset({
                    nivel: 'usuario',
                    empresa_id: filtroEmpresa !== 'TODAS' ? filtroEmpresa : (empresaAtiva?.id || 'gvel_diesel'),
                    modulos: MODULOS_PADRAO_USUARIO,
                  })
                  setMostrarForm(true)
                }}
                className="flex items-center gap-2 shrink-0 h-9"
              >
                <Plus className="h-4 w-4" />
                Novo usuário
              </Button>
            )}
          </div>
        </div>

        {/* Formulário de Cadastro */}
        {mostrarForm && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4 border-b border-border/10 pb-2">
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wide flex items-center gap-2">
                  <Plus className="h-4 w-4 text-primary" />
                  Cadastrar Novo Usuário
                </h3>
                <button
                  type="button"
                  onClick={() => { setMostrarForm(false); reset() }}
                  className="text-secondary hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div>
                  <Label htmlFor="nome">Nome Completo *</Label>
                  <Input id="nome" placeholder="Nome do usuário" {...register('nome')} />
                  <FieldError message={errors.nome?.message} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="email">E-mail de Acesso *</Label>
                    <Input id="email" type="email" placeholder="usuario@empresa.com" {...register('email')} />
                    <FieldError message={errors.email?.message} />
                  </div>
                  <div>
                    <Label htmlFor="senha">Senha Temporária *</Label>
                    <Input id="senha" type="password" placeholder="Mínimo de 6 caracteres" {...register('senha')} />
                    <FieldError message={errors.senha?.message} />
                    <p className="mt-1 text-xs text-secondary">A pessoa será obrigada a trocar no primeiro login.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="telefone">Telefone</Label>
                    <Input id="telefone" placeholder="Opcional" {...register('telefone')} />
                  </div>

                  <div>
                    <Label htmlFor="empresa_id">Empresa Vinculada *</Label>
                    <Select id="empresa_id" {...register('empresa_id')}>
                      {empresas.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.nome} ({emp.sistemaLabel})
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="nivel">Nível de Acesso *</Label>
                    <Select id="nivel" {...register('nivel')}>
                      <option value="usuario">Usuário Padrão</option>
                      <option value="admin">Administrador (Total)</option>
                    </Select>
                  </div>
                </div>

                {/* Seletor Clean de Permissões */}
                <Controller
                  name="modulos"
                  control={control}
                  render={({ field }) => (
                    <ModulosSelector
                      nivel={nivelWatch}
                      selected={field.value || MODULOS_PADRAO_USUARIO}
                      onChange={field.onChange}
                    />
                  )}
                />

                <div className="flex justify-end gap-3 pt-2">
                  <Button type="button" variant="secondary" onClick={() => { setMostrarForm(false); reset() }}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Salvando…' : 'Cadastrar usuário'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Lista de Usuários */}
        <Card>
          <CardContent className="pt-6">
            {erroLista && <p className="mb-3 text-sm text-status-danger">{erroLista}</p>}
            {loading ? (
              <p className="text-sm text-secondary">Carregando usuários…</p>
            ) : usuariosFiltrados.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-8 w-8 text-secondary mx-auto mb-2 opacity-50" />
                <p className="text-sm text-secondary font-medium">
                  {filtroEmpresa === 'TODAS'
                    ? 'Nenhum usuário cadastrado.'
                    : 'Nenhum usuário cadastrado para a empresa selecionada.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {usuariosFiltrados.map((u: Usuario) => {
                  const modulosPermitidos = getModulosUsuario(u)
                  const empresaVinculada = empresas.find((e) => e.id === u.empresa_id) || empresas[0]

                  return editandoId === u.id ? (
                    <EditarUsuarioForm
                      key={u.id}
                      usuario={u}
                      onCancel={() => setEditandoId(null)}
                      onSalvo={async () => {
                        setEditandoId(null)
                        await refetch()
                      }}
                      onErro={setErroLista}
                    />
                  ) : (
                    <div key={u.id} className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-xl bg-background border border-border/10 p-4 transition-all hover:border-border/30">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/15 text-xs font-bold text-primary">
                          {u.foto_url ? (
                            <img src={u.foto_url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            u.nome.slice(0, 2).toUpperCase()
                          )}
                        </div>
                        <div className="space-y-2 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-foreground font-bold text-sm">{u.nome}</p>
                          
                          {/* Badge de Empresa */}
                          {empresaVinculada && (
                            <span
                              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[10px] font-bold border shadow-xs"
                              style={{
                                backgroundColor: empresaVinculada.cor ? `${empresaVinculada.cor}18` : '#37415118',
                                color: empresaVinculada.cor || '#9ca3af',
                                borderColor: empresaVinculada.cor ? `${empresaVinculada.cor}40` : '#37415140',
                              }}
                            >
                              <Building2 className="h-3 w-3" />
                              {empresaVinculada.nome}
                            </span>
                          )}

                          <Badge tone={u.nivel === 'admin' ? 'warning' : 'neutral'}>
                            {u.nivel === 'admin' ? 'Administrador' : 'Usuário'}
                          </Badge>

                          {u.nivel === 'admin' && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-primary uppercase">
                              <ShieldCheck className="h-3.5 w-3.5" /> Acesso Total
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-secondary">
                          {u.email} · {u.telefone || 'Sem telefone'} · Desde {formatDate(u.created_at)}
                        </p>

                        {/* Badges de Módulos Autorizados */}
                        {u.nivel !== 'admin' && (
                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            <span className="text-[10px] font-bold text-secondary uppercase tracking-wider mr-1">
                              Acesso:
                            </span>
                            {modulosPermitidos.length === 0 ? (
                              <span className="text-[10px] text-secondary italic">Nenhum módulo selecionado</span>
                            ) : (
                              modulosPermitidos.map((modId) => {
                                const mod = MODULOS_SISTEMA.find((m) => m.id === modId)
                                if (mod) {
                                  return (
                                    <span
                                      key={modId}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface border border-border/20 text-[10px] font-semibold text-foreground uppercase"
                                    >
                                      {mod.label}
                                    </span>
                                  )
                                }
                                for (const m of MODULOS_SISTEMA) {
                                  const sub = m.subModulos?.find((s) => s.id === modId)
                                  if (sub) {
                                    return (
                                      <span
                                        key={modId}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-[10px] font-semibold text-primary uppercase"
                                      >
                                        {m.label}: {sub.label}
                                      </span>
                                    )
                                  }
                                }
                                return null
                              })
                            )}
                          </div>
                        )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                        <Button
                          type="button"
                          variant="secondary"
                          size="icon"
                          onClick={() => setEditandoId(u.id)}
                          aria-label={`Editar ${u.nome}`}
                          title="Editar permissões e dados"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="icon"
                          onClick={() => handleResetar(u.id, u.nome)}
                          disabled={resetandoId === u.id}
                          aria-label={`Resetar senha de ${u.nome}`}
                          title="Resetar senha"
                        >
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        {u.id !== perfil?.id && (
                          <Button
                            type="button"
                            variant="danger"
                            size="icon"
                            onClick={() => handleExcluir(u.id, u.nome)}
                            disabled={excluindoId === u.id}
                            aria-label={`Excluir ${u.nome}`}
                            title="Excluir usuário"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal senha temporária */}
      {senhaTemporariaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-border/10 bg-surface p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">Senha resetada</h2>
              <button
                onClick={() => setSenhaTemporariaModal(null)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-secondary hover:bg-overlay/10 hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-4 text-sm text-secondary">
              A senha de <span className="font-medium text-foreground">{senhaTemporariaModal.nome}</span> foi
              resetada para a senha padrão <strong className="text-foreground">123456</strong>. Ao fazer login com ela, o usuário será direcionado para definir sua nova senha pessoal.
            </p>
            <div className="flex items-center gap-2 rounded-xl border border-border/10 bg-background px-4 py-3">
              <code className="flex-1 text-sm font-mono tracking-widest text-primary select-all">
                {senhaTemporariaModal.senha}
              </code>
              <button
                onClick={() => copiarSenha(senhaTemporariaModal.senha)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-secondary hover:bg-overlay/10 hover:text-foreground transition-colors"
                aria-label="Copiar senha"
              >
                {copiado ? <Check className="h-4 w-4 text-status-success" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <button
              onClick={() => setSenhaTemporariaModal(null)}
              className="mt-4 w-full rounded-xl border border-border/10 py-2.5 text-sm font-medium text-secondary hover:bg-overlay/5 hover:text-foreground transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </>
  )
}

function EditarUsuarioForm({
  usuario,
  onCancel,
  onSalvo,
  onErro,
}: {
  usuario: Usuario
  onCancel: () => void
  onSalvo: () => void | Promise<void>
  onErro: (message: string) => void
}) {
  const { empresas } = useEmpresa()
  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { isSubmitting },
  } = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      nome: usuario.nome,
      telefone: usuario.telefone ?? '',
      empresa_id: usuario.empresa_id || 'gvel_diesel',
      nivel: usuario.nivel,
      modulos: getModulosUsuario(usuario),
    },
  })

  const nivelWatch = watch('nivel')

  const [fotoUrl, setFotoUrl] = useState(usuario.foto_url || '')
  const [enviandoFoto, setEnviandoFoto] = useState(false)
  const [arquivoParaRecortar, setArquivoParaRecortar] = useState<File | null>(null)
  const fotoInputRef = useRef<HTMLInputElement>(null)

  function handleFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setArquivoParaRecortar(file)
  }

  async function handleFotoRecortada(arquivoRecortado: File) {
    setArquivoParaRecortar(null)
    setEnviandoFoto(true)
    try {
      const url = await uploadFotoUsuario(arquivoRecortado, usuario.id)
      setFotoUrl(url)
    } catch (err) {
      onErro(err instanceof Error ? err.message : 'Não foi possível processar a foto.')
    } finally {
      setEnviandoFoto(false)
    }
  }

  async function onSubmit(values: EditFormValues) {
    try {
      await atualizarUsuario(usuario.id, {
        ...values,
        email: usuario.email,
        empresa_id: values.empresa_id || 'gvel_diesel',
        modulos: values.nivel === 'admin' ? TODOS_MODULOS_IDS : values.modulos || [],
        foto_url: fotoUrl || null,
      })
      await onSalvo()
    } catch (err) {
      onErro(err instanceof Error ? err.message : 'Não foi possível salvar as alterações.')
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4 rounded-2xl border-2 border-primary/40 bg-surface/95 p-4 sm:p-5 shadow-xl shadow-black/20"
    >
      <div className="flex items-center justify-between border-b border-border/10 pb-2">
        <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Pencil className="h-3.5 w-3.5 text-primary" />
          Editando: {usuario.nome} ({usuario.email})
        </h4>
        <button
          type="button"
          onClick={onCancel}
          className="text-secondary hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => fotoInputRef.current?.click()}
          disabled={enviandoFoto}
          aria-label="Alterar foto de perfil"
          className="group relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/15 text-sm font-bold text-primary disabled:cursor-default"
        >
          {fotoUrl ? (
            <img src={fotoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            usuario.nome.slice(0, 2).toUpperCase()
          )}
          <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
            <Camera className={enviandoFoto ? 'h-4 w-4 animate-pulse text-white' : 'h-4 w-4 text-white'} />
          </span>
        </button>
        <input
          ref={fotoInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFotoChange}
        />
        <p className="text-[11px] text-secondary">
          Clique na foto para {fotoUrl ? 'trocar' : 'adicionar'} o avatar deste usuário.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <div>
          <Label htmlFor={`nome-${usuario.id}`}>Nome</Label>
          <Input id={`nome-${usuario.id}`} {...register('nome')} />
        </div>
        <div>
          <Label htmlFor={`telefone-${usuario.id}`}>Telefone</Label>
          <Input id={`telefone-${usuario.id}`} placeholder="Opcional" {...register('telefone')} />
        </div>
        <div>
          <Label htmlFor={`empresa-${usuario.id}`}>Empresa</Label>
          <Select id={`empresa-${usuario.id}`} {...register('empresa_id')}>
            {empresas.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.nome} ({emp.sistemaLabel})
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor={`nivel-${usuario.id}`}>Nível</Label>
          <Select id={`nivel-${usuario.id}`} {...register('nivel')}>
            <option value="usuario">Usuário</option>
            <option value="admin">Administrador</option>
          </Select>
        </div>
      </div>

      {/* Seletor Clean de Permissões com Sub-Abas */}
      <Controller
        name="modulos"
        control={control}
        render={({ field }) => (
          <ModulosSelector
            nivel={nivelWatch}
            selected={field.value || []}
            onChange={field.onChange}
          />
        )}
      />

      <div className="flex justify-end gap-2.5 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel} aria-label="Cancelar edição">
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Salvando…' : 'Salvar Alterações'}
        </Button>
      </div>

      {arquivoParaRecortar && (
        <RecortarFotoModal
          arquivo={arquivoParaRecortar}
          onCancelar={() => setArquivoParaRecortar(null)}
          onConfirmar={handleFotoRecortada}
        />
      )}
    </form>
  )
}
