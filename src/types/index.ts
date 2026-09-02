export type BusinessType =
  | 'hotel'
  | 'resort'
  | 'guesthouse'
  | 'homestay'
  | 'restaurant'
  | 'cafe'
  | 'sari_sari'
  | 'retail'
  | 'service'
  | 'salon'
  | 'beauty'
  | 'tour_operator'
  | 'agency'
  | 'other'

export type UserRole = 'owner' | 'manager' | 'staff'

export type CustomerStatus = 'new' | 'active' | 'vip' | 'inactive'
export type CustomerType = 'guest' | 'local' | 'corporate' | 'regular' | 'walk_in'

export type BookingStatus = 'pending' | 'confirmed' | 'checked_in' | 'completed' | 'cancelled' | 'no_show'
export type PaymentStatus = 'paid' | 'pending' | 'partial' | 'refunded'
export type OrderStatus = 'new' | 'processing' | 'completed' | 'cancelled'

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'
export type TaskStatus = 'todo' | 'in_progress' | 'waiting' | 'completed'

export type LeadStage = 'new' | 'contacted' | 'qualified' | 'proposal' | 'won' | 'lost'

export interface Business {
  id: string
  name: string
  type: BusinessType
  location: string
  currency: string
  timezone: string
  team_size: number
  logo_url?: string
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  user_id: string
  business_id: string
  first_name: string
  last_name: string
  email: string
  phone?: string
  role: UserRole
  avatar_url?: string
  created_at: string
  updated_at: string
}

export interface Customer {
  id: string
  business_id: string
  first_name: string
  last_name: string
  email?: string
  phone?: string
  type: CustomerType
  status: CustomerStatus
  total_spent: number
  visit_count: number
  last_activity: string
  notes?: string
  created_at: string
  updated_at: string
}

export interface CustomerNote {
  id: string
  customer_id: string
  business_id: string
  author_id: string
  content: string
  created_at: string
  updated_at: string
}

export interface Booking {
  id: string
  business_id: string
  customer_id: string
  resource: string
  date: string
  start_time: string
  end_time: string
  guests: number
  status: BookingStatus
  amount: number
  payment_status: PaymentStatus
  notes?: string
  created_at: string
  updated_at: string
}

export interface Order {
  id: string
  business_id: string
  customer_id: string
  booking_id?: string | null
  order_number: string
  items: string
  description?: string
  total: number
  payment_status: PaymentStatus
  status: OrderStatus
  staff_member: string
  created_at: string
  updated_at: string
}

export interface Task {
  id: string
  business_id: string
  customer_id?: string
  title: string
  description?: string
  due_date: string
  priority: TaskPriority
  status: TaskStatus
  assignee_id?: string
  created_at: string
  updated_at: string
}

export interface Lead {
  id: string
  business_id: string
  name: string
  company?: string | null
  phone?: string | null
  email?: string | null
  source?: string | null
  stage: LeadStage
  estimated_value: number
  next_action?: string | null
  assigned_staff?: string | null
  created_at: string
  updated_at: string
}

export interface Activity {
  id: string
  business_id: string
  user_id: string
  action: string
  entity_type: string
  entity_id: string
  description: string
  metadata?: Record<string, unknown>
  created_at: string
}

export interface FollowUp {
  id: string
  business_id: string
  customer_id: string
  due_date: string
  note?: string | null
  status: 'pending' | 'completed' | 'skipped'
  completed_at?: string | null
  created_by?: string | null
  created_at: string
  updated_at: string
}

export interface Notification {
  id: string
  user_id: string
  business_id: string
  title: string
  message: string
  type: 'booking' | 'task' | 'payment' | 'lead' | 'customer' | 'system'
  read: boolean
  entity_type?: string | null
  entity_id?: string | null
  created_at: string
}

export interface BusinessSettings {
  id: string
  business_id: string
  key: string
  value: string
  created_at: string
  updated_at: string
}

export interface DateRange {
  start: string
  end: string
}

export type AutomationTriggerType =
  | 'overdue_task'
  | 'upcoming_booking'
  | 'unconfirmed_booking'
  | 'inactive_customer'
  | 'new_lead'

export type AutomationActionType = 'create_task' | 'create_follow_up' | 'notify_user' | 'log_activity'

export interface AutomationRule {
  id: string
  name: string
  enabled: boolean
  triggerType: AutomationTriggerType
  /** Window in days used by the trigger (e.g. upcoming bookings / inactivity). */
  triggerDays: number
  actionType: AutomationActionType
  /** Action message/title template supporting {{customer}}, {{title}}, {{resource}}, {{date}}. */
  template: string
  created_at: string
  updated_at: string
}

export interface AutomationEvent {
  type: AutomationTriggerType
  id: string
  customerId?: string
  customerName?: string
  title: string
  resource?: string
  date?: string
}

export type TemplateChannel = 'email' | 'sms'

export interface MessageTemplate {
  id: string
  business_id: string
  name: string
  channel: TemplateChannel
  subject?: string | null
  body: string
  created_at: string
  updated_at: string
}

export type CommunicationStatus = 'sent' | 'failed'

export interface Communication {
  id: string
  business_id: string
  customer_id: string
  channel: TemplateChannel
  template_id?: string | null
  subject?: string | null
  body: string
  status: CommunicationStatus
  sent_at: string
}

export interface WorkingHoursDay {
  open: string | null
  close: string | null
}

export type WorkingHours = Record<string, WorkingHoursDay>

export interface InstanceFeatures {
  public_shopfront: boolean
  online_payments: boolean
  customer_reviews: boolean
  guest_bookings: boolean
}

/** Tenant-level white-label configuration. */
export interface InstanceConfig {
  app_name: string | null
  custom_domain: string | null
  primary_color: string | null
  features: InstanceFeatures
}

export interface PaginationParams {
  page: number
  per_page: number
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  per_page: number
  total_pages: number
}
