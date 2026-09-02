import { useEffect, useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { ResponsiveContainer, PieChart, Pie, Cell, Legend, Tooltip } from 'recharts'
import { PageHeader } from '@/components/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ChartContainer } from '@/components/ui/ChartContainer'
import { LineTrendChart } from '@/components/charts/LineTrendChart'
import {
  type ReportRange,
  salesByDay,
  totalSales,
  bookingsStats,
  customerStats,
  taskCompletionStats,
  ordersByStatus,
  formatCurrencyLocal,
  rangeStart,
  rangeEnd,
} from '@/services/reportService'
import { downloadCSV } from '@/utils/csv'
import { useBusiness } from '@/contexts/BusinessContext'
import { cn } from '@/lib/cn'

const COLORS = ['#3b6cf6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-surface-200 p-4">
      <p className="text-sm text-surface-500">{label}</p>
      <p className="text-2xl font-semibold text-surface-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-surface-400 mt-1">{sub}</p>}
    </div>
  )
}

function SimplePie({ data }: { data: { name: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={2}>
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <Legend />
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  )
}

export function ReportsPage() {
  const { terminology } = useBusiness()
  const [range, setRange] = useState<ReportRange>('30')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [sales, setSales] = useState<Awaited<ReturnType<typeof salesByDay>>>([])
  const [total, setTotal] = useState(0)
  const [bookings, setBookings] = useState<Awaited<ReturnType<typeof bookingsStats>>>()
  const [customers, setCustomers] = useState<Awaited<ReturnType<typeof customerStats>>>()
  const [tasks, setTasks] = useState<Awaited<ReturnType<typeof taskCompletionStats>>>({ completed: 0, total: 0, rate: 0 })
  const [orders, setOrders] = useState<Awaited<ReturnType<typeof ordersByStatus>>>()

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [s, t, b, c, tk, o] = await Promise.all([
        salesByDay(range, customStart, customEnd),
        totalSales(range, customStart, customEnd),
        bookingsStats(),
        customerStats(),
        taskCompletionStats(),
        ordersByStatus(),
      ])
      if (cancelled) return
      setSales(s)
      setTotal(t)
      setBookings(b)
      setCustomers(c)
      setTasks(tk)
      setOrders(o)
    }
    load()
    return () => { cancelled = true }
  }, [range, customStart, customEnd])

  const resolvedBookings = bookings ?? { byStatus: [], byPayment: [], total: 0 }
  const resolvedCustomers = customers ?? { byType: new Map<string, number>(), byStatus: new Map<string, number>(), repeat: 0, total: 0, retentionRate: 0, acquisition: 0 }
  const resolvedOrders = orders ?? { byStatus: [], byPayment: [], total: 0 }

  const exportSalesData = useMemo(() => sales, [sales])

  // Aggregate per-day sales into a single time series for the line chart.
  const salesLine = useMemo(() => {
    const map = new Map<string, number>()
    sales.forEach((r) => {
      map.set(r.date, (map.get(r.date) ?? 0) + r.total)
    })
    return Array.from(map.entries()).map(([date, total]) => ({ label: date, total, date }))
  }, [sales])

  function exportSalesCSV() {
    downloadCSV(
      'sales-report.csv',
      ['Date', 'Amount', 'Status'],
      exportSalesData.map((r) => [r.date, String(r.total), r.status])
    )
  }

  const rangeTabs: { value: ReportRange; label: string }[] = [
    { value: '7', label: '7d' },
    { value: '30', label: '30d' },
    { value: '90', label: '90d' },
    { value: 'custom', label: 'Custom' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Analyze your sales, bookings, customers, and operations."
        actions={
          <Button icon={<Download className="h-4 w-4" />} variant="secondary" onClick={exportSalesCSV}>
            Export CSV
          </Button>
        }
      />

      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
          <div className="flex rounded-lg border border-surface-200 overflow-hidden">
            {rangeTabs.map((t) => (
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
          {range === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="border border-surface-300 rounded-lg px-2 py-1.5 text-sm"
              />
              <span className="text-surface-400">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="border border-surface-300 rounded-lg px-2 py-1.5 text-sm"
              />
            </div>
          )}
          <p className="text-sm text-surface-500">
            {rangeStart(range, customStart, customEnd).toLocaleDateString()} – {rangeEnd(range, customEnd).toLocaleDateString()}
          </p>
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Total Sales" value={formatCurrencyLocal(total)} sub={`${sales.length} transactions`} />
        <StatCard label="Total Bookings" value={String(resolvedBookings.total)} />
        <StatCard label="Task Completion" value={`${tasks.rate}%`} sub={`${tasks.completed}/${tasks.total} done`} />
        <StatCard label="Customer Retention" value={`${resolvedCustomers.retentionRate}%`} sub={`${resolvedCustomers.acquisition} new in 30d`} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-surface-900">Daily Sales</h3>
            <span className="text-sm font-medium text-primary-600">{formatCurrencyLocal(total)} total</span>
          </div>
          <ChartContainer height={300}>
            <LineTrendChart
              data={salesLine}
              series={[{ key: 'total', label: 'Sales', color: '#3b6cf6', format: 'currency' }]}
              xKey="label"
            />
          </ChartContainer>
        </Card>

        <Card>
          <h3 className="text-lg font-semibold text-surface-900 mb-4">{terminology.bookingLabel} Status</h3>
          <ChartContainer height={300}>
            <SimplePie data={resolvedBookings.byStatus} />
          </ChartContainer>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card>
          <h3 className="text-lg font-semibold text-surface-900 mb-4">Orders by Status</h3>
          <ChartContainer height={240}>
            <SimplePie data={resolvedOrders.byStatus} />
          </ChartContainer>
        </Card>
        <Card>
          <h3 className="text-lg font-semibold text-surface-900 mb-4">{terminology.bookingLabel} by Payment</h3>
          <ChartContainer height={240}>
            <SimplePie data={resolvedBookings.byPayment} />
          </ChartContainer>
        </Card>
        <Card>
          <h3 className="text-lg font-semibold text-surface-900 mb-4">Customer Types</h3>
          <div className="space-y-2">
            {Array.from(resolvedCustomers.byType.entries()).map(([name, value]) => (
              <div key={name} className="flex items-center justify-between text-sm">
                <span className="text-surface-500 capitalize">{name.replace('_', ' ')}</span>
                <span className="font-medium text-surface-900">{value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
