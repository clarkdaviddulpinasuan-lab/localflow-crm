import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, Plus, ClipboardList, CheckCircle2, LayoutList, LayoutGrid } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Pagination } from '@/components/ui/Pagination'
import { Badge, getStatusBadge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Select } from '@/components/ui/Field'
import { SavedViewsMenu, type SavedViewState } from '@/components/SavedViewsMenu'
import { Skeleton } from '@/components/ui/Skeleton'
import { TaskForm, type TaskFormData } from '@/features/tasks/TaskForm'
import { cn } from '@/lib/cn'
import { listTasks, createTask, updateTask, completeTask, taskSearchFields } from '@/services/taskService'
import { listCustomers } from '@/services/customerService'
import type { Task, TaskStatus } from '@/types'

const BOARD_COLUMNS: { key: TaskStatus; label: string }[] = [
  { key: 'todo', label: 'To Do' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'waiting', label: 'Waiting' },
  { key: 'completed', label: 'Completed' },
]

export function TasksPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [view, setView] = useState<'list' | 'board'>('list')
  const [data, setData] = useState<Task[]>([])
  const [customers, setCustomers] = useState<{ value: string; label: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [priority, setPriority] = useState('')
  const [sortBy, setSortBy] = useState('due_date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)
  const [perPage] = useState(10)
  const [total, setTotal] = useState(0)
  const [modalOpen, setModalOpen] = useState(searchParams.get('new') === '1' || false)
  const [editing, setEditing] = useState<Task | null>(null)
  const [saving, setSaving] = useState(false)

  const defaultCustomerId = searchParams.get('customer') ?? undefined

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listTasks({
        search,
        searchFields: taskSearchFields,
        filters: { status: status || undefined, priority: priority || undefined },
        sortBy: sortBy as keyof Task,
        sortDir,
        ...(view === 'list' ? { page, perPage } : { perPage: 9999 }),
      })
      setData(res.data)
      setTotal(res.total)
    } finally {
      setLoading(false)
    }
  }, [search, status, priority, sortBy, sortDir, page, perPage, view])

  useEffect(() => {
    const customerList = listCustomers({ perPage: 9999 })
    customerList.then((res) => {
      setCustomers(res.data.map((c) => ({ value: c.id, label: `${c.first_name} ${c.last_name}` })))
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
    return (id?: string) => (id ? map.get(id) ?? 'Unknown' : '—')
  }, [customers])

  function handleSort(key: string) {
    if (sortBy === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortBy(key); setSortDir('asc') }
  }

  function currentViewState(): SavedViewState {
    return { filters: { search, status, priority, sortBy, sortDir }, viewId: view }
  }

  function applyViewState(state: SavedViewState) {
    const f = state.filters
    setSearch(typeof f.search === 'string' ? f.search : '')
    setStatus(typeof f.status === 'string' ? f.status : '')
    setPriority(typeof f.priority === 'string' ? f.priority : '')
    setSortBy(typeof f.sortBy === 'string' ? f.sortBy : 'due_date')
    setSortDir(f.sortDir === 'desc' ? 'desc' : 'asc')
    setView(state.viewId === 'board' ? 'board' : 'list')
    setPage(1)
  }

  function refresh() {
    return loadData()
  }

  async function moveTask(t: Task, next: TaskStatus) {
    if (t.status === next) return
    await updateTask(t.id, { status: next })
    await refresh()
  }

  const boardGroups = useMemo(() => {
    const groups: Record<TaskStatus, Task[]> = { todo: [], in_progress: [], waiting: [], completed: [] }
    data.forEach((t) => {
      if (groups[t.status]) groups[t.status].push(t)
    })
    return groups
  }, [data])

  async function handleSave(values: TaskFormData) {
    setSaving(true)
    try {
      if (editing) {
        await updateTask(editing.id, values)
      } else {
        await createTask(values)
      }
      setModalOpen(false)
      setEditing(null)
      setSearchParams({})
      await refresh()
    } finally {
      setSaving(false)
    }
  }

  function isOverdue(task: Task) {
    return task.status !== 'completed' && task.due_date < new Date().toISOString().slice(0, 10)
  }

  const columns: Column<Task>[] = useMemo(
    () => [
      {
        key: 'title',
        header: 'Task',
        sortable: true,
        render: (r) => (
          <div>
            <p className={cn('font-medium text-surface-900', r.status === 'completed' && 'line-through text-surface-400')}>
              {r.title}
            </p>
            {r.description && <p className="text-xs text-surface-500 truncate max-w-md">{r.description}</p>}
          </div>
        ),
      },
      {
        key: 'customer',
        header: 'Customer',
        sortable: true,
        sortValue: (r) => customerName(r.customer_id ?? undefined),
        render: (r) => <span className="text-surface-700">{customerName(r.customer_id ?? undefined)}</span>,
        hideOnMobile: true,
      },
      {
        key: 'priority',
        header: 'Priority',
        sortable: true,
        render: (r) => <Badge variant={getStatusBadge(r.priority).variant}>{getStatusBadge(r.priority).label}</Badge>,
      },
      {
        key: 'due_date',
        header: 'Due',
        sortable: true,
        render: (r) => (
          <span className={cn(isOverdue(r) && 'text-danger-600 font-medium')}>
            {new Date(r.due_date + 'T00:00:00').toLocaleDateString()}
            {isOverdue(r) && ' • Overdue'}
          </span>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        sortable: true,
        render: (r) => <Badge variant={getStatusBadge(r.status).variant}>{getStatusBadge(r.status).label}</Badge>,
        hideOnMobile: true,
      },
      {
        key: 'actions',
        header: '',
        render: (r) =>
          r.status !== 'completed' ? (
            <button
              onClick={async (e) => {
                e.stopPropagation()
                await completeTask(r.id)
                await refresh()
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-success-700 hover:bg-success-50 transition-colors"
            >
              <CheckCircle2 className="h-4 w-4" /> Complete
            </button>
          ) : null,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [customerName]
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tasks"
        description="Track follow-ups, reminders, and to-dos."
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => { setEditing(null); setModalOpen(true) }}>
            Create Task
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
              placeholder="Search tasks..."
              className="w-full h-9 pl-9 pr-3 text-sm rounded-lg border border-surface-200 bg-surface-50 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-colors"
            />
          </div>
          <div className="flex gap-3 items-center">
            <div className="flex rounded-lg border border-surface-200 bg-surface-50 p-0.5" role="tablist" aria-label="Task view">
              <button
                role="tab"
                aria-selected={view === 'list'}
                onClick={() => { setView('list'); setPage(1) }}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 h-8 rounded-md text-sm font-medium transition-colors',
                  view === 'list' ? 'bg-white text-surface-900 shadow-xs' : 'text-surface-500 hover:text-surface-700'
                )}
              >
                <LayoutList className="h-4 w-4" />
                List
              </button>
              <button
                role="tab"
                aria-selected={view === 'board'}
                onClick={() => { setView('board'); setPage(1) }}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 h-8 rounded-md text-sm font-medium transition-colors',
                  view === 'board' ? 'bg-white text-surface-900 shadow-xs' : 'text-surface-500 hover:text-surface-700'
                )}
              >
                <LayoutGrid className="h-4 w-4" />
                Board
              </button>
            </div>
            <Select
              id="status-filter"
              options={[
                { value: '', label: 'All statuses' },
                { value: 'todo', label: 'To Do' },
                { value: 'in_progress', label: 'In Progress' },
                { value: 'waiting', label: 'Waiting' },
                { value: 'completed', label: 'Completed' },
              ]}
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1) }}
              className="w-40"
            />
            <Select
              id="priority-filter"
              options={[
                { value: '', label: 'All priorities' },
                { value: 'low', label: 'Low' },
                { value: 'medium', label: 'Medium' },
                { value: 'high', label: 'High' },
                { value: 'urgent', label: 'Urgent' },
              ]}
              value={priority}
              onChange={(e) => { setPriority(e.target.value); setPage(1) }}
              className="w-40"
            />
            <SavedViewsMenu page="tasks" state={currentViewState()} onApply={applyViewState} />
          </div>
        </div>

        {loading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" />
          </div>
        ) : view === 'board' ? (
          <div className="overflow-x-auto">
            <div className="flex gap-4 p-4 w-max min-w-full">
              {BOARD_COLUMNS.map((col) => (
                <div key={col.key} className="w-64 shrink-0 rounded-xl bg-surface-50 border border-surface-100 p-3">
                  <div className="flex items-center justify-between mb-3 px-1">
                    <p className="text-sm font-semibold text-surface-700">{col.label}</p>
                    <span className="text-xs font-medium text-surface-500 bg-white border border-surface-200 rounded-full px-2 py-0.5">
                      {boardGroups[col.key].length}
                    </span>
                  </div>
                  {boardGroups[col.key].length === 0 ? (
                    <div className="rounded-lg border border-dashed border-surface-200 px-3 py-6 text-center text-xs text-surface-400">
                      No tasks
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {boardGroups[col.key].map((t) => (
                        <li key={t.id}>
                          <button
                            onClick={() => { setEditing(t); setModalOpen(true) }}
                            className="w-full bg-white rounded-lg border border-surface-200 p-3 text-left shadow-xs hover:border-primary-300 hover:shadow-sm transition-all"
                          >
                            <p className={cn('text-sm font-medium', t.status === 'completed' ? 'line-through text-surface-400' : 'text-surface-900')}>
                              {t.title}
                            </p>
                            {t.description && <p className="text-xs text-surface-500 truncate mt-0.5">{t.description}</p>}
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              <Badge variant={getStatusBadge(t.priority).variant}>{getStatusBadge(t.priority).label}</Badge>
                              <span className={cn('text-xs', isOverdue(t) ? 'text-danger-600 font-medium' : 'text-surface-500')}>
                                {new Date(t.due_date + 'T00:00:00').toLocaleDateString()}
                              </span>
                              {t.customer_id && <span className="text-xs text-surface-400">{customerName(t.customer_id)}</span>}
                            </div>
                            <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                              <select
                                value={t.status}
                                onChange={(e) => moveTask(t, e.target.value as TaskStatus)}
                                aria-label={`Change status for ${t.title}`}
                                className="w-full h-7 px-2 text-xs rounded-md border border-surface-200 bg-surface-50 text-surface-700 focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer"
                              >
                                {BOARD_COLUMNS.map((c) => (
                                  <option key={c.key} value={c.key}>{c.label}</option>
                                ))}
                              </select>
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            <DataTable
              columns={columns}
              data={data}
              rowKey={(r) => r.id}
              onRowClick={(r) => { setEditing(r); setModalOpen(true) }}
              onSort={handleSort}
              sortBy={sortBy}
              sortDir={sortDir}
              emptyState={
                <EmptyState
                  icon={<ClipboardList className="h-6 w-6" />}
                  title="No tasks"
                  description="Create follow-ups and reminders to stay on top of your work."
                  action={<Button icon={<Plus className="h-4 w-4" />} onClick={() => { setEditing(null); setModalOpen(true) }}>Create Task</Button>}
                />
              }
            />
            <Pagination page={page} totalPages={totalPages} total={total} perPage={perPage} onPageChange={setPage} />
          </>
        )}
      </Card>

      <TaskForm
        key={modalOpen ? `open-${editing?.id ?? 'new'}` : 'closed'}
        open={modalOpen}
        onClose={() => { setModalOpen(false); setSearchParams({}) }}
        onSave={handleSave}
        initial={editing ?? undefined}
        loading={saving}
        customerOptions={customers}
        defaultCustomerId={editing ? undefined : defaultCustomerId}
      />
    </div>
  )
}
