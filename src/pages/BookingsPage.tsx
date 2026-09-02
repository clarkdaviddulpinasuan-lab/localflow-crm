import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, Plus, CalendarCheck } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Pagination } from '@/components/ui/Pagination'
import { Badge, getStatusBadge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Select } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Skeleton'
import { BookingForm, type BookingFormData } from '@/features/bookings/BookingForm'
import { formatCurrency } from '@/utils/format'
import {
  listBookings,
  createBooking,
  updateBooking,
  cancelBooking,
  deleteBooking,
  bookingSearchFields,
} from '@/services/bookingService'
import { listCustomers } from '@/services/customerService'
import { listOrders } from '@/services/orderService'
import type { Booking, Order } from '@/types'
import { useBusiness } from '@/contexts/BusinessContext'

export function BookingsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { terminology } = useBusiness()
  const [data, setData] = useState<Booking[]>([])
  const [customers, setCustomers] = useState<{ value: string; label: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [sortBy, setSortBy] = useState('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const [perPage] = useState(10)
  const [total, setTotal] = useState(0)
  const [modalOpen, setModalOpen] = useState(
    searchParams.get('new') === '1' || false
  )
  const [editing, setEditing] = useState<Booking | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailBooking, setDetailBooking] = useState<Booking | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [bookingOrders, setBookingOrders] = useState<Order[]>([])

  const defaultCustomerId = searchParams.get('customer') ?? undefined

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listBookings({
        search,
        searchFields: bookingSearchFields,
        filters: { status: status || undefined },
        sortBy: sortBy as keyof Booking,
        sortDir,
        page,
        perPage,
      })
      setData(res.data)
      setTotal(res.total)
    } finally {
      setLoading(false)
    }
  }, [search, status, sortBy, sortDir, page, perPage])

  useEffect(() => {
    const customerList = listCustomers({ perPage: 9999 })
    customerList.then((res) => {
      setCustomers(
        res.data.map((c) => ({ value: c.id, label: `${c.first_name} ${c.last_name}` }))
      )
    })
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData()
    }, 250)
    return () => clearTimeout(timer)
  }, [loadData])

  const totalPages = Math.max(1, Math.ceil(total / perPage))

  const customerName = useMemo(() => {
    const map = new Map(customers.map((c) => [c.value, c.label]))
    return (id: string) => map.get(id) ?? 'Unknown'
  }, [customers])

  function handleSort(key: string) {
    if (sortBy === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortBy(key)
      setSortDir('asc')
    }
  }

  async function handleSave(values: BookingFormData) {
    setSaving(true)
    try {
      if (editing) {
        const { customer_id: _customer_id, ...rest } = values
        await updateBooking(editing.id, rest)
      } else {
        await createBooking(values)
      }
      setModalOpen(false)
      setEditing(null)
      setSearchParams({})
      await loadData()
    } finally {
      setSaving(false)
    }
  }

  function openDetail(b: Booking) {
    setDetailBooking(b)
    setDetailOpen(true)
  }

  async function handleCancel() {
    if (!detailBooking) return
    await cancelBooking(detailBooking.id)
    setDetailOpen(false)
    setCancelOpen(false)
    await loadData()
  }

  async function handleDelete() {
    if (!detailBooking) return
    await deleteBooking(detailBooking.id)
    setDetailOpen(false)
    setCancelOpen(false)
    await loadData()
  }

  useEffect(() => {
    if (!detailBooking) {
      setBookingOrders([])
      return
    }
    listOrders({ filters: { booking_id: detailBooking.id }, perPage: 50 }).then((res) => {
      setBookingOrders(res.data)
    })
  }, [detailBooking])

  const columns: Column<Booking>[] = useMemo(
    () => [
      {
        key: 'customer',
        header: 'Customer',
        sortable: true,
        sortValue: (r) => customerName(r.customer_id),
        render: (r) => <span className="font-medium text-surface-900">{customerName(r.customer_id)}</span>,
      },
      {
        key: 'resource',
        header: terminology.resourceLabel,
        sortable: true,
        render: (r) => <span className="text-surface-700">{r.resource}</span>,
        hideOnMobile: true,
      },
      {
        key: 'date',
        header: 'Date',
        sortable: true,
        render: (r) => <span>{new Date(r.date + 'T00:00:00').toLocaleDateString()}</span>,
      },
      {
        key: 'status',
        header: 'Status',
        sortable: true,
        render: (r) => {
          const b = getStatusBadge(r.status)
          return <Badge variant={b.variant}>{b.label}</Badge>
        },
      },
      {
        key: 'amount',
        header: 'Amount',
        sortable: true,
        render: (r) => <span className="font-medium text-surface-900">{formatCurrency(r.amount)}</span>,
        hideOnMobile: true,
      },
      {
        key: 'payment_status',
        header: 'Payment',
        sortable: true,
        render: (r) => <Badge variant={getStatusBadge(r.payment_status).variant}>{getStatusBadge(r.payment_status).label}</Badge>,
        hideOnMobile: true,
      },
    ],
    [customerName, terminology.resourceLabel]
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title={terminology.entitiesPlural}
        description={`Manage your ${terminology.bookingLabel.toLowerCase()}s and availability.`}
        actions={
          <Button
            icon={<Plus className="h-4 w-4" />}
            onClick={() => {
              setEditing(null)
              setModalOpen(true)
            }}
          >
            {terminology.bookingLabel === 'Order' || terminology.bookingLabel === 'Booking'
              ? `Create ${terminology.bookingLabel}`
              : `New ${terminology.bookingLabel}`}
          </Button>
        }
      />

      <Card padding={false}>
        <div className="p-4 border-b border-surface-100 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-surface-400">
              <Search className="h-4 w-4" />
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              placeholder={`Search by ${terminology.resourceLabel.toLowerCase()} or notes...`}
              className="w-full h-9 pl-9 pr-3 text-sm rounded-lg border border-surface-200 bg-surface-50 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-colors"
            />
          </div>
          <Select
            id="status-filter"
            options={[
              { value: '', label: 'All statuses' },
              ...['pending', 'confirmed', 'checked_in', 'completed', 'cancelled', 'no_show'].map((v) => ({
                value: v,
                label: v.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
              })),
            ]}
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1) }}
            className="w-44"
          />
        </div>

        {loading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : (
          <>
            <DataTable
              columns={columns}
              data={data}
              rowKey={(r) => r.id}
              onRowClick={openDetail}
              onSort={handleSort}
              sortBy={sortBy}
              sortDir={sortDir}
              emptyState={
                <EmptyState
                  icon={<CalendarCheck className="h-6 w-6" />}
                  title={`No ${terminology.bookingLabel.toLowerCase()}s yet`}
                  description={`Get started by creating your first ${terminology.bookingLabel.toLowerCase()}.`}
                  action={
                    <Button icon={<Plus className="h-4 w-4" />} onClick={() => { setEditing(null); setModalOpen(true) }}>
                      Create {terminology.bookingLabel}
                    </Button>
                  }
                />
              }
            />
            <Pagination page={page} totalPages={totalPages} total={total} perPage={perPage} onPageChange={setPage} />
          </>
        )}
      </Card>

      <BookingForm
        key={modalOpen ? `open-${editing?.id ?? 'new'}` : 'closed'}
        open={modalOpen}
        onClose={() => { setModalOpen(false); setSearchParams({}) }}
        onSave={handleSave}
        initial={editing ?? undefined}
        loading={saving}
        customerOptions={customers}
        defaultCustomerId={editing ? undefined : defaultCustomerId}
      />

      <Modal
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false)
          setDetailBooking(null)
        }}
        title="Booking details"
        size="sm"
      >
        {detailBooking && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-surface-900">{customerName(detailBooking.customer_id)}</p>
                <p className="text-sm text-surface-500">{detailBooking.resource}</p>
              </div>
              <Badge variant={getStatusBadge(detailBooking.status).variant}>
                {getStatusBadge(detailBooking.status).label}
              </Badge>
            </div>
            <dl className="text-sm space-y-2 border-t border-surface-100 pt-4">
              <div className="flex justify-between"><dt className="text-surface-500">Date</dt><dd className="font-medium text-surface-900">{new Date(detailBooking.date + 'T00:00:00').toLocaleDateString()}</dd></div>
              <div className="flex justify-between"><dt className="text-surface-500">Time</dt><dd className="font-medium text-surface-900">{detailBooking.start_time} – {detailBooking.end_time}</dd></div>
              <div className="flex justify-between"><dt className="text-surface-500">Guests</dt><dd className="font-medium text-surface-900">{detailBooking.guests}</dd></div>
              <div className="flex justify-between"><dt className="text-surface-500">Amount</dt><dd className="font-semibold text-surface-900">{formatCurrency(detailBooking.amount)}</dd></div>
              <div className="flex justify-between"><dt className="text-surface-500">Payment</dt><dd><Badge variant={getStatusBadge(detailBooking.payment_status).variant}>{getStatusBadge(detailBooking.payment_status).label}</Badge></dd></div>
              {detailBooking.notes && (
                <div className="flex justify-between"><dt className="text-surface-500">Notes</dt><dd className="font-medium text-surface-900 max-w-[60%] text-right">{detailBooking.notes}</dd></div>
              )}
            </dl>

            {bookingOrders.length > 0 && (
              <div className="border-t border-surface-100 pt-4">
                <h4 className="text-sm font-semibold text-surface-900 mb-2">Orders on this stay</h4>
                <ul className="space-y-2">
                  {bookingOrders.map((o) => (
                    <li key={o.id} className="flex items-center justify-between p-2 rounded-lg border border-surface-100">
                      <div>
                        <p className="text-sm font-medium text-surface-900">{o.order_number}</p>
                        <p className="text-xs text-surface-500">{o.items}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={getStatusBadge(o.payment_status).variant}>{getStatusBadge(o.payment_status).label}</Badge>
                        <span className="text-sm font-semibold text-surface-900">{formatCurrency(o.total)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              <Button variant="secondary" onClick={() => { setDetailOpen(false); setEditing(detailBooking); setModalOpen(true) }}>
                Edit
              </Button>
              <Button
                icon={<Plus className="h-4 w-4" />}
                onClick={() => {
                  const url = `/orders?booking=${detailBooking.id}&customer=${detailBooking.customer_id}&new=1`
                  window.location.href = url
                }}
              >
                Record order
              </Button>
              {detailBooking.status !== 'cancelled' && (
                <Button variant="secondary" onClick={() => setCancelOpen(true)}>Cancel booking</Button>
              )}
              <Button variant="danger" onClick={() => setCancelOpen(true)}>Delete</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title="Confirm" size="sm">
        <p className="text-sm text-surface-600 mb-6">
          Are you sure you want to {detailBooking?.status === 'cancelled' ? 'delete this' : 'cancel this'} booking? This cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setCancelOpen(false)}>Keep booking</Button>
          <Button variant="danger" onClick={detailBooking?.status === 'cancelled' ? handleDelete : handleCancel}>
            {detailBooking?.status === 'cancelled' ? 'Delete' : 'Cancel booking'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
