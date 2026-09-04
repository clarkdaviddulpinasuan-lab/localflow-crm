import { paginate, notFound, messageFromError, getCurrentBusinessId } from '@/lib/dataClient'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/services/activityService'
import type { Task, PaginatedResponse } from '@/types'
import type { QueryParams } from '@/utils/query'

export const taskSearchFields: (keyof Task)[] = ['title', 'description']

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
  return listFromSupabase(params)
}

export async function getTask(id: string): Promise<Task | undefined> {
  const { data, error } = await supabase.from('tasks').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(messageFromError(error, 'Failed to load task'))
  return (data as Task) ?? undefined
}

export async function createTask(
  input: Omit<Task, 'id' | 'business_id' | 'created_at' | 'updated_at'>
): Promise<Task> {
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
  await logActivity({
    action: 'created',
    entity_type: 'task',
    entity_id: input.customer_id ?? data.id,
    description: `Task created: ${data.title}`,
  })
  return data as Task
}

export async function updateTask(id: string, input: Partial<Task>): Promise<Task> {
  const { data, error } = await supabase
    .from('tasks')
    .update(input)
    .eq('id', id)
    .select()
    .maybeSingle()
  if (error) throw new Error(messageFromError(error, 'Failed to update task'))
  if (!data) notFound('Task')
  await logActivity({
    action: 'updated',
    entity_type: 'task',
    entity_id: data.customer_id ?? data.id,
    description: `Task updated: ${data.title}`,
  })
  return data as Task
}

export async function completeTask(id: string): Promise<Task> {
  const task = await updateTask(id, { status: 'completed' })
  await logActivity({
    action: 'completed',
    entity_type: 'task',
    entity_id: task.customer_id ?? task.id,
    description: `Task completed: ${task.title}`,
  })
  return task
}

export async function deleteTask(id: string): Promise<void> {
  const { data: existing, error: fetchErr } = await supabase
    .from('tasks')
    .select('id,title,customer_id')
    .eq('id', id)
    .maybeSingle()
  if (fetchErr) throw new Error(messageFromError(fetchErr, 'Failed to load task'))
  const { error } = await supabase.from('tasks').delete().eq('id', id)
  if (error) throw new Error(messageFromError(error, 'Failed to delete task'))
  await logActivity({
    action: 'deleted',
    entity_type: 'task',
    entity_id: existing?.customer_id ?? id,
    description: `Task deleted${existing?.title ? `: ${existing.title}` : ''}`,
  })
}
