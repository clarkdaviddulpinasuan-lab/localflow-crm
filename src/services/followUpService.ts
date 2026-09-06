import { paginate, messageFromError, getCurrentBusinessId } from '@/lib/dataClient'
import { supabase } from '@/lib/supabase'
import { withRetry } from '@/lib/withRetry'
import type { FollowUp, PaginatedResponse } from '@/types'
import type { QueryParams } from '@/utils/query'

export type FollowUpStatus = FollowUp['status']

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

  const { data, count, error } = await withRetry(() => query)
  if (error) throw new Error(messageFromError(error, 'Failed to load follow-ups'))
  return paginate((data as FollowUp[]) ?? [], count ?? 0, page, perPage)
}

export async function listFollowUps(params: QueryParams<FollowUp> = {}): Promise<PaginatedResponse<FollowUp>> {
  return listFromSupabase(params)
}

export async function createFollowUp(
  input: Pick<FollowUp, 'customer_id' | 'due_date'> & { note?: string }
): Promise<FollowUp> {
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
  const { error } = await supabase.from('follow_ups').delete().eq('id', id)
  if (error) throw new Error(messageFromError(error, 'Failed to delete follow-up'))
}
