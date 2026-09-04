import { describe, it, expect, beforeEach, vi } from 'vitest'
import { resetSupabaseMock } from '@/test/supabaseMock'
import { getCustomer, getCustomerNotes } from '@/services/customerService'
import { listBookings } from '@/services/bookingService'
import { listOrders } from '@/services/orderService'
import { listFollowUps } from '@/services/followUpService'
import { getCustomerActivities } from '@/services/activityService'
import { listCommunications } from '@/services/communicationService'
import { listTemplates } from '@/services/templateService'
import { getBusiness } from '@/services/settingsService'

vi.mock('@/lib/supabase', () => import('@/test/supabaseMock').then((m) => ({ supabase: m.supabaseMock })))

describe('customer profile data loading', () => {
  beforeEach(() => resetSupabaseMock())

  it('all profile-loading calls resolve for every seeded customer', async () => {
    const customerId = 'cust-001'
    const results = await Promise.all([
      getCustomer(customerId),
      getCustomerNotes(customerId),
      listBookings({ filters: { customer_id: customerId }, perPage: 10 }),
      listOrders({ filters: { customer_id: customerId }, perPage: 10 }),
      listFollowUps({ filters: { customer_id: customerId }, perPage: 20 }),
      getCustomerActivities(customerId, 20),
      listCommunications({ filters: { customer_id: customerId }, perPage: 20 }),
      listTemplates({ perPage: 100 }),
      getBusiness(),
    ])
    expect(results).toBeTruthy()
  })

  it('resolves even when an ancillary profile query fails', async () => {
    const customerId = 'cust-001'
    const customer = await getCustomer(customerId)
    expect(customer).toBeTruthy()
    const settled = await Promise.allSettled([
      getCustomerNotes(customerId),
      listBookings({ filters: { customer_id: customerId }, perPage: 10 }),
      listOrders({ filters: { customer_id: customerId }, perPage: 10 }),
      Promise.reject(new Error('simulated follow-ups failure')),
      getCustomerActivities(customerId, 20),
      Promise.reject(new Error('simulated communications failure')),
      listTemplates({ perPage: 100 }),
      getBusiness(),
    ])
    expect(settled.filter((r) => r.status === 'rejected').length).toBe(2)
    expect(settled.filter((r) => r.status === 'fulfilled').length).toBe(6)
  })
})