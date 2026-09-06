import { describe, it, expect } from 'vitest'
import type { BusinessType } from '@/types'
import {
  fromDashboardConfigJSON,
  getBusinessTypeConfig,
  UNIFORM_QUICK_ACTIONS,
  UNIFORM_NAV_LABELS,
  UNIFORM_KPI_CARDS,
  type DashboardConfigJSON,
} from '@/config/businessTypes'

const ALL_TYPES: BusinessType[] = [
  'hotel', 'resort', 'guesthouse', 'homestay', 'restaurant', 'cafe', 'salon',
  'beauty', 'tour_operator', 'agency', 'sari_sari', 'retail', 'service', 'other',
]

describe('uniform dashboard config', () => {
  it('gives every business type the same wording, KPIs, quick actions and nav labels', () => {
    ALL_TYPES.forEach((type) => {
      const cfg = getBusinessTypeConfig(type)
      expect(cfg.customerLabel).toBe('Customer')
      expect(cfg.bookingLabel).toBe('Booking')
      expect(cfg.orderLabel).toBe('Order')
      expect(cfg.resourceLabel).toBe('Resource')
      expect(cfg.primaryMetricLabel).toBe('Revenue')
      expect(cfg.kpiCards).toEqual(UNIFORM_KPI_CARDS)
      expect(cfg.quickActions).toEqual(UNIFORM_QUICK_ACTIONS)
      expect(cfg.navLabels).toEqual(UNIFORM_NAV_LABELS)
    })
  })

  it('only the display name varies by type', () => {
    expect(getBusinessTypeConfig('hotel').displayName).toBe('Hotel')
    expect(getBusinessTypeConfig('sari_sari').displayName).toBe('Sari-Sari Store')
    expect(getBusinessTypeConfig('other').displayName).toBe('Business')
  })

  it('ships four quick actions — customer, booking, order, task', () => {
    expect(UNIFORM_QUICK_ACTIONS.map((a) => a.id)).toEqual(['customer', 'booking', 'order', 'task'])
    UNIFORM_QUICK_ACTIONS.forEach((a) => expect(a.target).toMatch(/\?new=1$/))
  })

  it('ships no Revenue KPI card and always includes an Orders card', () => {
    expect(UNIFORM_KPI_CARDS.some((c) => c.metric === 'revenue')).toBe(false)
    expect(UNIFORM_KPI_CARDS.some((c) => c.metric === 'active_orders')).toBe(true)
  })
})

describe('fromDashboardConfigJSON', () => {
  const fallback = getBusinessTypeConfig('other')

  it('returns the fallback untouched when there is no stored config', () => {
    expect(fromDashboardConfigJSON(null, fallback)).toBe(fallback)
  })

  it('reads back only widget visibility from a stored config', () => {
    const stored = {
      kpiCards: [],
      quickActions: [{ id: 'x', label: 'Custom', target: '/x', icon: 'note' as const }],
      navLabels: { overview: 'Overview', customers: 'Patrons', bookings: 'Stays', orders: 'Tabs' },
      widgets: { insights: false, charts: false },
    } as DashboardConfigJSON

    const cfg = fromDashboardConfigJSON(stored, fallback)
    // custom quick actions / labels are ignored — everything stays uniform
    expect(cfg.quickActions).toEqual(UNIFORM_QUICK_ACTIONS)
    expect(cfg.navLabels).toEqual(UNIFORM_NAV_LABELS)
    // widget toggles are honoured
    expect(cfg.widgets).toEqual({ ...fallback.widgets, insights: false, charts: false })
  })
})
