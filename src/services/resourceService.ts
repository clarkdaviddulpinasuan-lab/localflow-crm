import { paginate, messageFromError, getCurrentBusinessId } from '@/lib/dataClient'
import { supabase } from '@/lib/supabase'
import { withRetry } from '@/lib/withRetry'
import type { Booking, Resource, PaginatedResponse } from '@/types'
import type { QueryParams } from '@/utils/query'

export const resourceSearchFields: (keyof Resource)[] = ['name', 'type']

async function listFromSupabase(params: QueryParams<Resource> = {}): Promise<PaginatedResponse<Resource>> {
  let query = supabase.from('resources').select('*', { count: 'exact' })

  if (params.filters) {
    for (const [key, value] of Object.entries(params.filters)) {
      if (value !== undefined && value !== '' && value !== null) {
        query = query.eq(key, value)
      }
    }
  }

  if (params.search) {
    const fields: (keyof Resource)[] = params.searchFields ?? resourceSearchFields
    const searchFilter = fields.map((f) => `${String(f)}.ilike.%${params.search}%`).join(',')
    query = query.or(searchFilter)
  }

  if (params.sortBy) {
    query = query.order(String(params.sortBy), { ascending: params.sortDir !== 'desc' })
  } else {
    query = query.order('name', { ascending: true })
  }

  const page = params.page ?? 1
  const perPage = params.perPage ?? 50
  const from = (page - 1) * perPage
  query = query.range(from, from + perPage - 1)

  const { data, count, error } = await withRetry(() => query)
  if (error) throw new Error(messageFromError(error, 'Failed to load resources'))
  return paginate((data as Resource[]) ?? [], count ?? 0, page, perPage)
}

export async function listResources(params: QueryParams<Resource> = {}): Promise<PaginatedResponse<Resource>> {
  return listFromSupabase(params)
}

export async function getActiveResources(): Promise<Resource[]> {
  const { data, error } = await withRetry(() =>
    supabase.from('resources').select('*').eq('active', true).order('name', { ascending: true })
  )
  if (error) throw new Error(messageFromError(error, 'Failed to load resources'))
  return (data as Resource[]) ?? []
}

export async function getResource(id: string): Promise<Resource | undefined> {
  const { data, error } = await withRetry(() => supabase.from('resources').select('*').eq('id', id).maybeSingle())
  if (error) throw new Error(messageFromError(error, 'Failed to load resource'))
  return (data as Resource) ?? undefined
}

export async function createResource(
  input: Omit<Resource, 'id' | 'business_id' | 'created_at' | 'updated_at'>
): Promise<Resource> {
  const businessId = await getCurrentBusinessId()
  const { data, error } = await supabase
    .from('resources')
    .insert({
      business_id: businessId,
      name: input.name,
      type: input.type ?? 'resource',
      color: input.color ?? null,
      active: input.active ?? true,
    })
    .select()
    .single()
  if (error) throw new Error(messageFromError(error, 'Failed to create resource'))
  return data as Resource
}

export async function updateResource(id: string, input: Partial<Resource>): Promise<Resource> {
  const { data, error } = await supabase
    .from('resources')
    .update(input)
    .eq('id', id)
    .select()
    .maybeSingle()
  if (error) throw new Error(messageFromError(error, 'Failed to update resource'))
  if (!data) throw new Error('Resource not found')
  return data as Resource
}

export async function deleteResource(id: string): Promise<void> {
  const { error } = await supabase.from('resources').delete().eq('id', id)
  if (error) throw new Error(messageFromError(error, 'Failed to delete resource'))
}

const OCCUPIED_STATUSES: Booking['status'][] = ['pending', 'confirmed', 'checked_in']

export function isOccupiedBooking(booking: Booking, today: string): boolean {
  if (!OCCUPIED_STATUSES.includes(booking.status)) return false
  return booking.date >= today
}

export function groupUpcomingBookingsByResource(bookings: Booking[], today: string): Map<string, Booking[]> {
  const map = new Map<string, Booking[]>()
  for (const b of bookings) {
    if (!isOccupiedBooking(b, today)) continue
    const list = map.get(b.resource) ?? []
    list.push(b)
    map.set(b.resource, list)
  }
  for (const list of map.values()) {
    list.sort((a, b) => (a.date === b.date ? a.start_time.localeCompare(b.start_time) : a.date.localeCompare(b.date)))
  }
  return map
}
