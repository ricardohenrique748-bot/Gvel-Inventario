import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Trash2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { Input, Label, FieldError, Select } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useUsuarios, criarUsuario, excluirUsuario } from '@/hooks/useUsuarios'
import { useAuth } from '@/contexts/AuthContext'
import { formatDate } from '@/lib/format'

const schema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome'),
  email: z.string().trim().email('E-mail inválido'),
  senha: z.string().min(6, 'Mínimo de 6 caracteres'),
  telefone: z.string().optional(),
  nivel: z.enum(['admin', 'usuario']),
})

type FormValues = z.infer<typeof schema>

export function UsuariosTab() {
  const { perfil } = useAuth()
  const isAdmin = perfil?.nivel === 'admin'
  const { usuarios, loading, refetch } = useUsuarios()
  const [excluindoId, setExcluindoId] = useState<string | null>(null)
  const [erroExclusao, setErroExclusao] = useState<string | null>(null)
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
    } catch (err) {
      setError('email', { message: err instanceof Error ? err.message : 'Não foi possível criar o usuário.' })
    }
  }

  async function handleExcluir(id: string, nome: string) {
    if (!confirm(`Excluir o usuário "${nome}"? Essa ação não pode ser desfeita.`)) return
    setErroExclusao(null)
    setExcluindoId(id)
    try {
      await excluirUsuario(id)
      await refetch()
    } catch (err) {
      setErroExclusao(err instanceof Error ? err.message : 'Não foi possível excluir o usuário.')
    } finally {
      setExcluindoId(null)
    }
  }

  return (
    <div className="space-y-6">
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
                <Label htmlFor="senha">Senha</Label>
                <Input id="senha" type="password" placeholder="Mínimo de 6 caracteres" {...register('senha')} />
                <FieldError message={errors.senha?.message} />
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
            <div className="flex justify-end">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Salvando…' : 'Cadastrar usuário'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {erroExclusao && <p className="mb-3 text-sm text-status-danger">{erroExclusao}</p>}
          {loading ? (
            <p className="text-sm text-secondary">Carregando…</p>
          ) : usuarios.length === 0 ? (
            <p className="text-sm text-secondary">Nenhum usuário cadastrado.</p>
          ) : (
            <div className="space-y-3">
              {usuarios.map((u) => (
                <div key={u.id} className="flex items-center justify-between gap-3 rounded-xl bg-background px-4 py-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-white font-medium">{u.nome}</p>
                      <Badge tone={u.nivel === 'admin' ? 'warning' : 'neutral'}>
                        {u.nivel === 'admin' ? 'Administrador' : 'Usuário'}
                      </Badge>
                    </div>
                    <p className="text-sm text-secondary">
                      {u.email} · {u.telefone || 'Sem telefone'} · Desde {formatDate(u.created_at)}
                    </p>
                  </div>
                  {isAdmin && u.id !== perfil?.id && (
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
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
