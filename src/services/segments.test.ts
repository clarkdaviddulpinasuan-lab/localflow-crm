import { describe, it, expect, beforeEach } from 'vitest'
import { resetStore } from '@/services/demoStore'
import {
  computeSegmentStats,
  segmentCustomer,
  analyzeCustomers,
  SEGMENT_ORDER,
} from '@/services/segments'
import type { Customer } from '@/types'

function customer(partial: Partial<Customer>): Customer {
  return {
    id: 'c1',
    business_id: 'biz',
    first_name: 'Test',
    last_name: 'Customer',
    type: 'regular',
    status: 'active',
    total_spent: 0,
    visit_count: 0,
    last_activity: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...partial,
  }
}

const stats = computeSegmentStats([
  customer({ total_spent: 100, visit_count: 1 }),
  customer({ total_spent: 200, visit_count: 2 }),
  customer({ total_spent: 400, visit_count: 4 }),
  customer({ total_spent: 800, visit_count: 8 }),
])

describe('segments', () => {
  beforeEach(() => {
    resetStore()
  })

  it('classifies a new customer before anything else', () => {
    const c = customer({ total_spent: 0, visit_count: 0 })
    expect(segmentCustomer(c, stats)).toBe('new')
  })

  it('classifies inactive customers', () => {
    const c = customer({ status: 'inactive' })
    expect(segmentCustomer(c, stats)).toBe('inactive')
  })

  it('classifies high-value customers by spend percentile', () => {
    const c = customer({ total_spent: 1000, visit_count: 2 })
    expect(segmentCustomer(c, stats)).toBe('high_value')
  })

  it('classifies loyal regulars by visit count', () => {
    const c = customer({ total_spent: 120, visit_count: 10 })
    expect(segmentCustomer(c, stats)).toBe('loyal')
  })

  it('classifies prospects that have never visited', () => {
    const old = new Date()
    old.setDate(old.getDate() - 90)
    const c = customer({ visit_count: 0, created_at: old.toISOString(), total_spent: 0 })
    expect(segmentCustomer(c, stats)).toBe('prospect')
  })

  it('analyzeCustomers returns counts for every segment', async () => {
    const analysis = await analyzeCustomers()
    expect(analysis.customers.length).toBeGreaterThan(0)
    SEGMENT_ORDER.forEach((s) => {
      expect(typeof analysis.counts[s]).toBe('number')
    })
    const sum = SEGMENT_ORDER.reduce((acc, s) => acc + analysis.counts[s], 0)
    expect(sum).toBe(analysis.customers.length)
  })
})