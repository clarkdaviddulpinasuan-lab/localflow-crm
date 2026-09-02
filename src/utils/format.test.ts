import { describe, it, expect } from 'vitest'
import {
  formatCurrency,
  formatNumber,
  getInitials,
  getGreeting,
  calculatePercentageChange,
  classNames,
} from '@/utils/format'

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
