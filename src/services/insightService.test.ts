import { describe, it, expect, beforeEach } from 'vitest'
import { resetStore, updateStore } from '@/services/demoStore'
import { generateInsights } from '@/services/insightService'

describe('insight service', () => {
  beforeEach(() => {
    resetStore()
  })

  it('generates insights only from real store data', async () => {
    const insights = await generateInsights(30)
    expect(Array.isArray(insights)).toBe(true)
    expect(insights.length).toBeGreaterThan(0)
    insights.forEach((insight) => {
      expect(typeof insight.id).toBe('string')
      expect(typeof insight.title).toBe('string')
      expect(typeof insight.detail).toBe('string')
      expect(['positive', 'caution', 'info']).toContain(insight.severity)
    })
  })

  it('reports insufficient data for an empty business instead of fabricating', async () => {
    updateStore((s) => {
      s.customers = []
      s.bookings = []
      s.tasks = []
      s.leads = []
      s.orders = []
    })
    const insights = await generateInsights(30)
    expect(insights).toHaveLength(1)
    expect(insights[0].id).toBe('insufficient_data')
    expect(insights[0].severity).toBe('info')
  })

  it('does not emit revenue insights when there is no revenue in the window', async () => {
    const insights = await generateInsights(7)
    const ids = insights.map((i) => i.id)
    expect(ids.includes('insufficient_data')).toBe(false)
    expect(ids).not.toContain('revenue_momentum')
  })
})