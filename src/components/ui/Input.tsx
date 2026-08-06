import { forwardRef, type InputHTMLAttributes, type LabelHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('block text-sm font-medium text-secondary mb-1.5', className)} {...props} />
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

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(baseInputClasses, className)} {...props} />
  ),
)
Input.displayName = 'Input'

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(baseInputClasses, 'h-auto min-h-24 py-3 resize-y', className)}
      {...props}
    />
  ),
)
Textarea.displayName = 'Textarea'

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select ref={ref} className={cn(baseInputClasses, 'appearance-none pr-8', className)} {...props}>
      {children}
    </select>
  ),
)
Select.displayName = 'Select'
