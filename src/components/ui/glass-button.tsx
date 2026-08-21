import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

function cn(...inputs: (string | undefined | null | false)[]): string {
  return inputs.filter(Boolean).join(' ')
}

const glassButtonVariants = cva(
  'relative isolate all-unset cursor-pointer rounded-full transition-all duration-200 font-bold',
  {
    variants: {
      variant: {
        default: 'glass-button',
        primary: 'glass-button glass-button-primary',
        secondary: 'glass-button',
      },
      size: {
        default: 'text-xs sm:text-sm font-bold',
        sm: 'text-xs font-semibold',
        lg: 'text-base font-bold',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

const glassButtonTextVariants = cva(
  'glass-button-text relative block select-none tracking-wide uppercase',
  {
    variants: {
      size: {
        default: 'px-5 py-2.5',
        sm: 'px-3.5 py-1.5',
        lg: 'px-7 py-3.5',
        icon: 'flex h-10 w-10 items-center justify-center',
      },
    },
    defaultVariants: {
      size: 'default',
    },
  }
)

export interface GlassButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof glassButtonVariants> {
  contentClassName?: string
}

const GlassButton = React.forwardRef<HTMLButtonElement, GlassButtonProps>(
  ({ className, children, size, variant, contentClassName, ...props }, ref) => {
    return (
      <div className={cn('glass-button-wrap cursor-pointer rounded-full', className)}>
        <button
          className={cn('glass-button', glassButtonVariants({ size, variant }))}
          ref={ref}
          {...props}
        >
          <span className={cn(glassButtonTextVariants({ size }), contentClassName)}>
            {children}
          </span>
        </button>
        <div className="glass-button-shadow rounded-full" />
      </div>
    )
  }
)
GlassButton.displayName = 'GlassButton'

export { GlassButton, glassButtonVariants }
