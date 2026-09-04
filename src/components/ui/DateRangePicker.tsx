import { useMemo, useState } from 'react'
import {
  addMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  format,
  isAfter,
} from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface DateRange {
  start: string | null
  end: string | null
}

interface DateRangePickerProps {
  /** Controlled range (ISO `yyyy-MM-dd` or null). Omit for uncontrolled. */
  value?: DateRange
  /** Called whenever the range changes. */
  onChange?: (range: DateRange) => void
  /** Optional starting month (ISO `yyyy-MM-dd`). Defaults to today. */
  initialMonth?: string
  className?: string
}

function toDate(date?: string | null): Date | undefined {
  return date ? new Date(date + 'T00:00:00') : undefined
}

function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Reusable, interactive date-range picker.
 *
 * First click sets the start; the second click sets the end (a click before the
 * start overwrites the start instead). Start/end are solid blue circles and the
 * in-between days get a continuous light-blue rectangular highlight that runs
 * behind the circles to form an unbroken chain.
 */
export function DateRangePicker({ value, onChange, initialMonth, className }: DateRangePickerProps) {
  const [internal, setInternal] = useState<DateRange>({ start: null, end: null })

  const isControlled = value !== undefined
  const range: DateRange = isControlled ? value ?? { start: null, end: null } : internal

  const initial = toDate(initialMonth) ?? toDate(range.start) ?? new Date()
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(initial))

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(viewMonth), { weekStartsOn: 0 })
    const end = endOfWeek(endOfMonth(viewMonth), { weekStartsOn: 0 })
    return eachDayOfInterval({ start, end })
  }, [viewMonth])

  function commit(next: DateRange) {
    if (isControlled) {
      onChange?.(next)
    } else {
      setInternal(next)
      onChange?.(next)
    }
  }

  function handleSelect(day: Date) {
    const iso = toISODate(day)
    if (!isSameMonth(day, viewMonth)) {
      setViewMonth(startOfMonth(day))
    }
    if (!range.start) {
      commit({ start: iso, end: null })
      return
    }
    if (!range.end) {
      // If the click is before the current start, overwrite the start.
      if (isAfter(new Date(range.start + 'T00:00:00'), day)) {
        commit({ start: iso, end: null })
      } else {
        commit({ start: range.start, end: iso })
      }
      return
    }
    // Both are set — start a fresh selection.
    commit({ start: iso, end: null })
  }

  function handleReset() {
    commit({ start: null, end: null })
  }

  const startDate = toDate(range.start)
  const endDate = toDate(range.end)
  const hasSelection = !!startDate && !!endDate && (startDate.getTime() <= endDate.getTime())

  function dayKind(day: Date): 'start' | 'end' | 'inside' | 'single' | 'none' {
    if (!startDate) return 'none'
    if (hasSelection) {
      if (isSameDay(day, startDate) && isSameDay(day, endDate)) return 'single'
      if (isSameDay(day, startDate)) return 'start'
      if (isSameDay(day, endDate)) return 'end'
      if (day > startDate && day < endDate) return 'inside'
      return 'none'
    }
    if (isSameDay(day, startDate)) return 'single'
    return 'none'
  }

  const header = startDate
    ? hasSelection
      ? `${format(startDate, 'MMM d, yyyy')} → ${endDate ? format(endDate, 'MMM d, yyyy') : '...'}`
      : `${format(startDate, 'MMM d, yyyy')} → End Date`
    : 'Start Date → End Date'

  return (
    <div className={cn('w-full bg-white rounded-xl border border-surface-200 shadow-sm p-4', className)}>
      {/* Top header: selected range or placeholder */}
      <div className="mb-3 text-center text-sm font-medium text-surface-900">{header}</div>

      {/* Calendar header: month / year + nav */}
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={() => setViewMonth(addMonths(viewMonth, -1))}
          className="p-1.5 rounded-lg text-surface-500 hover:bg-surface-100 transition-colors"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold text-surface-800">{format(viewMonth, 'MMMM yyyy')}</span>
        <button
          type="button"
          onClick={() => setViewMonth(addMonths(viewMonth, 1))}
          className="p-1.5 rounded-lg text-surface-500 hover:bg-surface-100 transition-colors"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Days of the week row */}
      <div className="grid grid-cols-7 mb-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="text-center text-xs text-surface-400 py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const kind = dayKind(day)
          const inMonth = isSameMonth(day, viewMonth)

          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => handleSelect(day)}
              className={cn(
                'relative py-1 px-0.5 flex items-center justify-center text-sm transition-colors',
                !inMonth && 'text-surface-300',
                inMonth && !(kind === 'start' || kind === 'end' || kind === 'single') && 'text-surface-800'
              )}
            >
              {/* Full-width rectangular range background */}
              {(kind === 'start' || kind === 'end' || kind === 'inside') && (
                <span
                  className={cn(
                    'absolute top-1 bottom-1 bg-primary-100',
                    kind === 'start' && 'rounded-l-full',
                    kind === 'end' && 'rounded-r-full'
                  )}
                  style={
                    kind === 'start'
                      ? { left: 'calc(50% - 18px)', right: '-50%' }
                      : kind === 'end'
                      ? { left: '-50%', right: 'calc(50% - 18px)' }
                      : { left: 0, right: 0 }
                  }
                />
              )}
              {kind === 'single' && null}

              {kind === 'start' || kind === 'end' || kind === 'single' ? (
                <span
                  className={cn(
                    'relative z-10 h-9 w-9 rounded-full flex items-center justify-center',
                    kind === 'single' ? 'bg-primary-600' : 'bg-primary-600',
                    'text-white'
                  )}
                >
                  {format(day, 'd')}
                </span>
              ) : (
                <span
                  className={cn(
                    'relative z-10 flex h-9 w-9 items-center justify-center rounded-full',
                    inMonth && 'hover:bg-surface-100'
                  )}
                >
                  {format(day, 'd')}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Footer: reset */}
      <div className="mt-3 flex items-center">
        <button
          type="button"
          onClick={handleReset}
          disabled={!startDate}
          className={cn(
            'px-4 py-1.5 text-sm rounded-full border border-surface-300 text-surface-600',
            'hover:bg-surface-50 transition-colors',
            'disabled:opacity-40 disabled:pointer-events-none'
          )}
        >
          Reset
        </button>
      </div>
    </div>
  )
}
