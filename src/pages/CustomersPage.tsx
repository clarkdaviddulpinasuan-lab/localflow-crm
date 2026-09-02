import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, Download, Users } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Pagination } from '@/components/ui/Pagination'
import { Skeleton } from '@/components/ui/Skeleton'
import { Avatar } from '@/components/ui/Avatar'
import { Badge, getStatusBadge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Select } from '@/components/ui/Field'
import { SavedViewsMenu, type SavedViewState } from '@/components/SavedViewsMenu'
import { CustomerForm, type CustomerFormData } from '@/features/customers/CustomerForm'
import { formatCurrency, formatNumber } from '@/utils/format'
import { downloadCSV } from '@/utils/csv'
import {
  listCustomers,
  createCustomer,
  updateCustomer,
  customerSearchFields,
} from '@/services/customerService'
import { createBooking } from '@/services/bookingService'
import { createOrder } from '@/services/orderService'
import { createTask } from '@/services/taskService'
import type { Customer } from '@/types'

export function CustomersPage() {
  const navigate = useNavigate()
  const [data, setData] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [type, setType] = useState('')
  const [sortBy, setSortBy] = useState('last_name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)
  const [perPage] = useState(10)
  const [total, setTotal] = useState(0)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoading(true)
      const res = await listCustomers({
        search,
        searchFields: customerSearchFields,
        filters: { status: status || undefined, type: type || undefined },
        sortBy: sortBy as keyof Customer,
        sortDir,
        page,
        perPage,
      })
      setData(res.data)
      setTotal(res.total)
      setLoading(false)
    }, 250)
    return () => clearTimeout(timer)
  }, [search, status, type, sortBy, sortDir, page, perPage])

  const totalPages = Math.max(1, Math.ceil(total / perPage))

  function currentViewState(): SavedViewState {
    return { filters: { search, status, type, sortBy, sortDir } }
  }

  function applyViewState(state: SavedViewState) {
    const f = state.filters
    setSearch(typeof f.search === 'string' ? f.search : '')
    setStatus(typeof f.status === 'string' ? f.status : '')
    setType(typeof f.type === 'string' ? f.type : '')
    setSortBy(typeof f.sortBy === 'string' ? f.sortBy : 'last_name')
    setSortDir(f.sortDir === 'desc' ? 'desc' : 'asc')
    setPage(1)
  }

  function handleSort(key: string) {
    if (sortBy === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(key)
      setSortDir('asc')
    }
  }

  async function handleSave(values: CustomerFormData) {
    setSaving(true)
    setSaveError('')
    try {
      if (editing) {
        await updateCustomer(editing.id, {
          first_name: values.first_name,
          last_name: values.last_name,
          email: values.email,
          phone: values.phone,
          type: values.type,
          status: values.status,
        })
      } else {
        const { booking, order, task, ...customerData } = values
        const customer = await createCustomer(customerData)

        if (booking) {
          await createBooking({ ...booking, customer_id: customer.id })
        }
        if (order) {
          await createOrder({ ...order, customer_id: customer.id })
        }
        if (task) {
          await createTask({ ...task, customer_id: customer.id })
        }
      }
      setModalOpen(false)
      setEditing(null)
      const res = await listCustomers({
        search,
        searchFields: customerSearchFields,
        filters: { status: status || undefined, type: type || undefined },
        sortBy: sortBy as keyof Customer,
        sortDir,
        page,
        perPage,
      })
      setData(res.data)
      setTotal(res.total)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Unable to save customer. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleExport() {
    const all = await listCustomers({ perPage: 9999 })
    downloadCSV(
      'customers.csv',
      ['Name', 'Phone', 'Email', 'Type', 'Status', 'Total Spent', 'Visits'],
      all.data.map((c) => [
        `${c.first_name} ${c.last_name}`,
        c.phone ?? '',
        c.email ?? '',
        c.type,
        c.status,
        c.total_spent,
        c.visit_count,
      ])
    )
  }

  const columns: Column<Customer>[] = useMemo(
    () => [
      {
        key: 'name',
        header: 'Name',
        sortable: true,
        sortValue: (r) => `${r.last_name} ${r.first_name}`,
        render: (r) => (
          <div className="flex items-center gap-3">
            <Avatar firstName={r.first_name} lastName={r.last_name} size="sm" />
            <div>
              <p className="font-medium text-surface-900">{r.first_name} {r.last_name}</p>
              <p className="text-xs text-surface-500">{r.email || r.phone || 'No contact'}</p>
            </div>
          </div>
        ),
      },
      {
        key: 'type',
        header: 'Type',
        sortable: true,
        render: (r) => <span className="capitalize text-surface-600">{r.type.replace('_', ' ')}</span>,
        hideOnMobile: true,
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
        key: 'total_spent',
        header: 'Total Spent',
        sortable: true,
        render: (r) => <span className="font-medium text-surface-900">{formatCurrency(r.total_spent)}</span>,
        hideOnMobile: true,
      },
      {
        key: 'visit_count',
        header: 'Visits',
        sortable: true,
        render: (r) => formatNumber(r.visit_count),
        hideOnMobile: true,
      },
      {
        key: 'last_activity',
        header: 'Last Activity',
        sortable: true,
        render: (r) => (r.last_activity ? new Date(r.last_activity).toLocaleDateString() : '—'),
        hideOnMobile: true,
      },
    ],
    []
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="Manage your customer database and relationships."
        actions={
          <>
            <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={handleExport}>
              Export
            </Button>
            <Button
              icon={<Plus className="h-4 w-4" />}
              onClick={() => {
                setEditing(null)
                setModalOpen(true)
              }}
            >
              Add Customer
            </Button>
          </>
        }
      />

      {saveError && (
        <p className="text-sm text-danger-700 bg-danger-50 border border-danger-200 rounded-lg px-4 py-3">
          {saveError}
        </p>
      )}

      <Card padding={false}>
        <div className="p-4 border-b border-surface-100 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-surface-400">
              <Search className="h-4 w-4" />
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder="Search by name, email, or phone..."
              className="w-full h-9 pl-9 pr-3 text-sm rounded-lg border border-surface-200 bg-surface-50 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-colors"
            />
          </div>
          <div className="flex gap-3">
            <Select
              id="status-filter"
              options={[{ value: '', label: 'All statuses' }, ...['new', 'active', 'vip', 'inactive'].map((v) => ({ value: v, label: v.charAt(0).toUpperCase() + v.slice(1) }))]}
              value={status}
              onChange={(e) => {
                setStatus(e.target.value)
                setPage(1)
              }}
              className="w-40"
            />
            <Select
              id="type-filter"
              options={[{ value: '', label: 'All types' }, ...['guest', 'local', 'corporate', 'regular', 'walk_in'].map((v) => ({ value: v, label: v.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()) }))]}
              value={type}
              onChange={(e) => {
                setType(e.target.value)
                setPage(1)
              }}
              className="w-40"
            />
            <SavedViewsMenu page="customers" state={currentViewState()} onApply={applyViewState} />
          </div>
        </div>

        {loading ? (
          <div className="p-6">
            <Skeleton className="h-8 w-full mb-4" />
            <Skeleton className="h-8 w-full mb-4" />
            <Skeleton className="h-8 w-full mb-4" />
          </div>
        ) : (
          <>
            <DataTable
              columns={columns}
              data={data}
              rowKey={(r) => r.id}
              onRowClick={(r) => navigate(`/customers/${r.id}`)}
              onSort={handleSort}
              sortBy={sortBy}
              sortDir={sortDir}
              emptyState={
                <EmptyState
                  icon={<Users className="h-6 w-6" />}
                  title="No customers yet"
                  description="Start building your customer database by adding your first customer."
                  action={
                    <Button
                      icon={<Plus className="h-4 w-4" />}
                      onClick={() => {
                        setEditing(null)
                        setModalOpen(true)
                      }}
                    >
                      Add Customer
                    </Button>
                  }
                />
              }
            />
            <Pagination
              page={page}
              totalPages={totalPages}
              total={total}
              perPage={perPage}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>

      <CustomerForm
        key={modalOpen ? `open-${editing?.id ?? 'new'}` : 'closed'}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        initial={editing ?? undefined}
        loading={saving}
      />
    </div>
  )
}
