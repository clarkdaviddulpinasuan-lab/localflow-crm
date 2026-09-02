import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, CalendarDays } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge, getStatusBadge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { cn } from '@/lib/cn'
import {
  type CalendarView,
  type CalendarEvent,
  getViewDates,
  isCurrentMonth,
  isToday,
  getEventsForDate,
  eventInView,
  shiftDate,
  viewTitle,
  bookingToEvent,
} from '@/utils/calendar'
import { listBookings } from '@/services/bookingService'
import { listTasks } from '@/services/taskService'
import { listCustomers } from '@/services/customerService'
import type { Booking, Task } from '@/types'
import { useBusiness } from '@/contexts/BusinessContext'

function eventColor(e: CalendarEvent): string {
  if (e.type === 'task') {
    return e.status === 'completed'
      ? 'bg-success-50 text-success-700 border-success-200'
      : 'bg-warning-50 text-warning-700 border-warning-200'
  }
  const s = e.status
  if (s === 'cancelled' || s === 'no_show') return 'bg-danger-50 text-danger-700 border-danger-200'
  if (s === 'completed') return 'bg-success-50 text-success-700 border-success-200'
  return 'bg-primary-50 text-primary-700 border-primary-200'
}

export function CalendarPage() {
  const { terminology } = useBusiness()
  const [view, setView] = useState<CalendarView>('month')
  const [current, setCurrent] = useState(() => new Date())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailBooking, setDetailBooking] = useState<Booking | null>(null)
  const [detailTask, setDetailTask] = useState<Task | null>(null)

  useEffect(() => {
    async function load() {
      const [bookingsRes, tasksRes] = await Promise.all([
        listBookings({ perPage: 9999 }),
        listTasks({ perPage: 9999 }),
      ])
      const bookingEvents = bookingsRes.data.map(bookingToEvent)
      const taskEvents: CalendarEvent[] = tasksRes.data.map((t) => ({
        id: t.id,
        date: t.due_date,
        title: t.title,
        type: 'task',
        status: t.status,
      }))
      setEvents([...bookingEvents, ...taskEvents])
    }
    load()
  }, [])

  const days = getViewDates(view, current)
  const viewEvents = eventInView(events, view, current)
  const [customerName, setCustomerName] = useState<(id: string) => string>(() => () => 'Unknown')

  useEffect(() => {
    async function loadCustomers() {
      const customersRes = await listCustomers({ perPage: 9999 })
      const map = new Map(
        customersRes.data.map((c) => [c.id, `${c.first_name} ${c.last_name}`])
      )
      setCustomerName(() => (id: string) => map.get(id) ?? 'Unknown')
    }
    loadCustomers()
  }, [])

  async function openEvent(e: CalendarEvent) {
    if (e.type === 'booking') {
      const b = await listBookings({ perPage: 9999 })
      const found = b.data.find((x) => x.id === e.id)
      setDetailBooking(found ?? null)
    } else {
      const t = await listTasks({ perPage: 9999 })
      const found = t.data.find((x) => x.id === e.id)
      setDetailTask(found ?? null)
    }
    setDetailOpen(true)
  }

  const viewTabs: { value: CalendarView; label: string }[] = [
    { value: 'month', label: 'Month' },
    { value: 'week', label: 'Week' },
    { value: 'day', label: 'Day' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendar"
        description="View bookings, appointments, and tasks at a glance."
        actions={
          <Button
            icon={<Plus className="h-4 w-4" />}
            onClick={() => {
              window.location.href = `/bookings?new=1`
            }}
          >
            New {terminology.bookingLabel}
          </Button>
        }
      />

      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrent((c) => shiftDate(c, view, 'prev'))}
              className="p-2 rounded-lg text-surface-500 hover:bg-surface-100"
              aria-label="Previous"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h2 className="text-lg font-semibold text-surface-900 min-w-[10rem] text-center">{viewTitle(view, current)}</h2>
            <button
              onClick={() => setCurrent((c) => shiftDate(c, view, 'next'))}
              className="p-2 rounded-lg text-surface-500 hover:bg-surface-100"
              aria-label="Next"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <Button variant="secondary" size="sm" onClick={() => setCurrent(new Date())}>
              Today
            </Button>
          </div>
          <div className="flex rounded-lg border border-surface-200 overflow-hidden">
            {viewTabs.map((t) => (
              <button
                key={t.value}
                onClick={() => setView(t.value)}
                className={cn(
                  'px-4 py-1.5 text-sm font-medium transition-colors',
                  view === t.value ? 'bg-primary-600 text-white' : 'bg-white text-surface-600 hover:bg-surface-50'
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {view === 'month' && (
          <div className="grid grid-cols-7 gap-px bg-surface-100 border border-surface-100 rounded-lg overflow-hidden">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <div key={d} className="bg-white px-2 py-1.5 text-xs font-semibold text-surface-500 text-center border-b border-surface-100">
                {d}
              </div>
            ))}
            {days.map((date) => {
              const dayEvents = getEventsForDate(viewEvents, date)
              return (
                <div
                  key={date.toISOString()}
                  className={cn(
                    'bg-white min-h-24 p-1.5 border-b border-surface-50',
                    !isCurrentMonth(date, current) && 'opacity-40',
                    isToday(date) && 'bg-primary-50/50'
                  )}
                >
                  <span
                    className={cn(
                      'inline-flex items-center justify-center h-6 w-6 text-xs font-medium rounded-full',
                      isToday(date) && 'bg-primary-600 text-white'
                    )}
                  >
                    {date.getDate()}
                  </span>
                  <div className="mt-1 space-y-1">
                    {dayEvents.slice(0, 3).map((e) => (
                      <button
                        key={e.id}
                        onClick={() => openEvent(e)}
                        className={cn(
                          'w-full text-left text-[11px] px-1.5 py-0.5 rounded border truncate block',
                          eventColor(e)
                        )}
                        title={e.title}
                      >
                        {e.type === 'booking' && e.time ? `${e.time} ` : ''}{e.title}
                      </button>
                    ))}
                    {dayEvents.length > 3 && (
                      <p className="text-[11px] text-surface-400 px-1.5">+{dayEvents.length - 3} more</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {view === 'week' && (
          <div className="grid grid-cols-7 gap-px bg-surface-100 border border-surface-100 rounded-lg overflow-hidden">
            {days.map((date) => (
              <div key={date.toISOString()} className="bg-white min-h-40 p-1.5">
                <div className="text-center mb-2">
                  <p className="text-xs text-surface-400">{date.toLocaleDateString('en-US', { weekday: 'short' })}</p>
                  <span
                    className={cn(
                      'inline-flex items-center justify-center h-6 w-6 text-xs font-medium rounded-full mt-0.5',
                      isToday(date) && 'bg-primary-600 text-white'
                    )}
                  >
                    {date.getDate()}
                  </span>
                </div>
                <div className="space-y-1">
                  {getEventsForDate(viewEvents, date).map((e) => (
                    <button
                      key={e.id}
                      onClick={() => openEvent(e)}
                      className={cn('w-full text-left text-[11px] px-1.5 py-1 rounded border block', eventColor(e))}
                    >
                      {e.type === 'booking' && e.time ? `${e.time} ` : ''}{e.title}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {view === 'day' && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-surface-900">
              {current.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </h3>
            {viewEvents.length === 0 ? (
              <div className="py-10 text-center text-sm text-surface-500">
                <CalendarDays className="h-8 w-8 mx-auto mb-2 text-surface-300" />
                No events scheduled for this day.
              </div>
            ) : (
              <div className="space-y-2">
                {viewEvents.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => openEvent(e)}
                    className={cn('w-full text-left px-3 py-2.5 rounded-lg border', eventColor(e))}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{e.title}</p>
                        {e.subtitle && <p className="text-xs opacity-75">{e.subtitle}</p>}
                      </div>
                      {e.type === 'booking' && e.status && (
                        <Badge variant={getStatusBadge(e.status).variant}>{getStatusBadge(e.status).label}</Badge>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title="Event details" size="sm">
        {detailBooking && (
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <p className="font-medium text-surface-900">{detailBooking.resource}</p>
              <Badge variant={getStatusBadge(detailBooking.status).variant}>{getStatusBadge(detailBooking.status).label}</Badge>
            </div>
            <p className="text-surface-600">{customerName(detailBooking.customer_id)}</p>
            <dl className="space-y-1.5">
              <div className="flex justify-between"><dt className="text-surface-500">Date</dt><dd className="font-medium text-surface-900">{new Date(detailBooking.date + 'T00:00:00').toLocaleDateString()}</dd></div>
              <div className="flex justify-between"><dt className="text-surface-500">Time</dt><dd className="font-medium text-surface-900">{detailBooking.start_time} – {detailBooking.end_time}</dd></div>
              <div className="flex justify-between"><dt className="text-surface-500">Guests</dt><dd className="font-medium text-surface-900">{detailBooking.guests}</dd></div>
            </dl>
            <Button onClick={() => { window.location.href = `/bookings?customer=${detailBooking.customer_id}` }} className="w-full">
              View in Bookings
            </Button>
          </div>
        )}
        {detailTask && (
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <p className="font-medium text-surface-900">{detailTask.title}</p>
              <Badge variant={getStatusBadge(detailTask.priority).variant}>{getStatusBadge(detailTask.priority).label}</Badge>
            </div>
            {detailTask.description && <p className="text-surface-600">{detailTask.description}</p>}
            <dl className="space-y-1.5">
              <div className="flex justify-between"><dt className="text-surface-500">Due</dt><dd className="font-medium text-surface-900">{new Date(detailTask.due_date + 'T00:00:00').toLocaleDateString()}</dd></div>
              <div className="flex justify-between"><dt className="text-surface-500">Status</dt><dd><Badge variant={getStatusBadge(detailTask.status).variant}>{getStatusBadge(detailTask.status).label}</Badge></dd></div>
            </dl>
            <Button onClick={() => { window.location.href = `/tasks?customer=${detailTask.customer_id ?? ''}` }} className="w-full">
              View in Tasks
            </Button>
          </div>
        )}
      </Modal>
    </div>
  )
}
