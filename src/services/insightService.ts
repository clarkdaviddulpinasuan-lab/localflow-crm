import { subDays, parseISO, isWithinInterval } from 'date-fns'
import { getStore } from '@/services/demoStore'
import { isDemo } from '@/lib/dataClient'
import { listCustomers } from '@/services/customerService'
import { listBookings } from '@/services/bookingService'
import { listTasks } from '@/services/taskService'
import { businessHealth, revenueTrend, type TrendRange, type DailyPoint } from '@/services/dashboardService'
import { formatCurrency, calculatePercentageChange } from '@/utils/format'

export interface Insight {
  id: string
  severity: 'positive' | 'caution' | 'info'
  title: string
  detail: string
  link?: string
}

interface InsightFnInput {
  windowDays: number
  openTasks: number
  overdueTasks: number
  repeatCustomers: number
  pendingBookings: number
  outstandingCredit: number
  customersTotal: number
  customersNewThisWindow: number
  inactiveCustomers: number
  upcomingBookings: number
  upcomingValue: number
  revenue: { current: number; previous: number }
  busyDay: { date: string; count: number } | null
}

function windowSums(points: DailyPoint[], windowDays: number) {
  const now = new Date()
  const currentStart = subDays(now, windowDays - 1)
  const prevStart = subDays(currentStart, windowDays)
  const prevEnd = subDays(currentStart, 1)
  let current = 0
  let previous = 0
  points.forEach((p) => {
    const d = parseISO(p.date)
    if (isWithinInterval(d, { start: currentStart, end: now })) current += p.value
    else if (isWithinInterval(d, { start: prevStart, end: prevEnd })) previous += p.value
  })
  return { current, previous }
}

export async function generateInsights(windowDays: TrendRange = 30): Promise<Insight[]> {
  const [customers, bookings, tasks, health, revenuePoints] = await Promise.all([
    (async () => { if (isDemo()) return getStore().customers; const r = await listCustomers({ perPage: 10000 }); return r.data })(),
    (async () => { if (isDemo()) return getStore().bookings; const r = await listBookings({ perPage: 10000 }); return r.data })(),
    (async () => { if (isDemo()) return getStore().tasks; const r = await listTasks({ perPage: 10000 }); return r.data })(),
    businessHealth(),
    revenueTrend(windowDays),
  ])

  const today = new Date()

  const input: InsightFnInput = {
    windowDays,
    openTasks: health.openTasks,
    overdueTasks: tasks.filter((t) => t.status !== 'completed' && t.due_date < todayISO()).length,
    repeatCustomers: health.repeatCustomers,
    pendingBookings: health.pendingBookings,
    outstandingCredit: health.outstandingCredit,
    customersTotal: customers.length,
    customersNewThisWindow: customers.filter((c) => {
      const d = parseISO(c.created_at)
      return isWithinInterval(d, { start: subDays(today, windowDays - 1), end: today })
    }).length,
    inactiveCustomers: customers.filter((c) => c.status !== 'inactive' && parseISO(c.last_activity) < subDays(today, 60)).length,
    upcomingBookings: bookings.filter((b) => b.status !== 'cancelled' && b.status !== 'completed' && parseISO(b.date + 'T00:00:00') >= today).length,
    upcomingValue: bookings
      .filter((b) => b.status !== 'cancelled' && b.status !== 'completed' && parseISO(b.date + 'T00:00:00') >= today)
      .reduce((sum, b) => sum + b.amount, 0),
    revenue: windowSums(revenuePoints, windowDays),
    busyDay: busiestDay(bookings, windowDays),
  }

  return buildInsights(input)
}

function buildInsights(input: InsightFnInput): Insight[] {
  const totalRecords = input.customersTotal + input.upcomingBookings
  const hasBusiness = totalRecords >= 3 || input.customersNewThisWindow > 0

  if (!hasBusiness) {
    return [{
      id: 'insufficient_data',
      severity: 'info',
      title: 'Not enough data to generate insights yet',
      detail: 'Add customers, bookings, and orders and insights will appear here automatically.',
    }]
  }

  const insights: Insight[] = []

  // Revenue momentum (current vs previous window)
  const revenueChange = calculatePercentageChange(input.revenue.current, input.revenue.previous)
  if (input.revenue.current > 0 || input.revenue.previous > 0) {
    if (revenueChange >= 10) {
      insights.push({
        id: 'revenue_momentum',
        severity: 'positive',
        title: `${formatCurrency(input.revenue.current)} in the last ${input.windowDays} days`,
        detail: `Up ${revenueChange.toFixed(0)}% from the previous ${input.windowDays} days.`,
        link: '/bookings',
      })
    } else if (revenueChange <= -10) {
      insights.push({
        id: 'revenue_slowdown',
        severity: 'caution',
        title: `Revenue is ${Math.abs(revenueChange).toFixed(0)}% lower`,
        detail: `${formatCurrency(input.revenue.current)} vs ${formatCurrency(input.revenue.previous)} in the comparison period.`,
        link: '/bookings',
      })
    }
  }

  // Repeat customer rate
  if (input.customersTotal >= 3) {
    const repeatRate = Math.round((input.repeatCustomers / input.customersTotal) * 100)
    if (repeatRate >= 35) {
      insights.push({
        id: 'repeat_rate',
        severity: 'positive',
        title: `${input.repeatCustomers} of ${input.customersTotal} customers return`,
        detail: `A ${repeatRate}% repeat rate — strong loyalty for your business.`,
        link: '/customers',
      })
    } else if (repeatRate > 0) {
      insights.push({
        id: 'repeat_rate_low',
        severity: 'info',
        title: `${input.repeatCustomers} customers have returned`,
        detail: `That's ${repeatRate}% of your customer base — re-engagement could lift it.`,
        link: '/customers',
      })
    }
  }

  // Customer acquisition this window
  if (input.customersNewThisWindow >= 3) {
    insights.push({
      id: 'customer_acquisition',
      severity: 'positive',
      title: `${input.customersNewThisWindow} new ${input.customersNewThisWindow === 1 ? 'customer' : 'customers'} added`,
      detail: `Acquired in the last ${input.windowDays} days.`,
      link: '/customers',
    })
  }

  // Inactive customers
  if (input.inactiveCustomers > 0) {
    insights.push({
      id: 'inactive_customers',
      severity: 'caution',
      title: `${input.inactiveCustomers} ${input.inactiveCustomers === 1 ? 'customer' : 'customers'} haven't returned in 60+ days`,
      detail: 'A follow-up message could bring them back.',
      link: '/customers',
    })
  }

  // Outstanding credit
  if (input.outstandingCredit > 0) {
    insights.push({
      id: 'outstanding_credit',
      severity: 'info',
      title: `${formatCurrency(input.outstandingCredit)} in outstanding credit`,
      detail: 'Collections follow-ups are worth scheduling.',
      link: '/customers',
    })
  }

  // Overdue tasks
  if (input.overdueTasks > 0) {
    insights.push({
      id: 'overdue_tasks',
      severity: 'caution',
      title: `${input.overdueTasks} ${input.overdueTasks === 1 ? 'task' : 'tasks'} are overdue`,
      detail: 'Tackle these first to keep operations on track.',
      link: '/tasks',
    })
  } else if (input.openTasks > 0) {
    insights.push({
      id: 'open_tasks',
      severity: 'info',
      title: `${input.openTasks} tasks still open`,
      detail: 'You are on top of your task load — no overdue items.',
      link: '/tasks',
    })
  }

  // Pending confirmations
  if (input.pendingBookings > 0) {
    insights.push({
      id: 'pending_confirmations',
      severity: 'info',
      title: `${input.pendingBookings} booking${input.pendingBookings === 1 ? '' : 's'} awaiting confirmation`,
      detail: 'Unconfirmed bookings risk falling through.',
      link: '/bookings',
    })
  }

  // Upcoming booked value
  if (input.upcomingBookings > 0) {
    insights.push({
      id: 'upcoming_value',
      severity: 'positive',
      title: `${formatCurrency(input.upcomingValue)} already booked ahead`,
      detail: `Across ${input.upcomingBookings} upcoming ${input.upcomingBookings === 1 ? 'booking' : 'bookings'}.`,
      link: '/bookings',
    })
  }

  // Busiest day
  if (input.busyDay) {
    insights.push({
      id: 'busiest_day',
      severity: 'info',
      title: `${input.busyDay.date} tends to be your busiest day`,
      detail: `${input.busyDay.count} bookings on that weekday in the last ${input.windowDays} days.`,
      link: '/bookings',
    })
  }

  return insights.slice(0, 6)
}

function busiestDay(bookings: { date: string; status: string }[], windowDays: number): { date: string; count: number } | null {
  const now = new Date()
  const cutoff = subDays(now, windowDays - 1)
  const counts = new Map<string, number>()
  bookings
    .filter((b) => b.status !== 'cancelled')
    .forEach((b) => {
      const d = parseISO(b.date + 'T00:00:00')
      if (d < cutoff || d > now) return
      const weekday = d.toLocaleDateString(undefined, { weekday: 'long' })
      counts.set(weekday, (counts.get(weekday) ?? 0) + 1)
    })
  let best: { date: string; count: number } | null = null
  counts.forEach((count, weekday) => {
    if (!best || count > best.count) best = { date: weekday, count }
  })
  return best
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}