import { describe, it, expect, beforeEach } from 'vitest'
import { resetStore, getStore } from '@/services/demoStore'
import {
  listFollowUps,
  createFollowUp,
  completeFollowUp,
  skipFollowUp,
  deleteFollowUp,
} from '@/services/followUpService'

describe('follow-up service', () => {
  beforeEach(() => {
    resetStore()
  })

  it('lists seeded follow-ups for the demo business', async () => {
    const res = await listFollowUps({ perPage: 100 })
    expect(res.data.length).toBeGreaterThan(0)
    expect(res.data.every((f) => f.business_id === getStore().business.id)).toBe(true)
  })

  it('creates a follow-up and records activity', async () => {
    const customer = getStore().customers[0]
    const created = await createFollowUp({ customer_id: customer.id, due_date: '2026-09-15', note: 'Check in' })
    expect(created.status).toBe('pending')
    expect(getStore().followUps.some((f) => f.id === created.id)).toBe(true)
    expect(getStore().activities[0].entity_type).toBe('follow_up')
  })

  it('completes and skips follow-ups', async () => {
    const customer = getStore().customers[0]
    const created = await createFollowUp({ customer_id: customer.id, due_date: '2026-09-15' })
    const done = await completeFollowUp(created.id)
    expect(done.status).toBe('completed')
    expect(done.completed_at).toBeTruthy()
    const skipped = await skipFollowUp(created.id)
    expect(skipped.status).toBe('skipped')
    expect(skipped.completed_at).toBeFalsy()
  })

  it('filters by customer and deletes a follow-up', async () => {
    const customer = getStore().customers[0]
    await createFollowUp({ customer_id: customer.id, due_date: '2026-09-20' })
    const res = await listFollowUps({ filters: { customer_id: customer.id }, perPage: 100 })
    expect(res.data.length).toBeGreaterThan(0)
    const before = res.data.length
    await deleteFollowUp(res.data[0].id)
    const after = await listFollowUps({ filters: { customer_id: customer.id }, perPage: 100 })
    expect(after.data.length).toBe(before - 1)
  })
})