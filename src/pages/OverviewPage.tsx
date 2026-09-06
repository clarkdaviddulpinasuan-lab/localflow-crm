import { useEffect, useMemo, useState } from 'react'
import { Users, ArrowRight, SlidersHorizontal, Plus, PieChart as PieIcon, BarChart3, AlertCircle, AlertTriangle, RotateCw, Clock } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, AreaChart, Area } from 'recharts'
import { useAuth } from '@/contexts/AuthContext'
import { useBusiness } from '@/contexts/BusinessContext'
import { getGreeting, formatCurrency } from '@/utils/format'
import { KpiCard } from '@/components/KpiCard'
import { PageHeader } from '@/components/PageHeader'
import { Card } from '@/components/ui/Card'
import { Badge, getStatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState as UiEmptyState } from '@/components/ui/EmptyState'
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
  paymentStatusBreakdown,
  type Kpi,
  type DailyPoint,
  type TrendRange,
  type NeedsAttentionItem,
  type PaymentStatusPoint,
} from '@/services/dashboardService'
import { cn } from '@/lib/cn'

// Donut colors + labels for each payment status
const PAYMENT_META: Record<string, { label: string; color: string }> = {
  paid: { label: 'Paid', color: '#10b981' },
  partial: { label: 'Partial', color: '#f59e0b' },
  pending: { label: 'Pending', color: '#7b6bf2' },
  refunded: { label: 'Refunded', color: '#f43f5e' },
}

// Revenue counts money collected or part-collected. Pending is not yet certain
// and refunds are money handed back, so neither counts. Note that a partial
// record contributes its full invoice amount: the schema stores no paid-amount
// column, so the collected share of a partial payment is not knowable here.
const REVENUE_STATUSES = ['paid', 'partial']

export function OverviewPage() {
  const navigate = useNavigate()
  const { business } = useAuth()
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
  const [payments, setPayments] = useState<PaymentStatusPoint[]>([])
  const [growth, setGrowth] = useState<DailyPoint[]>([])
  const [insights, setInsights] = useState<Insight[]>([])
  const [insightsLoading, setInsightsLoading] = useState(true)
  const [customizeOpen, setCustomizeOpen] = useState(false)
  const [savingWidgets, setSavingWidgets] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setLoadError(false)
      const [k, u, a, h, r, g, att, ins] = await Promise.allSettled([
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
      const ok = <T,>(r: PromiseSettledResult<T>, fb: T) =>
        r.status === 'fulfilled' ? r.value : fb
      setKpis(ok(k, []))
      setUpcoming(ok(u, []))
      setActivity(ok(a, []))
      setHealth(ok(h, { retention: 0, openTasks: 0, pendingBookings: 0, repeatCustomers: 0, outstandingCredit: 0 }))
      setRevenue(ok(r, []))
      setGrowth(ok(g, []))
      setAttention(ok(att, []))
      setAttentionLoading(false)
      setInsights(ok(ins, []))
      setInsightsLoading(false)
      // The KPI compute is the anchor call: if it fails the whole dashboard is
      // likely unreachable, so surface a page-level error with a retry action.
      // Individual widgets still fall back to empty when only they fail.
      setLoadError(k.status === 'rejected')
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [config.kpiCards, range, reloadKey])

  // Payment split is all-time, so it does not depend on the range tabs.
  useEffect(() => {
    let cancelled = false
    paymentStatusBreakdown()
      .then((p) => { if (!cancelled) setPayments(p) })
      .catch(() => { if (!cancelled) setPayments([]) })
    return () => { cancelled = true }
  }, [])

  const revenueSeries = useMemo(
    () => ({
      xKey: 'label' as const,
      series: [
        { key: 'value', label: config.trendMetricLabel, color: '#7b6bf2', format: 'currency' as const },
      ],
    }),
    [config.trendMetricLabel]
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


  const donutData = useMemo(
    () =>
      payments.map((p) => ({
        name: PAYMENT_META[p.name]?.label ?? p.name,
        value: p.value,
        color: PAYMENT_META[p.name]?.color ?? '#94a3b8',
      })),
    [payments]
  )

  const donutTotal = useMemo(() => donutData.reduce((a, d) => a + d.value, 0), [donutData])

  const revenueTotal = useMemo(
    () => payments.filter((p) => REVENUE_STATUSES.includes(p.name)).reduce((a, p) => a + p.value, 0),
    [payments]
  )

  const barData = useMemo(() => growth.map((g) => ({ label: g.label, value: g.value })), [growth])

  const lastGrowthValue = growth.length > 0 ? growth[growth.length - 1].value : 0
  const firstGrowthValue = growth.length > 0 ? growth[0].value : 0
  const lastRangeLabel = tabs.find((t) => t.value === range)?.label ?? 'Current'

  function formatNumber(v: number) {
    if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M'
    if (v >= 1_000) return (v / 1_000).toFixed(1) + 'k'
    return String(v)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${getGreeting()}, ${business?.name ?? 'there'}`}
        description={`Here's what's happening with ${business?.name ?? 'your business'} today.`}
        actions={
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setCustomizeOpen(true)}
              className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-surface-200 bg-white px-3 text-sm text-surface-600 shadow-soft hover:bg-surface-50 transition-colors"
              aria-label="Customize dashboard"
              title="Customize dashboard"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>
            <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/customers?new=1')}>New {terminology.customerLabel}</Button>
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

      {loading ? (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
          <Skeleton className="h-72 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : loadError ? (
        <UiEmptyState
          icon={<AlertTriangle className="h-6 w-6" />}
          title="Couldn't load your dashboard"
          description="We hit a problem loading your data. Check your connection and try again."
          action={
            <Button icon={<RotateCw className="h-4 w-4" />} onClick={() => setReloadKey((x) => x + 1)}>
              Retry
            </Button>
          }
        />
      ) : (
        <>
      {/* Quick Actions */}
      {widgets.quickActions && (
        <div className="bg-white rounded-[14px] p-5 shadow-soft">
          <QuickActions actions={config.quickActions} />
        </div>
      )}

      {/* KPI cards — Rhombus 4-column row with accent strips */}
      {widgets.kpis && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          {kpis.filter((k) => k.id !== 'customers').map((k) => <KpiCard key={k.id} kpi={k} />)}
        </div>
      )}

      {/* Middle: wider revenue breakdown + growth on left, revenue & tasks on right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left column — wider breakdown + growth stacked (fixes bottom whitespace) */}
        <div className="lg:col-span-2 flex flex-col gap-5">
          {widgets.charts && (
            <Card className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-[#ede9fe] text-[#6a5ce0]">
                  <PieIcon className="h-4 w-4" />
                </span>
                <h3 className="text-base font-semibold text-surface-900">Payment Status</h3>
              </div>
              <p className="text-sm text-surface-500 mb-4">All {config.primaryMetricLabel.toLowerCase()} by payment state — all time</p>
              {donutData.length === 0 ? (
                <div className="h-52 flex items-center justify-center text-sm text-surface-500">
                  No payments recorded in this period
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  <div className="h-52 w-full sm:w-1/2">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Tooltip
                          formatter={(v) => formatCurrency(Number(v) || 0)}
                          contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 4px 16px rgba(0,0,0,0.06)', fontSize: 13 }}
                        />
                        <Pie data={donutData} dataKey="value" nameKey="name" innerRadius={54} outerRadius={84} paddingAngle={4} strokeWidth={0}>
                          {donutData.map((d) => (
                            <Cell key={d.name} fill={d.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 w-full space-y-3">
                    {donutData.map((d) => (
                      <div key={d.name} className="flex items-center text-sm">
                        <span className="h-2.5 w-2.5 rounded-full mr-2" style={{ background: d.color }} />
                        <span className="text-surface-600 flex-1">{d.name}</span>
                        <span className="text-surface-400 tabular-nums mr-3">
                          {Math.round((d.value / donutTotal) * 100)}%
                        </span>
                        <span className="font-semibold text-surface-900">{formatCurrency(d.value)}</span>
                      </div>
                    ))}
                    <div className="pt-2 border-t border-surface-100 flex items-center text-sm">
                      <span className="text-surface-500 flex-1">Total</span>
                      <span className="font-bold text-[#6a5ce0]">{formatCurrency(donutTotal)}</span>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* Bar chart — customer growth */}
          {widgets.charts && (
            <Card className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-[#fce7f3] text-[#db2777]">
                  <BarChart3 className="h-4 w-4" />
                </span>
                <h3 className="text-base font-semibold text-surface-900">{terminology.customerLabel} Growth</h3>
              </div>
              <p className="text-sm text-surface-500 mb-4">Last {range} days</p>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} minTickGap={24} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 4px 16px rgba(0,0,0,0.06)', fontSize: 13 }}
                      cursor={{ fill: 'rgba(123,107,242,0.06)' }}
                    />
                    <Bar dataKey="value" name={terminology.customerLabel} fill="#7b6bf2" radius={[6, 6, 0, 0]} maxBarSize={22} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 flex items-center justify-between px-1 text-sm">
                <div>
                  <p className="text-[11px] text-surface-400">Current {terminology.customerLabel}s</p>
                  <p className="font-bold text-surface-900">{formatNumber(lastGrowthValue)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-surface-400">Change</p>
                  <p className="font-semibold text-success-600">+{Math.abs(Math.round(firstGrowthValue / (lastGrowthValue || 1) * 100) - 100)}%</p>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* Right column — Total revenue + Open tasks */}
        <div className="lg:col-span-1 flex flex-col gap-5">
          {widgets.charts && (
            <Card>
              <p className="text-sm text-surface-500">Total {config.primaryMetricLabel}</p>
              <p className="text-3xl font-bold tracking-tight text-surface-900 mt-1">{formatCurrency(revenueTotal)}</p>
              <p className="text-xs text-surface-500 font-medium mt-1">Paid + partial, all time · trend last {lastRangeLabel}</p>
              <div className="h-20 mt-3">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenue} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revenueMini" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#7b6bf2" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#7b6bf2" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="label" hide />
                    <YAxis hide domain={['dataMin', 'dataMax']} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 4px 16px rgba(0,0,0,0.06)', fontSize: 13 }}
                      formatter={(v) => formatCurrency(Number(v) || 0)}
                    />
                    <Area type="monotone" dataKey="value" stroke="#7b6bf2" strokeWidth={2} strokeLinecap="round" fill="url(#revenueMini)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          {/* What needs your attention — right of customer growth */}
          {widgets.needsAttention && (
            <Card className="flex-1">
              <div className="flex items-center gap-2 mb-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-[#fef3c7] text-[#b45309]">
                  <AlertCircle className="h-4 w-4" />
                </span>
                <h3 className="text-base font-semibold text-surface-900">What needs your attention</h3>
              </div>
              <NeedsAttention items={attention} loading={attentionLoading} />
            </Card>
          )}
        </div>
      </div>

      {/* Performance row — wide trend + activity */}
      {widgets.charts && (
        <Card>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <h3 className="text-lg font-semibold text-surface-900">{config.primaryMetricLabel} Trend</h3>
              <p className="text-sm text-surface-500">Daily {config.primaryMetricLabel.toLowerCase()} from bookings and orders</p>
            </div>
            <div className="flex rounded-[10px] bg-[#f3f4f6] p-1">
              {tabs.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setRange(t.value)}
                  className={cn(
                    'px-3.5 py-1.5 text-xs font-medium rounded-[8px] transition-colors',
                    range === t.value ? 'bg-white text-[#6a5ce0] shadow-soft font-semibold' : 'text-surface-500 hover:text-surface-700'
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <LineTrendChart data={revenue as unknown as Record<string, number>[]} series={revenueSeries.series} xKey={revenueSeries.xKey} height={280} />
        </Card>
      )}

      {/* Bottom row — health, insights, upcoming */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {widgets.health && (
        <Card>
          <h3 className="text-base font-semibold text-surface-900 mb-4">Business health</h3>
          <div className="space-y-3">
            <HealthBar label="Customer retention" value={health.retention} color="#ede9fe" bar="bg-[#7b6bf2]" />
            <HealthStatRow label="Open tasks" value={String(health.openTasks)} />
            <HealthStatRow label="Pending bookings" value={String(health.pendingBookings)} />
            <HealthBar label="Repeat customers" value={health.repeatCustomers} color="#ccfbf1" bar="bg-[#7b6bf2]" />
            {health.outstandingCredit > 0 && (
              <HealthStatRow label="Outstanding" value={formatCurrency(health.outstandingCredit)} />
            )}
          </div>
        </Card>
        )}

        {widgets.insights && (
        <Card>
          <h3 className="text-base font-semibold text-surface-900 mb-1">Insights</h3>
          <p className="text-sm text-surface-500 mb-4">What your data is telling you</p>
          <InsightsPanel items={insights} loading={insightsLoading} />
        </Card>
        )}

        {widgets.upcoming && (
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <span className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-[#fef9c3] text-[#ca8a04]">
              <Clock className="h-4 w-4" />
            </span>
            <h3 className="text-base font-semibold text-surface-900">Upcoming {terminology.bookingLabel}s</h3>
          </div>
          {upcoming.length === 0 ? (
            <EmptyState
              title={`No upcoming ${terminology.bookingLabel.toLowerCase()}s`}
              description={`Your next confirmed ${terminology.bookingLabel.toLowerCase()} will appear here.`}
              link="/bookings"
              cta={`Create ${terminology.bookingLabel}`}
            />
          ) : (
            <ul className="divide-y divide-surface-100">
              {upcoming.map((u) => (
                <li key={u.id} className="flex items-center justify-between py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-surface-900">{u.customer}</p>
                    <p className="truncate text-xs text-surface-500">{u.service}</p>
                    <p className="text-[11px] text-surface-400 mt-0.5">{new Date(u.date + 'T00:00:00').toLocaleDateString()} · {u.time}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge variant={getStatusBadge(u.status).variant}>{getStatusBadge(u.status).label}</Badge>
                    <span className="text-sm font-semibold text-surface-900">{formatCurrency(u.amount)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        )}
      </div>

      {/* Recent activity */}
      {widgets.activity && (
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-surface-900">Recent activity</h3>
          <Link to="/activity" className="inline-flex items-center gap-1 text-sm font-medium text-[#7b6bf2] hover:text-[#6a5ce0]">
            View all <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        {activity.length === 0 ? (
          <p className="text-sm text-surface-500 py-6 text-center">No activity yet.</p>
        ) : (
          <ol className="space-y-4">
            {activity.map((a, idx) => (
              <li key={a.id} className="flex items-start gap-3">
                <span className={cn('flex h-2.5 w-2.5 mt-1.5 rounded-full shrink-0', idx % 3 === 0 ? 'bg-[#7b6bf2]' : idx % 3 === 1 ? 'bg-[#db2777]' : 'bg-[#0d9488]')} />
                <div>
                  <p className="text-[11px] text-surface-400">{new Date(a.created_at).toLocaleString()}</p>
                  <p className="text-sm text-surface-700">{a.description}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Card>
      )}
        </>
      )}
    </div>
  )
}

function HealthStatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-surface-500">{label}</span>
      <span className="font-semibold text-surface-900">{value}</span>
    </div>
  )
}

function HealthBar({ label, value, color, bar }: { label: string; value: number; color: string; bar: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1.5">
        <span className="text-surface-500">{label}</span>
        <span className="font-semibold text-surface-900">{value}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full" style={{ background: color }}>
        <div className={cn('h-1.5 rounded-full', bar)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
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
