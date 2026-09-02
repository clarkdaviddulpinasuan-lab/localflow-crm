import type { ReactNode } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface Column<T> {
  key: string
  header: string
  sortable?: boolean
  sortValue?: (row: T) => string | number
  render?: (row: T) => ReactNode
  className?: string
  hideOnMobile?: boolean
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  rowKey: (row: T) => string
  onRowClick?: (row: T) => void
  sortBy?: string
  sortDir?: 'asc' | 'desc'
  onSort?: (key: string) => void
  emptyState?: ReactNode
}

export function DataTable<T>({
  columns,
  data,
  rowKey,
  onRowClick,
  sortBy,
  sortDir,
  onSort,
  emptyState,
}: DataTableProps<T>) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[640px]">
        <thead>
          <tr className="border-b border-surface-200">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-surface-500 whitespace-nowrap',
                  col.hideOnMobile && 'hidden md:table-cell'
                )}
              >
                {col.sortable ? (
                  <button
                    onClick={() => onSort?.(col.key)}
                    className="inline-flex items-center gap-1 hover:text-surface-700 transition-colors"
                  >
                    {col.header}
                    {sortBy === col.key ? (
                      sortDir === 'asc' ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )
                    ) : (
                      <ChevronsUpDown className="h-3.5 w-3.5 text-surface-300" />
                    )}
                  </button>
                ) : (
                  col.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(
                'border-b border-surface-100 hover:bg-surface-50 transition-colors',
                onRowClick && 'cursor-pointer'
              )}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={cn(
                    'px-4 py-3 text-surface-700',
                    col.hideOnMobile && 'hidden md:table-cell',
                    col.className
                  )}
                >
                  {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {data.length === 0 && emptyState}
    </div>
  )
}
