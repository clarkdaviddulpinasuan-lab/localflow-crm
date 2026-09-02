import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, Plus, ShoppingCart } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Pagination } from '@/components/ui/Pagination'
import { Badge, getStatusBadge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Select } from '@/components/ui/Field'
import { SavedViewsMenu, type SavedViewState } from '@/components/SavedViewsMenu'
import { Modal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Skeleton'
import { OrderForm, type OrderFormData } from '@/features/orders/OrderForm'
import { formatCurrency } from '@/utils/format'
import { listOrders, createOrder, updateOrder, deleteOrder, orderSearchFields } from '@/services/orderService'
import { listCustomers } from '@/services/customerService'
import { listBookings } from '@/services/bookingService'
import type { Booking, Order } from '@/types'
import { useBusiness } from '@/contexts/BusinessContext'

function bookingLabel(b: Booking): string {
  return `${b.resource} • ${b.date} (${b.start_time}–${b.end_time})`
}

export function OrdersPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { terminology } = useBusiness()
  const [data, setData] = useState<Order[]>([])
  const [customers, setCustomers] = useState<{ value: string; label: string }[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [sortBy, setSortBy] = useState('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const [perPage] = useState(10)
  const [total, setTotal] = useState(0)
  const [modalOpen, setModalOpen] = useState(searchParams.get('new') === '1' || false)
  const [editing, setEditing] = useState<Order | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailOrder, setDetailOrder] = useState<Order | null>(null)
  const [saving, setSaving] = useState(false)

  const defaultCustomerId = searchParams.get('customer') ?? undefined
  const defaultBookingId = searchParams.get('booking') ?? undefined

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listOrders({
        search,
        searchFields: orderSearchFields,
        filters: { status: status || undefined },
        sortBy: sortBy as keyof Order,
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
      setCustomers(res.data.map((c) => ({ value: c.id, label: `${c.first_name} ${c.last_name}` })))
    })
    listBookings({ perPage: 9999 }).then((res) => setBookings(res.data))
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData()
    }, 250)
    return () => clearTimeout(timer)
  }, [loadData])

  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const bookingOptions = bookings.map((b) => ({
    value: `${b.customer_id}:${b.id}`,
    label: bookingLabel(b),
  }))

  const customerName = useMemo(() => {
    const map = new Map(customers.map((c) => [c.value, c.label]))
    return (id: string) => map.get(id) ?? 'Unknown'
  }, [customers])

  const bookingMap = useMemo(() => {
    const map = new Map<string, Booking>()
    bookings.forEach((b) => map.set(b.id, b))
    return map
  }, [bookings])

  function handleSort(key: string) {
    if (sortBy === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortBy(key); setSortDir('asc') }
  }

  function currentViewState(): SavedViewState {
    return { filters: { search, status, sortBy, sortDir } }
  }

  function applyViewState(state: SavedViewState) {
    const f = state.filters
    setSearch(typeof f.search === 'string' ? f.search : '')
    setStatus(typeof f.status === 'string' ? f.status : '')
    setSortBy(typeof f.sortBy === 'string' ? f.sortBy : 'created_at')
    setSortDir(f.sortDir === 'asc' ? 'asc' : 'desc')
    setPage(1)
  }

  async function handleSave(values: OrderFormData) {
    setSaving(true)
    try {
      if (editing) {
        await updateOrder(editing.id, values)
      } else {
        await createOrder(values)
      }
      setModalOpen(false)
      setEditing(null)
      setSearchParams({})
      await refresh()
    } finally {
      setSaving(false)
    }
  }

  async function refresh() {
    await loadData()
  }

  const columns: Column<Order>[] = useMemo(
    () => [
      {
        key: 'order_number',
        header: 'Order',
        sortable: true,
        render: (r) => <span className="font-mono text-xs font-medium text-surface-900">{r.order_number}</span>,
        hideOnMobile: true,
      },
      {
        key: 'customer',
        header: 'Customer',
        sortable: true,
        sortValue: (r) => customerName(r.customer_id),
        render: (r) => <span className="font-medium text-surface-900">{customerName(r.customer_id)}</span>,
      },
      {
        key: 'items',
        header: 'Items',
        sortable: true,
        render: (r) => <span className="text-surface-700">{r.items}</span>,
      },
      {
        key: 'status',
        header: 'Status',
        sortable: true,
        render: (r) => <Badge variant={getStatusBadge(r.status).variant}>{getStatusBadge(r.status).label}</Badge>,
      },
      {
        key: 'payment_status',
        header: 'Payment',
        sortable: true,
        render: (r) => <Badge variant={getStatusBadge(r.payment_status).variant}>{getStatusBadge(r.payment_status).label}</Badge>,
        hideOnMobile: true,
      },
      {
        key: 'total',
        header: 'Total',
        sortable: true,
        render: (r) => <span className="font-semibold text-surface-900">{formatCurrency(r.total)}</span>,
      },
      {
        key: 'created',
        header: 'Created',
        sortable: true,
        sortValue: (r) => r.created_at,
        render: (r) => <span className="text-sm text-surface-700">{new Date(r.created_at).toLocaleDateString()}</span>,
        hideOnMobile: true,
      },
      {
        key: 'stay',
        header: 'Stay',
        sortable: false,
        render: (r) => {
          if (!r.booking_id) return <span className="text-surface-400">—</span>
          const b = bookingMap.get(r.booking_id)
          if (!b) return <span className="text-surface-400">—</span>
          return (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 text-primary-700 px-2 py-0.5 text-xs font-medium">
              {bookingLabel(b)}
            </span>
          )
        },
      },
    ],
    [customerName, bookingMap]
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Orders"
        description={`Track ${terminology.orderLabel.toLowerCase()}s and payments.`}
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => { setEditing(null); setModalOpen(true) }}>
            Create Order
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
              placeholder="Search by order number, items, or staff..."
              className="w-full h-9 pl-9 pr-3 text-sm rounded-lg border border-surface-200 bg-surface-50 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-colors"
            />
          </div>
          <Select
            id="status-filter"
            options={[
              { value: '', label: 'All statuses' },
              ...['new', 'processing', 'completed', 'cancelled'].map((v) => ({ value: v, label: v.charAt(0).toUpperCase() + v.slice(1) })),
            ]}
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1) }}
            className="w-44"
          />
          <SavedViewsMenu page="orders" state={currentViewState()} onApply={applyViewState} />
        </div>

        {loading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" />
          </div>
        ) : (
          <>
            <DataTable
              columns={columns}
              data={data}
              rowKey={(r) => r.id}
              onRowClick={(r) => { setDetailOrder(r); setDetailOpen(true) }}
              onSort={handleSort}
              sortBy={sortBy}
              sortDir={sortDir}
              emptyState={
                <EmptyState
                  icon={<ShoppingCart className="h-6 w-6" />}
                  title="No orders yet"
                  description="Record your first sale or service order."
                  action={<Button icon={<Plus className="h-4 w-4" />} onClick={() => { setEditing(null); setModalOpen(true) }}>Create Order</Button>}
                />
              }
            />
            <Pagination page={page} totalPages={totalPages} total={total} perPage={perPage} onPageChange={setPage} />
          </>
        )}
      </Card>

      <OrderForm
        key={modalOpen ? `open-${editing?.id ?? 'new'}` : 'closed'}
        open={modalOpen}
        onClose={() => { setModalOpen(false); setSearchParams({}) }}
        onSave={handleSave}
        initial={editing ?? undefined}
        loading={saving}
        customerOptions={customers}
        defaultCustomerId={editing ? undefined : defaultCustomerId}
        bookings={bookingOptions}
        defaultBookingId={editing ? undefined : defaultBookingId}
      />

      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title={detailOrder?.order_number ?? 'Order details'} size="sm">
        {detailOrder && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-surface-900">{customerName(detailOrder.customer_id)}</p>
                <p className="text-sm text-surface-500">{detailOrder.items}</p>
              </div>
              <Badge variant={getStatusBadge(detailOrder.status).variant}>{getStatusBadge(detailOrder.status).label}</Badge>
            </div>
            {detailOrder.booking_id && (
              <div className="rounded-lg border border-primary-100 bg-primary-50 p-3">
                <p className="text-xs font-medium text-primary-700">Linked Stay</p>
                <p className="text-sm text-primary-900 mt-0.5">
                  {bookingMap.get(detailOrder.booking_id)
                    ? bookingLabel(bookingMap.get(detailOrder.booking_id)!)
                    : detailOrder.booking_id}
                </p>
              </div>
            )}
            {detailOrder.description && <p className="text-sm text-surface-600">{detailOrder.description}</p>}
            <dl className="text-sm space-y-2 border-t border-surface-100 pt-4">
              <div className="flex justify-between"><dt className="text-surface-500">Ordered</dt><dd className="font-medium text-surface-900">{new Date(detailOrder.created_at).toLocaleDateString()}</dd></div>
              <div className="flex justify-between"><dt className="text-surface-500">Staff</dt><dd className="font-medium text-surface-900">{detailOrder.staff_member || '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-surface-500">Payment</dt><dd><Badge variant={getStatusBadge(detailOrder.payment_status).variant}>{getStatusBadge(detailOrder.payment_status).label}</Badge></dd></div>
              <div className="flex justify-between"><dt className="text-surface-500">Total</dt><dd className="font-semibold text-surface-900">{formatCurrency(detailOrder.total)}</dd></div>
            </dl>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button variant="secondary" onClick={() => { setDetailOpen(false); setEditing(detailOrder); setModalOpen(true) }}>Edit</Button>
              <Button variant="danger" onClick={async () => { await deleteOrder(detailOrder.id); setDetailOpen(false); await refresh() }}>Delete</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
