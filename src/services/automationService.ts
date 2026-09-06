import { addDays, format, startOfDay, subDays } from 'date-fns'
import { getCurrentBusinessId, messageFromError } from '@/lib/dataClient'
import { supabase } from '@/lib/supabase'
import { listTasks, createTask } from '@/services/taskService'
import { listBookings } from '@/services/bookingService'
import { listLeads } from '@/services/leadService'
import { listCustomers, getCustomer } from '@/services/customerService'
import { createFollowUp } from '@/services/followUpService'
import { notify } from '@/services/notificationService'
import { sendCommunication } from '@/services/communicationService'
import { getProfile } from '@/services/settingsService'
import { withRetry } from '@/lib/withRetry'
import type { AutomationRule, AutomationEvent, AutomationTriggerType, AutomationActionType } from '@/types'

export const TRIGGER_LABELS: Record<AutomationTriggerType, string> = {
  overdue_task: 'Task is overdue',
  upcoming_booking: 'Confirmed booking is upcoming',
  unconfirmed_booking: 'Booking is unconfirmed',
  inactive_customer: 'Customer is inactive',
  new_lead: 'New lead created',
}

export const ACTION_LABELS: Record<AutomationActionType, string> = {
  create_task: 'Create task',
  create_follow_up: 'Create follow-up',
  notify_user: 'Send notification',
  send_email: 'Send email',
  log_activity: 'Log activity',
}

// Triggers that use the `triggerDays` window.
export const TRIGGER_USES_WINDOW: Record<AutomationTriggerType, boolean> = {
  overdue_task: false,
  upcoming_booking: true,
  unconfirmed_booking: true,
  inactive_customer: true,
  new_lead: false,
}

export const DEFAULT_WINDOW: Record<AutomationTriggerType, number> = {
  overdue_task: 1,
  upcoming_booking: 3,
  unconfirmed_booking: 3,
  inactive_customer: 60,
  new_lead: 1,
}

const RULES_KEY = 'automation_rules'

const DEFAULT_RULES: AutomationRule[] = [
  {
    id: 'rule-overdue-followup',
    name: 'Autofollow-up overdue tasks',
    enabled: true,
    triggerType: 'overdue_task',
    triggerDays: 1,
    actionType: 'create_follow_up',
    template: 'Follow up on {{title}}',
    created_at: '2025-08-01T00:00:00.000Z',
    updated_at: '2025-08-01T00:00:00.000Z',
  },
  {
    id: 'rule-unconfirmed-alert',
    name: 'Alert on unconfirmed bookings',
    enabled: true,
    triggerType: 'unconfirmed_booking',
    triggerDays: 3,
    actionType: 'notify_user',
    template: 'Booking {{title}} on {{date}} is still unconfirmed',
    created_at: '2025-08-01T00:00:00.000Z',
    updated_at: '2025-08-01T00:00:00.000Z',
  },
]

function todayISO(): string {
  return format(startOfDay(new Date()), 'yyyy-MM-dd')
}

export async function getRules(): Promise<AutomationRule[]> {
  const businessId = await getCurrentBusinessId()
  const { data, error } = await withRetry(() =>
    supabase
      .from('settings')
      .select('value')
      .eq('business_id', businessId)
      .eq('key', RULES_KEY)
      .maybeSingle()
  )
  if (error) throw new Error(messageFromError(error, 'Failed to load automation rules.'))
  if (!data?.value) return DEFAULT_RULES
  try {
    return JSON.parse(data.value) as AutomationRule[]
  } catch {
    return DEFAULT_RULES
  }
}

export async function saveRules(rules: AutomationRule[]): Promise<void> {
  const value = JSON.stringify(rules)
  const businessId = await getCurrentBusinessId()
  const { data: existing } = await supabase
    .from('settings')
    .select('id')
    .eq('business_id', businessId)
    .eq('key', RULES_KEY)
    .maybeSingle()
  if (existing?.id) {
    const { error } = await supabase
      .from('settings')
      .update({ value, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
    if (error) throw new Error(messageFromError(error, 'Failed to save automation rules.'))
  } else {
    const { error } = await supabase.from('settings').insert({
      business_id: businessId,
      key: RULES_KEY,
      value,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    if (error) throw new Error(messageFromError(error, 'Failed to save automation rules.'))
  }
}

function renderTemplate(template: string, event: AutomationEvent): string {
  return template
    .replace(/{{customer}}/g, event.customerName ?? 'customer')
    .replace(/{{title}}/g, event.title)
    .replace(/{{resource}}/g, event.resource ?? '')
    .replace(/{{date}}/g, event.date ?? '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function eventTypeLabel(type: AutomationTriggerType): string {
  switch (type) {
    case 'overdue_task':
      return 'task'
    case 'upcoming_booking':
    case 'unconfirmed_booking':
      return 'booking'
    case 'inactive_customer':
      return 'customer'
    case 'new_lead':
      return 'lead'
  }
}

async function collectEvents(rule: AutomationRule, customers: { id: string; first_name: string; last_name: string; status: string; last_activity: string | null }[]): Promise<AutomationEvent[]> {
  const today = new Date()
  const todayS = todayISO()
  const byId = new Map(customers.map((c) => [c.id, c]))
  const customerFor = (id?: string) => {
    const c = id ? byId.get(id) : undefined
    return { customerId: c?.id, customerName: c?.first_name && c?.last_name ? `${c.first_name} ${c.last_name}` : c?.first_name }
  }

  switch (rule.triggerType) {
    case 'overdue_task': {
      const res = await listTasks({ perPage: 200 })
      return res.data
        .filter((t) => t.status !== 'completed' && t.due_date < todayS)
        .map((t) => ({
          type: 'overdue_task' as const,
          id: t.id,
          title: t.title,
          date: t.due_date,
          ...customerFor(t.customer_id),
        }))
    }
    case 'upcoming_booking': {
      const until = format(addDays(today, rule.triggerDays), 'yyyy-MM-dd')
      const res = await listBookings({ perPage: 200 })
      return res.data
        .filter((b) => b.status === 'confirmed' && (b.date >= todayS && b.date <= until || (b.end_date && b.end_date >= todayS && b.end_date <= until)))
        .map((b) => ({
          type: 'upcoming_booking' as const,
          id: b.id,
          title: b.resource,
          resource: b.resource,
          date: b.date,
          ...customerFor(b.customer_id),
        }))
    }
    case 'unconfirmed_booking': {
      const res = await listBookings({ perPage: 200 })
      return res.data
        .filter((b) => b.status === 'pending' && b.date >= todayS)
        .map((b) => ({
          type: 'unconfirmed_booking' as const,
          id: b.id,
          title: b.resource,
          resource: b.resource,
          date: b.date,
          ...customerFor(b.customer_id),
        }))
    }
    case 'inactive_customer': {
      const cutoff = format(subDays(today, rule.triggerDays), 'yyyy-MM-dd')
      return customers
        .filter((c) => c.status !== 'inactive' && c.last_activity && c.last_activity.slice(0, 10) < cutoff)
        .map((c) => ({
          type: 'inactive_customer' as const,
          id: c.id,
          title: `${c.first_name} ${c.last_name}`,
          customerId: c.id,
          customerName: `${c.first_name} ${c.last_name}`,
        }))
    }
    case 'new_lead': {
      const res = await listLeads({ perPage: 200 })
      return res.data.filter((l) => l.stage === 'new').map((l) => ({ type: 'new_lead' as const, id: l.id, title: l.name }))
    }
  }
}

async function alreadyApplied(nonce: string): Promise<boolean> {
  const { data, error } = await withRetry(() => supabase.from('activities').select('id').eq('metadata.nonce', nonce).limit(1))
  if (error) throw new Error(messageFromError(error, 'Failed to check automation history.'))
  return (data ?? []).length > 0
}

async function logAutomationActivity(profile: { id: string; business_id: string }, event: AutomationEvent, message: string, nonce: string, ruleId: string) {
  const { error } = await supabase.from('activities').insert({
    business_id: profile.business_id,
    user_id: profile.id,
    action: 'automation',
    entity_type: event.type,
    entity_id: event.id,
    description: message,
    metadata: { automation: ruleId, nonce },
  })
  if (error) throw new Error(messageFromError(error, 'Failed to log automation activity.'))
}

async function applyAction(rule: AutomationRule, event: AutomationEvent, nonce: string): Promise<string> {
  const message = renderTemplate(rule.template, event)
  let result = ''

  switch (rule.actionType) {
    case 'create_task': {
      const task = await createTask({
        customer_id: event.customerId,
        title: message,
        due_date: todayISO(),
        priority: 'medium',
        status: 'todo',
      })
      result = `Created task “${task.title}”`
      break
    }
    case 'create_follow_up': {
      if (!event.customerId) return `Skipped — no customer linked to “${event.title}”`
      await createFollowUp({ customer_id: event.customerId, due_date: todayISO(), note: message })
      result = `Created follow-up “${message}”`
      break
    }
    case 'notify_user': {
      const profile = await getProfile()
      await notify({
        user_id: profile.user_id,
        business_id: profile.business_id,
        title: `Automation: ${rule.name}`,
        message,
        type: eventTypeLabel(event.type) as 'booking' | 'task' | 'payment' | 'lead' | 'customer' | 'system',
        entity_type: event.type,
        entity_id: event.id,
      })
      result = `Sent notification “${message}”`
      break
    }
    case 'send_email': {
      if (!event.customerId) return `Skipped — no customer linked to “${event.title}”`
      const customer = await getCustomer(event.customerId)
      if (!customer?.email) {
        return `Skipped — no email address for “${customer ? `${customer.first_name} ${customer.last_name}` : event.title}”`
      }
      await sendCommunication({
        customer_id: customer.id,
        channel: 'email',
        subject: message.slice(0, 90),
        body: message,
      })
      result = `Sent email “${message}”`
      break
    }
    case 'log_activity': {
      const profile = await getProfile()
      await logAutomationActivity(profile, event, message, nonce, rule.id)
      result = `Logged activity “${message}”`
      break
    }
  }

  if (rule.actionType !== 'log_activity') {
    const profile = await getProfile()
    await logAutomationActivity(profile, event, message, nonce, rule.id)
  }

  return result
}

export interface RuleOutcome {
  rule: AutomationRule
  event: AutomationEvent
  message: string
}

/**
 * Evaluates all enabled rules against fresh, current data (send-time refresh)
 * and applies each matching action exactly once per event via a Nonce derived
 * from the rule + event id (stored in the activity trail).
 */
export async function evaluateRules(): Promise<RuleOutcome[]> {
  const rules = await getRules()
  const enabled = rules.filter((r) => r.enabled)
  if (enabled.length === 0) return []

  const customerRes = await listCustomers({ perPage: 200 })
  const customers = customerRes.data

  const outcomes: RuleOutcome[] = []
  for (const rule of enabled) {
    const events = await collectEvents(rule, customers)
    for (const event of events) {
      const nonce = `${rule.id}|${event.type}|${event.id}`
      if (await alreadyApplied(nonce)) continue
      const message = await applyAction(rule, event, nonce)
      outcomes.push({ rule, event, message })
    }
  }
  return outcomes
}

export function nextRuleId(): string {
  return crypto.randomUUID()
}
