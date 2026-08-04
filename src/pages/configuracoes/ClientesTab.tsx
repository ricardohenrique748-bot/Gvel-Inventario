import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Pencil, Plus, Trash2, X } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { Input, Label, FieldError } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useClientes, criarCliente, atualizarCliente, excluirCliente } from '@/hooks/useClientes'
import { buscarCnpj, formatCnpj } from '@/lib/cnpj'
import type { Cliente } from '@/lib/types'

const schema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome da empresa'),
  cnpj: z.string().optional(),
  endereco: z.string().optional(),
  telefone: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export function ClientesTab() {
  const { clientes, loading, refetch } = useClientes()
  const [mostrarForm, setMostrarForm] = useState(false)
  const [buscandoCnpj, setBuscandoCnpj] = useState(false)
  const [cnpjInfo, setCnpjInfo] = useState<string | null>(null)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [excluindoId, setExcluindoId] = useState<string | null>(null)
  const [erroLista, setErroLista] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    getValues,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const { onBlur: cnpjOnBlur, onChange: cnpjOnChange, ...cnpjField } = register('cnpj')

  function handleCnpjChange(e: React.ChangeEvent<HTMLInputElement>) {
    e.target.value = formatCnpj(e.target.value)
    cnpjOnChange(e)
  }

  async function handleCnpjBlur(e: React.FocusEvent<HTMLInputElement>) {
    cnpjOnBlur(e)
    const digits = (getValues('cnpj') ?? '').replace(/\D/g, '')
    if (digits.length !== 14) return

    setBuscandoCnpj(true)
    setCnpjInfo(null)
    try {
      const info = await buscarCnpj(digits)
      if (info.nome) setValue('nome', info.nome)
      if (info.endereco) setValue('endereco', info.endereco)
      if (info.telefone) setValue('telefone', info.telefone)
      setCnpjInfo('Dados da empresa preenchidos automaticamente.')
    } catch (err) {
      setCnpjInfo(err instanceof Error ? err.message : 'Não foi possível buscar o CNPJ.')
    } finally {
      setBuscandoCnpj(false)
    }
  }

  async function onSubmit(values: FormValues) {
    try {
      await criarCliente(values.nome, values.telefone, values.cnpj, values.endereco)
      await refetch()
      reset()
      setCnpjInfo(null)
      setMostrarForm(false)
    } catch (err) {
      setError('nome', { message: err instanceof Error ? err.message : 'Não foi possível salvar o cliente.' })
    }
  }

  async function handleExcluir(id: string, nome: string) {
    if (!confirm(`Excluir o cliente "${nome}"? Essa ação não pode ser desfeita.`)) return
    setErroLista(null)
    setExcluindoId(id)
    try {
      await excluirCliente(id)
      await refetch()
    } catch (err) {
      setErroLista(err instanceof Error ? err.message : 'Não foi possível excluir o cliente.')
    } finally {
      setExcluindoId(null)
    }
  }

  return (
    <div className="space-y-6">
      {!mostrarForm ? (
        <Button type="button" onClick={() => setMostrarForm(true)}>
          <Plus className="h-4 w-4" />
          Novo cliente
        </Button>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div>
                <Label htmlFor="nome">Nome da empresa</Label>
                <Input id="nome" placeholder="Razão social ou nome fantasia" {...register('nome')} />
                <FieldError message={errors.nome?.message} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="cnpj">CNPJ</Label>
                  <Input
                    id="cnpj"
                    placeholder="00.000.000/0000-00"
                    inputMode="numeric"
                    maxLength={18}
                    {...cnpjField}
                    onChange={handleCnpjChange}
                    onBlur={handleCnpjBlur}
                  />
                  {buscandoCnpj && <p className="mt-1 text-xs text-secondary">Buscando dados da empresa…</p>}
                  {!buscandoCnpj && cnpjInfo && <p className="mt-1 text-xs text-secondary">{cnpjInfo}</p>}
                </div>
                <div>
                  <Label htmlFor="telefone">Telefone</Label>
                  <Input id="telefone" placeholder="Opcional" {...register('telefone')} />
                </div>
              </div>
              <div>
                <Label htmlFor="endereco">Endereço</Label>
                <Input id="endereco" placeholder="Endereço completo" {...register('endereco')} />
              </div>
              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setMostrarForm(false)
                    reset()
                    setCnpjInfo(null)
                  }}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Salvando…' : 'Cadastrar cliente'}
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
          ) : clientes.length === 0 ? (
            <p className="text-sm text-secondary">Nenhum cliente cadastrado.</p>
          ) : (
            <div className="space-y-3">
              {clientes.map((c) =>
                editandoId === c.id ? (
                  <EditarClienteForm
                    key={c.id}
                    cliente={c}
                    onCancel={() => setEditandoId(null)}
                    onSalvo={async () => {
                      setEditandoId(null)
                      await refetch()
                    }}
                    onErro={setErroLista}
                  />
                ) : (
                  <div key={c.id} className="flex items-center justify-between gap-3 rounded-xl bg-background px-4 py-3">
                    <div>
                      <p className="text-white font-medium">{c.nome}</p>
                      <p className="text-sm text-secondary">
                        {c.cnpj || 'Sem CNPJ'} · {c.telefone || 'Sem telefone'}
                      </p>
                      {c.endereco && <p className="text-sm text-secondary">{c.endereco}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon"
                        onClick={() => setEditandoId(c.id)}
                        aria-label={`Editar ${c.nome}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="danger"
                        size="icon"
                        onClick={() => handleExcluir(c.id, c.nome)}
                        disabled={excluindoId === c.id}
                        aria-label={`Excluir ${c.nome}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ),
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function EditarClienteForm({
  cliente,
  onCancel,
  onSalvo,
  onErro,
}: {
  cliente: Cliente
  onCancel: () => void
  onSalvo: () => void | Promise<void>
  onErro: (message: string) => void
}) {
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      nome: cliente.nome,
      cnpj: cliente.cnpj ?? '',
      telefone: cliente.telefone ?? '',
      endereco: cliente.endereco ?? '',
    },
  })

  async function onSubmit(values: FormValues) {
    try {
      await atualizarCliente(cliente.id, values)
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
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor={`nome-${cliente.id}`}>Nome da empresa</Label>
          <Input id={`nome-${cliente.id}`} {...register('nome')} />
        </div>
        <div>
          <Label htmlFor={`cnpj-${cliente.id}`}>CNPJ</Label>
          <Input id={`cnpj-${cliente.id}`} {...register('cnpj')} />
        </div>
        <div>
          <Label htmlFor={`telefone-${cliente.id}`}>Telefone</Label>
          <Input id={`telefone-${cliente.id}`} placeholder="Opcional" {...register('telefone')} />
        </div>
        <div>
          <Label htmlFor={`endereco-${cliente.id}`}>Endereço</Label>
          <Input id={`endereco-${cliente.id}`} {...register('endereco')} />
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
