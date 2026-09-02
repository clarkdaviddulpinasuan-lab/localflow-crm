import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Zap, RefreshCw } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Input, Select, Textarea } from '@/components/ui/Field'
import {
  getRules,
  saveRules,
  evaluateRules,
  nextRuleId,
  TRIGGER_LABELS,
  ACTION_LABELS,
  TRIGGER_USES_WINDOW,
  DEFAULT_WINDOW,
  type RuleOutcome,
} from '@/services/automationService'
import type { AutomationRule, AutomationTriggerType, AutomationActionType } from '@/types'

const triggerOptions: { value: AutomationTriggerType; label: string }[] = (Object.keys(TRIGGER_LABELS) as AutomationTriggerType[]).map(
  (t) => ({ value: t, label: TRIGGER_LABELS[t] })
)

const actionOptions: { value: AutomationActionType; label: string }[] = (Object.keys(ACTION_LABELS) as AutomationActionType[]).map(
  (a) => ({ value: a, label: ACTION_LABELS[a] })
)

const EMPTY_FORM = {
  name: '',
  enabled: true,
  triggerType: 'overdue_task' as AutomationTriggerType,
  triggerDays: 1,
  actionType: 'create_task' as AutomationActionType,
  template: '',
}

function templateHint(): string {
  return 'Supports {{customer}}, {{title}}, {{resource}}, {{date}}.'
}

export function AutomationPage() {
  const [rules, setRules] = useState<AutomationRule[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<AutomationRule | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [running, setRunning] = useState(false)
  const [outcomes, setOutcomes] = useState<RuleOutcome[] | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<AutomationRule | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    getRules().then(setRules)
  }, [])

  function openAdd() {
    setEditing(null)
    setForm({ ...EMPTY_FORM })
    setError('')
    setModalOpen(true)
  }

  function openEdit(r: AutomationRule) {
    setEditing(r)
    setForm({ name: r.name, enabled: r.enabled, triggerType: r.triggerType, triggerDays: r.triggerDays, actionType: r.actionType, template: r.template })
    setError('')
    setModalOpen(true)
  }

  async function submit() {
    if (!form.name.trim() || !form.template.trim()) {
      setError('Name and template are required.')
      return
    }
    const now = new Date().toISOString()
    const rule: AutomationRule = {
      id: editing?.id ?? nextRuleId(),
      name: form.name.trim(),
      enabled: form.enabled,
      triggerType: form.triggerType,
      triggerDays: TRIGGER_USES_WINDOW[form.triggerType] ? Math.max(1, form.triggerDays) : DEFAULT_WINDOW[form.triggerType],
      actionType: form.actionType,
      template: form.template.trim(),
      created_at: editing?.created_at ?? now,
      updated_at: now,
    }
    const next = editing ? rules.map((r) => (r.id === rule.id ? rule : r)) : [...rules, rule]
    await saveRules(next)
    setRules(next)
    setModalOpen(false)
  }

  async function toggleEnabled(r: AutomationRule) {
    const next = rules.map((x) => (x.id === r.id ? { ...x, enabled: !x.enabled, updated_at: new Date().toISOString() } : x))
    await saveRules(next)
    setRules(next)
  }

  async function confirmRemove() {
    if (!confirmDelete) return
    const next = rules.filter((r) => r.id !== confirmDelete.id)
    await saveRules(next)
    setRules(next)
    setConfirmDelete(null)
  }

  async function run() {
    setRunning(true)
    setOutcomes(null)
    try {
      const results = await evaluateRules()
      setOutcomes(results)
    } finally {
      setRunning(false)
    }
  }

  const usesWindow = TRIGGER_USES_WINDOW[form.triggerType]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Automation"
        description="Rule-based actions evaluated against fresh data. Each event is handled exactly once via a Nonce in the activity trail."
        actions={
          <>
            <Button variant="secondary" icon={<RefreshCw className="h-4 w-4" />} loading={running} onClick={run}>
              Run now
            </Button>
            <Button icon={<Plus className="h-4 w-4" />} onClick={openAdd}>
              New rule
            </Button>
          </>
        }
      />

      {outcomes !== null && (
        <Card className="p-4">
          <h2 className="text-sm font-semibold text-surface-900 mb-2">
            Latest run — {outcomes.length} action{outcomes.length === 1 ? '' : 's'}
          </h2>
          {outcomes.length === 0 ? (
            <p className="text-sm text-surface-500">Nothing fired. No enabled rule matched an event that had not already been handled.</p>
          ) : (
            <ul className="space-y-1.5">
              {outcomes.map((o, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <Zap className="h-4 w-4 mt-0.5 shrink-0 text-primary-500" />
                  <span>
                    <span className="font-medium text-surface-900">{o.rule.name}</span>
                    <span className="text-surface-500"> → {o.message}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <div className="space-y-3">
        {rules.length === 0 && <Card className="p-6 text-center text-sm text-surface-500">No rules yet. Create one to automate follow-ups, notifications, tasks, and more.</Card>}
        {rules.map((r) => {
          const usesWindow = TRIGGER_USES_WINDOW[r.triggerType]
          return (
            <Card key={r.id} className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-surface-900">{r.name}</h3>
                    <Badge variant={r.enabled ? 'success' : 'default'}>{r.enabled ? 'Enabled' : 'Disabled'}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-surface-500">
                    <span className="font-medium text-surface-700">{TRIGGER_LABELS[r.triggerType]}</span>
                    {usesWindow && <span> within {r.triggerDays} day{r.triggerDays === 1 ? '' : 's'}</span>} →
                    <span className="font-medium text-surface-700"> {ACTION_LABELS[r.actionType]}</span>
                  </p>
                  <p className="mt-0.5 text-sm text-surface-400">"{r.template}"</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <label className="flex items-center gap-2 text-xs font-medium text-surface-600">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-primary-600"
                      checked={r.enabled}
                      onChange={() => toggleEnabled(r)}
                    />
                    Enabled
                  </label>
                  <Button variant="secondary" size="sm" icon={<Pencil className="h-4 w-4" />} onClick={() => openEdit(r)}>
                    Edit
                  </Button>
                  <Button variant="secondary" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={() => setConfirmDelete(r)}>
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit rule' : 'New rule'}
        description="Choose a trigger and what should happen when it matches."
      >
        <div className="space-y-4">
          <Input
            id="rule-name"
            label="Rule name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Follow up on overdue tasks"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              id="trigger"
              label="Trigger"
              value={form.triggerType}
              options={triggerOptions}
              onChange={(e) => {
                const triggerType = e.target.value as AutomationTriggerType
                setForm((f) => ({ ...f, triggerType, triggerDays: DEFAULT_WINDOW[triggerType] }))
              }}
            />
            {usesWindow && (
              <Input
                id="window"
                label="Window (days)"
                type="number"
                min={1}
                value={form.triggerDays}
                onChange={(e) => setForm((f) => ({ ...f, triggerDays: Number(e.target.value) }))}
              />
            )}
          </div>
          <Select
            id="action"
            label="Action"
            value={form.actionType}
            options={actionOptions}
            onChange={(e) => setForm((f) => ({ ...f, actionType: e.target.value as AutomationActionType }))}
          />
          <Textarea
            id="template"
            label="Template"
            hint={templateHint()}
            value={form.template}
            onChange={(e) => setForm((f) => ({ ...f, template: e.target.value }))}
            placeholder="e.g. Follow up on {{title}}"
            rows={3}
          />
          <label className="flex items-center gap-2 text-sm font-medium text-surface-700">
            <input
              type="checkbox"
              className="h-4 w-4 accent-primary-600"
              checked={form.enabled}
              onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
            />
            Enabled
          </label>
          {error && <p className="text-sm text-danger-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={submit}>Save rule</Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title="Delete rule"
        description="Once deleted, this automation will no longer run. Its past Nonce history is kept."
      >
        <div className="space-y-4">
          <p className="text-sm text-surface-600">
            Delete "{confirmDelete?.name}"? Events it has already handled will not fire again.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button variant="danger" onClick={confirmRemove}>Delete</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}