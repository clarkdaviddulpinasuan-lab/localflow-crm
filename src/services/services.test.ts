import { describe, it, expect, beforeEach } from 'vitest'
import { resetStore } from '@/services/demoStore'
import {
  listCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  addCustomerNote,
  getCustomerNotes,
} from '@/services/customerService'
import {
  createBooking,
  listBookings,
  updateBooking,
  cancelBooking,
  getBooking,
  deleteBooking,
} from '@/services/bookingService'
import { getStatusBadge } from '@/components/ui/Badge'

describe('customer service', () => {
  beforeEach(() => {
    resetStore()
  })

  it('lists seeded customers', async () => {
    const res = await listCustomers({ perPage: 100 })
    expect(res.total).toBeGreaterThan(0)
    expect(res.data[0]).toHaveProperty('first_name')
  })

  it('creates a customer with defaults', async () => {
    const c = await createCustomer({ first_name: 'Test', last_name: 'User', email: 'test@example.com' })
    expect(c.id).toBeTruthy()
    expect(c.type).toBe('regular')
    expect(c.status).toBe('new')
    expect(c.total_spent).toBe(0)
    expect((await getCustomer(c.id))?.email).toBe('test@example.com')
  })

  it('updates a customer', async () => {
    const c = await createCustomer({ first_name: 'A', last_name: 'B' })
    const updated = await updateCustomer(c.id, { status: 'vip', total_spent: 1000 })
    expect(updated.status).toBe('vip')
    expect((await getCustomer(c.id))?.total_spent).toBe(1000)
  })

  it('deletes a customer', async () => {
    const c = await createCustomer({ first_name: 'A', last_name: 'B' })
    await deleteCustomer(c.id)
    expect(await getCustomer(c.id)).toBeUndefined()
  })

  it('throws on updating a missing customer', async () => {
    await expect(updateCustomer('nope', {})).rejects.toThrow('Customer not found')
  })

  it('adds and retrieves notes', async () => {
    const c = await createCustomer({ first_name: 'A', last_name: 'B' })
    await addCustomerNote(c.id, 'Prefers quiet rooms')
    const notes = await getCustomerNotes(c.id)
    expect(notes.length).toBe(1)
    expect(notes[0].content).toBe('Prefers quiet rooms')
  })
})

describe('booking service', () => {
  beforeEach(() => {
    resetStore()
  })

  function makeBooking() {
    return createBooking({
      customer_id: 'cust-001',
      resource: 'Room 202',
      date: '2099-01-01',
      start_time: '10:00',
      end_time: '12:00',
      guests: 2,
      status: 'pending',
      amount: 1500,
      payment_status: 'pending',
    })
  }

  it('creates and lists a booking', async () => {
    const b = await makeBooking()
    expect((await listBookings({ perPage: 100 })).total).toBeGreaterThan(0)
    expect((await getBooking(b.id))?.resource).toBe('Room 202')
    expect((await listBookings({ perPage: 100 })).data[0].status).toBe('pending')
  })

  it('updates booking status', async () => {
    const b = await makeBooking()
    const updated = await updateBooking(b.id, { status: 'confirmed' })
    expect(updated.status).toBe('confirmed')
  })

  it('cancels a booking and preserves a reason', async () => {
    const b = await makeBooking()
    const cancelled = await cancelBooking(b.id, 'Guest cancelled')
    expect(cancelled.status).toBe('cancelled')
    expect(cancelled.notes).toContain('Guest cancelled')
  })

  it('deletes a booking', async () => {
    const b = await makeBooking()
    await deleteBooking(b.id)
    expect(await getBooking(b.id)).toBeUndefined()
  })
})

describe('status badge mapping', () => {
  it('maps booking and task statuses to labels and variants', () => {
    expect(getStatusBadge('confirmed')).toEqual({ variant: 'primary', label: 'Confirmed' })
    expect(getStatusBadge('cancelled').label).toBe('Cancelled')
    expect(getStatusBadge('completed').label).toBe('Completed')
    expect(getStatusBadge('urgent').label).toBe('Urgent')
    expect(getStatusBadge('unknown-status').label).toBe('unknown-status')
  })
})
