import { useState } from 'react'
import { cn } from '@/lib/cn'
import { getInitials } from '@/utils/format'

interface AvatarProps {
  firstName: string
  lastName: string
  src?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeStyles = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-9 w-9 text-sm',
  lg: 'h-12 w-12 text-base',
}

export function Avatar({ firstName, lastName, src, size = 'md', className }: AvatarProps) {
  const [imgError, setImgError] = useState(false)
  const showImage = src && !imgError

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-700 font-semibold overflow-hidden',
        sizeStyles[size],
        className
      )}
    >
      {showImage ? (
        <img
          src={src}
          alt={`${firstName} ${lastName}`}
          className="h-full w-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        getInitials(firstName, lastName)
      )}
    </span>
  )
}
