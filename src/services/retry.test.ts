import { describe, it, expect, beforeEach, vi } from 'vitest'
vi.mock('@/lib/supabase', () => import('@/test/supabaseMock').then((m) => ({ supabase: m.supabaseMock })))
import {
  resetSupabaseMock,
  setTransientFailures,
  seededCustomers,
  seededOrders,
  seededBusiness,
} from '@/test/supabaseMock'
import { listCustomers, getCustomer, recalcTotalSpent, getCustomerNotes } from '@/services/customerService'
import { listTasks } from '@/services/taskService'
import { getOrder, nextOrderNumber } from '@/services/orderService'
import { getBusiness, listPendingInvites } from '@/services/settingsService'
import { listTemplates } from '@/services/templateService'
import { listFollowUps } from '@/services/followUpService'
import { listNotifications } from '@/services/notificationService'
import { getRules } from '@/services/automationService'
import { getInstanceConfig } from '@/services/instanceConfigService'

describe('service retry on transient network failures', () => {
  beforeEach(() => {
    resetSupabaseMock()
  })

  it('listCustomers retries a transient failure and succeeds', async () => {
    setTransientFailures('customers', 2, 'Failed to fetch')
    const res = await listCustomers({ perPage: 5 })
    expect(res.total).toBeGreaterThan(0)
    expect(res.data.length).toBeGreaterThan(0)
  })

  it('listTasks retries a transient failure and succeeds', async () => {
    setTransientFailures('tasks', 1, 'fetch failed')
    const res = await listTasks({ perPage: 5 })
    expect(res.data.length).toBeGreaterThan(0)
  })

  it('getCustomer (single-record getter) retries and succeeds', async () => {
    setTransientFailures('customers', 2, 'Failed to fetch')
    const customer = await getCustomer(seededCustomers[0].id)
    expect(customer?.id).toBe(seededCustomers[0].id)
  })

  it('getOrder (single-record getter) retries and succeeds', async () => {
    setTransientFailures('orders', 1, 'fetch failed')
    const order = await getOrder(seededOrders[0].id)
    expect(order?.id).toBe(seededOrders[0].id)
  })

  it('getBusiness retries and succeeds', async () => {
    setTransientFailures('businesses', 2, 'Failed to fetch')
    const business = await getBusiness()
    expect(business.id).toBe(seededBusiness.id)
  })

  it('recalcTotalSpent retries its internal aggregate reads', async () => {
    setTransientFailures('bookings', 1, 'Failed to fetch')
    await expect(recalcTotalSpent(seededCustomers[0].id)).resolves.toBeUndefined()
  })

  it('listTemplates retries a transient failure and succeeds', async () => {
    setTransientFailures('message_templates', 2, 'Failed to fetch')
    const res = await listTemplates({ perPage: 5 })
    expect(res.data.length).toBeGreaterThan(0)
  })

  it('listFollowUps retries a transient failure and succeeds', async () => {
    setTransientFailures('follow_ups', 1, 'fetch failed')
    const res = await listFollowUps({ perPage: 5 })
    expect(res.data.length).toBeGreaterThan(0)
  })

  it('listNotifications retries a transient failure and succeeds', async () => {
    setTransientFailures('notifications', 2, 'Failed to fetch')
    const res = await listNotifications(5)
    expect(res.length).toBeGreaterThan(0)
  })

  it('listPendingInvites retries a transient failure and succeeds', async () => {
    setTransientFailures('invitations', 1, 'fetch failed')
    await expect(listPendingInvites()).resolves.toEqual([])
  })

  it('getRules (settings read) retries and succeeds with defaults', async () => {
    setTransientFailures('settings', 2, 'Failed to fetch')
    const rules = await getRules()
    expect(rules.length).toBeGreaterThan(0)
  })

  it('getInstanceConfig (settings read) retries and succeeds with defaults', async () => {
    setTransientFailures('settings', 1, 'fetch failed')
    await expect(getInstanceConfig()).resolves.toMatchObject({ features: expect.any(Object) })
  })

  it('nextOrderNumber retries its read and still generates a number', async () => {
    setTransientFailures('orders', 1, 'Failed to fetch')
    await expect(nextOrderNumber()).resolves.toMatch(/^ORD-\d{4}-\d{3}$/)
  })

  it('getCustomerNotes retries a transient failure and succeeds', async () => {
    setTransientFailures('customer_notes', 1, 'fetch failed')
    await expect(getCustomerNotes(seededCustomers[0].id)).resolves.toEqual([])
  })

  it('fails immediately on non-transient (RLS-denied) errors', async () => {
    setTransientFailures('customers', 5, 'new row violates row-level security policy for table "customers"')
    await expect(listCustomers({ perPage: 5 })).rejects.toThrow('row-level security')
  })

  it('getters fail immediately on non-transient errors without retrying', async () => {
    setTransientFailures('customers', 5, 'Permission denied for table customers')
    await expect(getCustomer(seededCustomers[0].id)).rejects.toThrow('Permission denied')
  })
})