import { getStore, updateStore, nextId, type DemoStore } from '@/services/demoStore'
import { isDemo, paginate, messageFromError, getCurrentBusinessId } from '@/lib/dataClient'
import { supabase } from '@/lib/supabase'
import type { FollowUp, PaginatedResponse } from '@/types'
import { applyQuery, type QueryParams } from '@/utils/query'

export type FollowUpStatus = FollowUp['status']

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

async function listFromSupabase(params: QueryParams<FollowUp> = {}): Promise<PaginatedResponse<FollowUp>> {
  let query = supabase.from('follow_ups').select('*', { count: 'exact' })

  if (params.filters) {
    for (const [key, value] of Object.entries(params.filters)) {
      if (value !== undefined && value !== '' && value !== null) {
        query = query.eq(key, value)
      }
    }
  }

  if (params.sortBy) {
    query = query.order(String(params.sortBy), { ascending: params.sortDir !== 'desc' })
  } else {
    query = query.order('due_date', { ascending: true }).order('created_at', { ascending: false })
  }

  const page = params.page ?? 1
  const perPage = params.perPage ?? 50
  const from = (page - 1) * perPage
  query = query.range(from, from + perPage - 1)

  const { data, count, error } = await query
  if (error) throw new Error(messageFromError(error, 'Failed to load follow-ups'))
  return paginate((data as FollowUp[]) ?? [], count ?? 0, page, perPage)
}

export async function listFollowUps(params: QueryParams<FollowUp> = {}): Promise<PaginatedResponse<FollowUp>> {
  if (isDemo()) return applyQuery(getStore().followUps, params)
  return listFromSupabase(params)
}

export async function createFollowUp(
  input: Pick<FollowUp, 'customer_id' | 'due_date'> & { note?: string }
): Promise<FollowUp> {
  if (isDemo()) {
    const now = new Date().toISOString()
    const followUp: FollowUp = {
      id: nextId('fu'),
      business_id: getStore().business.id,
      customer_id: input.customer_id,
      due_date: input.due_date,
      note: input.note ?? null,
      status: 'pending',
      completed_at: null,
      created_by: getStore().profile.id,
      created_at: now,
      updated_at: now,
    }
    updateStore((s) => {
      s.followUps.unshift(followUp)
      logActivity(s, 'created', 'follow_up', followUp.id, `Follow-up scheduled for ${input.due_date}`)
    })
    return followUp
  }

  const businessId = await getCurrentBusinessId()
  const { data, error } = await supabase
    .from('follow_ups')
    .insert({
      business_id: businessId,
      customer_id: input.customer_id,
      due_date: input.due_date,
      note: input.note ?? null,
    })
    .select()
    .single()
  if (error) throw new Error(messageFromError(error, 'Failed to create follow-up'))
  return data as FollowUp
}

async function setStatus(id: string, status: FollowUpStatus): Promise<FollowUp> {
  if (isDemo()) {
    const existing = getStore().followUps.find((f) => f.id === id)
    if (!existing) throw new Error('Follow-up not found')
    const updated: FollowUp = {
      ...existing,
      status,
      completed_at: status === 'completed' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }
    updateStore((s) => {
      s.followUps = s.followUps.map((f) => (f.id === id ? updated : f))
      logActivity(s, 'updated', 'follow_up', id, `Follow-up marked ${status}`)
    })
    return updated
  }

  const { data, error } = await supabase
    .from('follow_ups')
    .update({ status, completed_at: status === 'completed' ? new Date().toISOString() : null })
    .eq('id', id)
    .select()
    .maybeSingle()
  if (error) throw new Error(messageFromError(error, 'Failed to update follow-up'))
  if (!data) throw new Error('Follow-up not found')
  return data as FollowUp
}

export function completeFollowUp(id: string): Promise<FollowUp> {
  return setStatus(id, 'completed')
}

export function skipFollowUp(id: string): Promise<FollowUp> {
  return setStatus(id, 'skipped')
}

export async function deleteFollowUp(id: string): Promise<void> {
  if (isDemo()) {
    updateStore((s) => {
      s.followUps = s.followUps.filter((f) => f.id !== id)
    })
    return
  }
  const { error } = await supabase.from('follow_ups').delete().eq('id', id)
  if (error) throw new Error(messageFromError(error, 'Failed to delete follow-up'))
}