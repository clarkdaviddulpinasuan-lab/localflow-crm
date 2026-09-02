import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search,
  CornerDownLeft,
  LayoutDashboard,
  CalendarPlus,
  Receipt,
  ListTodo,
  UserSearch,
  CarFront,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { OPEN_COMMAND_EVENT } from '@/lib/commandPalette'

type PaletteKind = 'action' | 'customer' | 'booking' | 'order' | 'task' | 'lead'

interface PaletteItem {
  kind: PaletteKind
  title: string
  subtitle?: string
  route: string
  keywords: string
  search: string
}

export interface CommandPaletteData {
  items: PaletteItem[]
}

// Built-in quick actions; resources are loaded lazily from the services layer.
const ACTION_ITEMS: Omit<PaletteItem, 'search'>[] = [
  { kind: 'action', title: 'New customer', subtitle: 'Add a customer or guest', route: '/customers?new=1', keywords: 'new add create customer guest client client' },
  { kind: 'action', title: 'New booking', subtitle: 'Create a booking or appointment', route: '/bookings?new=1', keywords: 'new add create booking appointment reservation' },
  { kind: 'action', title: 'Record a sale', subtitle: 'Add an order or sale', route: '/orders?new=1', keywords: 'new add create sale order transaction' },
  { kind: 'action', title: 'Create task', subtitle: 'Add a task to the list', route: '/tasks?new=1', keywords: 'new add create task to do follow up' },
  { kind: 'action', title: 'New lead', subtitle: 'Capture an inquiry or lead', route: '/leads?new=1', keywords: 'new add create lead inquiry pipeline' },
  { kind: 'action', title: 'Open dashboard', subtitle: 'Back to the overview', route: '/', keywords: 'overview dashboard home' },
  { kind: 'action', title: 'View reports', subtitle: 'Analytics and trends', route: '/reports', keywords: 'reports analytics insights trends' },
  { kind: 'action', title: 'Open calendar', subtitle: 'Upcoming bookings by day', route: '/calendar', keywords: 'calendar schedule agenda' },
  { kind: 'action', title: 'Team and staff', subtitle: 'Manage team members', route: '/team', keywords: 'team staff members people' },
  { kind: 'action', title: 'My profile', subtitle: 'Personal profile settings', route: '/profile', keywords: 'profile account me' },
  { kind: 'action', title: 'Business profile', subtitle: 'Business details and branding', route: '/business', keywords: 'business workspace branding settings' },
  { kind: 'action', title: 'App settings', subtitle: 'Preferences and options', route: '/settings', keywords: 'settings preferences options' },
  { kind: 'action', title: 'View activity', subtitle: 'Recent system activity', route: '/activity', keywords: 'activity audit log history' },
  { kind: 'action', title: 'View notifications', subtitle: 'Your notification inbox', route: '/notifications', keywords: 'notifications alerts bell inbox' },
]

const KIND_ICON: Record<PaletteKind, typeof Search> = {
  action: LayoutDashboard,
  customer: UserSearch,
  booking: CalendarPlus,
  order: Receipt,
  task: ListTodo,
  lead: CarFront,
}

const KIND_GROUP: Record<PaletteKind, string> = {
  action: 'Actions',
  customer: 'Customers',
  booking: 'Bookings',
  order: 'Orders',
  task: 'Tasks',
  lead: 'Leads',
}

async function loadResourceItems(): Promise<PaletteItem[]> {
  const [{ listCustomers }, { listBookings }, { listOrders }, { listTasks }, { listLeads }] = await Promise.all([
    import('@/services/customerService'),
    import('@/services/bookingService'),
    import('@/services/orderService'),
    import('@/services/taskService'),
    import('@/services/leadService'),
  ])

  const [customersRes, bookingsRes, ordersRes, tasksRes, leadsRes] = await Promise.all([
    listCustomers({ perPage: 100 }),
    listBookings({ perPage: 50 }),
    listOrders({ perPage: 50 }),
    listTasks({ perPage: 50 }),
    listLeads({ perPage: 50 }),
  ])

  const customers = customersRes.data
  const customerName = new Map(customers.map((c) => [c.id, `${c.first_name} ${c.last_name}`]))

  const toItems = <T extends { kind: PaletteKind; route: string; title: string; subtitle?: string }>(
    raw: (T & { search: string })[]
  ): PaletteItem[] =>
    raw.map((i) => ({
      kind: i.kind,
      route: i.route,
      title: i.title,
      subtitle: i.subtitle,
      keywords: '',
      search: `${i.title} ${i.subtitle ?? ''} ${i.search}`.toLowerCase(),
    }))

  return toItems([
    ...customers.map((c) => ({
      kind: 'customer' as const,
      title: `${c.first_name} ${c.last_name}`,
      subtitle: `${c.status} ${c.type}`,
      route: `/customers/${c.id}`,
      search: `${c.first_name} ${c.last_name} ${c.email ?? ''} ${c.phone ?? ''} ${c.status} ${c.type}`,
    })),
    ...bookingsRes.data.map((b) => ({
      kind: 'booking' as const,
      title: `${customerName.get(b.customer_id) ?? b.customer_id}`,
      subtitle: `${b.resource} • ${b.date} • ${b.start_time} • ${b.status}`,
      route: '/bookings',
      search: `${customerName.get(b.customer_id) ?? ''} ${b.resource} ${b.date} ${b.status} booking reservation appointment`,
    })),
    ...ordersRes.data.map((o) => ({
      kind: 'order' as const,
      title: o.order_number,
      subtitle: `${customerName.get(o.customer_id) ?? o.customer_id} • ${o.status} • ${o.total}`,
      route: '/orders',
      search: `${o.order_number} ${customerName.get(o.customer_id) ?? ''} ${o.status} ${o.description ?? ''} sale order`,
    })),
    ...tasksRes.data.map((t) => ({
      kind: 'task' as const,
      title: t.title,
      subtitle: `${t.status} • ${t.priority} • due ${t.due_date}`,
      route: '/tasks',
      search: `${t.title} ${t.description ?? ''} ${t.status} ${t.priority} task`,
    })),
    ...leadsRes.data.map((l) => ({
      kind: 'lead' as const,
      title: l.name,
      subtitle: `${l.stage} • ${l.company ?? 'No company'} • ${l.estimated_value}`,
      route: '/leads',
      search: `${l.name} ${l.company ?? ''} ${l.email ?? ''} ${l.phone ?? ''} ${l.stage} lead pipeline`,
    })),
  ])
}

function matchItems(items: PaletteItem[], raw: string): PaletteItem[] {
  const terms = raw.toLowerCase().trim().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return items
  return items
    .filter((it) => terms.every((t) => it.search.includes(t)))
    .sort((a, b) => {
      const aPrefix = a.search.startsWith(terms[0]) ? 1 : 0
      const bPrefix = b.search.startsWith(terms[0]) ? 1 : 0
      return bPrefix - aPrefix || a.title.localeCompare(b.title)
    })
}

function itemKey(it: PaletteItem): string {
  return `${it.kind}-${it.title}-${it.subtitle ?? ''}`
}

export function CommandPalette() {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [items, setItems] = useState<PaletteItem[]>([])
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((v) => {
          if (!v) {
            setQuery('')
            setActiveIndex(0)
            setLoading(true)
          }
          return !v
        })
      } else if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    function onOpen() {
      setQuery('')
      setActiveIndex(0)
      setLoading(true)
      setOpen(true)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener(OPEN_COMMAND_EVENT, onOpen)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener(OPEN_COMMAND_EVENT, onOpen)
    }
  }, [])

  useEffect(() => {
    if (!open || loaded) return
    Promise.all([loadResourceItems()])
      .then(([resourceItems]) => {
        setItems([
          ...ACTION_ITEMS.map((a) => ({ ...a, search: `${a.title} ${a.subtitle ?? ''} ${a.keywords}`.toLowerCase() })),
          ...resourceItems,
        ])
        setLoaded(true)
      })
      .catch(() => {
        setItems(ACTION_ITEMS.map((a) => ({ ...a, search: `${a.title} ${a.subtitle ?? ''} ${a.keywords}`.toLowerCase() })))
      })
      .finally(() => setLoading(false))
  }, [open, loaded])

  const groups = useMemo(() => {
    const matched = matchItems(items, query)
    const order: PaletteKind[] = ['action', 'customer', 'booking', 'order', 'task', 'lead']
    const grouped: { label: string; entries: PaletteItem[] }[] = []
    for (const kind of order) {
      const entries = matched.filter((it) => it.kind === kind)
      if (entries.length === 0) continue
      grouped.push({ label: KIND_GROUP[kind], entries })
    }
    return grouped
  }, [items, query])

  const flat = useMemo(() => groups.flatMap((g) => g.entries), [groups])

  function close() {
    setOpen(false)
    setQuery('')
  }

  function run(it: PaletteItem) {
    close()
    navigate(it.route)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4">
      <div className="fixed inset-0 bg-surface-900/40 backdrop-blur-sm" onClick={close} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="relative w-full max-w-xl rounded-2xl border border-surface-200 bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActiveIndex((i) => Math.min(flat.length - 1, i + 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActiveIndex((i) => Math.max(0, i - 1))
          } else if (e.key === 'Enter') {
            e.preventDefault()
            const it = flat[activeIndex]
            if (it) run(it)
          }
        }}
      >
        <div className="flex items-center gap-3 px-4 border-b border-surface-100">
          <Search className="h-4 w-4 text-surface-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActiveIndex(0)
            }}
            placeholder="Type to search customers, bookings, tasks…"
            className="w-full py-3.5 text-sm text-surface-900 placeholder:text-surface-400 bg-transparent focus:outline-none"
            autoFocus
          />
          <kbd className="hidden sm:inline-flex items-center h-6 px-1.5 rounded-md border border-surface-200 bg-surface-50 text-[11px] text-surface-400">
            ESC
          </kbd>
        </div>

        <div className="max-h-[50vh] overflow-y-auto p-2">
          {loading ? (
            <div className="px-3 py-8 text-center text-sm text-surface-500">Loading workspace…</div>
          ) : flat.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-surface-500">
              No results for “{query}”.
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.label} className="py-1.5">
                <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-surface-400">
                  {group.label}
                </p>
                <ul>
                  {group.entries.map((it) => {
                    const idx = flat.indexOf(it)
                    const Icon = KIND_ICON[it.kind]
                    const active = idx === activeIndex
                    return (
                      <li key={itemKey(it)}>
                        <button
                          onMouseEnter={() => setActiveIndex(idx)}
                          onClick={() => run(it)}
                          className={cn(
                            'flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors',
                            active ? 'bg-primary-50 text-primary-900' : 'text-surface-700'
                          )}
                        >
                          <span
                            className={cn(
                              'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                              active ? 'bg-primary-100 text-primary-600' : 'bg-surface-100 text-surface-500'
                            )}
                          >
                            <Icon className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium truncate">{it.title}</span>
                            {it.subtitle && (
                              <span className="block text-xs text-surface-500 truncate">{it.subtitle}</span>
                            )}
                          </span>
                          {active && <CornerDownLeft className="h-4 w-4 text-primary-400 shrink-0" />}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}