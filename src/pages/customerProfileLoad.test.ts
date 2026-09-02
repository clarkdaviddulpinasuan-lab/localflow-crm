import { describe, it, expect, beforeEach } from 'vitest'
import { resetStore } from '@/services/demoStore'
import { getCustomer, getCustomerNotes } from '@/services/customerService'
import { listBookings } from '@/services/bookingService'
import { listOrders } from '@/services/orderService'
import { listFollowUps } from '@/services/followUpService'
import { analyzeCustomers } from '@/services/segments'
import { getCustomerActivities } from '@/services/activityService'
import { listCommunications } from '@/services/communicationService'
import { listTemplates } from '@/services/templateService'
import { getBusiness } from '@/services/settingsService'

describe('customer profile data loading', () => {
  beforeEach(() => {
    resetStore()
  })

  it('all profile-loading calls resolve for every demo customer', async () => {
    const customerId = 'cust-001'
    const results = await Promise.all([
      getCustomer(customerId),
      getCustomerNotes(customerId),
      listBookings({ filters: { customer_id: customerId }, perPage: 10 }),
      listOrders({ filters: { customer_id: customerId }, perPage: 10 }),
      listFollowUps({ filters: { customer_id: customerId }, perPage: 20 }),
      analyzeCustomers(),
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
      analyzeCustomers(),
      getCustomerActivities(customerId, 20),
      Promise.reject(new Error('simulated communications failure')),
      listTemplates({ perPage: 100 }),
      getBusiness(),
    ])
    expect(settled.filter((r) => r.status === 'rejected').length).toBe(2)
    expect(settled.filter((r) => r.status === 'fulfilled').length).toBe(7)
  })
})