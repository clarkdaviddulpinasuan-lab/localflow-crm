import { describe, it, expect } from 'vitest'
import { can, type Permission } from '@/utils/permissions'

const permissions: Permission[] = [
  'view:reports',
  'manage:team',
  'manage:settings',
  'manage:business',
  'manage:customers',
  'manage:bookings',
  'manage:orders',
  'manage:tasks',
  'manage:leads',
]

describe('permissions', () => {
  it('owner can do everything', () => {
    permissions.forEach((p) => expect(can('owner', p)).toBe(true))
  })

  it('manager can manage but not settings', () => {
    expect(can('manager', 'manage:settings')).toBe(false)
    expect(can('manager', 'manage:business')).toBe(true)
    expect(can('manager', 'manage:team')).toBe(true)
    expect(can('manager', 'view:reports')).toBe(true)
  })

  it('staff has limited access', () => {
    expect(can('staff', 'manage:customers')).toBe(true)
    expect(can('staff', 'manage:bookings')).toBe(true)
    expect(can('staff', 'manage:orders')).toBe(true)
    expect(can('staff', 'manage:settings')).toBe(false)
    expect(can('staff', 'manage:team')).toBe(false)
    expect(can('staff', 'manage:business')).toBe(false)
    expect(can('staff', 'view:reports')).toBe(false)
  })

  it('returns false for null role', () => {
    permissions.forEach((p) => expect(can(null, p)).toBe(false))
  })
})
