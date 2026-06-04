import { type ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '../../utils/cn'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
}

export const Button = forwardRef<HTMLButtonElement, Props>(
  ({ variant = 'secondary', size = 'md', className, children, ...props }, ref) => {
    const base = 'inline-flex items-center gap-1.5 font-medium rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-chiffon/30 disabled:opacity-40 disabled:cursor-not-allowed'
    const sizes = {
      sm: 'px-2.5 py-1 text-xs',
      md: 'px-3.5 py-2 text-sm',
    }
    const variants = {
      primary: 'bg-gray-100 hover:bg-gray-100/80 text-gray-900',
      secondary: 'bg-gray-750 hover:bg-gray-700 text-gray-100 border border-gray-700',
      ghost: 'hover:bg-gray-800 text-gray-400 hover:text-gray-100',
      danger: 'bg-red-950 hover:bg-red-900 text-red-400 border border-red-900',
    }
    return (
      <button ref={ref} className={cn(base, sizes[size], variants[variant], className)} {...props}>
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'
