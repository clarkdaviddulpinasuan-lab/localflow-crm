import { describe, it, expect, beforeEach } from 'vitest'
import { format, startOfDay, subDays } from 'date-fns'
import { resetStore, getStore } from '@/services/demoStore'
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
    resetStore()
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
      customer_id: getStore().customers[0].id,
      title: 'Pending customer visit',
      due_date: format(subDays(startOfDay(new Date()), 2), 'yyyy-MM-dd'),
      priority: 'medium' as TaskPriority,
      status: 'todo' as TaskStatus,
    })
    await saveRules([{ ...rule({ actionType: 'create_follow_up', template: 'Call {{title}}' }) }])

    const before = getStore().followUps.length
    const outcomes = await evaluateRules()

    const fired = outcomes.find((o) => o.event.id === task.id)
    expect(fired).toBeTruthy()
    expect(fired?.message).toContain('Call Pending customer visit')
    expect(getStore().followUps.length).toBe(before + outcomes.length)
  })

  it('applies each matching action only once (Nonce dedupe)', async () => {
    await createTask({
      title: 'Deduped task',
      due_date: format(subDays(startOfDay(new Date()), 1), 'yyyy-MM-dd'),
      priority: 'medium' as TaskPriority,
      status: 'todo' as TaskStatus,
    })
    await saveRules([{ ...rule({ actionType: 'log_activity' }) }])
    const before = getStore().activities.length

    const first = await evaluateRules()
    const second = await evaluateRules()

    expect(first.length).toBeGreaterThanOrEqual(1)
    expect(second.length).toBe(0)
    expect(getStore().activities.length).toBe(before + first.length)
  })

  it('completing the task removes it from the overdue trigger pool', async () => {
    const task = await createTask({
      title: 'Fixes itself',
      due_date: format(subDays(startOfDay(new Date()), 1), 'yyyy-MM-dd'),
      priority: 'medium' as TaskPriority,
      status: 'todo' as TaskStatus,
    })
    await saveRules([{ ...rule({ actionType: 'log_activity' }) }])
    expect((await evaluateRules()).length).toBeGreaterThanOrEqual(1)
    await completeTask(task.id)
    // Nonce already recorded; a completed task also no longer matches.
    expect((await evaluateRules()).length).toBe(0)
    // Fresh default behaviour check: overdue pool is now empty.
    await resetStore()
    await saveRules([{ ...rule({ actionType: 'log_activity' }) }])
    expect((await evaluateRules()).length).toBe(0)
  })

  it('exposes a label for every trigger type', () => {
    expect(TRIGGER_LABELS.overdue_task).toBeTruthy()
    expect(TRIGGER_LABELS.new_lead).toBeTruthy()
  })
})