import { Link } from 'react-router-dom'
import { UserPlus, CalendarPlus, ShoppingCart, ClipboardList, StickyNote, CreditCard, Flag } from 'lucide-react'
import type { QuickActionConfig } from '@/config/businessTypes'
import { cn } from '@/lib/cn'

const iconMap = {
  customer: UserPlus,
  booking: CalendarPlus,
  order: ShoppingCart,
  task: ClipboardList,
  note: StickyNote,
  payment: CreditCard,
  lead: Flag,
}

interface QuickActionsProps {
  actions: QuickActionConfig[]
  className?: string
}

export function QuickActions({ actions, className }: QuickActionsProps) {
  return (
    <div className={cn('flex flex-wrap gap-2.5', className)}>
      {actions.map((action) => {
        const Icon = iconMap[action.icon] ?? ClipboardList
        const isRoute = action.target.startsWith('/')
        const buttonClasses =
          'inline-flex items-center gap-2 rounded-[10px] border border-surface-200 bg-white px-3.5 py-2.5 text-sm font-medium text-surface-700 shadow-soft transition-colors hover:bg-surface-50 hover:border-surface-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7b6bf2]'
        const content = (
          <>
            <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-[#ede9fe] text-[#6a5ce0]">
              <Icon className="h-4 w-4" />
            </span>
            {action.label}
          </>
        )
        return isRoute ? (
          <Link key={action.id} to={action.target} className={buttonClasses}>
            {content}
          </Link>
        ) : (
          <button key={action.id} className={buttonClasses} onClick={() => {}}>
            {content}
          </button>
        )
      })}
    </div>
  )
}
