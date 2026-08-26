import { useState } from 'react'
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
  Shield,
  ShieldCheck,
  CheckSquare,
  Square,
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
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { Input, Label, FieldError, Select } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useUsuarios, criarUsuario, excluirUsuario, atualizarUsuario, resetarSenha } from '@/hooks/useUsuarios'
import { useAuth } from '@/contexts/AuthContext'
import { formatDate } from '@/lib/format'
import { MODULOS_SISTEMA, TODOS_MODULOS_IDS, MODULOS_PADRAO_USUARIO, getModulosUsuario } from '@/lib/permissoes'
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
}

const schema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome'),
  email: z.string().trim().email('E-mail inválido'),
  senha: z.string().min(6, 'Mínimo de 6 caracteres'),
  telefone: z.string().optional(),
  nivel: z.enum(['admin', 'usuario']),
  modulos: z.array(z.string()).optional(),
})

type FormValues = z.infer<typeof schema>

const editSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome'),
  telefone: z.string().optional(),
  nivel: z.enum(['admin', 'usuario']),
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

  const toggleModulo = (id: string) => {
    if (isAdmin) return
    if (selected.includes(id)) {
      onChange(selected.filter((m) => m !== id))
    } else {
      onChange([...selected, id])
    }
  }

  const selecionarTodos = () => {
    onChange(TODOS_MODULOS_IDS)
  }

  const selecionarPadrao = () => {
    onChange(MODULOS_PADRAO_USUARIO)
  }

  const limparTodos = () => {
    onChange([])
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border/20 bg-background/50 p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border/10 pb-3">
        <div>
          <Label className="!mb-0 text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
            <Shield className="h-4 w-4 text-primary" />
            Módulos & Telas Permitidas
          </Label>
          <p className="text-[11px] text-secondary mt-0.5">
            {isAdmin
              ? 'Administradores possuem acesso mestre a todas as telas do sistema.'
              : 'Selecione as telas e funcionalidades que este usuário poderá visualizar e acessar:'}
          </p>
        </div>

        {!isAdmin && (
          <div className="flex items-center gap-1.5 self-end sm:self-auto">
            <button
              type="button"
              onClick={selecionarTodos}
              className="text-[11px] font-bold text-primary hover:underline px-1.5 py-0.5 rounded transition-colors"
            >
              Marcar Todos
            </button>
            <span className="text-secondary/40">·</span>
            <button
              type="button"
              onClick={selecionarPadrao}
              className="text-[11px] font-bold text-secondary hover:text-foreground px-1.5 py-0.5 rounded transition-colors"
            >
              Padrão
            </button>
            <span className="text-secondary/40">·</span>
            <button
              type="button"
              onClick={limparTodos}
              className="text-[11px] font-bold text-secondary hover:text-foreground px-1.5 py-0.5 rounded transition-colors"
            >
              Limpar
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
        {MODULOS_SISTEMA.map((modulo) => {
          const Icon = ICONES_MODULOS[modulo.iconeNome] || Shield
          const isChecked = isAdmin || selected.includes(modulo.id)

          return (
            <div
              key={modulo.id}
              onClick={() => toggleModulo(modulo.id)}
              className={`flex items-start gap-3 p-3 rounded-xl border transition-all select-none cursor-pointer ${
                isAdmin
                  ? 'border-primary/30 bg-primary/5 opacity-80 cursor-default'
                  : isChecked
                  ? 'border-primary/50 bg-primary/10 text-foreground shadow-sm shadow-primary/10'
                  : 'border-border/15 bg-surface/60 text-secondary hover:border-border/40 hover:text-foreground hover:bg-surface'
              }`}
            >
              <div className="mt-0.5 shrink-0">
                {isChecked ? (
                  <CheckSquare className="h-4 w-4 text-primary" />
                ) : (
                  <Square className="h-4 w-4 text-secondary/50" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <Icon className={`h-3.5 w-3.5 shrink-0 ${isChecked ? 'text-primary' : 'text-secondary'}`} />
                  <p className="text-xs font-bold uppercase tracking-tight truncate">{modulo.label}</p>
                </div>
                <p className="text-[10px] text-secondary leading-tight mt-0.5 line-clamp-2">
                  {modulo.descricao}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function UsuariosTab() {
  const { perfil } = useAuth()
  const isAdmin = perfil?.nivel === 'admin'
  const { usuarios, loading, refetch } = useUsuarios()
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
      modulos: MODULOS_PADRAO_USUARIO,
    },
  })

  const nivelWatch = watch('nivel')

  async function onSubmit(values: FormValues) {
    try {
      await criarUsuario({
        ...values,
        modulos: values.nivel === 'admin' ? TODOS_MODULOS_IDS : values.modulos || MODULOS_PADRAO_USUARIO,
      })
      await refetch()
      reset({ nivel: 'usuario', modulos: MODULOS_PADRAO_USUARIO })
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
      <div className="space-y-6">
        {!mostrarForm ? (
          <Button type="button" onClick={() => setMostrarForm(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Novo usuário
          </Button>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div>
                  <Label htmlFor="nome">Nome</Label>
                  <Input id="nome" placeholder="Nome do usuário" {...register('nome')} />
                  <FieldError message={errors.nome?.message} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="email">E-mail</Label>
                    <Input id="email" type="email" placeholder="usuario@empresa.com" {...register('email')} />
                    <FieldError message={errors.email?.message} />
                  </div>
                  <div>
                    <Label htmlFor="senha">Senha temporária</Label>
                    <Input id="senha" type="password" placeholder="Mínimo de 6 caracteres" {...register('senha')} />
                    <FieldError message={errors.senha?.message} />
                    <p className="mt-1 text-xs text-secondary">A pessoa será obrigada a trocar no primeiro login.</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="telefone">Telefone</Label>
                    <Input id="telefone" placeholder="Opcional" {...register('telefone')} />
                  </div>
                  <div>
                    <Label htmlFor="nivel">Nível</Label>
                    <Select id="nivel" {...register('nivel')}>
                      <option value="usuario">Usuário</option>
                      <option value="admin">Administrador</option>
                    </Select>
                  </div>
                </div>

                {/* Seletor de Permissões de Módulos */}
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

        <Card>
          <CardContent className="pt-6">
            {erroLista && <p className="mb-3 text-sm text-status-danger">{erroLista}</p>}
            {loading ? (
              <p className="text-sm text-secondary">Carregando…</p>
            ) : usuarios.length === 0 ? (
              <p className="text-sm text-secondary">Nenhum usuário cadastrado.</p>
            ) : (
              <div className="space-y-3">
                {usuarios.map((u) => {
                  const modulosPermitidos = getModulosUsuario(u)

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
                      <div className="space-y-2 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-foreground font-bold text-sm">{u.nome}</p>
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
                                if (!mod) return null
                                return (
                                  <span
                                    key={modId}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface border border-border/20 text-[10px] font-semibold text-foreground uppercase"
                                  >
                                    {mod.label}
                                  </span>
                                )
                              })
                            )}
                          </div>
                        )}
                      </div>

                      {isAdmin && (
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
                      )}
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
      nivel: usuario.nivel,
      modulos: getModulosUsuario(usuario),
    },
  })

  const nivelWatch = watch('nivel')

  async function onSubmit(values: EditFormValues) {
    try {
      await atualizarUsuario(usuario.id, {
        ...values,
        email: usuario.email,
        modulos: values.nivel === 'admin' ? TODOS_MODULOS_IDS : values.modulos || [],
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

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor={`nome-${usuario.id}`}>Nome</Label>
          <Input id={`nome-${usuario.id}`} {...register('nome')} />
        </div>
        <div>
          <Label htmlFor={`telefone-${usuario.id}`}>Telefone</Label>
          <Input id={`telefone-${usuario.id}`} placeholder="Opcional" {...register('telefone')} />
        </div>
        <div>
          <Label htmlFor={`nivel-${usuario.id}`}>Nível</Label>
          <Select id={`nivel-${usuario.id}`} {...register('nivel')}>
            <option value="usuario">Usuário</option>
            <option value="admin">Administrador</option>
          </Select>
        </div>
      </div>

      {/* Seletor de Permissões de Módulos */}
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
    </form>
  )
}
