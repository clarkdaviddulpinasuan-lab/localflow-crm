import type { BusinessType, BookingStatus, OrderStatus, PaymentStatus } from '@/types'

// ============================================================
// DASHBOARD CONFIGURATION
// ============================================================
// One product, one dashboard. Wording, KPIs, quick actions and
// sidebar labels are the SAME for every business type — see
// UNIFORM_CONFIG below. The business type is still stored (and
// shown in Profile) but only selects a display name.
//
// A per-workspace `dashboard_config` row in the settings table
// can still hide/show dashboard sections (widgets); nothing else
// in it is read back any more.
// ============================================================

/** A single KPI card definition shown on the dashboard. */
export interface KpiCardConfig {
  id: string
  label: string
  icon: 'revenue' | 'customers' | 'bookings' | 'orders' | 'tasks' | 'repeat' | 'credit' | 'occupancy' | 'aov'
  positiveIsGood: boolean
  /** How the value is derived. */
  metric: 'revenue' | 'customers' | 'active_bookings' | 'active_orders' | 'open_tasks' | 'repeat_customers'
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
// Uniform configuration
// ------------------------------------------------------------------
// The app is one product, not one-app-per-industry. Every business type
// resolves to the SAME config: same wording, KPIs, quick actions and
// sidebar. The business type is still stored and shown in Profile as a
// label (see BUSINESS_TYPE_NAMES), but it no longer changes the UI.

export const UNIFORM_QUICK_ACTIONS: QuickActionConfig[] = [
  { id: 'customer', label: 'Add Customer', target: '/customers?new=1', icon: 'customer' },
  { id: 'booking', label: 'Create Booking', target: '/bookings?new=1', icon: 'booking' },
  { id: 'order', label: 'New Order', target: '/orders?new=1', icon: 'order' },
  { id: 'task', label: 'Create Task', target: '/tasks?new=1', icon: 'task' },
]

export const UNIFORM_NAV_LABELS: NavLabels = {
  overview: 'Overview',
  customers: 'Customers',
  bookings: 'Bookings',
  orders: 'Orders',
}

export const UNIFORM_KPI_CARDS: KpiCardConfig[] = [
  { id: 'customers', label: 'Customers', icon: 'customers', positiveIsGood: true, metric: 'customers', format: 'number' },
  { id: 'bookings', label: 'Bookings', icon: 'bookings', positiveIsGood: true, metric: 'active_bookings', format: 'number' },
  { id: 'orders', label: 'Orders', icon: 'orders', positiveIsGood: true, metric: 'active_orders', format: 'number' },
  { id: 'tasks', label: 'Pending Tasks', icon: 'tasks', positiveIsGood: false, metric: 'open_tasks', format: 'number' },
  { id: 'repeat', label: 'Repeat Customers', icon: 'repeat', positiveIsGood: true, metric: 'repeat_customers', format: 'number' },
]

/** Everything except the identity fields (`type`, `displayName`). */
const UNIFORM_CONFIG: Omit<BusinessTypeConfig, 'type' | 'displayName'> = {
  customerLabel: 'Customer',
  bookingLabel: 'Booking',
  orderLabel: 'Order',
  resourceLabel: 'Resource',
  defaultResources: ['Resource 1', 'Resource 2', 'Resource 3'],
  primaryMetricLabel: 'Revenue',
  trendMetricLabel: 'Revenue',
  kpiCards: UNIFORM_KPI_CARDS,
  quickActions: UNIFORM_QUICK_ACTIONS,
  navLabels: UNIFORM_NAV_LABELS,
  widgets: DEFAULT_WIDGETS,
}

/** Display name per business type — the only thing the type still affects. */
export const BUSINESS_TYPE_NAMES: Record<BusinessType, string> = {
  hotel: 'Hotel',
  resort: 'Resort',
  guesthouse: 'Guesthouse',
  homestay: 'Homestay',
  restaurant: 'Restaurant',
  cafe: 'Café',
  salon: 'Salon',
  beauty: 'Beauty Studio',
  tour_operator: 'Tour Operator',
  agency: 'Agency',
  sari_sari: 'Sari-Sari Store',
  retail: 'Retail',
  service: 'Service Business',
  other: 'Business',
}

export function getBusinessTypeConfig(type: BusinessType): BusinessTypeConfig {
  return {
    ...UNIFORM_CONFIG,
    type,
    displayName: BUSINESS_TYPE_NAMES[type] ?? BUSINESS_TYPE_NAMES.other,
  }
}

// Persistable shape (a trimmed copy safe to store in settings). Only the
// per-workspace widget visibility is still read back; every other field is
// uniform and kept here for back-compat with older stored configs.
export interface DashboardConfigJSON {
  type?: BusinessType
  kpiCards: KpiCardConfig[]
  quickActions: QuickActionConfig[]
  navLabels: NavLabels
  widgets?: Partial<DashboardWidgetConfig>
}

export function toDashboardConfigJSON(config: BusinessTypeConfig): DashboardConfigJSON {
  return {
    type: config.type,
    kpiCards: config.kpiCards,
    quickActions: config.quickActions,
    navLabels: config.navLabels,
    widgets: config.widgets ?? DEFAULT_WIDGETS,
  }
}

export function fromDashboardConfigJSON(json: DashboardConfigJSON | null | undefined, fallback: BusinessTypeConfig): BusinessTypeConfig {
  if (!json) return fallback
  // The dashboard is uniform across business types; the only thing a stored
  // config still controls is which dashboard sections are shown.
  return { ...fallback, widgets: { ...DEFAULT_WIDGETS, ...(json.widgets ?? {}) } }
}

export type { BookingStatus, OrderStatus, PaymentStatus }
