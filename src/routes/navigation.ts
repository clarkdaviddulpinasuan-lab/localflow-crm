import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard,
  Users,
  Users2,
  CalendarCheck,
  ShoppingCart,
  ClipboardList,
  CalendarDays,
  Filter,
  BarChart3,
  Zap,
  Mail,
  CalendarClock,
  UsersRound,
  Activity,
  Bell,
  Building2,
  Settings,
  UserCircle,
} from 'lucide-react'
import type { NavLabels } from '@/config/businessTypes'

export interface NavItem {
  label: string
  path: string
  icon: LucideIcon
}

export interface NavGroup {
  label?: string
  items: NavItem[]
}

export const navGroups: NavGroup[] = [
  {
    items: [
      { label: 'Overview', path: '/', icon: LayoutDashboard },
      { label: 'Customers', path: '/customers', icon: Users },
      { label: 'Segments', path: '/segments', icon: Users2 },
      { label: 'Bookings', path: '/bookings', icon: CalendarCheck },
      { label: 'Availability', path: '/availability', icon: CalendarClock },
      { label: 'Orders', path: '/orders', icon: ShoppingCart },
      { label: 'Tasks', path: '/tasks', icon: ClipboardList },
      { label: 'Calendar', path: '/calendar', icon: CalendarDays },
      { label: 'Leads', path: '/leads', icon: Filter },
      { label: 'Reports', path: '/reports', icon: BarChart3 },
      { label: 'Automation', path: '/automation', icon: Zap },
      { label: 'Templates', path: '/templates', icon: Mail },
    ],
  },
  {
    label: 'Workspace',
    items: [
      { label: 'Team', path: '/team', icon: UsersRound },
      { label: 'Activity', path: '/activity', icon: Activity },
      { label: 'Notifications', path: '/notifications', icon: Bell },
      { label: 'My Profile', path: '/profile', icon: UserCircle },
    ],
  },
  {
    label: 'Administration',
    items: [
      { label: 'Business Profile', path: '/business', icon: Building2 },
      { label: 'Settings', path: '/settings', icon: Settings },
    ],
  },
]

// Build the primary nav groups with business-type overrides applied to the
// customer/booking/order labels while leaving structure and icons intact.
export function buildNavGroups(overrides?: Partial<NavLabels>): NavGroup[] {
  if (!overrides) return navGroups
  return navGroups.map((group) => ({
    ...group,
    items: group.items.map((item) => {
      const label =
        item.path === '/customers' ? overrides.customers
        : item.path === '/bookings' ? overrides.bookings
        : item.path === '/orders' ? overrides.orders
        : undefined
      return label && label !== item.label
        ? { ...item, label }
        : item
    }),
  }))
}
