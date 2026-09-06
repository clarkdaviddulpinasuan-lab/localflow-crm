import { paginate, notFound, messageFromError, getCurrentBusinessId } from '@/lib/dataClient'
import { supabase } from '@/lib/supabase'
import { withRetry } from '@/lib/withRetry'
import { logActivity } from '@/services/activityService'
import type { Lead, PaginatedResponse } from '@/types'
import type { QueryParams } from '@/utils/query'

export const leadSearchFields: (keyof Lead)[] = ['name', 'company', 'email', 'phone', 'source']

async function listFromSupabase(params: QueryParams<Lead> = {}): Promise<PaginatedResponse<Lead>> {
  let query = supabase.from('leads').select('*', { count: 'exact' })

  if (params.filters) {
    for (const [key, value] of Object.entries(params.filters)) {
      if (value !== undefined && value !== '' && value !== null) {
        query = query.eq(key, value)
      }
    }
  }

  if (params.search) {
    const fields: (keyof Lead)[] = params.searchFields ?? leadSearchFields
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

  const { data, count, error } = await withRetry(() => query)
  if (error) throw new Error(messageFromError(error, 'Failed to load leads'))
  return paginate((data as Lead[]) ?? [], count ?? 0, page, perPage)
}

export async function listLeads(params: QueryParams<Lead> = {}): Promise<PaginatedResponse<Lead>> {
  return listFromSupabase(params)
}

export async function getLead(id: string): Promise<Lead | undefined> {
  const { data, error } = await withRetry(() => supabase.from('leads').select('*').eq('id', id).maybeSingle())
  if (error) throw new Error(messageFromError(error, 'Failed to load lead'))
  return (data as Lead) ?? undefined
}

export async function createLead(
  input: Omit<Lead, 'id' | 'business_id' | 'created_at' | 'updated_at'>
): Promise<Lead> {
  const businessId = await getCurrentBusinessId()
  const { data, error } = await supabase
    .from('leads')
    .insert({
      business_id: businessId,
      name: input.name,
      company: input.company ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      source: input.source ?? null,
      stage: input.stage ?? 'new',
      estimated_value: input.estimated_value,
      next_action: input.next_action ?? null,
      assigned_staff: input.assigned_staff ?? null,
    })
    .select()
    .single()
  if (error) throw new Error(messageFromError(error, 'Failed to create lead'))
  await logActivity({
    action: 'created',
    entity_type: 'lead',
    entity_id: data.id,
    description: `Lead created: ${data.name}`,
  })
  return data as Lead
}

export async function updateLead(id: string, input: Partial<Lead>): Promise<Lead> {
  const { data, error } = await supabase
    .from('leads')
    .update(input)
    .eq('id', id)
    .select()
    .maybeSingle()
  if (error) throw new Error(messageFromError(error, 'Failed to update lead'))
  if (!data) notFound('Lead')
  await logActivity({
    action: 'updated',
    entity_type: 'lead',
    entity_id: data.id,
    description: input.stage ? `Lead moved to ${input.stage}: ${data.name}` : `Lead updated: ${data.name}`,
  })
  return data as Lead
}

export async function deleteLead(id: string): Promise<void> {
  const { data: existing, error: fetchErr } = await supabase
    .from('leads')
    .select('id,name')
    .eq('id', id)
    .maybeSingle()
  if (fetchErr) throw new Error(messageFromError(fetchErr, 'Failed to load lead'))
  const { error } = await supabase.from('leads').delete().eq('id', id)
  if (error) throw new Error(messageFromError(error, 'Failed to delete lead'))
  await logActivity({
    action: 'deleted',
    entity_type: 'lead',
    entity_id: id,
    description: `Lead deleted${existing?.name ? `: ${existing.name}` : ''}`,
  })
}
