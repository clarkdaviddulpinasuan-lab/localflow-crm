import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { RotateCcw } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Input, Select } from '@/components/ui/Field'
import {
  getAvailableSlots,
  getWorkingHours,
  saveWorkingHours,
  isOpenOn,
  DAY_KEYS,
  dayLabel,
  DEFAULT_WORKING_HOURS,
  type TimeSlot,
} from '@/services/availabilityService'
import { listBookings } from '@/services/bookingService'
import type { WorkingHours } from '@/types'

export function AvailabilityPage() {
  const [resources, setResources] = useState<string[]>([])
  const [date, setDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [slotsByResource, setSlotsByResource] = useState<Record<string, TimeSlot[]>>({})
  const [hours, setHours] = useState<WorkingHours>(DEFAULT_WORKING_HOURS)
  const [hoursOpen, setHoursOpen] = useState(false)

  useEffect(() => {
    listBookings({ perPage: 200 }).then((res) => {
      const unique = Array.from(new Set(res.data.map((b) => b.resource))).sort()
      setResources(unique)
    })
  }, [])

  useEffect(() => {
    getWorkingHours().then(setHours)
  }, [])

  useEffect(() => {
    if (resources.length === 0) return
    let cancelled = false
    Promise.all(resources.map(async (r) => [r, await getAvailableSlots(r, date)] as const)).then((pairs) => {
      if (!cancelled) setSlotsByResource(Object.fromEntries(pairs))
    })
    return () => {
      cancelled = true
    }
  }, [resources, date])

  async function saveHours() {
    await saveWorkingHours(hours)
    setHoursOpen(false)
    if (resources.length === 0) return
    const pairs = await Promise.all(resources.map(async (r) => [r, await getAvailableSlots(r, date)] as const))
    setSlotsByResource(Object.fromEntries(pairs))
  }

  function setDayHour(day: string, field: 'open' | 'close', value: string) {
    setHours((prev) => {
      const current = prev[day] ?? { open: null, close: null }
      const next = { ...current, [field]: value || null }
      const bothOpen = next.open && next.close
      return { ...prev, [day]: bothOpen ? next : { open: null, close: null } }
    })
  }

  const closedToday = !isOpenOn(hours, new Date(date + 'T00:00:00'))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Availability"
        description="Slot view of each resource against working hours and existing bookings."
        actions={
          <Button variant="secondary" icon={<RotateCcw className="h-4 w-4" />} onClick={() => setHoursOpen(true)}>
            Working hours
          </Button>
        }
      />

      <Card className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="w-full sm:w-56">
            <Input id="avail-date" label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <p className="pb-2 text-sm text-surface-500">
            1-hour slots generated from working hours; booked slots are marked unavailable.
          </p>
        </div>
        {closedToday && <p className="mt-3 text-sm text-warning-600">Closed on this day per working hours.</p>}
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {resources.map((resource) => {
          const slots = slotsByResource[resource] ?? []
          const free = slots.filter((s) => s.available).length
          return (
            <Card key={resource} className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-surface-900">{resource}</h3>
                <Badge variant={free > 0 ? 'success' : 'danger'}>
                  {free} of {slots.length} free
                </Badge>
              </div>
              {slots.length === 0 ? (
                <p className="text-sm text-surface-400">Closed.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {slots.map((s) => (
                    <span
                      key={s.start}
                      className={`rounded-md border px-2 py-1 text-xs font-medium ${
                        s.available
                          ? 'border-success-200 bg-success-50 text-success-700'
                          : 'border-surface-200 bg-surface-50 text-surface-400 line-through'
                      }`}
                      title={s.available ? `${s.start}–${s.end} (free)` : `${s.start}–${s.end} (booked)`}
                    >
                      {s.start}
                    </span>
                  ))}
                </div>
              )}
            </Card>
          )
        })}
        {resources.length === 0 && <Card className="p-6 col-span-full text-center text-sm text-surface-500">No resources yet.</Card>}
      </div>

      <Modal
        open={hoursOpen}
        onClose={() => {
          setHoursOpen(false)
          getWorkingHours().then(setHours)
        }}
        title="Working hours"
        description="Days with no hours set are treated as closed. Changes apply to slot generation across the app."
      >
        <div className="space-y-3">
          {DAY_KEYS.map((day) => {
            const d = hours[day] ?? { open: null, close: null }
            const open = d.open ?? ''
            const close = d.close ?? ''
            return (
              <div key={day} className="flex items-center gap-3">
                <span className="w-24 text-sm font-medium text-surface-700">{dayLabel(day)}</span>
                <div className="grid grid-cols-2 gap-2">
                  <Select
                    id={`hours-${day}-open`}
                    label=""
                    value={open}
                    options={['Closed', '08:00', '09:00', '10:00'].map((t) => ({ value: t === 'Closed' ? '' : t, label: t }))}
                    onChange={(e) => setDayHour(day, 'open', e.target.value)}
                  />
                  <Select
                    id={`hours-${day}-close`}
                    label=""
                    value={close}
                    options={['Closed', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'].map((t) => ({ value: t === 'Closed' ? '' : t, label: t }))}
                    onChange={(e) => setDayHour(day, 'close', e.target.value)}
                  />
                </div>
              </div>
            )
          })}
          <p className="text-xs text-surface-400">Open and close times share the same selected hour options; leave either as Closed for a day off.</p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setHoursOpen(false)}>Cancel</Button>
            <Button onClick={saveHours}>Save hours</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}