import { format } from 'date-fns'
import { getStore, updateStore } from '@/services/demoStore'
import { isDemo, getCurrentBusinessId, messageFromError } from '@/lib/dataClient'
import { supabase } from '@/lib/supabase'
import { listBookings } from '@/services/bookingService'
import type { WorkingHours } from '@/types'

const WORKING_HOURS_KEY = 'working_hours'

/** Default: Mon-Sat 09:00-17:00, Sunday closed. */
export const DEFAULT_WORKING_HOURS: WorkingHours = {
  monday: { open: '09:00', close: '17:00' },
  tuesday: { open: '09:00', close: '17:00' },
  wednesday: { open: '09:00', close: '17:00' },
  thursday: { open: '09:00', close: '17:00' },
  friday: { open: '09:00', close: '17:00' },
  saturday: { open: '09:00', close: '17:00' },
  sunday: { open: null, close: null },
}

const DAY_KEYS = Object.keys(DEFAULT_WORKING_HOURS)

export async function getWorkingHours(): Promise<WorkingHours> {
  if (isDemo()) {
    const row = getStore().settings.find((s) => s.key === WORKING_HOURS_KEY)
    if (!row?.value) return DEFAULT_WORKING_HOURS
    try {
      return { ...DEFAULT_WORKING_HOURS, ...(JSON.parse(row.value) as WorkingHours) }
    } catch {
      return DEFAULT_WORKING_HOURS
    }
  }
  const businessId = await getCurrentBusinessId()
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('business_id', businessId)
    .eq('key', WORKING_HOURS_KEY)
    .maybeSingle()
  if (error) throw new Error(messageFromError(error, 'Failed to load working hours.'))
  if (!data?.value) return DEFAULT_WORKING_HOURS
  try {
    return { ...DEFAULT_WORKING_HOURS, ...(JSON.parse(data.value) as WorkingHours) }
  } catch {
    return DEFAULT_WORKING_HOURS
  }
}

export async function saveWorkingHours(hours: WorkingHours): Promise<void> {
  const value = JSON.stringify(hours)
  if (isDemo()) {
    updateStore((s) => {
      const idx = s.settings.findIndex((row) => row.key === WORKING_HOURS_KEY)
      if (idx >= 0) {
        s.settings[idx] = { ...s.settings[idx], value, updated_at: new Date().toISOString() }
      } else {
        s.settings.push({
          id: 'settings-' + WORKING_HOURS_KEY,
          business_id: s.business.id,
          key: WORKING_HOURS_KEY,
          value,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
      }
    })
    return
  }
  const businessId = await getCurrentBusinessId()
  const { data: existing } = await supabase
    .from('settings')
    .select('id')
    .eq('business_id', businessId)
    .eq('key', WORKING_HOURS_KEY)
    .maybeSingle()
  if (existing?.id) {
    const { error } = await supabase
      .from('settings')
      .update({ value, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
    if (error) throw new Error(messageFromError(error, 'Failed to save working hours.'))
  } else {
    const { error } = await supabase.from('settings').insert({
      business_id: businessId,
      key: WORKING_HOURS_KEY,
      value,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    if (error) throw new Error(messageFromError(error, 'Failed to save working hours.'))
  }
}

export interface TimeSlot {
  start: string
  end: string
  available: boolean
}

function dayKey(date: Date): string {
  return format(date, 'EEEE').toLowerCase()
}

function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function toHHMM(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * Generates availability slots for a resource (e.g. a room) on a given day based
 * on working hours, stepping by `slotMinutes`, and flags slots that conflict with
 * existing bookings for that resource.
 */
export async function getAvailableSlots(resource: string, date: string, slotMinutes = 60): Promise<TimeSlot[]> {
  const hours = await getWorkingHours()
  const day = dayKey(new Date(date + 'T00:00:00'))
  const schedule = hours[day] ?? { open: null, close: null }
  if (!schedule.open || !schedule.close) return []

  const bookingsRes = await listBookings({ filters: { resource, date }, perPage: 200 })
  const busy = bookingsRes.data
    .filter((b) => b.status !== 'cancelled')
    .map((b) => [toMinutes(b.start_time), toMinutes(b.end_time)] as const)

  const open = toMinutes(schedule.open)
  const close = toMinutes(schedule.close)
  const slots: TimeSlot[] = []
  for (let s = open; s + slotMinutes <= close; s += slotMinutes) {
    const start = s
    const end = s + slotMinutes
    const conflict = busy.find(([bs, be]) => start < be && end > bs)
    slots.push({
      start: toHHMM(start),
      end: toHHMM(end),
      available: !conflict,
    })
  }
  return slots
}

/** Convenience used by slot pickers: only free slots. */
export async function getFreeSlots(resource: string, date: string, slotMinutes = 60): Promise<string[]> {
  const slots = await getAvailableSlots(resource, date, slotMinutes)
  return slots.filter((s) => s.available).map((s) => s.start)
}

export function isOpenOn(hours: WorkingHours, date: Date): boolean {
  const schedule = hours[dayKey(date)] ?? { open: null, close: null }
  return Boolean(schedule.open && schedule.close)
}

export function dayLabel(day: string): string {
  return day.charAt(0).toUpperCase() + day.slice(1)
}

export { DAY_KEYS }