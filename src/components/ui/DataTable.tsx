import type { ReactNode } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface Column<T> {
  key: string
  header: string
  sortable?: boolean
  sortValue?: (row: T) => string | number
  render?: (row: T) => ReactNode
  className?: string
  hideOnMobile?: boolean
  mobilePriority?: number
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
  mobileCardRender?: (row: T) => ReactNode
  compact?: boolean
}

function SortIndicator({ sortBy, sortDir, key }: { sortBy?: string; sortDir?: 'asc' | 'desc'; key: string }) {
  if (sortBy !== key) return <ChevronsUpDown className="h-3.5 w-3.5 text-surface-300" />
  return sortDir === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
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
  mobileCardRender,
  compact = false,
}: DataTableProps<T>) {
  const visibleColumns = columns.filter((c) => !c.hideOnMobile)
  const mobileColumns = columns.filter((c) => !c.hideOnMobile && (c.mobilePriority ?? 0) > 0)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _sortColumns = columns.filter((c) => c.sortable)

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[640px] hidden md:table">
        <thead>
          <tr className="border-b border-surface-200">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  'px-4 text-left text-xs font-semibold uppercase tracking-wide text-surface-500 whitespace-nowrap',
                  compact ? 'py-2' : 'py-3',
                  col.hideOnMobile && 'hidden md:table-cell'
                )}
              >
                {col.sortable ? (
                  <button
                    onClick={() => onSort?.(col.key)}
                    className="inline-flex items-center gap-1 hover:text-surface-700 transition-colors"
                  >
                    {col.header}
                    <SortIndicator sortBy={sortBy} sortDir={sortDir} key={col.key} />
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
                    compact ? 'px-4 py-1.5' : 'px-4 py-3',
                    'text-surface-700',
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

      <div className={cn('md:hidden', compact ? 'space-y-2' : 'space-y-3')}>
        {data.map((row) => (
          <div
            key={rowKey(row)}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={cn(
              'bg-white border border-surface-200 rounded-[12px] shadow-soft transition-shadow hover:shadow-soft-md',
              compact ? 'p-2.5' : 'p-4',
              onRowClick && 'cursor-pointer active:bg-surface-50'
            )}
          >
            {mobileCardRender ? (
              mobileCardRender(row)
            ) : (
              <>
                <div className={cn('flex items-start justify-between gap-3', compact ? 'mb-2' : 'mb-3')}>
                  <div className="min-w-0 flex-1">
                    {visibleColumns.slice(0, 2).map((col) => (
                      <div key={col.key} className="text-sm text-surface-700">
                        {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '')}
                      </div>
                    ))}
                  </div>
                  {onRowClick && <ChevronRight className="h-5 w-5 text-surface-400 shrink-0" />}
                </div>
                {mobileColumns.length > 0 && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {mobileColumns.map((col) => (
                      <div key={col.key} className="text-[11px] text-surface-500">
                        <span className="font-medium text-surface-400">{col.header}:</span>{' '}
                        {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '')}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      {data.length === 0 && emptyState}
    </div>
  )
}
