import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Building2, Check, Loader2, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { Input, Label, FieldError } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useEmpresa } from '@/contexts/EmpresaContext'
import type { Empresa } from '@/contexts/EmpresaContext'
import { buscarCnpj, formatCnpj } from '@/lib/cnpj'

const schema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome da empresa'),
  sistemaLabel: z.string().trim().min(1, 'Informe o rótulo do sistema'),
  cor: z.string().min(4, 'Selecione uma cor'),
  cnpj: z.string().optional(),
  observacoes: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

const CORES_PRESETS = [
  { label: 'Vermelho GVel', value: '#E23B2E' },
  { label: 'Azul Marinho', value: '#1E3A5F' },
  { label: 'Verde Escuro', value: '#1B6B3A' },
  { label: 'Laranja', value: '#D4540A' },
  { label: 'Roxo', value: '#6B21A8' },
  { label: 'Teal', value: '#0F766E' },
  { label: 'Índigo', value: '#3730A3' },
  { label: 'Cinza Escuro', value: '#374151' },
]

export function EmpresasTab() {
  const { empresas, empresaAtiva, setEmpresaAtiva, adicionarEmpresa, atualizarEmpresa, excluirEmpresa } =
    useEmpresa()
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [excluindoId, setExcluindoId] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState<string | null>(null)
  const [buscandoCnpj, setBuscandoCnpj] = useState(false)
  const [cnpjInfo, setCnpjInfo] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { nome: '', sistemaLabel: 'CENTER TRUCK', cor: '#E23B2E', cnpj: '', observacoes: '' },
  })

  const corAtual = watch('cor')

  function iniciarEdicao(empresa: Empresa) {
    setEditandoId(empresa.id)
    setMostrarForm(true)
    setCnpjInfo(null)
    reset({
      nome: empresa.nome,
      sistemaLabel: empresa.sistemaLabel,
      cor: empresa.cor,
      cnpj: empresa.cnpj ? formatCnpj(empresa.cnpj) : '',
      observacoes: empresa.observacoes ?? '',
    })
  }

  function cancelar() {
    setMostrarForm(false)
    setEditandoId(null)
    setCnpjInfo(null)
    reset({ nome: '', sistemaLabel: 'CENTER TRUCK', cor: '#E23B2E', cnpj: '', observacoes: '' })
  }

  async function handleBuscarCnpj(cnpjVal?: string) {
    const raw = cnpjVal ?? watch('cnpj') ?? ''
    const digits = raw.replace(/\D/g, '')
    if (digits.length !== 14) {
      setCnpjInfo('O CNPJ deve conter 14 dígitos.')
      return
    }

    setBuscandoCnpj(true)
    setCnpjInfo(null)
    try {
      const info = await buscarCnpj(digits)
      if (info.nome) {
        setValue('nome', info.nome)
        const currentSistema = watch('sistemaLabel')
        if (!currentSistema || currentSistema === 'CENTER TRUCK') {
          setValue('sistemaLabel', info.nome.split(' ').slice(0, 3).join(' ').toUpperCase())
        }
      }
      if (info.endereco) {
        const obs = [info.endereco, info.telefone ? `Tel: ${info.telefone}` : null].filter(Boolean).join(' | ')
        const obsAtual = watch('observacoes')
        if (!obsAtual) {
          setValue('observacoes', obs)
        }
      }
      setCnpjInfo('Dados da empresa preenchidos via Receita Federal!')
    } catch (err) {
      setCnpjInfo(err instanceof Error ? err.message : 'Não foi possível consultar o CNPJ.')
    } finally {
      setBuscandoCnpj(false)
    }
  }

  function onSubmit(values: FormValues) {
    const dadosFormatados = {
      ...values,
      cnpj: values.cnpj ? formatCnpj(values.cnpj) : '',
    }
    if (editandoId) {
      atualizarEmpresa(editandoId, dadosFormatados)
      setSucesso('Empresa atualizada com sucesso!')
    } else {
      adicionarEmpresa(dadosFormatados)
      setSucesso('Empresa cadastrada com sucesso!')
    }
    cancelar()
    setTimeout(() => setSucesso(null), 3000)
  }

  function confirmarExclusao(id: string) {
    excluirEmpresa(id)
    setExcluindoId(null)
    setSucesso('Empresa removida.')
    setTimeout(() => setSucesso(null), 3000)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-foreground uppercase tracking-wide">
            Empresas do Grupo GVEL
          </h2>
          <p className="text-xs text-secondary mt-0.5">
            Gerencie as empresas do grupo. Clique no logo do sistema para trocar de empresa.
          </p>
        </div>
        {!mostrarForm && (
          <Button
            size="md"
            onClick={() => { setEditandoId(null); setMostrarForm(true); setCnpjInfo(null) }}
            className="flex items-center gap-2 shrink-0"
          >
            <Plus className="h-4 w-4" />
            Nova Empresa
          </Button>
        )}
      </div>

      {/* Mensagem de Sucesso */}
      {sucesso && (
        <div className="flex items-center gap-2 rounded-xl border border-status-success/30 bg-status-success/10 px-4 py-3 text-sm text-status-success font-medium">
          <Check className="h-4 w-4 shrink-0" />
          {sucesso}
        </div>
      )}

      {/* Formulário */}
      {mostrarForm && (
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-foreground uppercase tracking-wide">
                {editandoId ? 'Editar Empresa' : 'Cadastrar Nova Empresa'}
              </h3>
              <button onClick={cancelar} className="text-secondary hover:text-foreground transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Nome */}
                <div>
                  <Label htmlFor="emp_nome">Nome da Empresa *</Label>
                  <Input
                    id="emp_nome"
                    placeholder="Ex: GVel Leves"
                    {...register('nome')}
                  />
                  <FieldError message={errors.nome?.message} />
                </div>

                {/* Rótulo do Sistema */}
                <div>
                  <Label htmlFor="emp_sistema">Rótulo do Sistema *</Label>
                  <Input
                    id="emp_sistema"
                    placeholder="Ex: CENTER TRUCK"
                    {...register('sistemaLabel')}
                  />
                  <FieldError message={errors.sistemaLabel?.message} />
                  <p className="mt-1 text-[11px] text-secondary">
                    Aparece no cabeçalho do sistema
                  </p>
                </div>

                {/* CNPJ com Busca Automática */}
                <div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="emp_cnpj">CNPJ</Label>
                    {buscandoCnpj && (
                      <span className="flex items-center gap-1 text-[11px] text-primary font-medium">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Buscando na Receita...
                      </span>
                    )}
                  </div>
                  <div className="relative mt-1">
                    <Input
                      id="emp_cnpj"
                      placeholder="00.000.000/0000-00"
                      value={watch('cnpj') || ''}
                      onChange={(e) => {
                        const formatted = formatCnpj(e.target.value)
                        setValue('cnpj', formatted)
                        const digits = formatted.replace(/\D/g, '')
                        if (digits.length === 14) {
                          handleBuscarCnpj(formatted)
                        }
                      }}
                      onBlur={() => {
                        const digits = (watch('cnpj') || '').replace(/\D/g, '')
                        if (digits.length === 14) {
                          handleBuscarCnpj()
                        }
                      }}
                      className="pr-10 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => handleBuscarCnpj()}
                      disabled={buscandoCnpj}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-secondary hover:text-primary transition-colors cursor-pointer rounded-lg hover:bg-overlay/10"
                      title="Buscar dados do CNPJ"
                    >
                      {buscandoCnpj ? (
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      ) : (
                        <Search className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {cnpjInfo && (
                    <p className={`mt-1 text-[11px] font-medium ${cnpjInfo.includes('via') ? 'text-emerald-500' : 'text-amber-500'}`}>
                      {cnpjInfo}
                    </p>
                  )}
                </div>

                {/* Cor */}
                <div>
                  <Label>Cor de Identificação *</Label>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {CORES_PRESETS.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        title={c.label}
                        onClick={() => setValue('cor', c.value)}
                        className="h-7 w-7 rounded-full border-2 transition-all shrink-0"
                        style={{
                          backgroundColor: c.value,
                          borderColor: corAtual === c.value ? 'white' : 'transparent',
                          boxShadow: corAtual === c.value ? `0 0 0 2px ${c.value}` : 'none',
                        }}
                      />
                    ))}
                    <div className="flex items-center gap-1.5">
                      <input
                        type="color"
                        value={corAtual}
                        onChange={(e) => setValue('cor', e.target.value)}
                        className="h-7 w-7 cursor-pointer rounded-full border-0 bg-transparent p-0"
                        title="Cor personalizada"
                      />
                      <span className="text-xs text-secondary font-mono">{corAtual}</span>
                    </div>
                  </div>
                  <FieldError message={errors.cor?.message} />
                </div>
              </div>

              {/* Observações */}
              <div>
                <Label htmlFor="emp_obs">Observações</Label>
                <Input
                  id="emp_obs"
                  placeholder="Informações adicionais"
                  {...register('observacoes')}
                />
              </div>

              {/* Preview */}
              <div className="rounded-xl border border-border/30 bg-overlay/5 p-3 flex items-center gap-3">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white font-black text-sm shadow-md"
                  style={{ backgroundColor: corAtual }}
                >
                  <Building2 className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground uppercase tracking-wider">
                    {watch('sistemaLabel') || 'SISTEMA'}
                  </p>
                  <p className="text-[11px] text-secondary uppercase tracking-wide">
                    {watch('nome') || 'Nome da Empresa'}
                  </p>
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <Button type="button" variant="ghost" size="md" onClick={cancelar}>
                  Cancelar
                </Button>
                <Button type="submit" size="md" disabled={isSubmitting}>
                  {editandoId ? 'Salvar Alterações' : 'Cadastrar Empresa'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Lista de Empresas */}
      <div className="space-y-3">
        {empresas.map((empresa) => {
          const isAtiva = empresa.id === empresaAtiva?.id
          const isExcluindo = excluindoId === empresa.id

          return (
            <Card key={empresa.id}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  {/* Ícone colorido */}
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-md"
                    style={{ backgroundColor: empresa.cor }}
                  >
                    <Building2 className="h-5 w-5" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-foreground">{empresa.nome}</p>
                      {isAtiva && (
                        <Badge className="text-[10px] px-1.5 py-0.5 bg-primary/15 text-primary border-primary/25">
                          ATIVA
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-secondary uppercase tracking-wide">
                      {empresa.sistemaLabel}
                    </p>
                    {empresa.cnpj && (
                      <p className="text-[11px] text-secondary/70 mt-0.5 font-mono">
                        {empresa.cnpj}
                      </p>
                    )}
                  </div>

                  {/* Ações */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {!isAtiva && (
                      <Button
                        size="md"
                        variant="ghost"
                        onClick={() => setEmpresaAtiva(empresa.id)}
                        className="text-xs h-8 px-3"
                      >
                        Ativar
                      </Button>
                    )}
                    <button
                      onClick={() => iniciarEdicao(empresa)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-secondary hover:bg-overlay/10 hover:text-foreground transition-colors"
                      title="Editar"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    {empresas.length > 1 && (
                      <>
                        {isExcluindo ? (
                          <div className="flex items-center gap-1.5 rounded-lg border border-status-error/30 bg-status-error/10 px-2.5 py-1">
                            <span className="text-xs text-status-error font-medium">Excluir?</span>
                            <button
                              onClick={() => confirmarExclusao(empresa.id)}
                              className="text-status-error hover:text-status-error/70 text-xs font-bold"
                            >
                              Sim
                            </button>
                            <button
                              onClick={() => setExcluindoId(null)}
                              className="text-secondary hover:text-foreground text-xs"
                            >
                              Não
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setExcluindoId(empresa.id)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-secondary hover:bg-status-error/10 hover:text-status-error transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {empresa.observacoes && (
                  <p className="mt-2 ml-14 text-[11px] text-secondary/60 italic">
                    {empresa.observacoes}
                  </p>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
