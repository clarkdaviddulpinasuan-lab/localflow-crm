import { useState, type FormEvent } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Input, Select, Textarea } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import type { Order, OrderStatus, PaymentStatus } from '@/types'
import { nextOrderNumber } from '@/services/orderService'

const orderStatusOptions: { value: OrderStatus; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'processing', label: 'Processing' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

const paymentOptions: { value: PaymentStatus; label: string }[] = [
  { value: 'paid', label: 'Paid' },
  { value: 'pending', label: 'Pending' },
  { value: 'partial', label: 'Partial' },
  { value: 'refunded', label: 'Refunded' },
]

interface OrderFormValues {
  customer_id: string
  booking_id: string
  items: string
  description: string
  total: number
  payment_status: PaymentStatus
  status: OrderStatus
  staff_member: string
}

interface OrderFormProps {
  open: boolean
  onClose: () => void
  onSave: (values: OrderFormValues) => Promise<void>
  initial?: Order
  loading?: boolean
  customerOptions: { value: string; label: string }[]
  defaultCustomerId?: string
  bookings?: { value: string; label: string }[]
  defaultBookingId?: string
}

export interface OrderFormData extends OrderFormValues {}

export function OrderForm({
  open,
  onClose,
  onSave,
  initial,
  loading,
  customerOptions,
  defaultCustomerId,
  bookings = [],
  defaultBookingId,
}: OrderFormProps) {
  const [values, setValues] = useState<OrderFormValues>({
    customer_id: defaultCustomerId ?? initial?.customer_id ?? '',
    booking_id: defaultBookingId ?? initial?.booking_id ?? '',
    items: initial?.items ?? '',
    description: initial?.description ?? '',
    total: initial?.total ?? 0,
    payment_status: initial?.payment_status ?? 'pending',
    status: initial?.status ?? 'new',
    staff_member: initial?.staff_member ?? '',
  })
  const [errors, setErrors] = useState<Partial<Record<keyof OrderFormValues, string>>>({})

  const availableBookings = values.customer_id
    ? bookings.filter((b) => b.value.startsWith(values.customer_id + ':'))
    : []

  const selectedBookingValue = values.booking_id
    ? bookings.find((b) => b.value.endsWith(':' + values.booking_id))?.value ?? ''
    : ''

  function set<K extends keyof OrderFormValues>(key: K, value: OrderFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  function validate(): boolean {
    const next: Partial<Record<keyof OrderFormValues, string>> = {}
    if (!values.customer_id) next.customer_id = 'Please select a customer'
    if (!values.items.trim()) next.items = 'Items are required'
    if (values.total < 0) next.total = 'Total cannot be negative'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!validate()) return
    await onSave(values)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? 'Edit order' : 'Create order'}
      description={initial ? `Order ${initial.order_number}` : `Number will be ${nextOrderNumber()}`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          id="customer_id"
          label="Customer"
          required
          value={values.customer_id}
          onChange={(e) => {
            const customerId = e.target.value
            const selected = values.booking_id
              ? bookings.find((b) => b.value.endsWith(':' + values.booking_id))
              : undefined
            set('customer_id', customerId)
            if (selected && !selected.value.startsWith(customerId + ':')) {
              set('booking_id', '')
            }
          }}
          error={errors.customer_id}
          options={[{ value: '', label: 'Select customer...' }, ...customerOptions]}
        />

        {availableBookings.length > 0 && (
          <Select
            id="booking_id"
            label="Booking / Stay (optional)"
            value={selectedBookingValue}
            onChange={(e) => {
              const v = e.target.value
              set('booking_id', v ? v.split(':')[1] : '')
            }}
            options={[{ value: '', label: 'No linked stay' }, ...availableBookings]}
          />
        )}

        <Input
          id="items"
          label="Items / Description"
          required
          value={values.items}
          onChange={(e) => set('items', e.target.value)}
          error={errors.items}
          placeholder="e.g. Island Hopping Tour Package"
        />

        <Textarea
          id="description"
          label="Details"
          value={values.description}
          onChange={(e) => set('description', e.target.value)}
          placeholder="Optional details about the order"
          rows={3}
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input
            id="total"
            label="Total"
            type="number"
            min={0}
            step="0.01"
            value={values.total}
            onChange={(e) => set('total', parseFloat(e.target.value) || 0)}
            error={errors.total}
          />
          <Select
            id="status"
            label="Status"
            value={values.status}
            onChange={(e) => set('status', e.target.value as OrderStatus)}
            options={orderStatusOptions}
          />
          <Select
            id="payment_status"
            label="Payment"
            value={values.payment_status}
            onChange={(e) => set('payment_status', e.target.value as PaymentStatus)}
            options={paymentOptions}
          />
        </div>

        <Input
          id="staff_member"
          label="Staff member"
          value={values.staff_member}
          onChange={(e) => set('staff_member', e.target.value)}
          placeholder="e.g. Marco"
          hint="Optional"
        />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={loading}>
            {initial ? 'Save changes' : 'Create order'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
