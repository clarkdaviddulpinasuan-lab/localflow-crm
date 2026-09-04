import { cn } from '@/lib/cn'

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
  label?: string
}

const sizeClasses = {
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-8 w-8 border-[3px]',
} as const

export function Spinner({ size = 'md', className, label }: SpinnerProps) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span
        aria-hidden="true"
        className={cn(
          'inline-block shrink-0 rounded-full border-surface-300/70 border-t-primary-600 animate-spin',
          sizeClasses[size]
        )}
      />
      {label ? <span className="text-sm text-surface-500">{label}</span> : null}
    </span>
  )
}
