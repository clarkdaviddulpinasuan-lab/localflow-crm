import { useState, type FormEvent } from 'react'
import { ChevronDown, ChevronRight, CalendarCheck, ShoppingCart, ClipboardList } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Input, Select, Textarea, FieldWrapper } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { useBusiness } from '@/contexts/BusinessContext'
import type {
  Customer,
  CustomerStatus,
  CustomerType,
  BookingStatus,
  PaymentStatus,
  OrderStatus,
  TaskPriority,
  TaskStatus,
} from '@/types'

const statusOptions: { value: CustomerStatus; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'active', label: 'Active' },
  { value: 'vip', label: 'VIP' },
  { value: 'inactive', label: 'Inactive' },
]

const typeOptions: { value: CustomerType; label: string }[] = [
  { value: 'guest', label: 'Guest' },
  { value: 'local', label: 'Local' },
  { value: 'corporate', label: 'Corporate' },
  { value: 'regular', label: 'Regular' },
  { value: 'walk_in', label: 'Walk-in' },
]

const bookingStatusOptions: { value: BookingStatus; label: string }[] = [
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

const orderStatusOptions: { value: OrderStatus; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'processing', label: 'Processing' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

const priorityOptions: { value: TaskPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

const taskStatusOptions: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
]

export interface BookingData {
  resource: string
  date: string
  start_time: string
  end_time: string
  guests: number
  amount: number
  status: BookingStatus
  payment_status: PaymentStatus
  notes: string
}

export interface OrderData {
  items: string
  description: string
  total: number
  status: OrderStatus
  payment_status: PaymentStatus
  staff_member: string
}

export interface TaskData {
  title: string
  description: string
  due_date: string
  priority: TaskPriority
  status: TaskStatus
}

interface CustomerFormValues {
  first_name: string
  last_name: string
  email: string
  phone: string
  type: CustomerType
  status: CustomerStatus
  booking?: BookingData
  order?: OrderData
  task?: TaskData
}

interface CustomerFormProps {
  open: boolean
  onClose: () => void
  onSave: (values: CustomerFormValues) => Promise<void>
  initial?: Customer
  loading?: boolean
}

export interface CustomerFormData extends CustomerFormValues {}

function SectionToggle({
  icon,
  label,
  enabled,
  onToggle,
  preview,
}: {
  icon: React.ReactNode
  label: string
  enabled: boolean
  onToggle: () => void
  preview?: string
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors ${
        enabled
          ? 'border-primary-300 bg-primary-50 text-primary-700'
          : 'border-surface-200 bg-white text-surface-600 hover:bg-surface-50'
      }`}
    >
      <div className={`flex-shrink-0 ${enabled ? 'text-primary-600' : 'text-surface-400'}`}>{icon}</div>
      <span className="flex-1 text-left text-sm font-medium">{label}</span>
      {preview && <span className="text-xs text-surface-400 mr-2">{preview}</span>}
      {enabled ? <ChevronDown className="h-4 w-4 flex-shrink-0" /> : <ChevronRight className="h-4 w-4 flex-shrink-0" />}
    </button>
  )
}

export function CustomerForm({ open, onClose, onSave, initial, loading }: CustomerFormProps) {
  const { terminology } = useBusiness()
  const isCreate = !initial

  const [values, setValues] = useState<CustomerFormValues>({
    first_name: initial?.first_name ?? '',
    last_name: initial?.last_name ?? '',
    email: initial?.email ?? '',
    phone: initial?.phone ?? '',
    type: initial?.type ?? 'regular',
    status: initial?.status ?? 'new',
  })

  const [showBooking, setShowBooking] = useState(false)
  const [showOrder, setShowOrder] = useState(false)
  const [showTask, setShowTask] = useState(false)

  const [booking, setBookingState] = useState<BookingData>({
    resource: '',
    date: new Date().toISOString().slice(0, 10),
    start_time: '14:00',
    end_time: '12:00',
    guests: 1,
    amount: 0,
    status: 'pending',
    payment_status: 'pending',
    notes: '',
  })

  const [order, setOrderState] = useState<OrderData>({
    items: '',
    description: '',
    total: 0,
    status: 'new',
    payment_status: 'pending',
    staff_member: '',
  })

  const [task, setTaskState] = useState<TaskData>({
    title: '',
    description: '',
    due_date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    priority: 'medium',
    status: 'todo',
  })

  const [errors, setErrors] = useState<Partial<Record<string, string>>>({})

  function set<K extends keyof CustomerFormValues>(key: K, value: CustomerFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  function setBooking<K extends keyof BookingData>(key: K, value: BookingData[K]) {
    setBookingState((prev) => ({ ...prev, [key]: value }))
    setErrors((e) => ({ ...e, [`booking.${key}`]: undefined }))
  }

  function setOrder<K extends keyof OrderData>(key: K, value: OrderData[K]) {
    setOrderState((prev) => ({ ...prev, [key]: value }))
    setErrors((e) => ({ ...e, [`order.${key}`]: undefined }))
  }

  function setTask<K extends keyof TaskData>(key: K, value: TaskData[K]) {
    setTaskState((prev) => ({ ...prev, [key]: value }))
    setErrors((e) => ({ ...e, [`task.${key}`]: undefined }))
  }

  function validate(): boolean {
    const next: Record<string, string> = {}
    if (!values.first_name.trim()) next.first_name = 'First name is required'
    if (!values.last_name.trim()) next.last_name = 'Last name is required'
    if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
      next.email = 'Enter a valid email address'
    }

    if (showBooking) {
      if (!booking.resource.trim()) next['booking.resource'] = `${terminology.resourceLabel} is required`
      if (!booking.date) next['booking.date'] = 'Date is required'
      if (!booking.start_time) next['booking.start_time'] = 'Start time is required'
      if (booking.guests < 1) next['booking.guests'] = 'At least 1 guest'
    }

    if (showOrder) {
      if (!order.items.trim()) next['order.items'] = 'Items are required'
    }

    if (showTask) {
      if (!task.title.trim()) next['task.title'] = 'Title is required'
      if (!task.due_date) next['task.due_date'] = 'Due date is required'
    }

    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!validate()) return
    const result: CustomerFormValues = {
      ...values,
      email: values.email.trim() || '',
      phone: values.phone.trim(),
    }
    if (showBooking) result.booking = { ...booking }
    if (showOrder) result.order = { ...order }
    if (showTask) result.task = { ...task }
    await onSave(result)
  }

  const uniqueResources = Array.from(new Set(terminology.defaultResources))

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? 'Edit customer' : 'Add customer'}
      description={initial ? 'Update the customer details below.' : 'Add a new customer and optionally create a booking, order, or task.'}
    >
      <form onSubmit={handleSubmit} className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
        {/* Customer Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            id="first_name"
            label="First name"
            required
            value={values.first_name}
            onChange={(e) => set('first_name', e.target.value)}
            error={errors.first_name}
            placeholder="e.g. Maria"
          />
          <Input
            id="last_name"
            label="Last name"
            required
            value={values.last_name}
            onChange={(e) => set('last_name', e.target.value)}
            error={errors.last_name}
            placeholder="e.g. Santos"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            id="email"
            label="Email"
            type="email"
            value={values.email}
            onChange={(e) => set('email', e.target.value)}
            error={errors.email}
            placeholder="customer@email.com"
            hint="Optional"
          />
          <Input
            id="phone"
            label="Phone"
            type="tel"
            value={values.phone}
            onChange={(e) => set('phone', e.target.value)}
            placeholder="+63 900 000 0000"
            hint="Optional"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            id="type"
            label="Customer type"
            value={values.type}
            onChange={(e) => set('type', e.target.value as CustomerType)}
            options={typeOptions}
          />
          <Select
            id="status"
            label="Status"
            value={values.status}
            onChange={(e) => set('status', e.target.value as CustomerStatus)}
            options={statusOptions}
          />
        </div>

        {/* Related Entity Sections (create mode only) */}
        {isCreate && (
          <div className="space-y-3 pt-2 border-t border-surface-100">
            <p className="text-xs font-medium text-surface-500 uppercase tracking-wider">Also create</p>

            {/* Booking Section */}
            <SectionToggle
              icon={<CalendarCheck className="h-4 w-4" />}
              label={`Create ${terminology.bookingLabel}`}
              enabled={showBooking}
              onToggle={() => setShowBooking(!showBooking)}
              preview={showBooking && booking.amount > 0 ? `${terminology.bookingLabel}: ${formatAmt(booking.amount)}` : undefined}
            />
            {showBooking && (
              <div className="space-y-3 pl-7 pr-1 pb-1">
                <FieldWrapper label={`${terminology.resourceLabel}`} required error={errors['booking.resource']}>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {uniqueResources.map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setBooking('resource', r)}
                        className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                          booking.resource === r
                            ? 'bg-primary-50 border-primary-300 text-primary-700'
                            : 'border-surface-200 text-surface-600 hover:bg-surface-50'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                  <Input
                    id="booking_resource"
                    value={booking.resource}
                    onChange={(e) => setBooking('resource', e.target.value)}
                    placeholder={`e.g. ${terminology.defaultResources[0]}`}
                  />
                </FieldWrapper>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    id="booking_date"
                    label="Date"
                    type="date"
                    required
                    value={booking.date}
                    onChange={(e) => setBooking('date', e.target.value)}
                    error={errors['booking.date']}
                  />
                  <Input
                    id="booking_guests"
                    label="Guests"
                    type="number"
                    min={1}
                    value={booking.guests}
                    onChange={(e) => setBooking('guests', parseInt(e.target.value) || 1)}
                    error={errors['booking.guests']}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Input
                    id="booking_start_time"
                    label="Check-in / Start"
                    type="time"
                    required
                    value={booking.start_time}
                    onChange={(e) => setBooking('start_time', e.target.value)}
                    error={errors['booking.start_time']}
                  />
                  <Input
                    id="booking_end_time"
                    label="Check-out / End"
                    type="time"
                    value={booking.end_time}
                    onChange={(e) => setBooking('end_time', e.target.value)}
                  />
                  <Input
                    id="booking_amount"
                    label="Amount"
                    type="number"
                    min={0}
                    step="0.01"
                    value={booking.amount}
                    onChange={(e) => setBooking('amount', parseFloat(e.target.value) || 0)}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Select
                    id="booking_status"
                    label="Status"
                    value={booking.status}
                    onChange={(e) => setBooking('status', e.target.value as BookingStatus)}
                    options={bookingStatusOptions}
                  />
                  <Select
                    id="booking_payment"
                    label="Payment"
                    value={booking.payment_status}
                    onChange={(e) => setBooking('payment_status', e.target.value as PaymentStatus)}
                    options={paymentOptions}
                  />
                </div>

                <Textarea
                  id="booking_notes"
                  label="Notes"
                  value={booking.notes}
                  onChange={(e) => setBooking('notes', e.target.value)}
                  placeholder="Optional notes about this booking"
                  rows={2}
                />
              </div>
            )}

            {/* Order Section */}
            <SectionToggle
              icon={<ShoppingCart className="h-4 w-4" />}
              label="Create order"
              enabled={showOrder}
              onToggle={() => setShowOrder(!showOrder)}
              preview={showOrder && order.total > 0 ? `Order: ${formatAmt(order.total)}` : undefined}
            />
            {showOrder && (
              <div className="space-y-3 pl-7 pr-1 pb-1">
                <Input
                  id="order_items"
                  label="Items / Description"
                  required
                  value={order.items}
                  onChange={(e) => setOrder('items', e.target.value)}
                  error={errors['order.items']}
                  placeholder="e.g. Island Hopping Tour Package"
                />

                <Textarea
                  id="order_description"
                  label="Details"
                  value={order.description}
                  onChange={(e) => setOrder('description', e.target.value)}
                  placeholder="Optional details about the order"
                  rows={2}
                />

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Input
                    id="order_total"
                    label="Total"
                    type="number"
                    min={0}
                    step="0.01"
                    value={order.total}
                    onChange={(e) => setOrder('total', parseFloat(e.target.value) || 0)}
                  />
                  <Select
                    id="order_status"
                    label="Status"
                    value={order.status}
                    onChange={(e) => setOrder('status', e.target.value as OrderStatus)}
                    options={orderStatusOptions}
                  />
                  <Select
                    id="order_payment"
                    label="Payment"
                    value={order.payment_status}
                    onChange={(e) => setOrder('payment_status', e.target.value as PaymentStatus)}
                    options={paymentOptions}
                  />
                </div>

                <Input
                  id="order_staff"
                  label="Staff member"
                  value={order.staff_member}
                  onChange={(e) => setOrder('staff_member', e.target.value)}
                  placeholder="e.g. Marco"
                  hint="Optional"
                />
              </div>
            )}

            {/* Task Section */}
            <SectionToggle
              icon={<ClipboardList className="h-4 w-4" />}
              label="Create task"
              enabled={showTask}
              onToggle={() => setShowTask(!showTask)}
            />
            {showTask && (
              <div className="space-y-3 pl-7 pr-1 pb-1">
                <Input
                  id="task_title"
                  label="Title"
                  required
                  value={task.title}
                  onChange={(e) => setTask('title', e.target.value)}
                  error={errors['task.title']}
                  placeholder="e.g. Call guest regarding airport transfer"
                />

                <Textarea
                  id="task_description"
                  label="Description"
                  value={task.description}
                  onChange={(e) => setTask('description', e.target.value)}
                  placeholder="Optional details"
                  rows={2}
                />

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Input
                    id="task_due_date"
                    label="Due date"
                    type="date"
                    required
                    value={task.due_date}
                    onChange={(e) => setTask('due_date', e.target.value)}
                    error={errors['task.due_date']}
                  />
                  <Select
                    id="task_priority"
                    label="Priority"
                    value={task.priority}
                    onChange={(e) => setTask('priority', e.target.value as TaskPriority)}
                    options={priorityOptions}
                  />
                  <Select
                    id="task_status"
                    label="Status"
                    value={task.status}
                    onChange={(e) => setTask('status', e.target.value as TaskStatus)}
                    options={taskStatusOptions}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {isCreate && (showBooking || showOrder) && (
          <div className="flex items-center justify-between rounded-lg border border-surface-200 bg-surface-50 px-4 py-3 text-sm">
            <span className="text-surface-600 font-medium">Customer total spent</span>
            <span className="font-semibold text-surface-900">
              {formatAmt((showBooking ? booking.amount : 0) + (showOrder ? order.total : 0))}
            </span>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 sticky bottom-0 bg-white border-t border-surface-100 -mx-1 px-1 pb-1">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            {initial ? 'Save changes' : 'Add customer'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function formatAmt(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}
