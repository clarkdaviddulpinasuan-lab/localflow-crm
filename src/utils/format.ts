import { getPreferences, type Preferences } from '@/services/settingsService'

export function formatCurrency(amount: number, currency: string = 'PHP'): string {
  const formatter = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
  return formatter.format(amount)
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-US').format(n)
}

export function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}

// Parse a `YYYY-MM-DD` date string as a local date (avoids UTC timezone shifts).
export function parseISODate(value: string): Date {
  return new Date(value + 'T00:00:00')
}

// Formats a date as a plain, locale-free YYYY-MM-DD string for comparisons.
function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Renders a full date using the user's saved `dateFormat` preference
// (MM/DD/YYYY, DD/MM/YYYY or YYYY-MM-DD). When `opts` is provided the caller
// asks for a specialized format (month/weekday names) and we fall back to
// `toLocaleDateString` with those options instead.
export function formatDate(value: Date | string, opts?: Intl.DateTimeFormatOptions): string {
  const date = typeof value === 'string' ? parseISODate(value) : value
  if (opts) {
    return date.toLocaleDateString(undefined, opts)
  }
  const format = getPreferences().dateFormat as Preferences['dateFormat']
  const iso = toISODate(date)
  if (format === 'DD/MM/YYYY') {
    return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
  }
  if (format === 'YYYY-MM-DD') {
    return iso
  }
  return `${iso.slice(5, 7)}/${iso.slice(8, 10)}/${iso.slice(0, 4)}`
}

// "Sep 3, 2026" for a single date, "Sep 3 – 5, 2026" for a multi-day span.
export function formatDateSpan(start: string, end?: string | null): string {
  if (!start) return '—'
  const startDate = parseISODate(start)
  if (end && end > start) {
    const endDate = parseISODate(end)
    const sameMonth = startDate.getMonth() === endDate.getMonth() && startDate.getFullYear() === endDate.getFullYear()
    if (sameMonth) {
      return `${startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${endDate.toLocaleDateString(undefined, { day: 'numeric', year: 'numeric' })}`
    }
    return `${startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${endDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
  }
  return formatDate(startDate)
}

export function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export function calculatePercentageChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / previous) * 100 * 10) / 10
}

export function classNames(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ')
}
