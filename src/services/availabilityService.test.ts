import { describe, it, expect, beforeEach } from 'vitest'
import { format, startOfDay } from 'date-fns'
import { resetStore, getStore } from '@/services/demoStore'
import { getWorkingHours, saveWorkingHours, getAvailableSlots, getFreeSlots, DEFAULT_WORKING_HOURS } from '@/services/availabilityService'
import { createBooking } from '@/services/bookingService'

function nextOpenDay(skip = 0): string {
  const d = startOfDay(new Date())
  d.setDate(d.getDate() + 1 + skip)
  while (d.getDay() === 0) d.setDate(d.getDate() + 1)
  return format(d, 'yyyy-MM-dd')
}

function dayName(date: string): string {
  return format(new Date(date + 'T00:00:00'), 'EEEE').toLowerCase()
}

describe('availability service', () => {
  beforeEach(() => {
    resetStore()
  })

  it('returns default working hours', async () => {
    const hours = await getWorkingHours()
    expect(hours.monday.open).toBe('09:00')
    expect(hours.monday.close).toBe('17:00')
  })

  it('persists working hours', async () => {
    const custom = { ...DEFAULT_WORKING_HOURS, monday: { open: '10:00', close: '15:00' } }
    await saveWorkingHours(custom)
    const loaded = await getWorkingHours()
    expect(loaded.monday).toEqual({ open: '10:00', close: '15:00' })
  })

  it('generates 1-hour slots capped by working hours', async () => {
    const date = nextOpenDay()
    await saveWorkingHours({ ...DEFAULT_WORKING_HOURS, [dayName(date)]: { open: '09:00', close: '11:00' } })
    const slots = await getAvailableSlots('Room 201', date)
    expect(slots).toHaveLength(2)
    expect(slots.every((s) => s.available)).toBe(true)
  })

  it('flags the slot of an existing booking as unavailable', async () => {
    const date = nextOpenDay(1)
    await saveWorkingHours({ ...DEFAULT_WORKING_HOURS, [dayName(date)]: { open: '09:00', close: '12:00' } })
    await createBooking({ customer_id: getStore().customers[0].id, resource: 'Room 201', date, start_time: '10:00', end_time: '11:00', guests: 2, status: 'confirmed', payment_status: 'paid', amount: 100 })
    const slots = await getAvailableSlots('Room 201', date)
    expect(slots.find((s) => s.start === '10:00')?.available).toBe(false)
    expect(slots.filter((s) => s.available)).toHaveLength(2)
    const free = await getFreeSlots('Room 201', date)
    expect(free).toEqual(['09:00', '11:00'])
  })

  it('returns no slots on a closed day', async () => {
    await saveWorkingHours({ ...DEFAULT_WORKING_HOURS, sunday: { open: null, close: null } })
    const d = startOfDay(new Date())
    while (d.getDay() !== 0) d.setDate(d.getDate() + 1)
    const slots = await getAvailableSlots('Room 201', format(d, 'yyyy-MM-dd'))
    expect(slots).toHaveLength(0)
  })
})