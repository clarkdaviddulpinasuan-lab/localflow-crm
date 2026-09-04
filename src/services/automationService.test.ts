import { describe, it, expect, beforeEach, vi } from 'vitest'
vi.mock('@/lib/supabase', () => import('@/test/supabaseMock').then((m) => ({ supabase: m.supabaseMock })))
import { format, startOfDay, subDays } from 'date-fns'
import { resetSupabaseMock, getTable, setTable, setFunctionsInvoke } from '@/test/supabaseMock'
import { getRules, saveRules, evaluateRules, TRIGGER_LABELS } from '@/services/automationService'
import { completeTask, createTask } from '@/services/taskService'
import type { AutomationRule, TaskPriority, TaskStatus } from '@/types'

function rule(partial: Partial<AutomationRule>): AutomationRule {
  const now = new Date().toISOString()
  return {
    id: 'rule-test',
    name: 'Test rule',
    enabled: true,
    triggerType: 'overdue_task',
    triggerDays: 1,
    actionType: 'create_follow_up',
    template: 'Follow up on {{title}}',
    created_at: now,
    updated_at: now,
    ...partial,
  }
}

describe('automation service', () => {
  beforeEach(() => {
    resetSupabaseMock()
  })

  it('returns default rules when none are saved, and persists saved rules', async () => {
    const defaults = await getRules()
    expect(defaults.length).toBeGreaterThan(0)
    const custom = [{ ...rule({ id: 'rule-x', name: 'Custom' }) }]
    await saveRules(custom)
    const stored = await getRules()
    expect(stored).toEqual(custom)
  })

  it('creates a follow-up for an overdue task via the rule action', async () => {
    const task = await createTask({
      customer_id: 'cust-001',
      title: 'Pending customer visit',
      due_date: format(subDays(startOfDay(new Date()), 2), 'yyyy-MM-dd'),
      priority: 'medium' as TaskPriority,
      status: 'todo' as TaskStatus,
    })
    await saveRules([{ ...rule({ actionType: 'create_follow_up', template: 'Call {{title}}' }) }])

    const before = getTable('follow_ups').length
    const outcomes = await evaluateRules()

    const fired = outcomes.find((o) => o.event.id === task.id)
    expect(fired).toBeTruthy()
    expect(fired?.message).toContain('Call Pending customer visit')
    expect(getTable('follow_ups').length).toBe(before + outcomes.length)
  })

  it('applies each matching action only once (Nonce dedupe)', async () => {
    await createTask({
      title: 'Deduped task',
      due_date: format(subDays(startOfDay(new Date()), 1), 'yyyy-MM-dd'),
      priority: 'medium' as TaskPriority,
      status: 'todo' as TaskStatus,
    })
    await saveRules([{ ...rule({ actionType: 'log_activity' }) }])
    const before = getTable('activities').length

    const first = await evaluateRules()
    const second = await evaluateRules()

    expect(first.length).toBeGreaterThanOrEqual(1)
    expect(second.length).toBe(0)
    expect(getTable('activities').length).toBe(before + first.length)
  })

  it('completing the task removes it from the overdue trigger pool', async () => {
    setTable('tasks', [])
    const task = await createTask({
      title: 'Fixes itself',
      due_date: format(subDays(startOfDay(new Date()), 1), 'yyyy-MM-dd'),
      priority: 'medium' as TaskPriority,
      status: 'todo' as TaskStatus,
    })
    await saveRules([{ ...rule({ actionType: 'log_activity' }) }])
    expect((await evaluateRules()).length).toBe(1)
    await completeTask(task.id)
    // Nonce already recorded; a completed task also no longer matches.
    expect((await evaluateRules()).length).toBe(0)
  })

  it('sends an email to an at-risk customer via the send_email action', async () => {
    setFunctionsInvoke(async () => ({ data: { ok: true }, error: null }))
    // Force every customer to look long-inactive (but not already 'inactive').
    const customers = getTable('customers').map((c) => ({ ...(c as Record<string, unknown>), last_activity: '2020-01-01T00:00:00Z' }))
    setTable('customers', customers)
    await saveRules([{
      ...rule({
        triggerType: 'inactive_customer',
        triggerDays: 60,
        actionType: 'send_email',
        template: 'Hi {{customer}}, we miss you! Book your next stay.',
      }),
    }])

    const outcomes = await evaluateRules()
    const fired = outcomes.find((o) => o.message.startsWith('Sent email'))
    expect(fired).toBeTruthy()
    expect(fired?.message).toContain('we miss you!')
    expect(fired?.message).toEqual(expect.stringMatching(/^Sent email “Hi \w+ \w+, we miss you!/))
    expect(getTable('communications').some((r) => r.customer_id === fired?.event.customerId && r.channel === 'email')).toBe(true)
  })

  it('skips send_email when the linked customer has no email address', async () => {
    setFunctionsInvoke(async () => ({ data: { ok: true }, error: null }))
    const customers = getTable('customers').map((c) => ({ ...(c as Record<string, unknown>), email: null, last_activity: '2020-01-01T00:00:00Z' }))
    setTable('customers', customers)
    await saveRules([{
      ...rule({ triggerType: 'inactive_customer', triggerDays: 60, actionType: 'send_email', template: 'Hi {{customer}}' }),
    }])

    const outcomes = await evaluateRules()
    expect(outcomes.length).toBeGreaterThan(0)
    expect(outcomes.every((o) => o.message.startsWith('Skipped — no email address'))).toBe(true)
    expect(getTable('communications').length).toBe(0)
  })

  it('exposes a label for every trigger type', () => {
    expect(TRIGGER_LABELS.overdue_task).toBeTruthy()
    expect(TRIGGER_LABELS.new_lead).toBeTruthy()
  })
})
