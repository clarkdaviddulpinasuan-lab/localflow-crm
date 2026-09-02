import { useMemo, useState } from 'react'
import { ResponsiveContainer, AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { formatCurrency } from '@/utils/format'
import { cn } from '@/lib/cn'

export interface SeriesConfig {
  key: string
  label: string
  color: string
  format: 'currency' | 'number'
}

interface LineTrendChartProps {
  data: Record<string, number | string>[]
  series: SeriesConfig[]
  xKey: string
  height?: number
  formatCurrencyValue?: (v: number) => string
  showLegend?: boolean
  note?: string
}

const DEFAULT_TOOLTIP_STYLE = {
  borderRadius: 12,
  border: '1px solid #e2e8f0',
  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
  fontSize: 13,
}

function formatTickValue(v: number, format: 'currency' | 'number'): string {
  if (format === 'currency') {
    if (Math.abs(v) >= 1000) return formatCurrency(v)
    return formatCurrency(v)
  }
  return String(Math.round(v))
}

export function LineTrendChart({
  data,
  series,
  xKey,
  height = 260,
  showLegend = true,
  note,
}: LineTrendChartProps) {
  const [hidden, setHidden] = useState<Set<string>>(new Set())

  const visibleSeries = useMemo(() => series.filter((s) => !hidden.has(s.key)), [series, hidden])

  function toggleSeries(key: string) {
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  if (visibleSeries.length === 0) {
    return (
      <div className="flex items-center justify-center text-sm text-surface-400" style={{ height }}>
        No data to display.
      </div>
    )
  }

  const allGradients = series.map((s) => (
      <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor={s.color} stopOpacity={0.12} />
        <stop offset="95%" stopColor={s.color} stopOpacity={0} />
      </linearGradient>
    )
  )

  return (
    <div>
      {showLegend && series.length > 1 && (
        <div className="flex flex-wrap items-center gap-3 mb-3">
          {series.map((s) => {
            const isOff = hidden.has(s.key)
            return (
              <button
                key={s.key}
                onClick={() => toggleSeries(s.key)}
                className={cn(
                  'inline-flex items-center gap-1.5 text-xs font-medium transition-opacity',
                  isOff ? 'text-surface-400 opacity-60' : 'text-surface-700'
                )}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: s.color, opacity: isOff ? 0.4 : 1 }}
                />
                {s.label}
              </button>
            )
          })}
          {note && <span className="text-xs text-surface-400 ml-auto">{note}</span>}
        </div>
      )}
      {!showLegend && note && (
        <div className="mb-3 text-xs text-surface-400">{note}</div>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>{allGradients}</defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey={xKey}
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={false}
            minTickGap={24}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={false}
            width={44}
            tickFormatter={(v) => formatTickValue(Number(v), visibleSeries[0]?.format ?? 'number')}
          />
          <Tooltip
            contentStyle={DEFAULT_TOOLTIP_STYLE}
            labelStyle={{ fontWeight: 600, color: '#0f172a', marginBottom: 4 }}
            cursor={{ stroke: '#cbd5e1', strokeDasharray: '4 4' }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            content={({ active, payload, label }: any) => {
              if (!active || !payload || payload.length === 0) return null
              return (
                <div style={DEFAULT_TOOLTIP_STYLE} className="bg-white px-3 py-2.5">
                  <p style={{ fontWeight: 600, color: '#0f172a', marginBottom: 6 }}>{label}</p>
                  <div className="space-y-1">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {payload.map((entry: any) => {
                      const s = visibleSeries.find((x) => x.key === entry.dataKey)
                      const fmt = s?.format ?? 'currency'
                      return (
                        <div key={entry.dataKey} className="flex items-center gap-2 text-sm">
                          <span className="h-2 w-2 rounded-full" style={{ background: entry.stroke || entry.color }} />
                          <span className="text-surface-500">{entry.name}</span>
                          <span className="ml-auto font-medium text-surface-900">{formatTickValue(Number(entry.value), fmt)}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            }}
          />
          {visibleSeries.map((s) => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={1.75}
              strokeLinecap="round"
              fill={`url(#grad-${s.key})`}
              dot={false}
              activeDot={{ r: 5, strokeWidth: 2, stroke: '#ffffff', fill: s.color }}
              animationDuration={700}
              animationEasing="ease-out"
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// Single-series convenience for simple line graphs.
export function SimpleLineChart({
  data,
  xKey,
  valueKey,
  valueLabel,
  color = '#3b6cf6',
  height = 240,
}: {
  data: { [key: string]: number | string }[]
  xKey: string
  valueKey: string
  valueLabel?: string
  color?: string
  height?: number
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="simple-glow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.2} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} minTickGap={24} />
        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={40} />
        <Tooltip
          contentStyle={DEFAULT_TOOLTIP_STYLE}
          labelStyle={{ fontWeight: 600, color: '#0f172a', marginBottom: 4 }}
        />
        <Line
          type="monotone"
          dataKey={valueKey}
          name={valueLabel ?? valueKey}
          stroke={color}
          strokeWidth={1.75}
          strokeLinecap="round"
          dot={false}
          activeDot={{ r: 5, strokeWidth: 2, stroke: '#ffffff', fill: color }}
          animationDuration={700}
          animationEasing="ease-out"
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
