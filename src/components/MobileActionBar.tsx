import { Link } from 'react-router-dom'
import { UserPlus, CalendarPlus, ShoppingCart, ClipboardList, StickyNote, CreditCard, Flag } from 'lucide-react'
import type { QuickActionConfig } from '@/config/businessTypes'
import { useBusiness } from '@/contexts/BusinessContext'

const iconMap = {
  customer: UserPlus,
  booking: CalendarPlus,
  order: ShoppingCart,
  task: ClipboardList,
  note: StickyNote,
  payment: CreditCard,
  lead: Flag,
}

// A compact fixed bottom action bar shown only on small screens so staff can
// create records quickly from anywhere in the app.
export function MobileActionBar() {
  const { config } = useBusiness()
  const actions = config.quickActions.slice(0, 5)

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 border-t border-surface-200 bg-white/95 backdrop-blur lg:hidden safe-area-bottom">
      <nav className="flex items-stretch justify-around" aria-label="Quick actions">
        {actions.map((action: QuickActionConfig) => {
          const Icon = iconMap[action.icon] ?? ClipboardList
          const isRoute = action.target.startsWith('/')
          const inner = (
            <>
              <Icon className="h-5 w-5" />
              <span className="text-[10px] leading-tight">{action.label}</span>
            </>
          )
          const cls =
            'flex flex-1 flex-col items-center gap-0.5 py-2.5 text-surface-600 active:bg-surface-100 transition-colors'
          return isRoute ? (
            <Link key={action.id} to={action.target} className={cls}>
              {inner}
            </Link>
          ) : (
            <button key={action.id} onClick={() => {}} className={cls}>
              {inner}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
