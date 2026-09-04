import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Input, Select, Textarea, FieldWrapper } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { DateRangePicker, type DateRange } from '@/components/ui/DateRangePicker'
import { Combobox } from '@/components/ui/Combobox'
import { useBusiness } from '@/contexts/BusinessContext'
import { getActiveResources } from '@/services/resourceService'
import type { Booking, BookingStatus, PaymentStatus } from '@/types'

const statusOptions: { value: BookingStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'checked_in', label: 'Checked In' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'no_show', label: 'No-show' },
]

const paymentOptions: { value: PaymentStatus; label: string }[] = [
  { value: 'paid', label: 'Paid' },
  { value: 'pending', label: 'Pending' },
  { value: 'partial', label: 'Partial' },
  { value: 'refunded', label: 'Refunded' },
]

interface BookingFormValues {
  customer_id: string
  resource: string
  date: string
  end_date: string
  start_time: string
  end_time: string
  guests: number
  status: BookingStatus
  amount: number
  payment_status: PaymentStatus
  notes: string
}

interface BookingFormProps {
  open: boolean
  onClose: () => void
  onSave: (values: BookingFormValues) => Promise<void>
  initial?: Booking
  loading?: boolean
  customerOptions: { value: string; label: string }[]
  defaultCustomerId?: string
}

export interface BookingFormData extends BookingFormValues {}

export function BookingForm({
  open,
  onClose,
  onSave,
  initial,
  loading,
  customerOptions,
  defaultCustomerId,
}: BookingFormProps) {
  const { terminology } = useBusiness()
  const [dbResources, setDbResources] = useState<{ name: string; color?: string | null }[]>([])
  const [values, setValues] = useState<BookingFormValues>({
    customer_id: defaultCustomerId ?? initial?.customer_id ?? '',
    resource: initial?.resource ?? '',
    date: initial?.date ?? new Date().toISOString().slice(0, 10),
    end_date: initial?.end_date ?? '',
    start_time: initial?.start_time ?? '14:00',
    end_time: initial?.end_time ?? '12:00',
    guests: initial?.guests ?? 1,
    status: initial?.status ?? 'pending',
    amount: initial?.amount ?? 0,
    payment_status: initial?.payment_status ?? 'pending',
    notes: initial?.notes ?? '',
  })
  const [errors, setErrors] = useState<Partial<Record<keyof BookingFormValues, string>>>({})

  useEffect(() => {
    if (!open) return
    getActiveResources()
      .then((resources) => setDbResources(resources.map((r) => ({ name: r.name, color: r.color }))))
      .catch(() => setDbResources([]))
  }, [open])

  function set<K extends keyof BookingFormValues>(key: K, value: BookingFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  function handleRangeChange({ start, end }: DateRange) {
    set('date', start ?? '')
    set('end_date', end ?? '')
  }

  function validate(): boolean {
    const next: Partial<Record<keyof BookingFormValues, string>> = {}
    if (!values.customer_id) next.customer_id = 'Please select a customer'
    if (!values.resource.trim()) next.resource = `${terminology.resourceLabel} is required`
    if (!values.date) next.date = 'Date is required'
    if (!values.start_time) next.start_time = 'Start time is required'
    if (values.guests < 1) next.guests = 'At least 1 guest'
    if (values.amount < 0) next.amount = 'Amount cannot be negative'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!validate()) return
    await onSave(values)
  }

  const resourceColors = useMemo(() => {
    const map = new Map<string, string | null>()
    dbResources.forEach((r) => map.set(r.name, r.color ?? null))
    if (initial?.resource) map.set(initial.resource, null)
    return map
  }, [dbResources, initial])

  const uniqueResources = useMemo(() => {
    const names = new Set<string>()
    dbResources.forEach((r) => names.add(r.name))
    if (initial?.resource) names.add(initial.resource)
    return Array.from(names)
  }, [dbResources, initial])

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? 'Edit booking' : `Create ${terminology.bookingLabel}`}
      description={terminology.bookingLabel === 'Reservation'
        ? 'Book a table for your customer.'
        : 'Schedule a stay for your guest.'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          id="customer_id"
          label="Customer"
          required
          value={values.customer_id}
          onChange={(e) => set('customer_id', e.target.value)}
          error={errors.customer_id}
          options={[{ value: '', label: 'Select customer...' }, ...customerOptions]}
        />

        <FieldWrapper label={terminology.resourceLabel} required error={errors.resource}>
          <div className="flex flex-wrap gap-2 mb-2">
            {uniqueResources.map((r) => {
              const color = resourceColors.get(r)
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => set('resource', r)}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                    values.resource === r
                      ? 'bg-primary-50 border-primary-300 text-primary-700'
                      : 'border-surface-200 text-surface-600 hover:bg-surface-50'
                  }`}
                >
                  {color && (
                    <span
                      className="inline-block h-2 w-2 rounded-full mr-1.5 -mb-px"
                      style={{ backgroundColor: color }}
                    />
                  )}
                  {r}
                </button>
              )
            })}
          </div>
          <Combobox
            id="resource"
            value={values.resource}
            onChange={(v) => set('resource', v)}
            options={uniqueResources.map((r) => ({ value: r, label: r }))}
            placeholder={`Search ${terminology.resourceLabel.toLowerCase()}...`}
            emptyMessage={`No ${terminology.resourceLabel.toLowerCase()} matches`}
            className="mt-1"
          />
        </FieldWrapper>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-surface-700">Dates</label>
          <DateRangePicker
            value={{ start: values.date || null, end: values.end_date || null }}
            onChange={handleRangeChange}
          />
          {errors.date && <p className="text-xs text-danger-600">{errors.date}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input
            id="start_time"
            label="Check-in / Start"
            type="time"
            required
            value={values.start_time}
            onChange={(e) => set('start_time', e.target.value)}
            error={errors.start_time}
          />
          <Input
            id="end_time"
            label="Check-out / End"
            type="time"
            value={values.end_time}
            onChange={(e) => set('end_time', e.target.value)}
          />
          <Input
            id="guests"
            label="Guests"
            type="number"
            min={1}
            value={values.guests}
            onChange={(e) => set('guests', parseInt(e.target.value) || 1)}
            error={errors.guests}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Select
            id="status"
            label="Status"
            value={values.status}
            onChange={(e) => set('status', e.target.value as BookingStatus)}
            options={statusOptions}
          />
          <Select
            id="payment_status"
            label="Payment"
            value={values.payment_status}
            onChange={(e) => set('payment_status', e.target.value as PaymentStatus)}
            options={paymentOptions}
          />
          <Input
            id="amount"
            label="Amount"
            type="number"
            min={0}
            step="0.01"
            value={values.amount}
            onChange={(e) => set('amount', parseFloat(e.target.value) || 0)}
            error={errors.amount}
          />
        </div>

        <Textarea
          id="notes"
          label="Notes"
          value={values.notes}
          onChange={(e) => set('notes', e.target.value)}
          placeholder="Optional notes about this booking"
          rows={3}
        />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            {initial ? 'Save changes' : `Create ${terminology.bookingLabel}`}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
