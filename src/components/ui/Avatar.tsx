import { cn } from '@/lib/cn'
import { getInitials } from '@/utils/format'

interface AvatarProps {
  firstName: string
  lastName: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeStyles = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-9 w-9 text-sm',
  lg: 'h-12 w-12 text-base',
}

export function Avatar({ firstName, lastName, size = 'md', className }: AvatarProps) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-700 font-semibold',
        sizeStyles[size],
        className
      )}
    >
      {getInitials(firstName, lastName)}
    </span>
  )
}
