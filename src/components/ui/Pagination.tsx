import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'

interface PaginationProps {
  page: number
  totalPages: number
  total: number
  perPage: number
  onPageChange: (page: number) => void
}

export function Pagination({ page, totalPages, total, perPage, onPageChange }: PaginationProps) {
  if (totalPages <= 1) {
    return (
      <div className="flex items-center justify-between px-4 py-3 text-sm text-surface-500">
        <span>Showing {Math.min(total, perPage)} of {total}</span>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-surface-100">
      <p className="text-sm text-surface-500">
        Showing{' '}
        <span className="font-medium text-surface-700">
          {(page - 1) * perPage + 1}-{Math.min(page * perPage, total)}
        </span>{' '}
        of <span className="font-medium text-surface-700">{total}</span>
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="p-1.5 rounded-md text-surface-500 hover:bg-surface-100 hover:text-surface-700 disabled:opacity-40 disabled:pointer-events-none"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {Array.from({ length: totalPages }).map((_, i) => (
          <button
            key={i}
            onClick={() => onPageChange(i + 1)}
            className={cn(
              'h-8 w-8 rounded-md text-sm font-medium transition-colors',
              page === i + 1
                ? 'bg-primary-600 text-white'
                : 'text-surface-600 hover:bg-surface-100'
            )}
          >
            {i + 1}
          </button>
        ))}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="p-1.5 rounded-md text-surface-500 hover:bg-surface-100 hover:text-surface-700 disabled:opacity-40 disabled:pointer-events-none"
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
