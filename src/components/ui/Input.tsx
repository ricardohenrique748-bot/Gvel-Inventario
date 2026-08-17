import { forwardRef, type InputHTMLAttributes, type LabelHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('block text-sm font-medium text-secondary mb-1.5 uppercase', className)} {...props} />
}

interface FieldErrorProps {
  message?: string
}

export function FieldError({ message }: FieldErrorProps) {
  if (!message) return null
  return <p className="mt-1 text-xs text-status-danger">{message}</p>
}

const baseInputClasses =
  'w-full h-12 rounded-xl bg-background border border-secondary/30 px-4 text-base text-foreground placeholder:text-secondary/60 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  noUppercase?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, onChange, style, type, noUppercase, id, name, autoCapitalize, autoComplete, ...props }, ref) => {
    const isPasswordField =
      type === 'password' ||
      id?.toLowerCase().includes('pass') ||
      id?.toLowerCase().includes('senha') ||
      name?.toLowerCase().includes('pass') ||
      name?.toLowerCase().includes('senha') ||
      autoComplete?.toLowerCase().includes('password')

    const isEmailField =
      type === 'email' ||
      id?.toLowerCase().includes('email') ||
      name?.toLowerCase().includes('email') ||
      autoComplete?.toLowerCase().includes('email')

    const shouldUppercase =
      !noUppercase &&
      !isPasswordField &&
      !isEmailField &&
      type !== 'password' &&
      type !== 'email' &&
      type !== 'number' &&
      type !== 'time' &&
      type !== 'date' &&
      type !== 'datetime-local' &&
      type !== 'file'

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (shouldUppercase) {
        const upper = e.target.value.toUpperCase()
        // Cria um evento sintético com o valor em maiúsculas
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
        nativeInputValueSetter?.call(e.target, upper)
        e.target.dispatchEvent(new Event('input', { bubbles: true }))
        // Repassa um evento clonado com valor atualizado
        Object.defineProperty(e, 'target', { writable: false, value: Object.assign(e.target, { value: upper }) })
      }
      onChange?.(e)
    }

    return (
      <input
        ref={ref}
        type={type}
        id={id}
        name={name}
        autoCapitalize={autoCapitalize || (isPasswordField || isEmailField || !shouldUppercase ? 'none' : undefined)}
        autoComplete={autoComplete}
        className={cn(baseInputClasses, className)}
        onChange={handleChange}
        style={{ textTransform: shouldUppercase ? 'uppercase' : undefined, ...style }}
        {...props}
      />
    )
  },
)
Input.displayName = 'Input'

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, onChange, style, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      e.target.value = e.target.value.toUpperCase()
      onChange?.(e)
    }
    return (
      <textarea
        ref={ref}
        className={cn(baseInputClasses, 'h-auto min-h-24 py-3 resize-y', className)}
        onChange={handleChange}
        style={{ textTransform: 'uppercase', ...style }}
        {...props}
      />
    )
  },
)
Textarea.displayName = 'Textarea'

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select ref={ref} className={cn(baseInputClasses, 'appearance-none pr-8 uppercase', className)} {...props}>
      {children}
    </select>
  ),
)
Select.displayName = 'Select'
