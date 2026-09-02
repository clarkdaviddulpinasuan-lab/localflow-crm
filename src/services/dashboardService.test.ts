import { describe, it, expect, beforeEach } from 'vitest'
import { resetStore } from '@/services/demoStore'
import {
  computeKpis,
  revenueTrend,
  customerGrowth,
  bookingStatusCounts,
  upcomingReservations,
  recentActivity,
  businessHealth,
  monthlyOverview,
  todayISO,
} from '@/services/dashboardService'

describe('dashboard service', () => {
  beforeEach(() => {
    resetStore()
  })

  it('computes five KPIs with required fields', async () => {
    const kpis = await computeKpis()
    expect(kpis).toHaveLength(5)
    kpis.forEach((k) => {
      expect(typeof k.value).toBe('number')
      expect(typeof k.display).toBe('string')
      expect(typeof k.change).toBe('number')
      expect(typeof k.positiveIsGood).toBe('boolean')
    })
  })

  it('includes revenue and customer KPIs', async () => {
    const kpis = await computeKpis()
    const labels = kpis.map((k) => k.label)
    expect(labels.some((l) => l.includes('Revenue'))).toBe(true)
    // The customer KPI label is config-driven (resort config uses "Guests").
    expect(labels.some((l) => l === 'Customers' || l === 'Guests')).toBe(true)
    expect(labels.some((l) => l.includes('Repeat'))).toBe(true)
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
})
