import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, CalendarDays, Users, ArrowRight, SlidersHorizontal } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useBusiness } from '@/contexts/BusinessContext'
import { getGreeting, formatCurrency } from '@/utils/format'
import { KpiCard } from '@/components/KpiCard'
import { PageHeader } from '@/components/PageHeader'
import { Card } from '@/components/ui/Card'
import { Badge, getStatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { ChartContainer } from '@/components/ui/ChartContainer'
import { QuickActions } from '@/components/QuickActions'
import { NeedsAttention } from '@/components/NeedsAttention'
import { InsightsPanel } from '@/components/InsightsPanel'
import { LineTrendChart } from '@/components/charts/LineTrendChart'
import { generateInsights, type Insight } from '@/services/insightService'
import type { DashboardWidgetKey } from '@/config/businessTypes'
import { DEFAULT_WIDGETS } from '@/config/businessTypes'
import {
  computeKpisFromConfig,
  revenueTrend,
  customerGrowth,
  upcomingReservations,
  recentActivity,
  businessHealth,
  needsAttention,
  type Kpi,
  type DailyPoint,
  type TrendRange,
  type NeedsAttentionItem,
} from '@/services/dashboardService'
import { cn } from '@/lib/cn'

export function OverviewPage() {
  const { profile, business } = useAuth()
  const { config, terminology, updateConfig } = useBusiness()
  const [range, setRange] = useState<TrendRange>(30)
  const [kpis, setKpis] = useState<Kpi[]>([])
  const [upcoming, setUpcoming] = useState<Awaited<ReturnType<typeof upcomingReservations>>>([])
  const [activity, setActivity] = useState<{ id: string; description: string; created_at: string }[]>([])
  const [health, setHealth] = useState<{ retention: number; openTasks: number; pendingBookings: number; repeatCustomers: number; outstandingCredit: number }>({
    retention: 0, openTasks: 0, pendingBookings: 0, repeatCustomers: 0, outstandingCredit: 0,
  })
  const [attention, setAttention] = useState<NeedsAttentionItem[]>([])
  const [attentionLoading, setAttentionLoading] = useState(true)
  const [revenue, setRevenue] = useState<DailyPoint[]>([])
  const [growth, setGrowth] = useState<DailyPoint[]>([])
  const [insights, setInsights] = useState<Insight[]>([])
  const [insightsLoading, setInsightsLoading] = useState(true)
  const [customizeOpen, setCustomizeOpen] = useState(false)
  const [savingWidgets, setSavingWidgets] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [k, u, a, h, r, g, att, ins] = await Promise.all([
        computeKpisFromConfig(config.kpiCards, range),
        upcomingReservations(5),
        recentActivity(6),
        businessHealth(),
        revenueTrend(range),
        customerGrowth(range),
        needsAttention(8),
        generateInsights(range),
      ])
      if (cancelled) return
      setKpis(k)
      setUpcoming(u)
      setActivity(a)
      setHealth(h)
      setRevenue(r)
      setGrowth(g)
      setAttention(att)
      setAttentionLoading(false)
      setInsights(ins)
      setInsightsLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [config.kpiCards, range])

  const todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })

  const revenueSeries = useMemo(
    () => ({
      xKey: 'label' as const,
      series: [
        { key: 'value', label: config.trendMetricLabel, color: '#3b6cf6', format: 'currency' as const },
      ],
    }),
    [config.trendMetricLabel]
  )

  const growthSeries = useMemo(
    () => ({
      xKey: 'label' as const,
      series: [
        { key: 'value', label: terminology.customerLabel + 's', color: '#10b981', format: 'number' as const },
      ],
    }),
    [terminology.customerLabel]
  )

  const tabs: { value: TrendRange; label: string }[] = [
    { value: 7, label: '7d' },
    { value: 30, label: '30d' },
    { value: 90, label: '90d' },
  ]

  const widgetOptions: { key: DashboardWidgetKey; label: string }[] = [
    { key: 'quickActions', label: 'Quick actions' },
    { key: 'needsAttention', label: 'What needs your attention' },
    { key: 'kpis', label: 'KPI cards' },
    { key: 'charts', label: 'Trend charts' },
    { key: 'health', label: 'Business health' },
    { key: 'insights', label: 'Insights' },
    { key: 'upcoming', label: `Upcoming ${terminology.bookingLabel}s` },
    { key: 'activity', label: 'Recent activity' },
  ]

  const widgets = config.widgets ?? DEFAULT_WIDGETS

  async function toggleWidget(key: DashboardWidgetKey, value: boolean) {
    setSavingWidgets(true)
    try {
      await updateConfig({ widgets: { ...widgets, [key]: value } })
    } finally {
      setSavingWidgets(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${getGreeting()}, ${profile?.first_name ?? 'there'}`}
        description={`Here's what's happening with ${business?.name ?? 'your business'} today.`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" icon={<SlidersHorizontal className="h-4 w-4" />} onClick={() => setCustomizeOpen(true)}>
              Customize
            </Button>
            <span className="inline-flex items-center gap-1.5 text-sm text-surface-500">
              <CalendarDays className="h-4 w-4 text-surface-400" />
              {todayLabel}
            </span>
            {business && (
              <Badge variant="primary" className="normal-case">{business.name}</Badge>
            )}
          </div>
        }
      />

      <Modal open={customizeOpen} onClose={() => setCustomizeOpen(false)} title="Customize dashboard">
        <p className="text-sm text-surface-500 mb-4">Choose which sections appear on your dashboard. Changes save to your business settings.</p>
        <ul className="space-y-2">
          {widgetOptions.map((opt) => {
            const active = widgets[opt.key]
            return (
              <li key={opt.key}>
                <button
                  type="button"
                  onClick={() => toggleWidget(opt.key, !active)}
                  className="flex w-full items-center justify-between rounded-lg border border-surface-200 p-3 text-sm font-medium text-surface-700 hover:bg-surface-50 transition-colors"
                >
                  {opt.label}
                  <span
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${active ? 'bg-primary-600' : 'bg-surface-200'}`}
                    aria-hidden
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${active ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        <div className="flex justify-end pt-4">
          <Button onClick={() => setCustomizeOpen(false)} disabled={savingWidgets}>Done</Button>
        </div>
      </Modal>

      {/* Quick Actions */}
      {widgets.quickActions && (
        <div className="rounded-xl border border-surface-200 bg-white p-4 shadow-xs">
          <p className="text-xs font-semibold uppercase tracking-wider text-surface-400 mb-2.5">Quick Actions</p>
          <QuickActions actions={config.quickActions} />
        </div>
      )}

      {/* Needs Attention */}
      {widgets.needsAttention && (
        <Card className={cn('border-l-4 border-l-amber-400')}>
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            <h3 className="text-base font-semibold text-surface-900">What needs your attention</h3>
          </div>
          <NeedsAttention items={attention} loading={attentionLoading} />
        </Card>
      )}

      {/* KPI cards */}
      {widgets.kpis && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
          {kpis.map((k) => <KpiCard key={k.id} kpi={k} />)}
        </div>
      )}

      {/* Primary charts */}
      {widgets.charts && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-surface-900">{config.primaryMetricLabel} Trend</h3>
              <p className="text-sm text-surface-500">Daily {config.primaryMetricLabel.toLowerCase()} from bookings and orders</p>
            </div>
            <div className="flex rounded-lg border border-surface-200 overflow-hidden">
              {tabs.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setRange(t.value)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium transition-colors',
                    range === t.value ? 'bg-primary-600 text-white' : 'bg-white text-surface-600 hover:bg-surface-50'
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <ChartContainer height={260}>
            <LineTrendChart data={revenue as unknown as Record<string, number>[]} series={revenueSeries.series} xKey={revenueSeries.xKey} />
          </ChartContainer>
        </Card>

        <Card>
          <h3 className="text-lg font-semibold text-surface-900 mb-4">{terminology.customerLabel} Growth</h3>
          <ChartContainer height={260}>
            <LineTrendChart data={growth as unknown as Record<string, number>[]} series={growthSeries.series} xKey={growthSeries.xKey} />
          </ChartContainer>
        </Card>
      </div>
      )}

      {/* Business health + insights + monthly snapshot */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {widgets.health && (
        <Card>
          <h3 className="text-lg font-semibold text-surface-900 mb-4">Business Health</h3>
          <dl className="space-y-2 text-sm">
            <HealthStat label="Customer retention" value={`${health.retention}%`} />
            <HealthStat label="Open tasks" value={String(health.openTasks)} />
            <HealthStat label="Pending bookings" value={String(health.pendingBookings)} />
            <HealthStat label="Repeat customers" value={String(health.repeatCustomers)} />
            {health.outstandingCredit > 0 && (
              <HealthStat label="Outstanding" value={formatCurrency(health.outstandingCredit)} />
            )}
          </dl>
        </Card>
        )}

        {widgets.insights && (
        <Card>
          <h3 className="text-lg font-semibold text-surface-900 mb-1">Insights</h3>
          <p className="text-sm text-surface-500 mb-4">What your data is telling you</p>
          <InsightsPanel items={insights} loading={insightsLoading} />
        </Card>
        )}

        {widgets.upcoming && (
        <Card className="lg:col-span-2">
          <h3 className="text-lg font-semibold text-surface-900 mb-4">Upcoming {terminology.bookingLabel}s</h3>
          {upcoming.length === 0 ? (
            <EmptyState
              title={`No upcoming ${terminology.bookingLabel.toLowerCase()}s`}
              description={`Your next confirmed ${terminology.bookingLabel.toLowerCase()} will appear here.`}
              link="/bookings"
              cta={`Create ${terminology.bookingLabel}`}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-200">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-surface-500">{terminology.customerLabel}</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-surface-500">{terminology.resourceLabel}</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-surface-500">Date</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-surface-500">Time</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-surface-500">Status</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-surface-500">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {upcoming.map((u) => (
                    <tr key={u.id} className="border-b border-surface-100">
                      <td className="px-3 py-2.5 font-medium text-surface-900">{u.customer}</td>
                      <td className="px-3 py-2.5 text-surface-700">{u.service}</td>
                      <td className="px-3 py-2.5 text-surface-600">{new Date(u.date + 'T00:00:00').toLocaleDateString()}</td>
                      <td className="px-3 py-2.5 text-surface-600">{u.time}</td>
                      <td className="px-3 py-2.5"><Badge variant={getStatusBadge(u.status).variant}>{getStatusBadge(u.status).label}</Badge></td>
                      <td className="px-3 py-2.5 text-right font-medium text-surface-900">{formatCurrency(u.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        )}
      </div>

      {/* Recent activity */}
      {widgets.activity && (
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-surface-900">Recent Activity</h3>
          <Link to="/activity" className="inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700">
            View all <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        {activity.length === 0 ? (
          <p className="text-sm text-surface-500 py-6 text-center">No activity yet.</p>
        ) : (
          <ol className="relative border-l border-surface-200 ml-2 space-y-4">
            {activity.map((a) => (
              <li key={a.id} className="ml-4">
                <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-white bg-primary-500" />
                <p className="text-[11px] text-surface-400">{new Date(a.created_at).toLocaleString()}</p>
                <p className="text-sm text-surface-700">{a.description}</p>
              </li>
            ))}
          </ol>
        )}
      </Card>
      )}
    </div>
  )
}

function HealthStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-surface-500">{label}</dt>
      <dd className="font-semibold text-surface-900">{value}</dd>
    </div>
  )
}

function EmptyState({ title, description, link, cta }: { title: string; description: string; link: string; cta: string }) {
  return (
    <div className="py-8 text-center">
      <Users className="h-8 w-8 text-surface-300 mx-auto mb-2" />
      <p className="text-sm font-medium text-surface-700">{title}</p>
      <p className="text-xs text-surface-400 mt-1 mb-3">{description}</p>
      <Link to={link} className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-primary-700 transition-colors">
        {cta}
      </Link>
    </div>
  )
}
