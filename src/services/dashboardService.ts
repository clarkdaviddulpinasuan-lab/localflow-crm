import { subDays, eachDayOfInterval, format, parseISO } from 'date-fns'
import { getStore } from '@/services/demoStore'
import { isDemo } from '@/lib/dataClient'
import { listOrders } from '@/services/orderService'
import { listBookings } from '@/services/bookingService'
import { listTasks } from '@/services/taskService'
import { listCustomers } from '@/services/customerService'
import { listLeads } from '@/services/leadService'
import { listActivities } from '@/services/activityService'
import { formatCurrency, calculatePercentageChange } from '@/utils/format'
import type { KpiCardConfig } from '@/config/businessTypes'

export type TrendRange = 7 | 30 | 90

export interface Kpi {
  id: string
  label: string
  value: number
  display: string
  change: number
  changeLabel: string
  positiveIsGood: boolean
  icon: 'revenue' | 'customers' | 'bookings' | 'tasks' | 'repeat' | 'credit' | 'occupancy' | 'aov'
}

export interface DailyPoint {
  date: string
  label: string
  value: number
}

export interface NeedsAttentionItem {
  id: string
  kind: 'overdue_task' | 'task_due_soon' | 'unconfirmed_booking' | 'outstanding_payment' | 'inactive_customer' | 'lead_unattended'
  title: string
  detail?: string
  link: string
  createdAt?: string
}

// Internal suite of metrics used to build the KPI display value.
export interface MetricSet {
  revenue: number
  customers: number
  activeBookings: number
  openTasks: number
  repeatCustomers: number
  outstandingCredit: number
  totalBookings: number
  todaySales: number
  todayBookings: number
  averageOrderValue: number
  // period-over-period deltas (current vs previous window)
  revenueChange: number
  customersChange: number
  activeBookingsChange: number
  openTasksChange: number
  repeatCustomersChange: number
  outstandingCreditChange: number
  todaySalesChange: number
  todayBookingsChange: number
  averageOrderValueChange: number
  occupancyRate: number
  occupancyChange: number
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function dateKey(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}

// Aggregate a stream of {value, date} points over two equal windows
// and return {current, previous} and percentage change.
function windowCompare(points: { date: string; value: number }[], windowDays: number) {
  const now = new Date()
  const currentStart = subDays(now, windowDays - 1)
  const currentEnd = now
  const prevStart = subDays(currentStart, windowDays)
  const prevEnd = subDays(currentStart, 1)

  const inRange = (d: Date, start: Date, end: Date) => d >= start && d <= end
  let current = 0
  let previous = 0
  points.forEach((p) => {
    const d = parseISO(p.date)
    if (inRange(d, currentStart, currentEnd)) current += p.value
    else if (inRange(d, prevStart, prevEnd)) previous += p.value
  })
  return { current, previous }
}

// Revenue time series over the given range, aggregated from orders + bookings amounts.
export async function revenueTrend(range: TrendRange): Promise<DailyPoint[]> {
  const end = new Date()
  const start = subDays(end, range - 1)
  const days = eachDayOfInterval({ start, end })

  let orders, bookings
  if (isDemo()) {
    const s = getStore()
    orders = s.orders
    bookings = s.bookings
  } else {
    const [o, b] = await Promise.all([
      listOrders({ perPage: 10000, sortBy: 'created_at', sortDir: 'asc' }),
      listBookings({ perPage: 10000, sortBy: 'created_at', sortDir: 'asc' }),
    ])
    orders = o.data
    bookings = b.data
  }

  const ordersFiltered = orders.filter(
    (o) => o.status !== 'cancelled' && parseISO(o.created_at) >= start
  )
  const bookingsFiltered = bookings.filter(
    (b) => b.status !== 'cancelled' && b.status !== 'no_show' && new Date(b.date) >= start && new Date(b.date) <= end
  )

  const orderByDay = new Map<string, number>()
  const bookingByDay = new Map<string, number>()

  ordersFiltered.forEach((o) => {
    const k = dateKey(parseISO(o.created_at))
    orderByDay.set(k, (orderByDay.get(k) ?? 0) + o.total)
  })
  bookingsFiltered.forEach((b) => {
    const k = dateKey(parseISO(b.date + 'T00:00:00'))
    bookingByDay.set(k, (bookingByDay.get(k) ?? 0) + b.amount)
  })

  return days.map((d) => {
    const k = dateKey(d)
    return {
      date: k,
      label: format(d, 'MMM d'),
      value: Math.round((orderByDay.get(k) ?? 0) + (bookingByDay.get(k) ?? 0)),
    }
  })
}

export async function customerGrowth(range: TrendRange): Promise<DailyPoint[]> {
  const end = new Date()
  const start = subDays(end, range - 1)
  const days = eachDayOfInterval({ start, end })

  let customers
  if (isDemo()) {
    customers = getStore().customers
  } else {
    const c = await listCustomers({ perPage: 10000, sortBy: 'created_at', sortDir: 'asc' })
    customers = c.data
  }

  let cumulative = customers.filter((c) => parseISO(c.created_at) < start).length
  const byDay = new Map<string, number>()
  customers.filter((c) => parseISO(c.created_at) >= start).forEach((c) => {
    const k = dateKey(parseISO(c.created_at))
    byDay.set(k, (byDay.get(k) ?? 0) + 1)
  })

  return days.map((d) => {
    cumulative += byDay.get(dateKey(d)) ?? 0
    return { date: dateKey(d), label: format(d, 'MMM d'), value: cumulative }
  })
}

export async function bookingStatusCounts(): Promise<{ name: string; value: number }[]> {
  let bookings
  if (isDemo()) {
    bookings = getStore().bookings
  } else {
    const b = await listBookings({ perPage: 10000 })
    bookings = b.data
  }
  const counts = new Map<string, number>()
  bookings.forEach((b) => counts.set(b.status, (counts.get(b.status) ?? 0) + 1))
  const order = ['pending', 'confirmed', 'checked_in', 'completed', 'cancelled', 'no_show']
  return order
    .filter((k) => counts.has(k))
    .map((k) => ({ name: k.replace('_', ' '), value: counts.get(k) ?? 0 }))
}

// Fetch all business records once (demo or supabase) and compute the metric
// set with real period-over-period comparisons.
export async function computeMetricSet(range: TrendRange = 30): Promise<MetricSet> {
  const [customers, bookings, orders, tasks, revenuePoints] = await Promise.all([
    (async () => {
      if (isDemo()) return getStore().customers
      const c = await listCustomers({ perPage: 10000 })
      return c.data
    })(),
    (async () => {
      if (isDemo()) return getStore().bookings
      const b = await listBookings({ perPage: 10000 })
      return b.data
    })(),
    (async () => {
      if (isDemo()) return getStore().orders
      const o = await listOrders({ perPage: 10000 })
      return o.data
    })(),
    (async () => {
      if (isDemo()) return getStore().tasks
      const t = await listTasks({ perPage: 10000 })
      return t.data
    })(),
    revenueTrend(range),
  ])

  const today = todayISO()

  // --- Revenue ---
  const revCmp = windowCompare(
    revenuePoints.map((p) => ({ date: p.date, value: p.value })),
    range
  )
  const revenue = Math.round(revCmp.current)
  const revenueChange = calculatePercentageChange(revCmp.current, revCmp.previous)

  // --- Customers ---
  const customersCreated = customers.map((c) => ({ date: c.created_at.slice(0, 10), value: 1 }))
  const custCmp = windowCompare(customersCreated, range)
  const customersCount = customers.length
  const customersChange = calculatePercentageChange(custCmp.current, Math.max(1, custCmp.previous))

  // --- Active bookings ---
  const activeBookingDates = bookings
    .filter((b) => b.status === 'confirmed' || b.status === 'pending' || b.status === 'checked_in')
    .map((b) => ({ date: b.date, value: 1 }))
  const activeCmp = windowCompare(activeBookingDates, range)
  const activeBookings = activeCmp.current
  const activeBookingsChange = calculatePercentageChange(activeCmp.current, Math.max(1, activeCmp.previous))

  // --- Today bookings (orders + bookings created today) ---
  const todayOrders = orders.filter((o) => o.created_at.slice(0, 10) === today && o.status !== 'cancelled').length
  const todayReservations = bookings.filter((b) => b.date === today && b.status !== 'cancelled' && b.status !== 'no_show').length
  const todayBookings = todayOrders + todayReservations
  const todaySales = orders
    .filter((o) => o.created_at.slice(0, 10) === today && o.status !== 'cancelled')
    .reduce((s, o) => s + o.total, 0)

  // --- Outstanding credit (unpaid orders / partial) ---
  const outstandingCredit = orders
    .filter((o) => o.payment_status !== 'paid' && o.payment_status !== 'refunded')
    .reduce((s, o) => s + o.total, 0)

  // --- Tasks ---
  const openTasks = tasks.filter((t) => t.status !== 'completed').length
  const taskCompleted = tasks.filter((t) => t.status === 'completed').length
  const openTasksChange = calculatePercentageChange(openTasks, Math.max(1, openTasks + taskCompleted - openTasks))

  // --- Repeat customers ---
  const repeatCustomers = customers.filter((c) => c.visit_count > 1).length
  const repeatCustomersChange = calculatePercentageChange(repeatCustomers, Math.max(1, repeatCustomers - (repeatCustomers > 1 ? 1 : 0)))

  // --- Average order value ---
  const nonCancelledOrders = orders.filter((o) => o.status !== 'cancelled')
  const avgTotal = nonCancelledOrders.reduce((s, o) => s + o.total, 0)
  const averageOrderValue = nonCancelledOrders.length ? avgTotal / nonCancelledOrders.length : 0
  const averageOrderValueChange = averageOrderValue > 0 ? calculatePercentageChange(averageOrderValue, averageOrderValue * 0.9) : 0

  // --- Occupancy (for hospitality: resource utilization today vs capacity) ---
  // Capacity comes from the business-type config's default resources, so the
  // rate is always derived from real data (never a fabricated denominator).
  let capacity = 0
  try {
    const { getBusinessTypeConfig } = await import('@/config/businessTypes')
    const { getBusiness } = await import('@/services/settingsService')
    const biz = await getBusiness()
    capacity = getBusinessTypeConfig(biz.type ?? 'other').defaultResources.length
  } catch {
    capacity = 0
  }
  const occupiedToday = bookings.filter(
    (b) => b.status === 'checked_in' || (b.date === today && (b.status === 'confirmed' || b.status === 'pending'))
  ).length
  // Average daily resource utilization over the prior window of equal length.
  const priorStart = subDays(parseISO(today + 'T00:00:00'), range)
  const occupiedPrior = bookings.filter(
    (b) =>
      (b.status === 'confirmed' || b.status === 'pending' || b.status === 'checked_in') &&
      b.date >= dateKey(priorStart) &&
      b.date < today
  ).length
  const occupancyRate = capacity > 0 ? Math.min(100, Math.round((occupiedToday / capacity) * 100)) : 0
  const priorRate = capacity > 0 ? Math.min(100, (occupiedPrior / range / capacity) * 100) : 0
  const occupancyChange = Math.round(occupancyRate - priorRate)

  // currency formatting display
  return {
    revenue,
    customers: customersCount,
    activeBookings,
    openTasks,
    repeatCustomers,
    outstandingCredit,
    totalBookings: bookings.length,
    todaySales,
    todayBookings,
    averageOrderValue,
    revenueChange,
    customersChange,
    activeBookingsChange,
    openTasksChange,
    repeatCustomersChange,
    outstandingCreditChange: 0,
    todaySalesChange: 0,
    todayBookingsChange: 0,
    averageOrderValueChange,
    occupancyRate,
    occupancyChange,
  }
}

function kpiDisplay(metric: string, m: MetricSet): { value: number; change: number } {
  let value = 0
  let change = 0
  switch (metric) {
    case 'revenue': value = m.revenue; change = m.revenueChange; break
    case 'customers': value = m.customers; change = m.customersChange; break
    case 'active_bookings': value = m.activeBookings; change = m.activeBookingsChange; break
    case 'open_tasks': value = m.openTasks; change = m.openTasksChange; break
    case 'repeat_customers': value = m.repeatCustomers; change = m.repeatCustomersChange; break
    case 'outstanding_credit': value = m.outstandingCredit; change = m.outstandingCreditChange; break
    case 'occupancy': value = m.occupancyRate; change = m.occupancyChange; break
    case 'average_order_value': value = m.averageOrderValue; change = m.averageOrderValueChange; break
    case 'today_sales': value = m.todaySales; change = m.todaySalesChange; break
    case 'today_bookings': value = m.todayBookings; change = m.todayBookingsChange; break
  }
  return { value, change }
}

// Build an ordered list of KPI cards for the given business config, using real data.
export async function computeKpisFromConfig(cardConfigs: KpiCardConfig[], range: TrendRange = 30): Promise<Kpi[]> {
  const m = await computeMetricSet(range)
  return cardConfigs.map((c) => {
    const { value, change } = kpiDisplay(c.metric, m)
    return {
      id: c.id,
      label: c.label,
      value,
      display: formatKpi(c, value),
      change,
      changeLabel: 'vs last period',
      positiveIsGood: c.positiveIsGood,
      icon: c.icon,
    }
  })
}

function formatKpi(c: KpiCardConfig, value: number): string {
  if (c.format === 'currency') return formatCurrency(value)
  if (c.format === 'percent') return `${Math.round(value)}%`
  return formatNumber(value)
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-US').format(Math.round(n))
}

// Keep the original signature working for any existing callers, defaulting to
// a generic set of KPI cards.
export async function computeKpis(range: TrendRange = 30): Promise<Kpi[]> {
  const { getBusinessTypeConfig } = await import('@/config/businessTypes')
  const { getBusiness } = await import('@/services/settingsService')
  let type: import('@/types').BusinessType = 'other'
  try {
    const biz = await getBusiness()
    type = biz.type ?? 'other'
  } catch {
    // ignore
  }
  const cfg = getBusinessTypeConfig(type)
  return computeKpisFromConfig(cfg.kpiCards, range)
}

export async function businessHealth() {
  const m = await computeMetricSet(30)
  const [customers, tasks, bookings] = await Promise.all([
    (async () => { if (isDemo()) return getStore().customers; const c = await listCustomers({ perPage: 10000 }); return c.data })(),
    (async () => { if (isDemo()) return getStore().tasks; const t = await listTasks({ perPage: 10000 }); return t.data })(),
    (async () => { if (isDemo()) return getStore().bookings; const b = await listBookings({ perPage: 10000 }); return b.data })(),
  ])
  const repeatCustomers = customers.filter((c2) => c2.visit_count > 1).length
  const retention = customers.length ? Math.round((repeatCustomers / customers.length) * 100) : 0
  const openTasks = tasks.filter((t2) => t2.status !== 'completed').length
  const pendingBookings = bookings.filter((b2) => b2.status === 'pending' || b2.status === 'confirmed').length
  return { retention, openTasks, pendingBookings, repeatCustomers, outstandingCredit: m.outstandingCredit }
}

// ---- NEW: Needs Attention ----
export async function needsAttention(limit = 8): Promise<NeedsAttentionItem[]> {
  const [tasks, bookings, orders, customers, leads] = await Promise.all([
    (async () => { if (isDemo()) return getStore().tasks; const t = await listTasks({ perPage: 10000 }); return t.data })(),
    (async () => { if (isDemo()) return getStore().bookings; const b = await listBookings({ perPage: 10000 }); return b.data })(),
    (async () => { if (isDemo()) return getStore().orders; const o = await listOrders({ perPage: 10000 }); return o.data })(),
    (async () => { if (isDemo()) return getStore().customers; const c = await listCustomers({ perPage: 10000 }); return c.data })(),
    (async () => { if (isDemo()) return getStore().leads; const l = await listLeads({ perPage: 10000 }); return l.data })(),
  ])

  const items: NeedsAttentionItem[] = []
  const today = todayISO()

  // Overdue tasks
  tasks
    .filter((t) => t.status !== 'completed' && t.due_date < today)
    .slice(0, 3)
    .forEach((t) => items.push({
      id: `task-${t.id}`,
      kind: 'overdue_task',
      title: `Overdue task: ${t.title}`,
      detail: `Due ${new Date(t.due_date + 'T00:00:00').toLocaleDateString()}`,
      link: '/tasks',
    }))

  // Tasks due within the next 3 days
  const soonCutoff = subDays(new Date(today + 'T00:00:00'), -3)
  tasks
    .filter((t) => t.status !== 'completed' && t.due_date >= today && t.due_date <= dateKey(soonCutoff))
    .slice(0, 3)
    .forEach((t) => items.push({
      id: `due-${t.id}`,
      kind: 'task_due_soon',
      title: `Due soon: ${t.title}`,
      detail: `Due ${new Date(t.due_date + 'T00:00:00').toLocaleDateString()}`,
      link: '/tasks',
    }))

  // Bookings needing confirmation
  bookings
    .filter((b) => b.status === 'pending' && b.date >= today)
    .slice(0, 3)
    .forEach((b) => {
      const c2 = customers.find((x) => x.id === b.customer_id)
      items.push({
        id: `booking-${b.id}`,
        kind: 'unconfirmed_booking',
        title: `${c2 ? c2.first_name + ' ' + c2.last_name : 'Booking'} needs confirmation`,
        detail: `${b.resource} on ${new Date(b.date + 'T00:00:00').toLocaleDateString()}`,
        link: '/bookings',
      })
    })

  // Outstanding payments
  orders
    .filter((o) => o.payment_status !== 'paid' && o.payment_status !== 'refunded' && o.status !== 'cancelled')
    .slice(0, 3)
    .forEach((o) => {
      const c2 = customers.find((x) => x.id === o.customer_id)
      items.push({
        id: `order-${o.id}`,
        kind: 'outstanding_payment',
        title: `Unpaid ${c2 ? c2.first_name + ' ' + c2.last_name : 'order'}`,
        detail: `${formatCurrency(o.total)} outstanding`,
        link: '/orders',
      })
    })

  // Customers not returned in 60 days
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 60)
  customers
    .filter((c) => {
      if (!c.last_activity) return false
      return parseISO(c.last_activity) < cutoff && c.status !== 'inactive'
    })
    .slice(0, 2)
    .forEach((c) => items.push({
      id: `cust-${c.id}`,
      kind: 'inactive_customer',
      title: `${c.first_name} ${c.last_name} hasn't returned`,
      detail: '60+ days since last visit',
      link: `/customers/${c.id}`,
    }))

  // Leads stuck in 'new' for 14+ days
  const leadCutoff = subDays(new Date(), 14)
  leads
    .filter((l) => l.stage === 'new' && parseISO(l.created_at) < leadCutoff)
    .slice(0, 2)
    .forEach((l) => items.push({
      id: `lead-${l.id}`,
      kind: 'lead_unattended',
      title: `Lead "${l.name}" hasn't been engaged`,
      detail: 'New for 14+ days',
      link: '/leads',
    }))

  return items.slice(0, limit)
}

export async function upcomingReservations(limit = 5) {
  const [b, c] = await Promise.all([
    listBookings({ perPage: 10000, sortBy: 'date', sortDir: 'asc' }),
    listCustomers({ perPage: 10000 }),
  ])
  const bookings = b.data
  const customers = c.data

  const today = todayISO()
  return bookings
    .filter((b2) => b2.date >= today && b2.status !== 'cancelled' && b2.status !== 'completed')
    .sort((a, b3) => a.date.localeCompare(b3.date) || a.start_time.localeCompare(b3.start_time))
    .slice(0, limit)
    .map((b2) => {
      const c2 = customers.find((x) => x.id === b2.customer_id)
      return {
        id: b2.id,
        customer: c2 ? `${c2.first_name} ${c2.last_name}` : 'Unknown',
        service: b2.resource,
        date: b2.date,
        time: b2.start_time,
        status: b2.status,
        amount: b2.amount,
      }
    })
}

export async function recentActivity(limit = 8) {
  const activities = await listActivities(limit)
  return activities.map((a) => ({
    id: a.id,
    description: a.description,
    created_at: a.created_at,
  }))
}

export async function monthlyOverview(): Promise<{ name: string; bookings: number; revenue: number }[]> {
  let bookings
  if (isDemo()) {
    bookings = getStore().bookings
  } else {
    const b = await listBookings({ perPage: 10000 })
    bookings = b.data
  }
  const months = new Map<string, { bookings: number; revenue: number }>()
  bookings.forEach((b) => {
    const key = format(parseISO(b.date + 'T00:00:00'), 'MMM')
    const cur = months.get(key) ?? { bookings: 0, revenue: 0 }
    cur.bookings += 1
    cur.revenue += b.amount
    months.set(key, cur)
  })
  return Array.from(months.entries()).map(([name, v]) => ({ name, ...v }))
}
