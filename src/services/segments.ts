import { parseISO } from 'date-fns'
import { getStore } from '@/services/demoStore'
import { isDemo } from '@/lib/dataClient'
import { listCustomers } from '@/services/customerService'
import type { Customer } from '@/types'

export type CustomerSegment =
  | 'high_value'
  | 'loyal'
  | 'at_risk'
  | 'inactive'
  | 'new'
  | 'prospect'
  | 'regular'

export interface SegmentDef {
  id: CustomerSegment
  label: string
  description: string
  /** Tailwind chip classes. */
  chip: string
  priority: number
}

export const SEGMENT_DEFS: Record<CustomerSegment, SegmentDef> = {
  high_value: {
    id: 'high_value',
    label: 'High value',
    description: 'Top spenders who spend in the top quarter.',
    chip: 'text-amber-700 bg-amber-50 border-amber-200',
    priority: 1,
  },
  loyal: {
    id: 'loyal',
    label: 'Loyal regulars',
    description: 'Frequent visitors with many repeat visits.',
    chip: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    priority: 2,
  },
  at_risk: {
    id: 'at_risk',
    label: 'At risk',
    description: 'Were active but have gone quiet for 45–90 days.',
    chip: 'text-orange-700 bg-orange-50 border-orange-200',
    priority: 3,
  },
  inactive: {
    id: 'inactive',
    label: 'Inactive',
    description: 'No activity for 90+ days or marked inactive.',
    chip: 'text-surface-600 bg-surface-100 border-surface-200',
    priority: 4,
  },
  new: {
    id: 'new',
    label: 'New',
    description: 'Added within the last 30 days.',
    chip: 'text-primary-700 bg-primary-50 border-primary-200',
    priority: 5,
  },
  prospect: {
    id: 'prospect',
    label: 'Prospect',
    description: 'On record but never visited yet.',
    chip: 'text-info-700 bg-info-50 border-info-200',
    priority: 6,
  },
  regular: {
    id: 'regular',
    label: 'Regular',
    description: 'Steady customers who don\'t fit other buckets.',
    chip: 'text-surface-700 bg-surface-50 border-surface-200',
    priority: 7,
  },
}

export const SEGMENT_ORDER: CustomerSegment[] = [
  'high_value',
  'loyal',
  'at_risk',
  'inactive',
  'new',
  'prospect',
  'regular',
]

export interface SegmentStats {
  spendP75: number
  visitP75: number
}

export function computeSegmentStats(customers: Customer[]): SegmentStats {
  const spends = customers.map((c) => c.total_spent).sort((a, b) => a - b)
  const visits = customers.map((c) => c.visit_count).sort((a, b) => a - b)
  return {
    spendP75: percentile(spends, 0.75),
    visitP75: percentile(visits, 0.75),
  }
}

export function segmentCustomer(c: Customer, stats: SegmentStats): CustomerSegment {
  const now = new Date()
  const created = parseISO(c.created_at)
  const lastActivity = c.last_activity ? parseISO(c.last_activity) : null

  if (c.status === 'inactive') return 'inactive'
  if (now.getTime() - created.getTime() <= 30 * 86_400_000 && c.total_spent === 0) return 'new'
  if (lastActivity && now.getTime() - lastActivity.getTime() >= 90 * 86_400_000) return 'inactive'
  if (c.total_spent >= stats.spendP75 && c.visit_count >= 2) return 'high_value'
  if (c.visit_count >= 4) return 'loyal'
  if (
    lastActivity &&
    now.getTime() - lastActivity.getTime() >= 45 * 86_400_000 &&
    now.getTime() - lastActivity.getTime() < 90 * 86_400_000
  ) {
    return 'at_risk'
  }
  if (c.visit_count === 0) return 'prospect'
  return 'regular'
}

export interface AnalyzedCustomer extends Customer {
  segment: CustomerSegment
}

export interface SegmentAnalysis {
  customers: AnalyzedCustomer[]
  counts: Record<CustomerSegment, number>
}

export async function analyzeCustomers(): Promise<SegmentAnalysis> {
  const customers = isDemo() ? getStore().customers : (await listCustomers({ perPage: 9999 })).data
  const stats = computeSegmentStats(customers)
  const analyzed: AnalyzedCustomer[] = customers.map((c) => ({ ...c, segment: segmentCustomer(c, stats) }))
  const counts = Object.fromEntries(SEGMENT_ORDER.map((s) => [s, analyzed.filter((c) => c.segment === s).length])) as Record<CustomerSegment, number>
  return { customers: analyzed, counts }
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  if (sorted.length === 1) return sorted[0]
  const index = Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)
  return sorted[index]
}