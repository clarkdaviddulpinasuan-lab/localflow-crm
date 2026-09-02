import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, LayoutList, LayoutGrid } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Input, Select, Textarea } from '@/components/ui/Field'
import { EmptyState } from '@/components/ui/EmptyState'
import { SavedViewsMenu, type SavedViewState } from '@/components/SavedViewsMenu'
import { listLeads, createLead, updateLead, deleteLead } from '@/services/leadService'
import { getStatusBadge } from '@/components/ui/Badge'
import { formatCurrency } from '@/utils/format'
import { cn } from '@/lib/cn'
import type { Lead, LeadStage } from '@/types'
import type { QueryParams } from '@/utils/query'

const stageOrder: LeadStage[] = ['new', 'contacted', 'qualified', 'proposal', 'won', 'lost']

const stageOptions = stageOrder.map((s) => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))

const emptyForm = {
  name: '',
  company: '',
  phone: '',
  email: '',
  source: '',
  stage: 'new' as LeadStage,
  estimated_value: '',
  next_action: '',
  assigned_staff: '',
}

export function LeadsPage() {
  const [view, setView] = useState<'table' | 'pipeline'>('table')
  const [filter, setFilter] = useState<'all' | LeadStage>('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Lead | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const params: QueryParams<Lead> = { perPage: 500 }
      if (filter !== 'all') params.filters = { stage: filter }
      const res = await listLeads(params)
      setLeads(res.data)
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    loadData()
  }, [loadData])

  function openAdd() {
    setEditing(null)
    setForm(emptyForm)
    setError('')
    setModalOpen(true)
  }

  function openEdit(l: Lead) {
    setEditing(l)
    setForm({
      name: l.name,
      company: l.company ?? '',
      phone: l.phone ?? '',
      email: l.email ?? '',
      source: l.source ?? '',
      stage: l.stage,
      estimated_value: String(l.estimated_value || ''),
      next_action: l.next_action ?? '',
      assigned_staff: l.assigned_staff ?? '',
    })
    setError('')
    setModalOpen(true)
  }

  async function submit() {
    if (!form.name.trim()) {
      setError('Lead name is required.')
      return
    }
    const payload = {
      name: form.name.trim(),
      company: form.company || null,
      phone: form.phone || null,
      email: form.email || null,
      source: form.source || null,
      stage: form.stage,
      estimated_value: Number(form.estimated_value) || 0,
      next_action: form.next_action || null,
      assigned_staff: form.assigned_staff || null,
    }
    if (editing) {
      await updateLead(editing.id, payload)
    } else {
      await createLead(payload as Omit<Lead, 'id' | 'business_id' | 'created_at' | 'updated_at'>)
    }
    setModalOpen(false)
    await loadData()
  }

  async function remove(l: Lead) {
    if (window.confirm(`Delete lead "${l.name}"?`)) {
      await deleteLead(l.id)
      await loadData()
    }
  }

  async function moveStage(l: Lead, stage: LeadStage) {
    if (l.stage === stage) return
    await updateLead(l.id, { stage })
    await loadData()
  }

  const pipelineGroups = useMemo(() => {
    const groups: Record<LeadStage, Lead[]> = { new: [], contacted: [], qualified: [], proposal: [], won: [], lost: [] }
    leads.forEach((l) => {
      if (groups[l.stage]) groups[l.stage].push(l)
    })
    return groups
  }, [leads])

  function currentViewState(): SavedViewState {
    return { filters: { filter, view } }
  }

  function applyViewState(state: SavedViewState) {
    const f = state.filters
    setFilter(f.filter === 'all' || (stageOrder as string[]).includes(f.filter as string) ? (f.filter as 'all' | LeadStage) : 'all')
    setView(f.view === 'pipeline' ? 'pipeline' : 'table')
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leads"
        description="Track and qualify potential customers."
        actions={
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-surface-200 bg-surface-50 p-0.5" role="tablist" aria-label="Leads view">
              <button
                role="tab"
                aria-selected={view === 'table'}
                onClick={() => setView('table')}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 h-8 rounded-md text-sm font-medium transition-colors',
                  view === 'table' ? 'bg-white text-surface-900 shadow-xs' : 'text-surface-500 hover:text-surface-700'
                )}
              >
                <LayoutList className="h-4 w-4" />
                Table
              </button>
              <button
                role="tab"
                aria-selected={view === 'pipeline'}
                onClick={() => setView('pipeline')}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 h-8 rounded-md text-sm font-medium transition-colors',
                  view === 'pipeline' ? 'bg-white text-surface-900 shadow-xs' : 'text-surface-500 hover:text-surface-700'
                )}
              >
                <LayoutGrid className="h-4 w-4" />
                Pipeline
              </button>
            </div>
            <Button icon={<Plus className="h-4 w-4" />} onClick={openAdd}>
              Add Lead
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        {(['all', ...stageOrder] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 text-sm rounded-full border capitalize transition-colors ${filter === s ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-surface-600 border-surface-200 hover:bg-surface-50'}`}
          >
            {s}
          </button>
        ))}
        <SavedViewsMenu page="leads" state={currentViewState()} onApply={applyViewState} />
      </div>

      <Card>
        {loading ? (
          <div className="p-6 space-y-4">
            <div className="h-8 w-full rounded-lg bg-surface-100 animate-pulse" />
            <div className="h-8 w-full rounded-lg bg-surface-100 animate-pulse" />
            <div className="h-8 w-full rounded-lg bg-surface-100 animate-pulse" />
          </div>
        ) : leads.length === 0 ? (
          <EmptyState
            title="No leads yet"
            description={filter === 'all' ? 'Start tracking potential customers.' : 'No leads in this stage.'}
            action={<Button icon={<Plus className="h-4 w-4" />} onClick={openAdd}>Add Lead</Button>}
          />
        ) : view === 'pipeline' ? (
          <div className="overflow-x-auto">
            <div className="flex gap-4 w-max min-w-full">
              {stageOrder.map((stage) => (
                <div key={stage} className="w-64 shrink-0 rounded-xl bg-surface-50 border border-surface-100 p-3">
                  <div className="flex items-center justify-between mb-3 px-1">
                    <p className="text-sm font-semibold text-surface-700 capitalize">{stage}</p>
                    <span className="text-xs font-medium text-surface-500 bg-white border border-surface-200 rounded-full px-2 py-0.5">
                      {pipelineGroups[stage].length}
                    </span>
                  </div>
                  {pipelineGroups[stage].length === 0 ? (
                    <div className="rounded-lg border border-dashed border-surface-200 px-3 py-6 text-center text-xs text-surface-400">
                      No leads
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {pipelineGroups[stage].map((l) => (
                        <li key={l.id}>
                          <button
                            onClick={() => openEdit(l)}
                            className={cn(
                              'w-full bg-white rounded-lg border p-3 text-left shadow-xs hover:shadow-sm transition-all',
                              l.stage === 'won' ? 'border-success-300' : l.stage === 'lost' ? 'border-danger-300' : 'border-surface-200 hover:border-primary-300'
                            )}
                          >
                            <p className="text-sm font-medium text-surface-900">{l.name}</p>
                            {l.company && <p className="text-xs text-surface-500 truncate mt-0.5">{l.company}</p>}
                            <div className="flex items-center justify-between mt-2">
                              <Badge variant={getStatusBadge(l.stage).variant}>{getStatusBadge(l.stage).label}</Badge>
                              <span className="text-sm font-semibold text-surface-900">
                                {l.estimated_value ? formatCurrency(l.estimated_value) : '—'}
                              </span>
                            </div>
                            {l.next_action && <p className="text-xs text-surface-500 truncate mt-2">Next: {l.next_action}</p>}
                            <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                              <select
                                value={l.stage}
                                onChange={(e) => moveStage(l, e.target.value as LeadStage)}
                                aria-label={`Change stage for ${l.name}`}
                                className="w-full h-7 px-2 text-xs rounded-md border border-surface-200 bg-surface-50 text-surface-700 focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer"
                              >
                                {stageOrder.map((s) => (
                                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-surface-500">Name</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-surface-500">Company</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-surface-500">Stage</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-surface-500">Value</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-surface-500">Source</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-surface-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => (
                  <tr key={l.id} className="border-b border-surface-100">
                    <td className="px-4 py-3">
                      <p className="font-medium text-surface-900">{l.name}</p>
                      <p className="text-xs text-surface-500">{l.email || l.phone || '—'}</p>
                    </td>
                    <td className="px-4 py-3 text-surface-600">{l.company || '—'}</td>
                    <td className="px-4 py-3"><Badge variant={getStatusBadge(l.stage).variant}>{getStatusBadge(l.stage).label}</Badge></td>
                    <td className="px-4 py-3 font-medium text-surface-900">{l.estimated_value ? formatCurrency(l.estimated_value) : '—'}</td>
                    <td className="px-4 py-3 text-surface-600">{l.source || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => openEdit(l)} aria-label="Edit lead">Edit</Button>
                        <Button variant="ghost" size="sm" icon={<Trash2 className="h-3.5 w-3.5" />} className="text-danger-600" onClick={() => remove(l)} aria-label="Delete lead">Delete</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Lead' : 'Add Lead'} size="lg">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input label="Source" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="e.g. Referral, Walk-in, Social" />
          <Select label="Stage" options={stageOptions} value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value as LeadStage })} />
          <Input label="Estimated value" type="number" value={form.estimated_value} onChange={(e) => setForm({ ...form, estimated_value: e.target.value })} />
          <Input label="Assigned staff" value={form.assigned_staff} onChange={(e) => setForm({ ...form, assigned_staff: e.target.value })} />
          <div className="sm:col-span-2">
            <Textarea label="Next action" value={form.next_action} onChange={(e) => setForm({ ...form, next_action: e.target.value })} />
          </div>
        </div>
        {error && <p className="text-sm text-danger-600 mt-3">{error}</p>}
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button onClick={submit}>{editing ? 'Save' : 'Add Lead'}</Button>
        </div>
      </Modal>
    </div>
  )
}
