import { cn } from '@/lib/cn'
import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  padding?: boolean
}

export function Card({ children, className, padding = true }: CardProps) {
  return (
    <div
      className={cn(
        'bg-white rounded-xl border border-surface-200 shadow-xs',
        padding && 'p-6',
        className
      )}
    >
      {children}
    </div>
  )
}

interface CardHeaderProps {
  title: string
  description?: string
  action?: ReactNode
}

export function CardHeader({ title, description, action }: CardHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div>
        <h3 className="text-lg font-semibold text-surface-900">{title}</h3>
        {description && (
          <p className="text-sm text-surface-500 mt-0.5">{description}</p>
        )}
      </div>
      {action}
    </div>
  )
}
