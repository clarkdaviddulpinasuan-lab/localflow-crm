import { ArrowUpRight, ArrowDownRight, Wallet, Users, CalendarCheck, ClipboardList, Repeat, CreditCard, BedDouble, Receipt, type LucideIcon } from 'lucide-react'
import type { Kpi } from '@/services/dashboardService'
import { cn } from '@/lib/cn'

const iconMap: Record<Kpi['icon'], LucideIcon> = {
  revenue: Wallet,
  customers: Users,
  bookings: CalendarCheck,
  tasks: ClipboardList,
  repeat: Repeat,
  credit: CreditCard,
  occupancy: BedDouble,
  aov: Receipt,
}

// Colour each icon tile by KPI type for subtle visual interest.
const tileStyles: Record<Kpi['icon'], string> = {
  revenue: 'bg-primary-50 text-primary-600',
  customers: 'bg-info-50 text-info-600',
  bookings: 'bg-success-50 text-success-600',
  tasks: 'bg-warning-50 text-warning-600',
  repeat: 'bg-violet-50 text-violet-600',
  credit: 'bg-warning-50 text-warning-600',
  occupancy: 'bg-primary-50 text-primary-600',
  aov: 'bg-success-50 text-success-600',
}

export function KpiCard({ kpi }: { kpi: Kpi }) {
  const Icon = iconMap[kpi.icon]
  const positive = kpi.change >= 0
  const good = kpi.positiveIsGood ? positive : !positive

  return (
    <div className="bg-white rounded-xl border border-surface-200 p-5 shadow-xs transition-shadow hover:shadow-md hover:border-surface-300">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-surface-500">{kpi.label}</span>
        <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', tileStyles[kpi.icon])}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="text-2xl font-semibold tracking-tight text-surface-900">{kpi.display}</p>
      <div className="flex items-center gap-1.5 mt-2">
        <span
          className={cn(
            'inline-flex items-center gap-0.5 text-xs font-semibold',
            good ? 'text-success-600' : 'text-danger-600'
          )}
        >
          {positive ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
          {Math.abs(kpi.change)}%
        </span>
        <span className="text-xs text-surface-400">{kpi.changeLabel}</span>
      </div>
    </div>
  )
}
