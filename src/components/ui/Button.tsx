import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'
export type ButtonSize = 'md' | 'lg' | 'icon'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'glass-tint bg-primary text-white hover:bg-primary-hover',
  secondary: 'glass-btn text-foreground',
  ghost: 'bg-transparent text-foreground transition-colors hover:bg-surface/60 hover:backdrop-blur-md',
  danger: 'glass-tint bg-status-danger text-white hover:brightness-110',
  success: 'glass-tint bg-status-success text-white hover:brightness-110',
}

const sizeClasses: Record<ButtonSize, string> = {
  md: 'h-11 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
  icon: 'h-11 w-11',
}

export function buttonClasses(variant: ButtonVariant = 'primary', size: ButtonSize = 'lg', className?: string) {
  return cn(
    'inline-flex items-center justify-center gap-2 rounded-xl font-medium disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    variantClasses[variant],
    sizeClasses[size],
    className,
  )
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'lg', ...props }, ref) => {
    return <button ref={ref} className={buttonClasses(variant, size, className)} {...props} />
  },
)
Button.displayName = 'Button'
