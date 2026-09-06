import { describe, it, expect, beforeEach, vi } from 'vitest'
vi.mock('@/lib/supabase', () => import('@/test/supabaseMock').then((m) => ({ supabase: m.supabaseMock })))
import { resetSupabaseMock, setTable } from '@/test/supabaseMock'
import {
  computeKpis,
  revenueTrend,
  customerGrowth,
  bookingStatusCounts,
  upcomingReservations,
  recentActivity,
  businessHealth,
  monthlyOverview,
  computeMetricSet,
  paymentStatusBreakdown,
  todayISO,
} from '@/services/dashboardService'

describe('dashboard service', () => {
  beforeEach(() => {
    resetSupabaseMock()
  })

  it('computes five KPIs with required fields', async () => {
    const kpis = await computeKpis()
    expect(kpis).toHaveLength(5)
    kpis.forEach((k) => {
      expect(typeof k.value).toBe('number')
      expect(typeof k.display).toBe('string')
      expect(k.change === null || typeof k.change === 'number').toBe(true)
      expect(typeof k.positiveIsGood).toBe('boolean')
    })
  })

  it('has no revenue KPI, and counts bookings and orders separately', async () => {
    const kpis = await computeKpis()
    const labels = kpis.map((k) => k.label)
    expect(labels.some((l) => l === 'Customers' || l === 'Guests')).toBe(true)
    expect(labels.some((l) => l.includes('Repeat'))).toBe(true)
    // Revenue lives on its own card, not in the KPI row.
    expect(kpis.some((k) => k.icon === 'revenue')).toBe(false)
    // Bookings and orders are distinct cards backed by distinct tables.
    expect(kpis.some((k) => k.icon === 'bookings')).toBe(true)
    expect(kpis.some((k) => k.icon === 'orders')).toBe(true)
  })

  it('reports a measured percentage against the previous equal window', async () => {
    const at = (back: number) => {
      const d = new Date()
      d.setDate(d.getDate() - back)
      return d.toISOString()
    }
    // 3 bookings this 30d window (one on the boundary day), 2 in the one before.
    setTable('bookings', [
      { id: 'b1', date: '2026-01-01', status: 'confirmed', amount: 0, payment_status: 'paid', created_at: at(0) },
      { id: 'b2', date: '2026-01-01', status: 'completed', amount: 0, payment_status: 'paid', created_at: at(10) },
      { id: 'b3', date: '2026-01-01', status: 'confirmed', amount: 0, payment_status: 'paid', created_at: at(29) },
      { id: 'b4', date: '2026-01-01', status: 'confirmed', amount: 0, payment_status: 'paid', created_at: at(35) },
      { id: 'b5', date: '2026-01-01', status: 'confirmed', amount: 0, payment_status: 'paid', created_at: at(59) },
      { id: 'b6', date: '2026-01-01', status: 'confirmed', amount: 0, payment_status: 'paid', created_at: at(200) },
      { id: 'b7', date: '2026-01-01', status: 'cancelled', amount: 0, payment_status: 'paid', created_at: at(1) },
    ])
    setTable('orders', [])

    const m = await computeMetricSet(30)
    expect(m.activeBookings).toBe(3)
    expect(m.activeBookingsChange).toBe(50)
  })

  it('counts orders and bookings from their own tables', async () => {
    const iso = new Date().toISOString()
    const today = iso.slice(0, 10)
    setTable('bookings', [
      { id: 'b1', date: today, status: 'confirmed', amount: 10, payment_status: 'paid', created_at: iso },
      { id: 'b2', date: today, status: 'confirmed', amount: 10, payment_status: 'paid', created_at: iso },
      { id: 'b3', date: today, status: 'cancelled', amount: 10, payment_status: 'paid', created_at: iso },
    ])
    setTable('orders', [
      { id: 'o1', created_at: iso, status: 'completed', total: 10, payment_status: 'paid' },
      { id: 'o2', created_at: iso, status: 'cancelled', total: 10, payment_status: 'paid' },
    ])
    const m = await computeMetricSet(30)
    // 2 active bookings (cancelled excluded), 1 active order — never summed together.
    expect(m.activeBookings).toBe(2)
    expect(m.activeOrders).toBe(1)
  })

  it('counts what was added in the window, not what is dated in it', async () => {
    const iso = new Date().toISOString()
    const old = '2021-02-03T00:00:00Z'
    setTable('bookings', [
      // added now but dated far in the future — still counts, it was added today
      { id: 'b-future', date: '2099-01-01', status: 'confirmed', amount: 0, payment_status: 'paid', created_at: iso },
      // dated recently but added long ago — does not count
      { id: 'b-old', date: new Date().toISOString().slice(0, 10), status: 'confirmed', amount: 0, payment_status: 'paid', created_at: old },
      { id: 'b-cancelled', date: '2099-01-01', status: 'cancelled', amount: 0, payment_status: 'paid', created_at: iso },
      { id: 'b-noshow', date: '2099-01-01', status: 'no_show', amount: 0, payment_status: 'paid', created_at: iso },
    ])
    setTable('orders', [
      { id: 'o-new', created_at: iso, status: 'completed', total: 0, payment_status: 'paid' },
      { id: 'o-old', created_at: old, status: 'completed', total: 0, payment_status: 'paid' },
      { id: 'o-cancelled', created_at: iso, status: 'cancelled', total: 0, payment_status: 'paid' },
    ])

    const m = await computeMetricSet(30)
    expect(m.activeBookings).toBe(1)
    expect(m.activeOrders).toBe(1)
  })

  it('revenue trend returns daily points for the range', async () => {
    const seven = await revenueTrend(7)
    expect(seven).toHaveLength(7)
    expect(seven[0]).toHaveProperty('date')
    expect(seven[0]).toHaveProperty('label')
    expect(seven[0]).toHaveProperty('value')
    const ninety = await revenueTrend(90)
    expect(ninety).toHaveLength(90)
  })

  it('customer growth is cumulative and non-negative', async () => {
    const growth = await customerGrowth(30)
    expect(growth).toHaveLength(30)
    let prev = -1
    growth.forEach((g) => {
      expect(g.value).toBeGreaterThanOrEqual(prev)
      prev = g.value
    })
  })

  it('booking status counts sum to total bookings for valid statuses', async () => {
    const counts = await bookingStatusCounts()
    expect(counts.length).toBeGreaterThan(0)
  })

  it('upcoming reservations are sorted by date ascending and future', async () => {
    const today = todayISO()
    const upcoming = await upcomingReservations(5)
    upcoming.forEach((u) => expect(u.date >= today).toBe(true))
    for (let i = 1; i < upcoming.length; i += 1) {
      expect(upcoming[i - 1].date <= upcoming[i].date).toBe(true)
    }
  })

  it('recent activity returns most-recent-first entries', async () => {
    const activity = await recentActivity(8)
    expect(activity.length).toBeLessThanOrEqual(8)
    for (let i = 1; i < activity.length; i += 1) {
      expect(activity[i - 1].created_at >= activity[i].created_at).toBe(true)
    }
  })

  it('business health returns retention, tasks, bookings, repeat', async () => {
    const health = await businessHealth()
    expect(health).toHaveProperty('retention')
    expect(health).toHaveProperty('openTasks')
    expect(health).toHaveProperty('pendingBookings')
    expect(health).toHaveProperty('repeatCustomers')
  })

  it('monthly overview aggregates by month', async () => {
    const overview = await monthlyOverview()
    overview.forEach((m) => {
      expect(m.name).toMatch(/^[A-Z][a-z]{2}$/)
      expect(m.bookings).toBeGreaterThan(0)
      expect(m.revenue).toBeGreaterThan(0)
    })
  })

  it('payment status breakdown totals every booking + order, all time', async () => {
    const iso = new Date().toISOString()
    const today = iso.slice(0, 10)
    setTable('bookings', [
      { id: 'b1', date: today, status: 'confirmed', amount: 100, payment_status: 'paid', created_at: iso },
      { id: 'b2', date: today, status: 'confirmed', amount: 50, payment_status: 'pending', created_at: iso },
      // cancelled / no-show still count toward what was collected
      { id: 'b3', date: today, status: 'cancelled', amount: 999, payment_status: 'paid', created_at: iso },
      { id: 'b4', date: today, status: 'no_show', amount: 888, payment_status: 'paid', created_at: iso },
      // far outside any dashboard range window — must still be counted
      { id: 'b5', date: '2021-03-04', status: 'completed', amount: 1000, payment_status: 'paid', created_at: '2021-03-04T00:00:00Z' },
    ])
    setTable('orders', [
      { id: 'o1', created_at: iso, status: 'completed', total: 25, payment_status: 'partial' },
      { id: 'o2', created_at: iso, status: 'completed', total: 10, payment_status: 'refunded' },
      { id: 'o3', created_at: iso, status: 'cancelled', total: 777, payment_status: 'paid' },
      { id: 'o4', created_at: '2021-03-04T00:00:00Z', status: 'completed', total: 500, payment_status: 'paid' },
    ])

    expect(await paymentStatusBreakdown()).toEqual([
      { name: 'paid', value: 100 + 999 + 888 + 1000 + 777 + 500 },
      { name: 'partial', value: 25 },
      { name: 'pending', value: 50 },
      { name: 'refunded', value: 10 },
    ])
  })

  it('payment status breakdown pages past the 1000-row limit', async () => {
    const iso = new Date().toISOString()
    // 2500 paid bookings of 10 each => 25000, spanning three fetch pages
    setTable(
      'bookings',
      Array.from({ length: 2500 }, (_, i) => ({
        id: `bk-${i}`,
        date: iso.slice(0, 10),
        status: 'confirmed',
        amount: 10,
        payment_status: 'paid',
        created_at: iso,
      }))
    )
    setTable('orders', [])

    expect(await paymentStatusBreakdown()).toEqual([{ name: 'paid', value: 25000 }])
  })
})
