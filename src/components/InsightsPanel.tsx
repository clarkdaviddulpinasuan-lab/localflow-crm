import { TrendingUp, AlertTriangle, Info, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Insight } from '@/services/insightService'

const sevStyle = {
  positive: { icon: TrendingUp, chip: 'text-emerald-600 bg-emerald-50' },
  caution: { icon: AlertTriangle, chip: 'text-amber-600 bg-amber-50' },
  info: { icon: Info, chip: 'text-blue-600 bg-blue-50' },
} as const

interface InsightsPanelProps {
  items: Insight[]
  loading?: boolean
}

export function InsightsPanel({ items, loading }: InsightsPanelProps) {
  return (
    <div>
      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-start gap-3 rounded-lg border border-surface-100 p-3">
              <span className="h-8 w-8 shrink-0 rounded-lg bg-surface-100 animate-pulse" />
              <span className="flex-1 space-y-1.5">
                <span className="block h-3 w-3/4 rounded bg-surface-100 animate-pulse" />
                <span className="block h-2.5 w-1/2 rounded bg-surface-100 animate-pulse" />
              </span>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="py-4 text-center text-sm text-surface-400">No insights available.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((insight) => {
            const { icon: Icon, chip } = sevStyle[insight.severity]
            const body = (
              <span className="flex min-w-0 flex-1 items-center gap-3">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${chip}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-surface-900">{insight.title}</span>
                  <span className="block text-xs text-surface-500">{insight.detail}</span>
                </span>
              </span>
            )
            return (
              <li key={insight.id}>
                {insight.link ? (
                  <Link
                    to={insight.link}
                    className="group flex items-center gap-1 rounded-lg border border-surface-100 bg-surface-50/60 p-3 transition-colors hover:border-surface-200 hover:bg-white"
                  >
                    {body}
                    <ChevronRight className="h-4 w-4 shrink-0 text-surface-300 transition-transform group-hover:translate-x-0.5 group-hover:text-surface-500" />
                  </Link>
                ) : (
                  <div className="flex items-center gap-1 rounded-lg border border-surface-100 bg-surface-50/60 p-3">{body}</div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}