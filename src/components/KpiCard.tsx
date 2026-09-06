import { ArrowUpRight, ArrowDownRight, Wallet, Users, CalendarCheck, ClipboardList, Repeat, CreditCard, BedDouble, Receipt, type LucideIcon } from 'lucide-react'
import type { Kpi } from '@/services/dashboardService'
import { cn } from '@/lib/cn'

const iconMap: Record<Kpi['icon'], LucideIcon> = {
  revenue: Wallet,
  customers: Users,
  bookings: CalendarCheck,
  orders: Receipt,
  tasks: ClipboardList,
  repeat: Repeat,
  credit: CreditCard,
  occupancy: BedDouble,
  aov: Receipt,
}

// Rhombus accent palette for the top strip and icon badge, keyed by KPI type.
const accentStyles: Record<Kpi['icon'], { strip: string; badge: string }> = {
  revenue: { strip: '#ede9fe', badge: 'bg-[#ede9fe] text-[#6a5ce0]' },
  customers: { strip: '#fce7f3', badge: 'bg-[#fce7f3] text-[#db2777]' },
  bookings: { strip: '#ccfbf1', badge: 'bg-[#ccfbf1] text-[#0d9488]' },
  orders: { strip: '#e0e7ff', badge: 'bg-[#e0e7ff] text-[#4f46e5]' },
  tasks: { strip: '#fef9c3', badge: 'bg-[#fef9c3] text-[#ca8a04]' },
  repeat: { strip: '#ede9fe', badge: 'bg-[#ede9fe] text-[#6a5ce0]' },
  credit: { strip: '#fce7f3', badge: 'bg-[#fce7f3] text-[#db2777]' },
  occupancy: { strip: '#ccfbf1', badge: 'bg-[#ccfbf1] text-[#0d9488]' },
  aov: { strip: '#fef9c3', badge: 'bg-[#fef9c3] text-[#ca8a04]' },
}

export function KpiCard({ kpi }: { kpi: Kpi }) {
  const Icon = iconMap[kpi.icon]
  // A null change means nothing was measured for this metric; the card then
  // states its basis rather than showing an invented percentage.
  const change = kpi.change
  const positive = (change ?? 0) >= 0
  const good = kpi.positiveIsGood ? positive : !positive
  const acc = accentStyles[kpi.icon]

  return (
    <div className="relative overflow-hidden bg-white rounded-[14px] shadow-soft transition-shadow hover:shadow-soft-md">
      <span className="absolute inset-x-0 top-0 h-1" style={{ background: acc.strip }} />
      <div className="p-5 pt-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-surface-500">{kpi.label}</span>
          <span className={cn('flex h-8 w-8 items-center justify-center rounded-[8px]', acc.badge)}>
            <Icon className="h-4 w-4" />
          </span>
        </div>
        <p className="text-3xl font-bold tracking-tight text-surface-900">{kpi.display}</p>
        <div className="flex items-center gap-1.5 mt-3">
          {change !== null && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 text-xs font-semibold',
                good ? 'text-success-600' : 'text-danger-600'
              )}
            >
              {positive ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
              {Math.abs(change)}%
            </span>
          )}
          <span className="text-xs text-surface-400">{kpi.changeLabel}</span>
        </div>
      </div>
    </div>
  )
}
