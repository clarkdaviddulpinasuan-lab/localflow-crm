import { cn } from '@/lib/cn'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg'
}

const sizeStyles = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
}

export function Modal({ open, onClose, title, description, children, size = 'md' }: ModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-surface-900/25 backdrop-blur-sm" onClick={onClose} />
      <div
        className={cn(
          'relative bg-white rounded-xl shadow-xl border border-surface-200 w-full mx-4',
          'animate-in fade-in zoom-in-95 duration-200',
          sizeStyles[size]
        )}
      >
        <div className="flex items-start justify-between p-6 pb-0">
          <div>
            <h2 className="text-lg font-semibold text-surface-900">{title}</h2>
            {description && <p className="text-sm text-surface-500 mt-0.5">{description}</p>}
          </div>
          <button
            onClick={onClose}
            className="text-surface-400 hover:text-surface-600 transition-colors p-1 -m-1 rounded-md"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}
