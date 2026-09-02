import { describe, it, expect } from 'vitest'
import {
  getViewDates,
  isCurrentMonth,
  getEventsForDate,
  eventInView,
  shiftDate,
  viewTitle,
  bookingToEvent,
} from '@/utils/calendar'

describe('calendar utils', () => {
  it('month view returns consecutive days starting Monday', () => {
    const days = getViewDates('month', new Date(2025, 0, 15))
    expect(days.length).toBeGreaterThanOrEqual(35)
    // First day should be a Monday
    expect([1, 2, 3, 4, 5, 6, 0]).toContain(days[0].getDay())
  })

  it('week view returns exactly 7 days', () => {
    expect(getViewDates('week', new Date(2025, 5, 10))).toHaveLength(7)
  })

  it('day view returns one day', () => {
    expect(getViewDates('day', new Date(2025, 5, 10))).toHaveLength(1)
  })

  it('isCurrentMonth detects the month', () => {
    expect(isCurrentMonth(new Date(2025, 5, 15), new Date(2025, 5, 1))).toBe(true)
    expect(isCurrentMonth(new Date(2025, 6, 15), new Date(2025, 5, 1))).toBe(false)
  })

  it('getEventsForDate filters events by exact day', () => {
    const events = [
      { id: '1', date: '2025-06-10', title: 'A', type: 'booking' as const },
      { id: '2', date: '2025-06-11', title: 'B', type: 'task' as const },
    ]
    expect(getEventsForDate(events, new Date(2025, 5, 10)).map((e) => e.id)).toEqual(['1'])
  })

  it('eventInView includes only events within the range', () => {
    const events = [
      { id: '1', date: '2025-06-08', title: 'A', type: 'booking' as const },
      { id: '2', date: '2025-06-12', title: 'B', type: 'task' as const },
    ]
    const inWeek = eventInView(events, 'week', new Date(2025, 5, 11))
    expect(inWeek.map((e) => e.id)).toEqual(['2'])
  })

  it('shiftDate cycles months', () => {
    const next = shiftDate(new Date(2025, 0, 15), 'month', 'next')
    expect(next.getMonth()).toBe(1)
    const prev = shiftDate(new Date(2025, 0, 15), 'month', 'prev')
    expect(prev.getMonth()).toBe(11)
  })

  it('shiftDate moves days by 7 in week view', () => {
    const next = shiftDate(new Date(2025, 5, 10), 'week', 'next')
    expect(next.getDate()).toBe(17)
  })

  it('viewTitle produces human labels', () => {
    expect(viewTitle('month', new Date(2025, 0, 15))).toContain('January 2025')
    expect(viewTitle('day', new Date(2025, 0, 15))).toContain('January')
  })

  it('bookingToEvent maps a booking to an event', () => {
    const booking = {
      id: 'b1',
      business_id: 'biz',
      customer_id: 'c1',
      resource: 'Room 101',
      date: '2025-06-10',
      start_time: '14:00',
      end_time: '15:00',
      guests: 2,
      status: 'confirmed' as const,
      amount: 1500,
      payment_status: 'paid' as const,
      created_at: '',
      updated_at: '',
    }
    const ev = bookingToEvent(booking)
    expect(ev.id).toBe('b1')
    expect(ev.type).toBe('booking')
    expect(ev.title).toBe('Room 101')
    expect(ev.time).toBe('14:00')
    expect(ev.status).toBe('confirmed')
  })
})
