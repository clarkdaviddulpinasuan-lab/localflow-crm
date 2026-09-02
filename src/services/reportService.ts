import { subDays, parseISO, format } from 'date-fns'
import { getStore } from '@/services/demoStore'
import { isDemo } from '@/lib/dataClient'
import { listOrders } from '@/services/orderService'
import { listBookings } from '@/services/bookingService'
import { listCustomers } from '@/services/customerService'
import { listTasks } from '@/services/taskService'
import type { PaymentStatus, BookingStatus, OrderStatus } from '@/types'

export type ReportRange = '7' | '30' | '90' | 'custom'

export function rangeStart(range: ReportRange, customStart?: string, _customEnd?: string) {
  if (range === 'custom' && customStart) return parseISO(customStart)
  return subDays(new Date(), Number(range) - 1)
}

export function rangeEnd(_range: ReportRange, customEnd?: string) {
  if (customEnd) return parseISO(customEnd)
  return new Date()
}

export async function salesByDay(range: ReportRange, customStart?: string, customEnd?: string) {
  let orders
  if (isDemo()) {
    orders = getStore().orders
  } else {
    const o = await listOrders({ perPage: 10000, sortBy: 'created_at', sortDir: 'asc' })
    orders = o.data
  }
  const start = rangeStart(range, customStart, customEnd)
  const end = rangeEnd(range, customEnd)
  return orders
    .filter((o) => o.status !== 'cancelled')
    .filter((o) => parseISO(o.created_at) >= start && parseISO(o.created_at) <= end)
    .map((o) => ({ date: format(parseISO(o.created_at), 'MMM d'), total: o.total, status: o.status }))
}

export async function totalSales(range: ReportRange, customStart?: string, customEnd?: string): Promise<number> {
  return (await salesByDay(range, customStart, customEnd)).reduce((a, b) => a + b.total, 0)
}

export async function bookingsStats() {
  let bookings
  if (isDemo()) {
    bookings = getStore().bookings
  } else {
    const b = await listBookings({ perPage: 10000 })
    bookings = b.data
  }
  const byStatus = new Map<string, number>()
  const byPayment = new Map<string, number>()
  bookings.forEach((b) => {
    byStatus.set(b.status, (byStatus.get(b.status) ?? 0) + 1)
    byPayment.set(b.payment_status, (byPayment.get(b.payment_status) ?? 0) + 1)
  })
  const statusNames: BookingStatus[] = ['pending', 'confirmed', 'checked_in', 'completed', 'cancelled', 'no_show']
  const paymentNames: PaymentStatus[] = ['paid', 'pending', 'partial', 'refunded']
  return {
    byStatus: statusNames.filter((k) => byStatus.has(k)).map((k) => ({ name: k.replace('_', ' '), value: byStatus.get(k) ?? 0 })),
    byPayment: paymentNames.filter((k) => byPayment.has(k)).map((k) => ({ name: k.replace('_', ' '), value: byPayment.get(k) ?? 0 })),
    total: bookings.length,
  }
}

export async function customerStats() {
  let customers
  if (isDemo()) {
    customers = getStore().customers
  } else {
    const c = await listCustomers({ perPage: 10000 })
    customers = c.data
  }
  const byType = new Map<string, number>()
  const byStatus = new Map<string, number>()
  customers.forEach((c) => {
    byType.set(c.type, (byType.get(c.type) ?? 0) + 1)
    byStatus.set(c.status, (byStatus.get(c.status) ?? 0) + 1)
  })
  const repeat = customers.filter((c) => c.visit_count > 1).length
  const total = customers.length
  return {
    byType,
    byStatus,
    repeat,
    total,
    retentionRate: total ? Math.round((repeat / total) * 100) : 0,
    acquisition: customers.filter((c) => parseISO(c.created_at) >= subDays(new Date(), 30)).length,
  }
}

export async function taskCompletionStats() {
  let tasks
  if (isDemo()) {
    tasks = getStore().tasks
  } else {
    const t = await listTasks({ perPage: 10000 })
    tasks = t.data
  }
  const completed = tasks.filter((t) => t.status === 'completed').length
  const total = tasks.length || 1
  return {
    completed,
    total: tasks.length,
    rate: Math.round((completed / total) * 100),
  }
}

export async function ordersByStatus() {
  let orders
  if (isDemo()) {
    orders = getStore().orders
  } else {
    const o = await listOrders({ perPage: 10000 })
    orders = o.data
  }
  const byStatus = new Map<string, number>()
  const byPayment = new Map<string, number>()
  orders.forEach((o) => {
    byStatus.set(o.status, (byStatus.get(o.status) ?? 0) + 1)
    byPayment.set(o.payment_status, (byPayment.get(o.payment_status) ?? 0) + 1)
  })
  const statusNames: OrderStatus[] = ['new', 'processing', 'completed', 'cancelled']
  const paymentNames: PaymentStatus[] = ['paid', 'pending', 'partial', 'refunded']
  return {
    byStatus: statusNames.filter((k) => byStatus.has(k)).map((k) => ({ name: k.replace('_', ' '), value: byStatus.get(k) ?? 0 })),
    byPayment: paymentNames.filter((k) => byPayment.has(k)).map((k) => ({ name: k.replace('_', ' '), value: byPayment.get(k) ?? 0 })),
    total: orders.length,
  }
}

export function formatCurrencyLocal(n: number, currency = 'PHP') {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n)
}
