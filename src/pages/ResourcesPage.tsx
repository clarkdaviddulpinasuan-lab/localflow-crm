import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Layers } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Pagination } from '@/components/ui/Pagination'
import { Badge, getStatusBadge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Skeleton'
import { Input } from '@/components/ui/Field'
import { SearchInput } from '@/components/ui/SearchInput'
import { formatDateSpan } from '@/utils/format'
import {
  listResources,
  createResource,
  updateResource,
  deleteResource,
  resourceSearchFields,
  groupUpcomingBookingsByResource,
} from '@/services/resourceService'
import { listBookings } from '@/services/bookingService'
import type { Booking, Resource } from '@/types'
import { useBusiness } from '@/contexts/BusinessContext'

interface ResourceFormValues {
  name: string
  type: string
  color: string
  active: boolean
}

function ResourceForm({
  open,
  onClose,
  onSave,
  initial,
  loading,
  error = '',
}: {
  open: boolean
  onClose: () => void
  onSave: (values: ResourceFormValues) => Promise<void>
  initial?: Resource
  loading: boolean
  error?: string
}) {
  const { terminology } = useBusiness()
  const [values, setValues] = useState<ResourceFormValues>({
    name: initial?.name ?? '',
    type: initial?.type ?? terminology.resourceLabel.toLowerCase(),
    color: initial?.color ?? '',
    active: initial?.active ?? true,
  })
  const [errors, setErrors] = useState<Partial<Record<keyof ResourceFormValues, string>>>({})

  function set<K extends keyof ResourceFormValues>(key: K, value: ResourceFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  function validate(): boolean {
    const next: Partial<Record<keyof ResourceFormValues, string>> = {}
    if (!values.name.trim()) next.name = `${terminology.resourceLabel} name is required`
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    await onSave(values)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? `Edit ${terminology.resourceLabel}` : `Add ${terminology.resourceLabel}`}
      description={initial ? `Update details for ${initial.name}` : `Add a new ${terminology.resourceLabel.toLowerCase()} to your workspace.`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          id="name"
          label={`${terminology.resourceLabel} name`}
          required
          value={values.name}
          onChange={(e) => set('name', e.target.value)}
          error={errors.name}
          placeholder={`e.g. ${terminology.defaultResources[0] ?? 'Room 101'}`}
        />
        <Input
          id="type"
          label="Type"
          value={values.type}
          onChange={(e) => set('type', e.target.value)}
          placeholder={terminology.resourceLabel.toLowerCase()}
          hint="e.g. room, table, stylist"
        />
        <Input
          id="color"
          label="Color"
          type="color"
          value={values.color || '#3b82f6'}
          onChange={(e) => set('color', e.target.value)}
          hint="Optional label color"
        />
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="active"
            checked={values.active}
            onChange={(e) => set('active', e.target.checked)}
            className="h-4 w-4 rounded border-surface-300 text-primary-600 focus:ring-primary-500"
          />
          <label htmlFor="active" className="text-sm text-surface-700">Active</label>
        </div>
        {error && <p className="text-sm text-danger-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={loading}>
            {initial ? 'Save changes' : `Add ${terminology.resourceLabel}`}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export function ResourcesPage() {
  const { terminology } = useBusiness()
  const [data, setData] = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)
  const [perPage] = useState(20)
  const [total, setTotal] = useState(0)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Resource | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailResource, setDetailResource] = useState<Resource | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [bookingsByResource, setBookingsByResource] = useState<Map<string, Booking[]>>(new Map())
  const [suggestions, setSuggestions] = useState<Resource[]>([])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listResources({
        search,
        searchFields: resourceSearchFields,
        sortBy: sortBy as keyof Resource,
        sortDir,
        page,
        perPage,
      })
      setData(res.data)
      setTotal(res.total)
    } finally {
      setLoading(false)
    }
  }, [search, sortBy, sortDir, page, perPage])

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData()
    }, 250)
    return () => clearTimeout(timer)
  }, [loadData])

  useEffect(() => {
    setSuggestions([])
    listResources({ perPage: 9999 })
      .then((res) => setSuggestions(res.data))
      .catch(() => setSuggestions([]))
  }, [])

  const today = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    let cancelled = false
    listBookings({ perPage: 500 })
      .then((res) => {
        if (!cancelled) setBookingsByResource(groupUpcomingBookingsByResource(res.data, today))
      })
      .catch(() => {
        if (!cancelled) setBookingsByResource(new Map())
      })
    return () => {
      cancelled = true
    }
  }, [today])

  const totalPages = Math.max(1, Math.ceil(total / perPage))

  function handleSort(key: string) {
    if (sortBy === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortBy(key)
      setSortDir('asc')
    }
  }

async function handleSave(values: ResourceFormValues) {
  setSaving(true)
  setSaveError('')
  try {
    if (editing) {
      await updateResource(editing.id, values)
    } else {
      await createResource(values)
    }
    setModalOpen(false)
    setEditing(null)
    await loadData()
  } catch (err) {
    setSaveError(err instanceof Error ? err.message : 'Failed to save resource')
  } finally {
    setSaving(false)
  }
}

  async function handleDelete() {
    if (!detailResource) return
    await deleteResource(detailResource.id)
    setDetailOpen(false)
    setConfirmDeleteOpen(false)
    await loadData()
  }

  const columns: Column<Resource>[] = useMemo(
    () => [
      {
        key: 'name',
        header: terminology.resourceLabel,
        sortable: true,
        render: (r) => (
          <div className="flex items-center gap-2">
            {r.color && (
              <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
            )}
            <span className="font-medium text-surface-900">{r.name}</span>
          </div>
        ),
      },
      {
        key: 'type',
        header: 'Type',
        sortable: true,
        render: (r) => <span className="text-surface-700">{r.type}</span>,
        hideOnMobile: true,
      },
      {
        key: 'active',
        header: 'Status',
        sortable: true,
        render: (r) => (
          <Badge variant={r.active ? 'success' : 'default'}>
            {r.active ? 'Active' : 'Inactive'}
          </Badge>
        ),
      },
      {
        key: 'occupancy',
        header: 'Occupancy',
        sortable: false,
        render: (r) => {
          const booked = (bookingsByResource.get(r.name)?.length ?? 0) > 0
          return (
            <Badge variant={booked ? 'danger' : 'success'} dot={false}>
              {booked ? 'Booked' : 'Available'}
            </Badge>
          )
        },
      },
      {
        key: 'created_at',
        header: 'Created',
        sortable: true,
        render: (r) => (
          <span className="text-sm text-surface-700">
            {new Date(r.created_at).toLocaleDateString()}
          </span>
        ),
        hideOnMobile: true,
      },
    ],
    [terminology.resourceLabel, bookingsByResource]
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${terminology.resourceLabel}s`}
        description={`Manage your ${terminology.resourceLabel.toLowerCase()}s.`}
        actions={
          <Button
            icon={<Plus className="h-4 w-4" />}
            onClick={() => {
              setEditing(null)
              setModalOpen(true)
            }}
          >
            Add {terminology.resourceLabel}
          </Button>
        }
      />

      <Card padding={false}>
        <div className="p-4 border-b border-surface-100">
          <div className="relative">
            <SearchInput<Resource>
              value={search}
              onChange={(v) => { setSearch(v); setPage(1) }}
              items={suggestions}
              getLabel={(r) => r.name}
              getMatchText={(r) => `${r.name} ${r.type ?? ''}`}
              getSubLabel={(r) => r.type || undefined}
              placeholder={`Search ${terminology.resourceLabel.toLowerCase()}s...`}
              noResultsMessage={`No ${terminology.resourceLabel.toLowerCase()}s match your search`}
            />
          </div>
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
              onRowClick={(r) => { setDetailResource(r); setDetailOpen(true) }}
              onSort={handleSort}
              sortBy={sortBy}
              sortDir={sortDir}
              emptyState={
                <EmptyState
                  icon={<Layers className="h-6 w-6" />}
                  title={`No ${terminology.resourceLabel.toLowerCase()}s yet`}
                  description={`Get started by adding your first ${terminology.resourceLabel.toLowerCase()}.`}
                  action={
                    <Button icon={<Plus className="h-4 w-4" />} onClick={() => { setEditing(null); setModalOpen(true) }}>
                      Add {terminology.resourceLabel}
                    </Button>
                  }
                />
              }
            />
            <Pagination page={page} totalPages={totalPages} total={total} perPage={perPage} onPageChange={setPage} />
          </>
        )}
      </Card>

      <ResourceForm
        key={modalOpen ? `open-${editing?.id ?? 'new'}` : 'closed'}
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null) }}
        onSave={handleSave}
        initial={editing ?? undefined}
        loading={saving}
        error={saveError}
      />

      <Modal
        open={detailOpen}
        onClose={() => { setDetailOpen(false); setDetailResource(null) }}
        title={`${terminology.resourceLabel} details`}
        size="sm"
      >
        {detailResource && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              {detailResource.color && (
                <span className="h-4 w-4 rounded-full shrink-0" style={{ backgroundColor: detailResource.color }} />
              )}
              <div>
                <p className="text-sm font-medium text-surface-900">{detailResource.name}</p>
                <p className="text-sm text-surface-500">{detailResource.type}</p>
              </div>
            </div>
            <dl className="text-sm space-y-2 border-t border-surface-100 pt-4">
              <div className="flex justify-between">
                <dt className="text-surface-500">Status</dt>
                <dd>
                  <Badge variant={detailResource.active ? 'success' : 'default'}>
                    {detailResource.active ? 'Active' : 'Inactive'}
                  </Badge>
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-surface-500">Created</dt>
                <dd className="font-medium text-surface-900">
                  {new Date(detailResource.created_at).toLocaleDateString()}
                </dd>
              </div>
            </dl>

            <div className="border-t border-surface-100 pt-4">
              <h4 className="text-sm font-semibold text-surface-900 mb-2">Upcoming bookings</h4>
              {(() => {
                const list = bookingsByResource.get(detailResource.name) ?? []
                if (list.length === 0) {
                  return <p className="text-sm text-surface-400">No upcoming bookings.</p>
                }
                return (
                  <ul className="space-y-2">
                    {list.map((b) => (
                      <li key={b.id} className="flex items-center justify-between rounded-lg border border-surface-100 p-2 text-sm">
                        <div>
                          <p className="font-medium text-surface-900">
                            {formatDateSpan(b.date, b.end_date)}
                          </p>
                          <p className="text-xs text-surface-500">{b.start_time} – {b.end_time}</p>
                        </div>
                        <Badge variant={getStatusBadge(b.status).variant} dot={false}>
                          {getStatusBadge(b.status).label}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )
              })()}
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setDetailOpen(false)
                  setEditing(detailResource)
                  setModalOpen(true)
                }}
              >
                Edit
              </Button>
              <Button variant="danger" onClick={() => setConfirmDeleteOpen(true)}>
                Delete
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={confirmDeleteOpen} onClose={() => setConfirmDeleteOpen(false)} title="Confirm delete" size="sm">
        <p className="text-sm text-surface-600 mb-6">
          Are you sure you want to delete this {terminology.resourceLabel.toLowerCase()}? Existing bookings referencing it will keep their record.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmDeleteOpen(false)}>Cancel</Button>
          <Button variant="danger" onClick={handleDelete}>Delete</Button>
        </div>
      </Modal>
    </div>
  )
}
