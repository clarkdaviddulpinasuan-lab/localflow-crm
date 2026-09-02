import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  format,
  addDays,
  startOfDay,
  endOfDay,
  isWithinInterval,
  parseISO,
} from 'date-fns'
import type { Booking } from '@/types'

export type CalendarView = 'month' | 'week' | 'day'

export interface CalendarEvent {
  id: string
  date: string
  title: string
  subtitle?: string
  type: 'booking' | 'task'
  status?: string
  time?: string
}

export function getViewDates(view: CalendarView, current: Date): Date[] {
  if (view === 'month') {
    return eachDayOfInterval({
      start: startOfWeek(startOfMonth(current), { weekStartsOn: 1 }),
      end: endOfWeek(endOfMonth(current), { weekStartsOn: 1 }),
    })
  }
  if (view === 'week') {
    return eachDayOfInterval({
      start: startOfWeek(current, { weekStartsOn: 1 }),
      end: endOfWeek(current, { weekStartsOn: 1 }),
    })
  }
  return [current]
}

export function isCurrentMonth(date: Date, current: Date): boolean {
  return isSameMonth(date, current)
}

export function isToday(date: Date): boolean {
  return isSameDay(date, new Date())
}

export function getEventsForDate(events: CalendarEvent[], date: Date): CalendarEvent[] {
  return events.filter((e) => isSameDay(parseISO(e.date), date))
}

export function eventInView(events: CalendarEvent[], view: CalendarView, current: Date): CalendarEvent[] {
  const days = getViewDates(view, current)
  if (days.length === 0) return []
  const start = startOfDay(days[0])
  const end = endOfDay(days[days.length - 1])
  return events.filter((e) => {
    const d = parseISO(e.date)
    return isWithinInterval(d, { start, end })
  })
}

export function shiftDate(current: Date, view: CalendarView, direction: 'prev' | 'next'): Date {
  const amount = direction === 'next' ? 1 : -1
  if (view === 'month') return new Date(current.getFullYear(), current.getMonth() + amount, 1)
  if (view === 'week') return addDays(current, 7 * amount)
  return addDays(current, amount)
}

export function viewTitle(view: CalendarView, current: Date): string {
  if (view === 'month') return format(current, 'MMMM yyyy')
  if (view === 'week') {
    const start = startOfWeek(current, { weekStartsOn: 1 })
    const end = endOfWeek(current, { weekStartsOn: 1 })
    return `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`
  }
  return format(current, 'EEEE, MMMM d, yyyy')
}

export function bookingToEvent(b: Booking): CalendarEvent {
  return {
    id: b.id,
    date: b.date,
    title: b.resource,
    subtitle: b.start_time,
    type: 'booking',
    status: b.status,
    time: b.start_time,
  }
}
