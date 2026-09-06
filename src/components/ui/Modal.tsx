import { cn } from '@/lib/cn'
import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg'
  mobileBottomSheet?: boolean
}

const sizeStyles = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

function getFocusable(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
}

export function Modal({ open, onClose, title, description, children, size = 'md', mobileBottomSheet = false }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return

    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null

    const dialog = dialogRef.current
    const initialFocus = dialog ? getFocusable(dialog)[0] : undefined
    initialFocus?.focus()
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab' || !dialog) return

      const focusables = getFocusable(dialog)
      if (focusables.length === 0) {
        event.preventDefault()
        dialog.focus()
        return
      }

      const first = focusables[0]
      const last = focusables[focusables.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
      previouslyFocusedRef.current?.focus()
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex md:items-center md:justify-center">
      <div className="fixed inset-0 bg-surface-900/25 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          'relative bg-white shadow-xl border border-surface-200 w-full mx-4 outline-none',
          'max-h-[90vh] flex flex-col',
          mobileBottomSheet
            ? 'md:rounded-xl md:animate-in md:fade-in md:zoom-in-95 md:duration-200 lg:max-w-lg'
            : 'rounded-xl animate-in fade-in zoom-in-95 duration-200',
          mobileBottomSheet ? 'md:max-h-[90vh]' : '',
          sizeStyles[size]
        )}
      >
        {!mobileBottomSheet && (
          <div className="flex items-start justify-between p-6 pb-4 border-b border-surface-100">
            <div>
              <h2 className="text-lg font-semibold text-surface-900">{title}</h2>
              {description && <p className="text-sm text-surface-500 mt-0.5">{description}</p>}
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="text-surface-400 hover:text-surface-600 transition-colors p-1 -m-1 rounded-md"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        {mobileBottomSheet && (
          <div className="md:hidden sticky top-0 z-10 bg-white border-b border-surface-100 rounded-t-xl">
            <div className="flex items-center justify-between p-4">
              <div className="w-8 h-1.5 mx-auto rounded-full bg-surface-300" />
              <h2 className="text-lg font-semibold text-surface-900 mx-auto">{title}</h2>
              <button
                onClick={onClose}
                aria-label="Close"
                className="text-surface-400 hover:text-surface-600 transition-colors p-1 -m-1 rounded-md"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {description && <p className="px-4 pb-4 text-sm text-surface-500">{description}</p>}
          </div>
        )}
        <div className="p-6 pt-0 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  )
}