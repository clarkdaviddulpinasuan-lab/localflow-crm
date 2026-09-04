import { describe, it, expect, beforeEach, vi } from 'vitest'
vi.mock('@/lib/supabase', () => import('@/test/supabaseMock').then((m) => ({ supabase: m.supabaseMock })))
import { resetSupabaseMock, getTable } from '@/test/supabaseMock'
import {
  listOrders,
  createOrder,
  updateOrder,
  deleteOrder,
} from '@/services/orderService'
import { listBookings } from '@/services/bookingService'

describe('order service', () => {
  beforeEach(() => {
    resetSupabaseMock()
  })

  it('lists seeded orders for the demo business', async () => {
    const res = await listOrders({ perPage: 100 })
    expect(res.data.length).toBeGreaterThan(0)
    expect(res.data.every((o) => o.business_id === 'biz-001')).toBe(true)
  })

  it('creates an order and persists a linked booking', async () => {
    const customers = getTable('customers')
    const bookings = await listBookings({ perPage: 100 })
    const booking = bookings.data[0]
    const created = await createOrder({
      customer_id: customers[0].id as string,
      booking_id: booking.id,
      items: 'Test order with stay',
      total: 1200,
      payment_status: 'pending',
      status: 'new',
      staff_member: '',
    })
    expect(created.booking_id).toBe(booking.id)
    expect(getTable('orders').some((o) => o.id === created.id)).toBe(true)
  })

  it('filters orders by booking_id', async () => {
    const customers = getTable('customers')
    const bookings = await listBookings({ perPage: 100 })
    const booking = bookings.data[0]
    await createOrder({
      customer_id: customers[0].id as string,
      booking_id: booking.id,
      items: 'Stay-linked order',
      total: 800,
      payment_status: 'paid',
      status: 'completed',
      staff_member: '',
    })
    const res = await listOrders({ filters: { booking_id: booking.id }, perPage: 100 })
    expect(res.data.length).toBeGreaterThan(0)
    expect(res.data.every((o) => o.booking_id === booking.id)).toBe(true)
  })

  it('updates and clears a booking link', async () => {
    const customers = getTable('customers')
    const bookings = await listBookings({ perPage: 100 })
    const booking = bookings.data[0]
    const created = await createOrder({
      customer_id: customers[0].id as string,
      booking_id: booking.id,
      items: 'Link update test',
      total: 500,
      payment_status: 'pending',
      status: 'new',
      staff_member: '',
    })
    const updated = await updateOrder(created.id, { booking_id: null })
    expect(updated.booking_id).toBeNull()
    const res = await listOrders({ filters: { booking_id: booking.id }, perPage: 100 })
    expect(res.data.some((o) => o.id === created.id)).toBe(false)
  })

  it('deletes an order', async () => {
    const customers = getTable('customers')
    const created = await createOrder({
      customer_id: customers[0].id as string,
      items: 'Delete test',
      total: 250,
      payment_status: 'pending',
      status: 'new',
      staff_member: '',
    })
    await deleteOrder(created.id)
    const res = await listOrders({ filters: { customer_id: customers[0].id }, perPage: 100 })
    expect(res.data.some((o) => o.id === created.id)).toBe(false)
  })
})
