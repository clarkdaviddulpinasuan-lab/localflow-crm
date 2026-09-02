import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Users } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Badge, getStatusBadge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/cn'
import { formatCurrency } from '@/utils/format'
import {
  analyzeCustomers,
  SEGMENT_DEFS,
  SEGMENT_ORDER,
  type AnalyzedCustomer,
  type CustomerSegment,
  type SegmentAnalysis,
} from '@/services/segments'

export function SegmentsPage() {
  const navigate = useNavigate()
  const [analysis, setAnalysis] = useState<SegmentAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<CustomerSegment>('at_risk')
  const [search, setSearch] = useState('')

  useEffect(() => {
    let cancelled = false
    analyzeCustomers()
      .then((res) => {
        if (cancelled) return
        setAnalysis(res)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const selectedCustomers = useMemo(() => {
    if (!analysis) return []
    const q = search.trim().toLowerCase()
    return analysis.customers
      .filter((c) => c.segment === selected)
      .filter((c) => !q || `${c.first_name} ${c.last_name} ${c.email ?? ''}`.toLowerCase().includes(q))
  }, [analysis, selected, search])

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Segments" description="Understand your customer base." />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-72 w-full" />
      </div>
    )
  }

  const totalCustomers = analysis?.customers.length ?? 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Segments"
        description="Group customers by behavior and value so you can act on them."
      />

      {totalCustomers < 3 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title="Not enough customers yet"
          description="Add at least 3 customers to unlock segments."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {SEGMENT_ORDER.map((id) => {
              const def = SEGMENT_DEFS[id]
              const count = analysis?.counts[id] ?? 0
              const active = selected === id
              return (
                <button
                  key={id}
                  onClick={() => setSelected(id)}
                  className={cn(
                    'rounded-xl border p-4 text-left transition-all hover:shadow-sm',
                    active ? 'border-primary-400 ring-2 ring-primary-100 bg-white' : 'border-surface-200 bg-white'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className={cn('inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold', def.chip)}>
                      {def.label}
                    </span>
                    <span className="text-2xl font-semibold text-surface-900">{count}</span>
                  </div>
                  <p className="mt-2 text-xs text-surface-500">{def.description}</p>
                </button>
              )
            })}
          </div>

          <div className="rounded-xl border border-surface-200 bg-white shadow-xs">
            <div className="p-4 border-b border-surface-100 flex flex-col sm:flex-row sm:items-center gap-3">
              <h3 className="text-base font-semibold text-surface-900 flex-1">
                {SEGMENT_DEFS[selected].label}
                <span className="ml-2 text-sm font-normal text-surface-500">{selectedCustomers.length} customers</span>
              </h3>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-surface-400">
                  <Search className="h-4 w-4" />
                </span>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search this segment..."
                  className="w-full sm:w-64 h-9 pl-9 pr-3 text-sm rounded-lg border border-surface-200 bg-surface-50 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-colors"
                />
              </div>
            </div>

            {selectedCustomers.length === 0 ? (
              <p className="py-10 text-center text-sm text-surface-400">No customers in this segment.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-surface-200">
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-surface-500">Name</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-surface-500">Status</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold text-surface-500">Total spent</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold text-surface-500">Visits</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-surface-500">Last activity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedCustomers.map((c) => (
                      <CustomerRow key={c.id} customer={c} onClick={() => navigate(`/customers/${c.id}`)} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function CustomerRow({ customer, onClick }: { customer: AnalyzedCustomer; onClick: () => void }) {
  const status = getStatusBadge(customer.status)
  return (
    <tr onClick={onClick} className="border-b border-surface-100 cursor-pointer hover:bg-surface-50 transition-colors">
      <td className="px-4 py-3">
        <p className="font-medium text-surface-900">{customer.first_name} {customer.last_name}</p>
        <p className="text-xs text-surface-500">{customer.email || customer.phone || 'No contact'}</p>
      </td>
      <td className="px-4 py-3">
        <Badge variant={status.variant}>{status.label}</Badge>
      </td>
      <td className="px-4 py-3 text-right font-medium text-surface-900">{formatCurrency(customer.total_spent)}</td>
      <td className="px-4 py-3 text-right text-surface-600">{customer.visit_count}</td>
      <td className="px-4 py-3 text-surface-600">
        {customer.last_activity ? new Date(customer.last_activity).toLocaleDateString() : '—'}
      </td>
    </tr>
  )
}