import { getStore, updateStore, nextId, type DemoStore } from '@/services/demoStore'
import { isDemo, paginate, notFound, messageFromError, getCurrentBusinessId } from '@/lib/dataClient'
import { supabase } from '@/lib/supabase'
import type { Task, PaginatedResponse } from '@/types'
import { applyQuery, type QueryParams } from '@/utils/query'

export const taskSearchFields: (keyof Task)[] = ['title', 'description']

function logActivity(
  s: DemoStore,
  action: string,
  entityType: string,
  entityId: string,
  description: string
) {
  s.activities.unshift({
    id: nextId('act'),
    business_id: s.business.id,
    user_id: s.profile.user_id,
    action,
    entity_type: entityType,
    entity_id: entityId,
    description,
    created_at: new Date().toISOString(),
  })
}

async function listFromSupabase(params: QueryParams<Task> = {}): Promise<PaginatedResponse<Task>> {
  let query = supabase.from('tasks').select('*', { count: 'exact' })

  if (params.filters) {
    for (const [key, value] of Object.entries(params.filters)) {
      if (value !== undefined && value !== '' && value !== null) {
        query = query.eq(key, value)
      }
    }
  }

  if (params.search) {
    const fields: (keyof Task)[] = params.searchFields ?? taskSearchFields
    const searchFilter = fields.map((f) => `${String(f)}.ilike.%${params.search}%`).join(',')
    query = query.or(searchFilter)
  }

  if (params.sortBy) {
    query = query.order(String(params.sortBy), { ascending: params.sortDir !== 'desc' })
  } else {
    query = query.order('created_at', { ascending: false })
  }

  const page = params.page ?? 1
  const perPage = params.perPage ?? 50
  const from = (page - 1) * perPage
  query = query.range(from, from + perPage - 1)

  const { data, count, error } = await query
  if (error) throw new Error(messageFromError(error, 'Failed to load tasks'))
  return paginate((data as Task[]) ?? [], count ?? 0, page, perPage)
}

export async function listTasks(params: QueryParams<Task> = {}): Promise<PaginatedResponse<Task>> {
  if (isDemo()) return applyQuery(getStore().tasks, params)
  return listFromSupabase(params)
}

export async function getTask(id: string): Promise<Task | undefined> {
  if (isDemo()) return getStore().tasks.find((t) => t.id === id)
  const { data, error } = await supabase.from('tasks').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(messageFromError(error, 'Failed to load task'))
  return (data as Task) ?? undefined
}

export async function createTask(
  input: Omit<Task, 'id' | 'business_id' | 'created_at' | 'updated_at'>
): Promise<Task> {
  if (isDemo()) {
    const now = new Date().toISOString()
    const task: Task = {
      id: nextId('task'),
      business_id: getStore().business.id,
      ...input,
      created_at: now,
      updated_at: now,
    }
    updateStore((s) => {
      s.tasks.unshift(task)
      logActivity(s, 'created', 'task', task.id, `Task created: ${task.title}`)
    })
    return task
  }

  const businessId = await getCurrentBusinessId()
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      business_id: businessId,
      customer_id: input.customer_id ?? null,
      title: input.title,
      description: input.description ?? null,
      due_date: input.due_date,
      priority: input.priority ?? 'medium',
      status: input.status ?? 'todo',
      assignee_id: input.assignee_id ?? null,
    })
    .select()
    .single()
  if (error) throw new Error(messageFromError(error, 'Failed to create task'))
  return data as Task
}

export async function updateTask(id: string, input: Partial<Task>): Promise<Task> {
  if (isDemo()) {
    const existing = getStore().tasks.find((t) => t.id === id)
    if (!existing) throw new Error('Task not found')
    const updated: Task = { ...existing, ...input, id, updated_at: new Date().toISOString() }
    updateStore((s) => {
      s.tasks = s.tasks.map((t) => (t.id === id ? updated : t))
      logActivity(s, 'updated', 'task', id, `Task updated: ${updated.title}`)
    })
    return updated
  }

  const { data, error } = await supabase
    .from('tasks')
    .update(input)
    .eq('id', id)
    .select()
    .maybeSingle()
  if (error) throw new Error(messageFromError(error, 'Failed to update task'))
  if (!data) notFound('Task')
  return data as Task
}

export async function completeTask(id: string): Promise<Task> {
  return updateTask(id, { status: 'completed' })
}

export async function deleteTask(id: string): Promise<void> {
  if (isDemo()) {
    updateStore((s) => {
      s.tasks = s.tasks.filter((t) => t.id !== id)
    })
    return
  }
  const { error } = await supabase.from('tasks').delete().eq('id', id)
  if (error) throw new Error(messageFromError(error, 'Failed to delete task'))
}
