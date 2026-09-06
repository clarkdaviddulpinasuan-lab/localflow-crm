import { describe, it, expect, beforeEach } from 'vitest'
import {
  formatCurrency,
  formatNumber,
  getInitials,
  getGreeting,
  calculatePercentageChange,
  classNames,
  formatDate,
  formatDateSpan,
  parseISODate,
} from '@/utils/format'
import { savePreferences, defaultPreferences } from '@/services/settingsService'

beforeEach(() => {
  savePreferences(defaultPreferences())
})

describe('formatCurrency', () => {
  it('formats PHP with no decimals by default', () => {
    expect(formatCurrency(12500)).toMatch(/12,500/)
  })

  it('respects a custom currency', () => {
    expect(formatCurrency(99, 'USD')).toMatch(/99/)
    expect(formatCurrency(99, 'USD')).toContain('$')
  })

  it('handles zero', () => {
    expect(formatCurrency(0)).toContain('0')
  })
})

describe('formatNumber', () => {
  it('groups thousands', () => {
    expect(formatNumber(1234567)).toBe('1,234,567')
  })
})

describe('getInitials', () => {
  it('returns two uppercase initials', () => {
    expect(getInitials('Maria', 'Santos')).toBe('MS')
    expect(getInitials('ana', 'reyes')).toBe('AR')
  })
})

describe('getGreeting', () => {
  it('returns a greeting based on the hour', () => {
    const hour = new Date().getHours()
    const greeting = getGreeting()
    if (hour < 12) expect(greeting).toBe('Good morning')
    else if (hour < 17) expect(greeting).toBe('Good afternoon')
    else expect(greeting).toBe('Good evening')
  })
})

describe('calculatePercentageChange', () => {
  it('computes percent change', () => {
    expect(calculatePercentageChange(120, 100)).toBe(20)
    expect(calculatePercentageChange(80, 100)).toBe(-20)
  })

  it('handles previous of zero', () => {
    expect(calculatePercentageChange(50, 0)).toBe(100)
    expect(calculatePercentageChange(0, 0)).toBe(0)
  })

  it('returns a single-decimal rounded value', () => {
    expect(calculatePercentageChange(10, 3)).toBeCloseTo(233.3, 1)
  })
})

describe('classNames', () => {
  it('joins truthy class names', () => {
    expect(classNames('a', '', 'b', null, undefined, false, 'c')).toBe('a b c')
  })
})

describe('formatDate', () => {
  it('defaults to MM/DD/YYYY', () => {
    expect(formatDate('2025-06-10')).toBe('06/10/2025')
  })

  it('honors DD/MM/YYYY', () => {
    savePreferences({ ...defaultPreferences(), dateFormat: 'DD/MM/YYYY' })
    expect(formatDate('2025-06-10')).toBe('10/06/2025')
  })

  it('honors YYYY-MM-DD', () => {
    savePreferences({ ...defaultPreferences(), dateFormat: 'YYYY-MM-DD' })
    expect(formatDate('2025-06-10')).toBe('2025-06-10')
  })

  it('accepts Date objects', () => {
    expect(formatDate(new Date(2025, 5, 10))).toBe('06/10/2025')
  })

  it('falls back to locale options when opts provided', () => {
    expect(formatDate('2025-06-10', { month: 'long' })).toBe('June')
  })
})

describe('formatDateSpan', () => {
  it('renders a single date', () => {
    expect(formatDateSpan('2025-06-10')).toBe('06/10/2025')
  })

  it('renders a multi-day span with range formatting', () => {
    const span = formatDateSpan('2025-06-10', '2025-06-12')
    expect(span).toContain('Jun 10')
    expect(span).toContain('12')
  })

  it('returns an em dash for empty input', () => {
    expect(formatDateSpan('')).toBe('—')
  })
})

describe('parseISODate', () => {
  it('parses YYYY-MM-DD as a local date', () => {
    const d = parseISODate('2025-06-10')
    expect(d.getFullYear()).toBe(2025)
    expect(d.getMonth()).toBe(5)
    expect(d.getDate()).toBe(10)
  })
})
