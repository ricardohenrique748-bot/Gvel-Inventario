import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Logo } from '@/components/ui/Logo'
import { Button } from '@/components/ui/Button'
import { Input, Label, FieldError } from '@/components/ui/Input'

const schema = z
  .object({
    senha: z.string().min(6, 'Mínimo de 6 caracteres'),
    confirmarSenha: z.string().min(6, 'Mínimo de 6 caracteres'),
  })
  .refine((data) => data.senha === data.confirmarSenha, {
    message: 'As senhas não coincidem',
    path: ['confirmarSenha'],
  })

type FormValues = z.infer<typeof schema>

export function TrocarSenha() {
  const { perfil, refetchPerfil } = useAuth()
  const navigate = useNavigate()
  const [erro, setErro] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  async function onSubmit(values: FormValues) {
    setErro(null)
    const { error: updateError } = await supabase.auth.updateUser({ password: values.senha })
    if (updateError) {
      setErro(updateError.message)
      return
    }

    if (perfil) {
      const { error: perfilError } = await supabase
        .from('usuarios')
        .update({ deve_trocar_senha: false })
        .eq('id', perfil.id)
      if (perfilError) {
        setErro(perfilError.message)
        return
      }
    }

    await refetchPerfil()
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-svh flex items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm rounded-3xl border border-border/10 bg-surface p-8 sm:p-10">
        <div className="mb-8 flex justify-center">
          <Logo size="lg" stacked />
        </div>

        <h1 className="mb-1 text-lg font-semibold text-foreground text-center">Defina sua senha</h1>
        <p className="mb-6 text-sm text-secondary text-center">
          Você entrou com uma senha temporária. Escolha uma nova senha para continuar.
        </p>

        <form onSubmit={handleSubmit(onSubmit) as (e: FormEvent) => void} className="space-y-4">
          <div>
            <Label htmlFor="senha">Nova senha</Label>
            <Input id="senha" type="password" placeholder="Mínimo de 6 caracteres" {...register('senha')} />
            <FieldError message={errors.senha?.message} />
          </div>
          <div>
            <Label htmlFor="confirmarSenha">Confirmar nova senha</Label>
            <Input id="confirmarSenha" type="password" placeholder="Repita a senha" {...register('confirmarSenha')} />
            <FieldError message={errors.confirmarSenha?.message} />
          </div>

          <FieldError message={erro ?? undefined} />

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Salvando…
              </>
            ) : (
              'Salvar e continuar'
            )}
          </Button>
        </form>
      </div>
    </div>
  )
}
