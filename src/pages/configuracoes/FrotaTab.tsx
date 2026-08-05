import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { Input, Label, FieldError, Select } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { QuickCreateSelect } from '@/components/QuickCreateSelect'
import { useClientes } from '@/hooks/useClientes'
import { useMarcas, useModelos, criarMarca, criarModelo } from '@/hooks/useMarcasModelos'
import { useVeiculosPorCliente, upsertVeiculo, atualizarVeiculo, excluirVeiculo } from '@/hooks/useVeiculos'
import type { VeiculoComRelacoes } from '@/lib/types'

const anoAtual = new Date().getFullYear()

const schema = z.object({
  clienteId: z.string().min(1, 'Selecione o cliente').refine((val) => val !== 'todos', 'Selecione um cliente para o veículo'),
  placa: z.string().trim().min(7, 'Placa inválida').max(8, 'Placa inválida'),
  tipo: z.enum(['pesado', 'leve']),
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
})

type FormValues = z.infer<typeof schema>

export function FrotaTab() {
  const { clientes } = useClientes()
  const { marcas, refetch: refetchMarcas } = useMarcas()
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [excluindoId, setExcluindoId] = useState<string | null>(null)
  const [erroLista, setErroLista] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { clienteId: 'todos', tipo: 'pesado', situacao: 'operante' },
  })

  const clienteId = watch('clienteId')
  const marcaId = watch('marcaId')
  const { modelos, refetch: refetchModelos } = useModelos(marcaId)
  const { veiculos, loading, refetch: refetchVeiculos } = useVeiculosPorCliente(clienteId)

  async function onSubmit(values: FormValues) {
    try {
      const operante = values.situacao === 'operante'
      if (editandoId) {
        await atualizarVeiculo(editandoId, {
          placa: values.placa,
          marcaId: values.marcaId,
          modeloId: values.modeloId,
          clienteId: values.clienteId,
          tipo: values.tipo,
          cor: values.cor,
          ano: values.ano,
          chassi: values.chassi,
          operante,
        })
        setEditandoId(null)
      } else {
        await upsertVeiculo({
          placa: values.placa,
          marcaId: values.marcaId,
          modeloId: values.modeloId,
          clienteId: values.clienteId,
          tipo: values.tipo,
          cor: values.cor,
          ano: values.ano,
          chassi: values.chassi,
          operante,
        })
      }
      await refetchVeiculos()
      reset({ clienteId: values.clienteId, tipo: 'pesado', situacao: 'operante' })
      setMostrarForm(false)
    } catch (err) {
      setError('placa', { message: err instanceof Error ? err.message : 'Não foi possível salvar o veículo.' })
    }
  }

  function handleEditar(v: VeiculoComRelacoes) {
    setEditandoId(v.id)
    setMostrarForm(true)
    setValue('clienteId', v.cliente_id)
    setValue('placa', v.placa)
    setValue('tipo', v.tipo)
    setValue('cor', v.cor ?? '')
    setValue('chassi', v.chassi ?? '')
    setValue('situacao', v.operante ? 'operante' : 'inoperante')
    setValue('ano', v.ano ?? (undefined as unknown as number))
    setValue('marcaId', v.marca_id)
    setValue('modeloId', v.modelo_id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleCancelarEdicao() {
    setEditandoId(null)
    setMostrarForm(false)
    reset({ clienteId, tipo: 'pesado', situacao: 'operante' })
  }

  async function handleExcluir(id: string, placa: string) {
    if (!confirm(`Excluir o veículo "${placa}"? Essa ação não pode ser desfeita.`)) return
    setErroLista(null)
    setExcluindoId(id)
    try {
      await excluirVeiculo(id)
      if (editandoId === id) handleCancelarEdicao()
      await refetchVeiculos()
    } catch (err) {
      setErroLista(err instanceof Error ? err.message : 'Não foi possível excluir o veículo.')
    } finally {
      setExcluindoId(null)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <div>
            <Label htmlFor="clienteId">Filtrar por Cliente</Label>
            <Select id="clienteId" {...register('clienteId')}>
              <option value="todos">Todos os clientes (Ver toda a frota)</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </Select>
            <FieldError message={errors.clienteId?.message} />
          </div>
        </CardContent>
      </Card>

      {!mostrarForm ? (
        <Button type="button" onClick={() => setMostrarForm(true)}>
          <Plus className="h-4 w-4" />
          Novo veículo
        </Button>
      ) : (
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <Label>Tipo de veículo</Label>
              <div className="flex gap-3">
                <label className="flex-1">
                  <input type="radio" value="pesado" className="peer sr-only" {...register('tipo')} />
                  <div className="h-12 flex items-center justify-center rounded-xl border border-secondary/30 text-secondary peer-checked:border-primary peer-checked:bg-primary/10 peer-checked:text-white cursor-pointer">
                    Pesado
                  </div>
                </label>
                <label className="flex-1">
                  <input type="radio" value="leve" className="peer sr-only" {...register('tipo')} />
                  <div className="h-12 flex items-center justify-center rounded-xl border border-secondary/30 text-secondary peer-checked:border-primary peer-checked:bg-primary/10 peer-checked:text-white cursor-pointer">
                    Leve
                  </div>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="placa">Placa</Label>
                <Input id="placa" placeholder="ABC1D23" className="uppercase" {...register('placa')} />
                <FieldError message={errors.placa?.message} />
              </div>
              <div>
                <Label htmlFor="cor">Cor</Label>
                <Input id="cor" placeholder="Branco" {...register('cor')} />
                <FieldError message={errors.cor?.message} />
              </div>
            </div>

            <div>
              <Label>Situação</Label>
              <div className="flex gap-3">
                <label className="flex-1">
                  <input type="radio" value="operante" className="peer sr-only" {...register('situacao')} />
                  <div className="h-12 flex items-center justify-center rounded-xl border border-secondary/30 text-secondary peer-checked:border-status-success peer-checked:bg-status-success/10 peer-checked:text-white cursor-pointer">
                    Operante
                  </div>
                </label>
                <label className="flex-1">
                  <input type="radio" value="inoperante" className="peer sr-only" {...register('situacao')} />
                  <div className="h-12 flex items-center justify-center rounded-xl border border-secondary/30 text-secondary peer-checked:border-status-danger peer-checked:bg-status-danger/10 peer-checked:text-white cursor-pointer">
                    Inoperante
                  </div>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="ano">Ano</Label>
                <Input
                  id="ano"
                  type="number"
                  placeholder={String(anoAtual)}
                  {...register('ano', { valueAsNumber: true })}
                />
                <FieldError message={errors.ano?.message} />
              </div>
              <div>
                <Label htmlFor="chassi">Chassi</Label>
                <Input id="chassi" placeholder="Opcional" {...register('chassi')} />
                <FieldError message={errors.chassi?.message} />
              </div>
            </div>

            <Controller
              control={control}
              name="marcaId"
              render={({ field }) => (
                <QuickCreateSelect
                  label="Marca"
                  value={field.value}
                  onChange={field.onChange}
                  options={marcas}
                  onCreate={async (nome) => {
                    const created = await criarMarca(nome)
                    await refetchMarcas()
                    return created
                  }}
                  placeholder="Selecione a marca"
                  error={errors.marcaId?.message}
                />
              )}
            />

            <Controller
              control={control}
              name="modeloId"
              render={({ field }) => (
                <QuickCreateSelect
                  label="Modelo"
                  value={field.value}
                  onChange={field.onChange}
                  options={modelos}
                  disabled={!marcaId}
                  onCreate={async (nome) => {
                    const created = await criarModelo(marcaId, nome)
                    await refetchModelos()
                    return created
                  }}
                  placeholder={marcaId ? 'Selecione o modelo' : 'Selecione a marca primeiro'}
                  error={errors.modeloId?.message}
                />
              )}
            />

            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={handleCancelarEdicao}>
                {editandoId ? 'Cancelar edição' : 'Cancelar'}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Salvando…' : editandoId ? 'Salvar alterações' : 'Cadastrar veículo'}
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
            <p className="text-sm text-secondary">Carregando frota…</p>
          ) : veiculos.length === 0 ? (
            <p className="text-sm text-secondary">
              {clienteId === 'todos' || !clienteId
                ? 'Nenhum veículo cadastrado na frota.'
                : 'Nenhum veículo cadastrado para este cliente.'}
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {veiculos.map((v) => (
                <div key={v.id} className="rounded-xl bg-background px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-white font-medium">{v.placa}</p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon"
                        onClick={() => handleEditar(v)}
                        aria-label={`Editar ${v.placa}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="danger"
                        size="icon"
                        onClick={() => handleExcluir(v.id, v.placa)}
                        disabled={excluindoId === v.id}
                        aria-label={`Excluir ${v.placa}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-secondary">
                    {v.marca?.nome} {v.modelo?.nome} {v.ano ? `· ${v.ano}` : ''}
                  </p>
                  <p className="text-sm text-secondary">{v.cor || 'Sem cor'}</p>
                  {v.chassi && <p className="text-sm text-secondary">Chassi: {v.chassi}</p>}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge tone="neutral">{v.tipo === 'pesado' ? 'Pesado' : 'Leve'}</Badge>
                    <Badge tone={v.operante ? 'success' : 'danger'}>{v.operante ? 'Operante' : 'Inoperante'}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
