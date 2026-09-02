import { useState, type FormEvent } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Input, Select, Textarea } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import type { Task, TaskPriority, TaskStatus } from '@/types'

const priorityOptions: { value: TaskPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

const statusOptions: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'completed', label: 'Completed' },
]

interface TaskFormValues {
  title: string
  description: string
  customer_id: string
  due_date: string
  priority: TaskPriority
  status: TaskStatus
}

interface TaskFormProps {
  open: boolean
  onClose: () => void
  onSave: (values: TaskFormValues) => Promise<void>
  initial?: Task
  loading?: boolean
  customerOptions: { value: string; label: string }[]
  defaultCustomerId?: string
}

export interface TaskFormData extends TaskFormValues {}

export function TaskForm({
  open,
  onClose,
  onSave,
  initial,
  loading,
  customerOptions,
  defaultCustomerId,
}: TaskFormProps) {
  const [values, setValues] = useState<TaskFormValues>({
    title: initial?.title ?? '',
    description: initial?.description ?? '',
    customer_id: defaultCustomerId ?? initial?.customer_id ?? '',
    due_date: initial?.due_date ?? new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    priority: initial?.priority ?? 'medium',
    status: initial?.status ?? 'todo',
  })
  const [errors, setErrors] = useState<Partial<Record<keyof TaskFormValues, string>>>({})

  function set<K extends keyof TaskFormValues>(key: K, value: TaskFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  function validate(): boolean {
    const next: Partial<Record<keyof TaskFormValues, string>> = {}
    if (!values.title.trim()) next.title = 'Title is required'
    if (!values.due_date) next.due_date = 'Due date is required'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!validate()) return
    await onSave(values)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? 'Edit task' : 'Create task'}
      description="Track a follow-up, reminder, or to-do item."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          id="title"
          label="Title"
          required
          value={values.title}
          onChange={(e) => set('title', e.target.value)}
          error={errors.title}
          placeholder="e.g. Call guest regarding airport transfer"
        />

        <Textarea
          id="description"
          label="Description"
          value={values.description}
          onChange={(e) => set('description', e.target.value)}
          placeholder="Optional details"
          rows={3}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            id="customer_id"
            label="Customer"
            value={values.customer_id}
            onChange={(e) => set('customer_id', e.target.value)}
            options={[{ value: '', label: 'No customer' }, ...customerOptions]}
          />
          <Input
            id="due_date"
            label="Due date"
            type="date"
            required
            value={values.due_date}
            onChange={(e) => set('due_date', e.target.value)}
            error={errors.due_date}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            id="priority"
            label="Priority"
            value={values.priority}
            onChange={(e) => set('priority', e.target.value as TaskPriority)}
            options={priorityOptions}
          />
          <Select
            id="status"
            label="Status"
            value={values.status}
            onChange={(e) => set('status', e.target.value as TaskStatus)}
            options={statusOptions}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={loading}>
            {initial ? 'Save changes' : 'Create task'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
