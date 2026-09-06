import { subDays, eachDayOfInterval, format, parseISO, startOfDay } from 'date-fns'
import { listOrders } from '@/services/orderService'
import { listBookings } from '@/services/bookingService'
import { listTasks } from '@/services/taskService'
import { listCustomers } from '@/services/customerService'
import { listLeads } from '@/services/leadService'
import { listActivities } from '@/services/activityService'
import { formatCurrency, calculatePercentageChange } from '@/utils/format'
import type { KpiCardConfig } from '@/config/businessTypes'
import type { PaymentStatus } from '@/types'

export type TrendRange = 7 | 30 | 90

export interface Kpi {
  id: string
  label: string
  value: number
  display: string
  change: number | null
  changeLabel: string
  positiveIsGood: boolean
  icon: 'revenue' | 'customers' | 'bookings' | 'orders' | 'tasks' | 'repeat' | 'credit' | 'occupancy' | 'aov'
}

export interface DailyPoint {
  date: string
  label: string
  value: number
}

export interface PaymentStatusPoint {
  name: string
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
  activeOrders: number
  openTasks: number
  repeatCustomers: number
  outstandingCredit: number
  totalBookings: number
  todaySales: number
  todayBookings: number
  averageOrderValue: number
  occupancyRate: number
  // Real period-over-period deltas: current window vs the equal window before
  // it. Metrics with no measured comparison expose no change at all.
  customersChange: number
  activeBookingsChange: number
  activeOrdersChange: number
  openTasksChange: number
  repeatCustomersChange: number
  occupancyChange: number
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function dateKey(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}

// Count records landing in the current window and in the equal window directly
// before it, so a change figure is a real like-for-like comparison. Boundaries
// are normalised to midnight; the previous helper kept the current time-of-day
// and so silently dropped the first day of every window.
function periodCounts(dates: (string | null | undefined)[], windowDays: number): { current: number; previous: number } {
  const currentStart = subDays(startOfDay(new Date()), windowDays - 1)
  const previousStart = subDays(currentStart, windowDays)
  let current = 0
  let previous = 0
  dates.forEach((raw) => {
    if (!raw) return
    const d = startOfDay(parseISO(raw))
    if (d >= currentStart) current += 1
    else if (d >= previousStart) previous += 1
  })
  return { current, previous }
}

// Revenue time series over the given range, aggregated from orders + bookings amounts.
export async function revenueTrend(range: TrendRange): Promise<DailyPoint[]> {
  const end = new Date()
  const start = subDays(end, range - 1)
  const days = eachDayOfInterval({ start, end })

  const [o, b] = await Promise.all([
    listOrders({ perPage: 10000, sortBy: 'created_at', sortDir: 'asc' }),
    listBookings({ perPage: 10000, sortBy: 'created_at', sortDir: 'asc' }),
  ])
  const orders = o.data
  const bookings = b.data

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

// Page through a list endpoint so a server-side row cap can never silently
// truncate a total.
async function fetchAllRows<T>(
  fetchPage: (page: number, perPage: number) => Promise<{ data: T[]; total: number }>
): Promise<T[]> {
  const perPage = 1000
  const first = await fetchPage(1, perPage)
  const rows = [...first.data]
  const pages = Math.ceil(first.total / perPage)
  for (let p = 2; p <= pages; p += 1) {
    const next = await fetchPage(p, perPage)
    if (next.data.length === 0) break
    rows.push(...next.data)
  }
  return rows
}

// Combined booking + order amounts grouped by payment status, across every
// record. Deliberately unwindowed and unfiltered by booking/order status so the
// totals reconcile with the Bookings and Orders list pages.
export async function paymentStatusBreakdown(): Promise<PaymentStatusPoint[]> {
  const [orders, bookings] = await Promise.all([
    fetchAllRows((page, perPage) => listOrders({ page, perPage, sortBy: 'created_at', sortDir: 'asc' })),
    fetchAllRows((page, perPage) => listBookings({ page, perPage, sortBy: 'created_at', sortDir: 'asc' })),
  ])

  const totals: Record<PaymentStatus, number> = { paid: 0, partial: 0, pending: 0, refunded: 0 }

  orders.forEach((ord) => {
    if (ord.payment_status in totals) totals[ord.payment_status] += ord.total ?? 0
  })
  bookings.forEach((booking) => {
    if (booking.payment_status in totals) totals[booking.payment_status] += booking.amount ?? 0
  })

  const order: PaymentStatus[] = ['paid', 'partial', 'pending', 'refunded']
  return order
    .filter((k) => totals[k] > 0)
    .map((k) => ({ name: k, value: Math.round(totals[k]) }))
}

export async function customerGrowth(range: TrendRange): Promise<DailyPoint[]> {
  const end = new Date()
  const start = subDays(end, range - 1)
  const days = eachDayOfInterval({ start, end })

  const c = await listCustomers({ perPage: 10000, sortBy: 'created_at', sortDir: 'asc' })
  const customers = c.data

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
  const b = await listBookings({ perPage: 10000 })
  const bookings = b.data
  const counts = new Map<string, number>()
  bookings.forEach((b) => counts.set(b.status, (counts.get(b.status) ?? 0) + 1))
  const order = ['pending', 'confirmed', 'checked_in', 'completed', 'cancelled', 'no_show']
  return order
    .filter((k) => counts.has(k))
    .map((k) => ({ name: k.replace('_', ' '), value: counts.get(k) ?? 0 }))
}

// Fetch all business records once and compute the metric set with real
// period-over-period comparisons.
export async function computeMetricSet(range: TrendRange = 30): Promise<MetricSet> {
  const [customers, bookings, orders, tasks, revenuePoints] = await Promise.all([
    (async () => (await listCustomers({ perPage: 10000 })).data)(),
    (async () => (await listBookings({ perPage: 10000 })).data)(),
    (async () => (await listOrders({ perPage: 10000 })).data)(),
    (async () => (await listTasks({ perPage: 10000 })).data)(),
    revenueTrend(range),
  ])

  const today = todayISO()

  // --- Revenue (kept for the legacy 'revenue' metric; no preset uses it) ---
  const revenue = Math.round(
    revenuePoints.reduce((sum, p) => sum + p.value, 0)
  )

  // --- Customers added in the window ---
  const custCmp = periodCounts(customers.map((c) => c.created_at), range)
  const customersCount = custCmp.current
  const customersChange = calculatePercentageChange(custCmp.current, custCmp.previous)

  // --- Bookings and orders added in the window, kept separate. Counted by
  // created_at ("when it was added"), so a booking made now for a future date
  // still counts today. ---
  const bookingsCmp = periodCounts(
    bookings.filter((b) => b.status !== 'cancelled' && b.status !== 'no_show').map((b) => b.created_at),
    range
  )
  const activeBookings = bookingsCmp.current
  const activeBookingsChange = calculatePercentageChange(bookingsCmp.current, bookingsCmp.previous)

  const ordersCmp = periodCounts(
    orders.filter((o) => o.status !== 'cancelled').map((o) => o.created_at),
    range
  )
  const activeOrders = ordersCmp.current
  const activeOrdersChange = calculatePercentageChange(ordersCmp.current, ordersCmp.previous)

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
  const tasksCmp = periodCounts(
    tasks.filter((t) => t.status !== 'completed').map((t) => t.created_at),
    range
  )
  const openTasks = tasksCmp.current
  const openTasksChange = calculatePercentageChange(tasksCmp.current, tasksCmp.previous)

  // --- Repeat customers ---
  // Repeat customers seen in the window, dated by their last activity, so the
  // figure moves with recent trade rather than sitting at an all-time total.
  const repeatCmp = periodCounts(
    customers.filter((c) => c.visit_count > 1).map((c) => c.last_activity),
    range
  )
  const repeatCustomers = repeatCmp.current
  const repeatCustomersChange = calculatePercentageChange(repeatCmp.current, repeatCmp.previous)

  // --- Average order value ---
  const nonCancelledOrders = orders.filter((o) => o.status !== 'cancelled')
  const avgTotal = nonCancelledOrders.reduce((s, o) => s + o.total, 0)
  const averageOrderValue = nonCancelledOrders.length ? avgTotal / nonCancelledOrders.length : 0

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
    activeOrders,
    openTasks,
    repeatCustomers,
    outstandingCredit,
    totalBookings: bookings.length,
    todaySales,
    todayBookings,
    averageOrderValue,
    occupancyRate,
    customersChange,
    activeBookingsChange,
    activeOrdersChange,
    openTasksChange,
    repeatCustomersChange,
    occupancyChange,
  }
}

// How each metric is scoped, so the card can say what it is showing instead of
// implying a comparison that was never measured.
const METRIC_BASIS: Record<string, string> = {
  revenue: 'All time',
  outstanding_credit: 'All time',
  average_order_value: 'All time average',
  today_sales: 'Today',
  today_bookings: 'Today',
}

function kpiDisplay(metric: string, m: MetricSet): { value: number; change: number | null } {
  let value = 0
  // null means there is no measured comparison for this metric, so the card
  // shows its basis instead of a percentage.
  let change: number | null = null
  switch (metric) {
    case 'revenue': value = m.revenue; break
    case 'customers': value = m.customers; change = m.customersChange; break
    case 'active_bookings': value = m.activeBookings; change = m.activeBookingsChange; break
    case 'active_orders': value = m.activeOrders; change = m.activeOrdersChange; break
    case 'open_tasks': value = m.openTasks; change = m.openTasksChange; break
    case 'repeat_customers': value = m.repeatCustomers; change = m.repeatCustomersChange; break
    case 'outstanding_credit': value = m.outstandingCredit; break
    case 'occupancy': value = m.occupancyRate; change = m.occupancyChange; break
    case 'average_order_value': value = m.averageOrderValue; break
    case 'today_sales': value = m.todaySales; break
    case 'today_bookings': value = m.todayBookings; break
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
      changeLabel: METRIC_BASIS[c.metric] ?? `vs previous ${range}d`,
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
    (async () => (await listCustomers({ perPage: 10000 })).data)(),
    (async () => (await listTasks({ perPage: 10000 })).data)(),
    (async () => (await listBookings({ perPage: 10000 })).data)(),
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
    (async () => (await listTasks({ perPage: 10000 })).data)(),
    (async () => (await listBookings({ perPage: 10000 })).data)(),
    (async () => (await listOrders({ perPage: 10000 })).data)(),
    (async () => (await listCustomers({ perPage: 10000 })).data)(),
    (async () => (await listLeads({ perPage: 10000 })).data)(),
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
  const b = await listBookings({ perPage: 10000 })
  const bookings = b.data
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
