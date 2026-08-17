import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Pencil, Plus, Trash2, X, KeyRound, Copy, Check } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { Input, Label, FieldError, Select } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useUsuarios, criarUsuario, excluirUsuario, atualizarUsuario, resetarSenha } from '@/hooks/useUsuarios'
import { useAuth } from '@/contexts/AuthContext'
import { formatDate } from '@/lib/format'
import type { Usuario } from '@/lib/types'

const schema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome'),
  email: z.string().trim().email('E-mail inválido'),
  senha: z.string().min(6, 'Mínimo de 6 caracteres'),
  telefone: z.string().optional(),
  nivel: z.enum(['admin', 'usuario']),
})

type FormValues = z.infer<typeof schema>

const editSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome'),
  telefone: z.string().optional(),
  nivel: z.enum(['admin', 'usuario']),
})

type EditFormValues = z.infer<typeof editSchema>

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
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { nivel: 'usuario' } })

  async function onSubmit(values: FormValues) {
    try {
      await criarUsuario(values)
      await refetch()
      reset()
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
    if (!confirm(`Resetar a senha de "${nome}"? Uma senha temporária será gerada.`)) return
    setErroLista(null)
    setResetandoId(id)
    try {
      const senha = await resetarSenha(id)
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
        <Button type="button" onClick={() => setMostrarForm(true)}>
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
              <div className="grid grid-cols-2 gap-4">
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
              <div className="grid grid-cols-2 gap-4">
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
              <div className="flex justify-end gap-3">
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
              {usuarios.map((u) =>
                editandoId === u.id ? (
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
                  <div key={u.id} className="flex items-center justify-between gap-3 rounded-xl bg-background px-4 py-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-foreground font-medium">{u.nome}</p>
                        <Badge tone={u.nivel === 'admin' ? 'warning' : 'neutral'}>
                          {u.nivel === 'admin' ? 'Administrador' : 'Usuário'}
                        </Badge>
                      </div>
                      <p className="text-sm text-secondary">
                        {u.email} · {u.telefone || 'Sem telefone'} · Desde {formatDate(u.created_at)}
                      </p>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          size="icon"
                          onClick={() => setEditandoId(u.id)}
                          aria-label={`Editar ${u.nome}`}
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
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                ),
              )}
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
              resetada. Compartilhe a senha abaixo com o usuário — ele será obrigado a trocar no próximo login.
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
    formState: { isSubmitting },
  } = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: { nome: usuario.nome, telefone: usuario.telefone ?? '', nivel: usuario.nivel },
  })

  async function onSubmit(values: EditFormValues) {
    try {
      await atualizarUsuario(usuario.id, values)
      await onSalvo()
    } catch (err) {
      onErro(err instanceof Error ? err.message : 'Não foi possível salvar as alterações.')
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-3 rounded-xl border border-primary/40 bg-background px-4 py-3"
    >
      <div className="grid gap-3 sm:grid-cols-3">
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
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="icon" onClick={onCancel} aria-label="Cancelar edição">
          <X className="h-4 w-4" />
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Salvando…' : 'Salvar'}
        </Button>
      </div>
    </form>
  )
}
