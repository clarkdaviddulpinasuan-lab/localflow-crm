import { describe, it, expect, beforeEach, vi } from 'vitest'
vi.mock('@/lib/supabase', () => import('@/test/supabaseMock').then((m) => ({ supabase: m.supabaseMock })))
import { resetSupabaseMock, getTable } from '@/test/supabaseMock'
import {
  listFollowUps,
  createFollowUp,
  completeFollowUp,
  skipFollowUp,
  deleteFollowUp,
} from '@/services/followUpService'

describe('follow-up service', () => {
  beforeEach(() => {
    resetSupabaseMock()
  })

  it('lists seeded follow-ups for the demo business', async () => {
    const res = await listFollowUps({ perPage: 100 })
    expect(res.data.length).toBeGreaterThan(0)
    expect(res.data.every((f) => f.business_id === 'biz-001')).toBe(true)
  })

  it('creates a follow-up', async () => {
    const customers = getTable('customers')
    const customer = customers[0]
    const created = await createFollowUp({ customer_id: customer.id as string, due_date: '2026-09-15', note: 'Check in' })
    expect(created.customer_id).toBe(customer.id)
    expect(created.due_date).toBe('2026-09-15')
    expect(created.note).toBe('Check in')
    expect(getTable('follow_ups').some((f) => f.id === created.id)).toBe(true)
  })

  it('completes and skips follow-ups', async () => {
    const customers = getTable('customers')
    const customer = customers[0]
    const created = await createFollowUp({ customer_id: customer.id as string, due_date: '2026-09-15' })
    const done = await completeFollowUp(created.id)
    expect(done.status).toBe('completed')
    expect(done.completed_at).toBeTruthy()
    const skipped = await skipFollowUp(created.id)
    expect(skipped.status).toBe('skipped')
    expect(skipped.completed_at).toBeFalsy()
  })

  it('filters by customer and deletes a follow-up', async () => {
    const customers = getTable('customers')
    const customer = customers[0]
    await createFollowUp({ customer_id: customer.id as string, due_date: '2026-09-20' })
    const res = await listFollowUps({ filters: { customer_id: customer.id as string }, perPage: 100 })
    expect(res.data.length).toBeGreaterThan(0)
    const before = res.data.length
    await deleteFollowUp(res.data[0].id)
    const after = await listFollowUps({ filters: { customer_id: customer.id as string }, perPage: 100 })
    expect(after.data.length).toBe(before - 1)
  })
})
