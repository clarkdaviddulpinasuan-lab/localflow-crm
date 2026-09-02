import { getStore, updateStore, nextId, type DemoStore } from '@/services/demoStore'
import { isDemo, paginate, notFound, messageFromError, getCurrentBusinessId } from '@/lib/dataClient'
import { supabase } from '@/lib/supabase'
import type { Lead, PaginatedResponse } from '@/types'
import { applyQuery, type QueryParams } from '@/utils/query'

export const leadSearchFields: (keyof Lead)[] = ['name', 'company', 'email', 'phone', 'source']

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

  const { data, count, error } = await query
  if (error) throw new Error(messageFromError(error, 'Failed to load leads'))
  return paginate((data as Lead[]) ?? [], count ?? 0, page, perPage)
}

export async function listLeads(params: QueryParams<Lead> = {}): Promise<PaginatedResponse<Lead>> {
  if (isDemo()) return applyQuery(getStore().leads, params)
  return listFromSupabase(params)
}

export async function getLead(id: string): Promise<Lead | undefined> {
  if (isDemo()) return getStore().leads.find((l) => l.id === id)
  const { data, error } = await supabase.from('leads').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(messageFromError(error, 'Failed to load lead'))
  return (data as Lead) ?? undefined
}

export async function createLead(
  input: Omit<Lead, 'id' | 'business_id' | 'created_at' | 'updated_at'>
): Promise<Lead> {
  if (isDemo()) {
    const now = new Date().toISOString()
    const lead: Lead = {
      id: nextId('lead'),
      business_id: getStore().business.id,
      ...input,
      created_at: now,
      updated_at: now,
    }
    updateStore((s) => {
      s.leads.unshift(lead)
      logActivity(s, 'created', 'lead', lead.id, `New lead added: ${lead.name}`)
    })
    return lead
  }

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
  return data as Lead
}

export async function updateLead(id: string, input: Partial<Lead>): Promise<Lead> {
  if (isDemo()) {
    const existing = getStore().leads.find((l) => l.id === id)
    if (!existing) throw new Error('Lead not found')
    const updated: Lead = { ...existing, ...input, id, updated_at: new Date().toISOString() }
    updateStore((s) => {
      s.leads = s.leads.map((l) => (l.id === id ? updated : l))
      logActivity(s, 'updated', 'lead', id, `Lead updated: ${updated.name} (${updated.stage})`)
    })
    return updated
  }

  const { data, error } = await supabase
    .from('leads')
    .update(input)
    .eq('id', id)
    .select()
    .maybeSingle()
  if (error) throw new Error(messageFromError(error, 'Failed to update lead'))
  if (!data) notFound('Lead')
  return data as Lead
}

export async function deleteLead(id: string): Promise<void> {
  if (isDemo()) {
    updateStore((s) => {
      s.leads = s.leads.filter((l) => l.id !== id)
    })
    return
  }
  const { error } = await supabase.from('leads').delete().eq('id', id)
  if (error) throw new Error(messageFromError(error, 'Failed to delete lead'))
}
