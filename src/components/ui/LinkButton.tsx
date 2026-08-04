import { Link, type LinkProps } from 'react-router-dom'
import { buttonClasses, type ButtonVariant, type ButtonSize } from './Button'

interface LinkButtonProps extends LinkProps {
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
}

export function LinkButton({ variant = 'primary', size = 'lg', className, ...props }: LinkButtonProps) {
  return <Link className={buttonClasses(variant, size, className)} {...props} />
}
