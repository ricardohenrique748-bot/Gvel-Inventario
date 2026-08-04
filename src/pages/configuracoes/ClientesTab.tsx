import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Card, CardContent } from '@/components/ui/Card'
import { Input, Label, FieldError } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useClientes, criarCliente } from '@/hooks/useClientes'
import { buscarCnpj, formatCnpj } from '@/lib/cnpj'

const schema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome da empresa'),
  cnpj: z.string().optional(),
  endereco: z.string().optional(),
  telefone: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export function ClientesTab() {
  const { clientes, loading, refetch } = useClientes()
  const [buscandoCnpj, setBuscandoCnpj] = useState(false)
  const [cnpjInfo, setCnpjInfo] = useState<string | null>(null)
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
    } catch (err) {
      setError('nome', { message: err instanceof Error ? err.message : 'Não foi possível salvar o cliente.' })
    }
  }

  return (
    <div className="space-y-6">
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
            <div className="flex justify-end">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Salvando…' : 'Cadastrar cliente'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <p className="text-sm text-secondary">Carregando…</p>
          ) : clientes.length === 0 ? (
            <p className="text-sm text-secondary">Nenhum cliente cadastrado.</p>
          ) : (
            <div className="space-y-3">
              {clientes.map((c) => (
                <div key={c.id} className="rounded-xl bg-background px-4 py-3">
                  <p className="text-white font-medium">{c.nome}</p>
                  <p className="text-sm text-secondary">
                    {c.cnpj || 'Sem CNPJ'} · {c.telefone || 'Sem telefone'}
                  </p>
                  {c.endereco && <p className="text-sm text-secondary">{c.endereco}</p>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
