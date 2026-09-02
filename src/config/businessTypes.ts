import type { BusinessType, BookingStatus, OrderStatus, PaymentStatus } from '@/types'

// ============================================================
// CENTRALIZED BUSINESS-TYPE CONFIGURATION
// ============================================================
// This is the single source of truth for how the UI adapts to
// different business types. Everything presentational (labels,
// KPIs, widgets, quick actions, navigation) is driven from here.
//
// Configuration can be overridden per-business at runtime via
// the `dashboard_config` key in the settings table (see
// settingsService.getDashboardConfig). The TypeScript defaults
// below act as the fallback schema + source of truth for the
// shape, and for demo mode.
// ============================================================

/** A single KPI card definition shown on the dashboard. */
export interface KpiCardConfig {
  id: string
  label: string
  icon: 'revenue' | 'customers' | 'bookings' | 'tasks' | 'repeat' | 'credit' | 'occupancy' | 'aov'
  positiveIsGood: boolean
  /** How the value is derived. */
  metric: 'revenue' | 'customers' | 'active_bookings' | 'open_tasks' | 'repeat_customers'
    | 'outstanding_credit' | 'occupancy' | 'average_order_value' | 'today_sales' | 'today_bookings'
  /** Optional formatting: currency vs plain number. */
  format: 'currency' | 'number' | 'percent'
}

/** A quick action available on the dashboard / mobile action bar. */
export interface QuickActionConfig {
  id: string
  label: string
  /** Route or button id. Value routed via <Link> when it starts with '/'. */
  target: string
  icon: 'customer' | 'booking' | 'order' | 'task' | 'note' | 'payment' | 'lead'
}

/** Dashboard sections a business can show or hide. */
export type DashboardWidgetKey =
  | 'quickActions'
  | 'needsAttention'
  | 'kpis'
  | 'charts'
  | 'health'
  | 'insights'
  | 'upcoming'
  | 'activity'

export type DashboardWidgetConfig = Record<DashboardWidgetKey, boolean>

export const DEFAULT_WIDGETS: DashboardWidgetConfig = {
  quickActions: true,
  needsAttention: true,
  kpis: true,
  charts: true,
  health: true,
  insights: true,
  upcoming: true,
  activity: true,
}

/** Nav override labels for the primary group (keys match navigation.ts). */
export interface NavLabels {
  overview: string
  customers: string
  bookings: string
  orders: string
}

export interface BusinessTypeConfig {
  /** Stable business type key. */
  type: BusinessType
  /** Human readable name. */
  displayName: string
  customerLabel: string
  bookingLabel: string
  orderLabel: string
  resourceLabel: string
  defaultResources: string[]
  /** Alternative label used for deals/transactions (orders vs sales vs bookings). */
  primaryMetricLabel: string
  /** The label shown for chart legends / headers. */
  trendMetricLabel: string
  kpiCards: KpiCardConfig[]
  quickActions: QuickActionConfig[]
  navLabels: NavLabels
  /** Dashboard section visibility. Optional for back-compat; see DEFAULT_WIDGETS. */
  widgets?: DashboardWidgetConfig
}

// ------------------------------------------------------------------
// Defaults per business type
// ------------------------------------------------------------------

const hospitalityKpis: KpiCardConfig[] = [
  { id: 'revenue', label: 'Revenue', icon: 'revenue', positiveIsGood: true, metric: 'revenue', format: 'currency' },
  { id: 'customers', label: 'Guests', icon: 'customers', positiveIsGood: true, metric: 'customers', format: 'number' },
  { id: 'bookings', label: 'Bookings', icon: 'bookings', positiveIsGood: true, metric: 'active_bookings', format: 'number' },
  { id: 'tasks', label: 'Pending Tasks', icon: 'tasks', positiveIsGood: false, metric: 'open_tasks', format: 'number' },
  { id: 'repeat', label: 'Repeat Guests', icon: 'repeat', positiveIsGood: true, metric: 'repeat_customers', format: 'number' },
]

const retailKpis: KpiCardConfig[] = [
  { id: 'revenue', label: 'Sales', icon: 'revenue', positiveIsGood: true, metric: 'revenue', format: 'currency' },
  { id: 'customers', label: 'Customers', icon: 'customers', positiveIsGood: true, metric: 'customers', format: 'number' },
  { id: 'bookings', label: 'Orders', icon: 'bookings', positiveIsGood: true, metric: 'active_bookings', format: 'number' },
  { id: 'credit', label: 'Outstanding Credit', icon: 'credit', positiveIsGood: false, metric: 'outstanding_credit', format: 'currency' },
  { id: 'repeat', label: 'Frequent Buyers', icon: 'repeat', positiveIsGood: true, metric: 'repeat_customers', format: 'number' },
]

const serviceKpis: KpiCardConfig[] = [
  { id: 'revenue', label: 'Revenue', icon: 'revenue', positiveIsGood: true, metric: 'revenue', format: 'currency' },
  { id: 'customers', label: 'Clients', icon: 'customers', positiveIsGood: true, metric: 'customers', format: 'number' },
  { id: 'bookings', label: 'Appointments', icon: 'bookings', positiveIsGood: true, metric: 'active_bookings', format: 'number' },
  { id: 'tasks', label: 'Pending Tasks', icon: 'tasks', positiveIsGood: false, metric: 'open_tasks', format: 'number' },
  { id: 'repeat', label: 'Repeat Clients', icon: 'repeat', positiveIsGood: true, metric: 'repeat_customers', format: 'number' },
]

function navWith(customers: string, bookings: string, orders: string): NavLabels {
  return { overview: 'Overview', customers, bookings, orders }
}

export const businessTypeConfigs: Record<BusinessType, BusinessTypeConfig> = {
  hotel: {
    type: 'hotel',
    displayName: 'Hotel',
    customerLabel: 'Guest',
    bookingLabel: 'Booking',
    orderLabel: 'Order',
    resourceLabel: 'Room',
    defaultResources: ['Room 101', 'Room 102', 'Room 103', 'Room 201'],
    primaryMetricLabel: 'Revenue',
    trendMetricLabel: 'Revenue',
    kpiCards: hospitalityKpis,
    navLabels: navWith('Guests', 'Bookings', 'Orders'),
    quickActions: [
      { id: 'customer', label: 'Add Guest', target: '/customers?new=1', icon: 'customer' },
      { id: 'booking', label: 'Create Booking', target: '/bookings?new=1', icon: 'booking' },
      { id: 'order', label: 'Record Order', target: '/orders?new=1', icon: 'order' },
      { id: 'task', label: 'Create Task', target: '/tasks?new=1', icon: 'task' },
      { id: 'note', label: 'Add Note', target: '/customers', icon: 'note' },
      { id: 'payment', label: 'Record Payment', target: '/bookings', icon: 'payment' },
    ],
  },
  resort: {
    type: 'resort',
    displayName: 'Resort',
    customerLabel: 'Guest',
    bookingLabel: 'Booking',
    orderLabel: 'Order',
    resourceLabel: 'Room',
    defaultResources: ['Room 101', 'Room 102', 'Room 203', 'Room 301'],
    primaryMetricLabel: 'Revenue',
    trendMetricLabel: 'Revenue',
    kpiCards: hospitalityKpis,
    navLabels: navWith('Guests', 'Bookings', 'Orders'),
    quickActions: [
      { id: 'customer', label: 'Add Guest', target: '/customers?new=1', icon: 'customer' },
      { id: 'booking', label: 'Create Booking', target: '/bookings?new=1', icon: 'booking' },
      { id: 'order', label: 'Record Order', target: '/orders?new=1', icon: 'order' },
      { id: 'task', label: 'Create Task', target: '/tasks?new=1', icon: 'task' },
      { id: 'note', label: 'Add Note', target: '/customers', icon: 'note' },
      { id: 'payment', label: 'Record Payment', target: '/bookings', icon: 'payment' },
    ],
  },
  guesthouse: {
    type: 'guesthouse',
    displayName: 'Guesthouse',
    customerLabel: 'Guest',
    bookingLabel: 'Booking',
    orderLabel: 'Order',
    resourceLabel: 'Room',
    defaultResources: ['Room 1', 'Room 2', 'Room 3', 'Dorm 1'],
    primaryMetricLabel: 'Revenue',
    trendMetricLabel: 'Revenue',
    kpiCards: hospitalityKpis,
    navLabels: navWith('Guests', 'Bookings', 'Orders'),
    quickActions: [
      { id: 'customer', label: 'Add Guest', target: '/customers?new=1', icon: 'customer' },
      { id: 'booking', label: 'Create Booking', target: '/bookings?new=1', icon: 'booking' },
      { id: 'order', label: 'Record Order', target: '/orders?new=1', icon: 'order' },
      { id: 'task', label: 'Create Task', target: '/tasks?new=1', icon: 'task' },
      { id: 'note', label: 'Add Note', target: '/customers', icon: 'note' },
      { id: 'payment', label: 'Record Payment', target: '/bookings', icon: 'payment' },
    ],
  },
  homestay: {
    type: 'homestay',
    displayName: 'Homestay',
    customerLabel: 'Guest',
    bookingLabel: 'Booking',
    orderLabel: 'Order',
    resourceLabel: 'Room',
    defaultResources: ['Room 1', 'Room 2', 'Room 3', 'Room 4'],
    primaryMetricLabel: 'Revenue',
    trendMetricLabel: 'Revenue',
    kpiCards: hospitalityKpis,
    navLabels: navWith('Guests', 'Bookings', 'Orders'),
    quickActions: [
      { id: 'booking', label: 'Create Booking', target: '/bookings?new=1', icon: 'booking' },
      { id: 'customer', label: 'Add Guest', target: '/customers?new=1', icon: 'customer' },
      { id: 'order', label: 'Record Order', target: '/orders?new=1', icon: 'order' },
      { id: 'task', label: 'Create Task', target: '/tasks?new=1', icon: 'task' },
      { id: 'note', label: 'Add Note', target: '/customers', icon: 'note' },
      { id: 'payment', label: 'Record Payment', target: '/bookings', icon: 'payment' },
    ],
  },
  restaurant: {
    type: 'restaurant',
    displayName: 'Restaurant',
    customerLabel: 'Customer',
    bookingLabel: 'Reservation',
    orderLabel: 'Order',
    resourceLabel: 'Table',
    defaultResources: ['Table 1', 'Table 2', 'Table 3', 'Table 4'],
    primaryMetricLabel: 'Sales',
    trendMetricLabel: 'Sales',
    kpiCards: [
      { id: 'revenue', label: 'Today Sales', icon: 'revenue', positiveIsGood: true, metric: 'today_sales', format: 'currency' },
      { id: 'bookings', label: 'Reservations', icon: 'bookings', positiveIsGood: true, metric: 'active_bookings', format: 'number' },
      { id: 'orders', label: 'Orders', icon: 'bookings', positiveIsGood: true, metric: 'today_bookings', format: 'number' },
      { id: 'aov', label: 'Avg Order', icon: 'aov', positiveIsGood: true, metric: 'average_order_value', format: 'currency' },
      { id: 'tasks', label: 'Open Tasks', icon: 'tasks', positiveIsGood: false, metric: 'open_tasks', format: 'number' },
    ],
    navLabels: navWith('Customers', 'Reservations', 'Orders'),
    quickActions: [
      { id: 'order', label: 'New Order', target: '/orders?new=1', icon: 'order' },
      { id: 'booking', label: 'New Reservation', target: '/bookings?new=1', icon: 'booking' },
      { id: 'customer', label: 'Add Customer', target: '/customers?new=1', icon: 'customer' },
      { id: 'task', label: 'Create Task', target: '/tasks?new=1', icon: 'task' },
      { id: 'payment', label: 'Record Payment', target: '/orders', icon: 'payment' },
    ],
  },
  cafe: {
    type: 'cafe',
    displayName: 'Café',
    customerLabel: 'Customer',
    bookingLabel: 'Reservation',
    orderLabel: 'Order',
    resourceLabel: 'Table',
    defaultResources: ['Table 1', 'Table 2', 'Table 3', 'Table 4'],
    primaryMetricLabel: 'Sales',
    trendMetricLabel: 'Sales',
    kpiCards: [
      { id: 'revenue', label: 'Today Sales', icon: 'revenue', positiveIsGood: true, metric: 'today_sales', format: 'currency' },
      { id: 'bookings', label: 'Reservations', icon: 'bookings', positiveIsGood: true, metric: 'active_bookings', format: 'number' },
      { id: 'orders', label: 'Orders', icon: 'bookings', positiveIsGood: true, metric: 'today_bookings', format: 'number' },
      { id: 'aov', label: 'Avg Order', icon: 'aov', positiveIsGood: true, metric: 'average_order_value', format: 'currency' },
      { id: 'tasks', label: 'Open Tasks', icon: 'tasks', positiveIsGood: false, metric: 'open_tasks', format: 'number' },
    ],
    navLabels: navWith('Customers', 'Reservations', 'Orders'),
    quickActions: [
      { id: 'order', label: 'New Order', target: '/orders?new=1', icon: 'order' },
      { id: 'booking', label: 'New Reservation', target: '/bookings?new=1', icon: 'booking' },
      { id: 'customer', label: 'Add Customer', target: '/customers?new=1', icon: 'customer' },
      { id: 'task', label: 'Create Task', target: '/tasks?new=1', icon: 'task' },
      { id: 'payment', label: 'Record Payment', target: '/orders', icon: 'payment' },
    ],
  },
  salon: {
    type: 'salon',
    displayName: 'Salon',
    customerLabel: 'Client',
    bookingLabel: 'Appointment',
    orderLabel: 'Service',
    resourceLabel: 'Stylist',
    defaultResources: ['Stylist 1', 'Stylist 2', 'Stylist 3'],
    primaryMetricLabel: 'Revenue',
    trendMetricLabel: 'Revenue',
    kpiCards: serviceKpis,
    navLabels: navWith('Clients', 'Appointments', 'Services'),
    quickActions: [
      { id: 'booking', label: 'New Appointment', target: '/bookings?new=1', icon: 'booking' },
      { id: 'customer', label: 'Add Client', target: '/customers?new=1', icon: 'customer' },
      { id: 'order', label: 'New Service', target: '/orders?new=1', icon: 'order' },
      { id: 'task', label: 'Create Task', target: '/tasks?new=1', icon: 'task' },
      { id: 'payment', label: 'Record Payment', target: '/orders', icon: 'payment' },
    ],
  },
  beauty: {
    type: 'beauty',
    displayName: 'Beauty Studio',
    customerLabel: 'Client',
    bookingLabel: 'Appointment',
    orderLabel: 'Service',
    resourceLabel: 'Therapist',
    defaultResources: ['Therapist 1', 'Therapist 2', 'Therapist 3'],
    primaryMetricLabel: 'Revenue',
    trendMetricLabel: 'Revenue',
    kpiCards: serviceKpis,
    navLabels: navWith('Clients', 'Appointments', 'Services'),
    quickActions: [
      { id: 'booking', label: 'New Appointment', target: '/bookings?new=1', icon: 'booking' },
      { id: 'customer', label: 'Add Client', target: '/customers?new=1', icon: 'customer' },
      { id: 'order', label: 'New Service', target: '/orders?new=1', icon: 'order' },
      { id: 'task', label: 'Create Task', target: '/tasks?new=1', icon: 'task' },
      { id: 'payment', label: 'Record Payment', target: '/orders', icon: 'payment' },
    ],
  },
  tour_operator: {
    type: 'tour_operator',
    displayName: 'Tour Operator',
    customerLabel: 'Traveler',
    bookingLabel: 'Tour',
    orderLabel: 'Sale',
    resourceLabel: 'Tour Slot',
    defaultResources: ['Morning Tour', 'Afternoon Tour', 'Evening Departure'],
    primaryMetricLabel: 'Revenue',
    trendMetricLabel: 'Revenue',
    kpiCards: [
      { id: 'revenue', label: 'Revenue', icon: 'revenue', positiveIsGood: true, metric: 'revenue', format: 'currency' },
      { id: 'customers', label: 'Travelers', icon: 'customers', positiveIsGood: true, metric: 'customers', format: 'number' },
      { id: 'bookings', label: 'Tours Sold', icon: 'bookings', positiveIsGood: true, metric: 'active_bookings', format: 'number' },
      { id: 'tasks', label: 'Pending Tasks', icon: 'tasks', positiveIsGood: false, metric: 'open_tasks', format: 'number' },
      { id: 'repeat', label: 'Repeat Travelers', icon: 'repeat', positiveIsGood: true, metric: 'repeat_customers', format: 'number' },
    ],
    navLabels: navWith('Travelers', 'Tours', 'Sales'),
    quickActions: [
      { id: 'booking', label: 'Book Tour', target: '/bookings?new=1', icon: 'booking' },
      { id: 'customer', label: 'Add Traveler', target: '/customers?new=1', icon: 'customer' },
      { id: 'order', label: 'Record Sale', target: '/orders?new=1', icon: 'order' },
      { id: 'task', label: 'Create Task', target: '/tasks?new=1', icon: 'task' },
      { id: 'lead', label: 'New Inquiry', target: '/leads?new=1', icon: 'lead' },
    ],
  },
  agency: {
    type: 'agency',
    displayName: 'Agency',
    customerLabel: 'Client',
    bookingLabel: 'Booking',
    orderLabel: 'Sale',
    resourceLabel: 'Account',
    defaultResources: ['Account 1', 'Account 2', 'Account 3'],
    primaryMetricLabel: 'Revenue',
    trendMetricLabel: 'Revenue',
    kpiCards: [
      { id: 'revenue', label: 'Revenue', icon: 'revenue', positiveIsGood: true, metric: 'revenue', format: 'currency' },
      { id: 'customers', label: 'Clients', icon: 'customers', positiveIsGood: true, metric: 'customers', format: 'number' },
      { id: 'bookings', label: 'Open Deals', icon: 'bookings', positiveIsGood: true, metric: 'active_bookings', format: 'number' },
      { id: 'credit', label: 'Outstanding Credit', icon: 'credit', positiveIsGood: false, metric: 'outstanding_credit', format: 'currency' },
      { id: 'repeat', label: 'Repeat Clients', icon: 'repeat', positiveIsGood: true, metric: 'repeat_customers', format: 'number' },
    ],
    navLabels: navWith('Clients', 'Deals', 'Sales'),
    quickActions: [
      { id: 'customer', label: 'Add Client', target: '/customers?new=1', icon: 'customer' },
      { id: 'booking', label: 'New Deal', target: '/bookings?new=1', icon: 'booking' },
      { id: 'order', label: 'Record Sale', target: '/orders?new=1', icon: 'order' },
      { id: 'lead', label: 'New Lead', target: '/leads?new=1', icon: 'lead' },
      { id: 'task', label: 'Create Task', target: '/tasks?new=1', icon: 'task' },
    ],
  },
  sari_sari: {
    type: 'sari_sari',
    displayName: 'Sari-Sari Store',
    customerLabel: 'Customer',
    bookingLabel: 'Booking',
    orderLabel: 'Sale',
    resourceLabel: 'Counter',
    defaultResources: ['Counter', 'Delivery'],
    primaryMetricLabel: 'Sales',
    trendMetricLabel: 'Sales',
    kpiCards: [
      { id: 'revenue', label: 'Today Sales', icon: 'revenue', positiveIsGood: true, metric: 'today_sales', format: 'currency' },
      { id: 'orders', label: 'Sales', icon: 'bookings', positiveIsGood: true, metric: 'today_bookings', format: 'number' },
      { id: 'customers', label: 'Customers', icon: 'customers', positiveIsGood: true, metric: 'customers', format: 'number' },
      { id: 'credit', label: 'Outstanding Credit', icon: 'credit', positiveIsGood: false, metric: 'outstanding_credit', format: 'currency' },
      { id: 'repeat', label: 'Frequent Buyers', icon: 'repeat', positiveIsGood: true, metric: 'repeat_customers', format: 'number' },
    ],
    navLabels: navWith('Customers', 'Credit', 'Sales'),
    quickActions: [
      { id: 'order', label: 'Record Sale', target: '/orders?new=1', icon: 'order' },
      { id: 'customer', label: 'Add Customer', target: '/customers?new=1', icon: 'customer' },
      { id: 'payment', label: 'Collect Payment', target: '/orders', icon: 'payment' },
      { id: 'credits', label: 'Record Credit', target: '/orders?new=1', icon: 'lead' },
      { id: 'task', label: 'Create Task', target: '/tasks?new=1', icon: 'task' },
    ],
  },
  retail: {
    type: 'retail',
    displayName: 'Retail',
    customerLabel: 'Customer',
    bookingLabel: 'Booking',
    orderLabel: 'Order',
    resourceLabel: 'Counter',
    defaultResources: ['Counter 1', 'Counter 2'],
    primaryMetricLabel: 'Sales',
    trendMetricLabel: 'Sales',
    kpiCards: retailKpis,
    navLabels: navWith('Customers', 'Account', 'Orders'),
    quickActions: [
      { id: 'order', label: 'Record Sale', target: '/orders?new=1', icon: 'order' },
      { id: 'customer', label: 'Add Customer', target: '/customers?new=1', icon: 'customer' },
      { id: 'payment', label: 'Collect Payment', target: '/orders', icon: 'payment' },
      { id: 'task', label: 'Create Task', target: '/tasks?new=1', icon: 'task' },
    ],
  },
  service: {
    type: 'service',
    displayName: 'Service Business',
    customerLabel: 'Client',
    bookingLabel: 'Appointment',
    orderLabel: 'Service Order',
    resourceLabel: 'Slot',
    defaultResources: ['Morning', 'Afternoon', 'Evening'],
    primaryMetricLabel: 'Revenue',
    trendMetricLabel: 'Revenue',
    kpiCards: [
      { id: 'revenue', label: 'Revenue', icon: 'revenue', positiveIsGood: true, metric: 'revenue', format: 'currency' },
      { id: 'customers', label: 'Clients', icon: 'customers', positiveIsGood: true, metric: 'customers', format: 'number' },
      { id: 'bookings', label: 'Appointments', icon: 'bookings', positiveIsGood: true, metric: 'active_bookings', format: 'number' },
      { id: 'tasks', label: 'Pending Tasks', icon: 'tasks', positiveIsGood: false, metric: 'open_tasks', format: 'number' },
      { id: 'repeat', label: 'Repeat Clients', icon: 'repeat', positiveIsGood: true, metric: 'repeat_customers', format: 'number' },
    ],
    navLabels: navWith('Clients', 'Appointments', 'Orders'),
    quickActions: [
      { id: 'booking', label: 'New Appointment', target: '/bookings?new=1', icon: 'booking' },
      { id: 'customer', label: 'Add Client', target: '/customers?new=1', icon: 'customer' },
      { id: 'order', label: 'New Order', target: '/orders?new=1', icon: 'order' },
      { id: 'task', label: 'Create Task', target: '/tasks?new=1', icon: 'task' },
    ],
  },
  other: {
    type: 'other',
    displayName: 'Business',
    customerLabel: 'Customer',
    bookingLabel: 'Booking',
    orderLabel: 'Order',
    resourceLabel: 'Resource',
    defaultResources: ['Slot A', 'Slot B', 'Slot C'],
    primaryMetricLabel: 'Revenue',
    trendMetricLabel: 'Revenue',
    kpiCards: [
      { id: 'revenue', label: 'Revenue', icon: 'revenue', positiveIsGood: true, metric: 'revenue', format: 'currency' },
      { id: 'customers', label: 'Customers', icon: 'customers', positiveIsGood: true, metric: 'customers', format: 'number' },
      { id: 'bookings', label: 'Bookings / Orders', icon: 'bookings', positiveIsGood: true, metric: 'active_bookings', format: 'number' },
      { id: 'tasks', label: 'Pending Tasks', icon: 'tasks', positiveIsGood: false, metric: 'open_tasks', format: 'number' },
      { id: 'repeat', label: 'Repeat Customers', icon: 'repeat', positiveIsGood: true, metric: 'repeat_customers', format: 'number' },
    ],
    navLabels: { overview: 'Overview', customers: 'Customers', bookings: 'Bookings', orders: 'Orders' },
    quickActions: [
      { id: 'customer', label: 'Add Customer', target: '/customers?new=1', icon: 'customer' },
      { id: 'booking', label: 'Create Booking', target: '/bookings?new=1', icon: 'booking' },
      { id: 'order', label: 'New Order', target: '/orders?new=1', icon: 'order' },
      { id: 'task', label: 'Create Task', target: '/tasks?new=1', icon: 'task' },
    ],
  },
}

export function getBusinessTypeConfig(type: BusinessType): BusinessTypeConfig {
  const config = businessTypeConfigs[type] ?? businessTypeConfigs.other
  return { ...config, widgets: config.widgets ?? DEFAULT_WIDGETS }
}

// Persistable shape (a trimmed copy safe to store in settings).
export interface DashboardConfigJSON {
  kpiCards: KpiCardConfig[]
  quickActions: QuickActionConfig[]
  navLabels: NavLabels
  widgets?: Partial<DashboardWidgetConfig>
}

export function toDashboardConfigJSON(config: BusinessTypeConfig): DashboardConfigJSON {
  return {
    kpiCards: config.kpiCards,
    quickActions: config.quickActions,
    navLabels: config.navLabels,
    widgets: config.widgets ?? DEFAULT_WIDGETS,
  }
}

export function fromDashboardConfigJSON(json: DashboardConfigJSON | null | undefined, fallback: BusinessTypeConfig): BusinessTypeConfig {
  if (!json) return fallback
  return {
    ...fallback,
    widgets: { ...DEFAULT_WIDGETS, ...(json.widgets ?? {}) },
    kpiCards: Array.isArray(json.kpiCards) && json.kpiCards.length ? json.kpiCards : fallback.kpiCards,
    quickActions: Array.isArray(json.quickActions) && json.quickActions.length ? json.quickActions : fallback.quickActions,
    navLabels: json.navLabels ?? fallback.navLabels,
  }
}

export type { BookingStatus, OrderStatus, PaymentStatus }
