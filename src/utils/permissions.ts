import type { UserRole } from '@/types'

export type Permission =
  | 'view:reports'
  | 'manage:team'
  | 'manage:settings'
  | 'manage:business'
  | 'manage:customers'
  | 'manage:bookings'
  | 'manage:orders'
  | 'manage:tasks'
  | 'manage:leads'

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  owner: [
    'view:reports',
    'manage:team',
    'manage:settings',
    'manage:business',
    'manage:customers',
    'manage:bookings',
    'manage:orders',
    'manage:tasks',
    'manage:leads',
  ],
  manager: [
    'view:reports',
    'manage:team',
    'manage:business',
    'manage:customers',
    'manage:bookings',
    'manage:orders',
    'manage:tasks',
    'manage:leads',
  ],
  staff: ['manage:customers', 'manage:bookings', 'manage:orders', 'manage:tasks'],
}

export function can(role: UserRole | null, permission: Permission): boolean {
  if (!role) return false
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false
}
