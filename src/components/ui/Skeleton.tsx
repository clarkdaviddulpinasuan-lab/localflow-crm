import { cn } from '@/lib/cn'

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-surface-200',
        className
      )}
    />
  )
}

export function TableSkeleton({ rows = 5, columns = 6 }: { rows?: number; columns?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          {Array.from({ length: columns }).map((_, j) => (
            <Skeleton
              key={j}
              className={cn(
                'h-4',
                j === 0 && 'w-10',
                j === 1 && 'w-40',
                j === 2 && 'w-32',
                j === 3 && 'w-24',
                j === 4 && 'w-20',
                j === 5 && 'w-16'
              )}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

export function CardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-surface-200 p-6 space-y-3">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-3 w-20" />
    </div>
  )
}
