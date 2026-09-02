import { Link } from 'react-router-dom'
import { AlertTriangle, CalendarClock, CreditCard, UserX, Clock, UserPlus, ChevronRight } from 'lucide-react'
import type { NeedsAttentionItem } from '@/services/dashboardService'

const kindIcon = {
  overdue_task: AlertTriangle,
  task_due_soon: Clock,
  unconfirmed_booking: CalendarClock,
  outstanding_payment: CreditCard,
  inactive_customer: UserX,
  lead_unattended: UserPlus,
}

const kindColor = {
  overdue_task: 'text-danger-600 bg-danger-50',
  task_due_soon: 'text-warning-600 bg-warning-50',
  unconfirmed_booking: 'text-warning-600 bg-warning-50',
  outstanding_payment: 'text-info-600 bg-info-50',
  inactive_customer: 'text-surface-600 bg-surface-100',
  lead_unattended: 'text-primary-600 bg-primary-50',
}

interface NeedsAttentionProps {
  items: NeedsAttentionItem[]
  loading?: boolean
}

export function NeedsAttention({ items, loading }: NeedsAttentionProps) {
  return (
    <div>
      {loading ? (
        <div className="py-6 text-center text-sm text-surface-400">Checking your workspace...</div>
      ) : items.length === 0 ? (
        <div className="py-6 text-center">
          <p className="text-sm font-medium text-surface-600">You're all caught up</p>
          <p className="text-xs text-surface-400 mt-1">Nothing needs your attention right now.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => {
            const Icon = kindIcon[item.kind]
            return (
              <li key={item.id}>
                <Link
                  to={item.link}
                  className="group flex items-center gap-3 rounded-lg border border-surface-100 bg-surface-50/60 p-3 transition-colors hover:border-surface-200 hover:bg-white"
                >
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${kindColor[item.kind]}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-surface-900">{item.title}</span>
                    {item.detail && <span className="block truncate text-xs text-surface-500">{item.detail}</span>}
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-surface-300 transition-transform group-hover:translate-x-0.5 group-hover:text-surface-500" />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
