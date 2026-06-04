import { type ReactNode } from 'react'
import { cn } from '../../utils/cn'

interface Props {
  children: ReactNode
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'orange'
  className?: string
}

export function Badge({ children, variant = 'default', className }: Props) {
  const variants = {
    default: 'bg-gray-750 text-gray-300',
    success: 'bg-emerald-950 text-emerald-400',
    warning: 'bg-amber-950 text-amber-400',
    danger: 'bg-red-950 text-red-400',
    orange: 'text-[#FFDBD1]',
  }
  return (
    <span
      className={cn('inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium', variants[variant], className)}
      style={variant === 'orange' ? { background: '#c2410c' } : undefined}
    >
      {children}
    </span>
  )
}
