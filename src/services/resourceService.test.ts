import { describe, it, expect } from 'vitest'
import { isOccupiedBooking, groupUpcomingBookingsByResource } from '@/services/resourceService'
import type { Booking } from '@/types'

const today = '2026-09-02'

function booking(overrides: Partial<Booking>): Booking {
  return {
    id: 'b1',
    business_id: 'biz',
    customer_id: 'cust',
    resource: 'Room 101',
    date: '2026-09-03',
    start_time: '14:00',
    end_time: '15:00',
    guests: 2,
    status: 'confirmed',
    amount: 100,
    payment_status: 'pending',
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
    ...overrides,
  }
}

describe('isOccupiedBooking', () => {
  it('treats active upcoming bookings as occupied', () => {
    expect(isOccupiedBooking(booking({ status: 'pending' }), today)).toBe(true)
    expect(isOccupiedBooking(booking({ status: 'confirmed' }), today)).toBe(true)
    expect(isOccupiedBooking(booking({ status: 'checked_in' }), today)).toBe(true)
  })

  it('excludes cancelled, no_show, and completed', () => {
    expect(isOccupiedBooking(booking({ status: 'cancelled' }), today)).toBe(false)
    expect(isOccupiedBooking(booking({ status: 'no_show' }), today)).toBe(false)
    expect(isOccupiedBooking(booking({ status: 'completed' }), today)).toBe(false)
  })

  it('excludes past-dated bookings', () => {
    expect(isOccupiedBooking(booking({ status: 'confirmed', date: '2026-09-01' }), today)).toBe(false)
    expect(isOccupiedBooking(booking({ status: 'confirmed', date: '2026-09-02' }), today)).toBe(true)
  })
})

describe('groupUpcomingBookingsByResource', () => {
  it('only keeps occupied bookings and groups by resource name', () => {
    const map = groupUpcomingBookingsByResource(
      [
        booking({ id: 'a', resource: 'Room 101' }),
        booking({ id: 'b', resource: 'Room 101' }),
        booking({ id: 'c', resource: 'Suite 2', date: '2026-09-04' }),
        booking({ id: 'd', resource: 'Room 101', status: 'cancelled' }),
      ],
      today
    )
    expect(map.get('Room 101')).toHaveLength(2)
    expect(map.get('Suite 2')).toHaveLength(1)
  })

  it('sorts each resource list by date then start time', () => {
    const map = groupUpcomingBookingsByResource(
      [
        booking({ id: 'a', date: '2026-09-05', start_time: '10:00' }),
        booking({ id: 'b', date: '2026-09-03', start_time: '16:00' }),
        booking({ id: 'c', date: '2026-09-03', start_time: '09:00' }),
      ],
      today
    )
    const list = map.get('Room 101')!
    expect(list.map((x) => x.id)).toEqual(['c', 'b', 'a'])
  })
})
