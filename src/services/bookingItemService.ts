import { paginate, messageFromError, getCurrentBusinessId } from '@/lib/dataClient'
import { supabase } from '@/lib/supabase'
import { withRetry } from '@/lib/withRetry'
import type { BookingItem, PaginatedResponse } from '@/types'
import type { QueryParams } from '@/utils/query'

export const bookingItemSearchFields: (keyof BookingItem)[] = ['name', 'category', 'notes']

async function listFromSupabase(params: QueryParams<BookingItem> = {}): Promise<PaginatedResponse<BookingItem>> {
  let query = supabase.from('booking_items').select('*', { count: 'exact' })

  if (params.filters) {
    for (const [key, value] of Object.entries(params.filters)) {
      if (value !== undefined && value !== '' && value !== null) {
        query = query.eq(key, value)
      }
    }
  }

  if (params.search) {
    const fields: (keyof BookingItem)[] = params.searchFields ?? bookingItemSearchFields
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
  if (error) throw new Error(messageFromError(error, 'Failed to load booking items'))
  return paginate((data as BookingItem[]) ?? [], count ?? 0, page, perPage)
}

export async function listBookingItems(params: QueryParams<BookingItem> = {}): Promise<PaginatedResponse<BookingItem>> {
  return listFromSupabase(params)
}

export async function getBookingItemsByBookingId(bookingId: string): Promise<BookingItem[]> {
  const { data, error } = await withRetry(() =>
    supabase.from('booking_items').select('*').eq('booking_id', bookingId).order('created_at', { ascending: true })
  )
  if (error) throw new Error(messageFromError(error, 'Failed to load booking items'))
  return (data as BookingItem[]) ?? []
}

export async function createBookingItem(
  input: Omit<BookingItem, 'id' | 'business_id' | 'total' | 'created_at' | 'updated_at'>
): Promise<BookingItem> {
  const businessId = await getCurrentBusinessId()
  const { data, error } = await supabase
    .from('booking_items')
    .insert({
      business_id: businessId,
      booking_id: input.booking_id,
      name: input.name,
      quantity: input.quantity ?? 1,
      unit_price: input.unit_price ?? 0,
      category: input.category ?? null,
      notes: input.notes ?? null,
    })
    .select()
    .single()
  if (error) throw new Error(messageFromError(error, 'Failed to create booking item'))
  return data as BookingItem
}

export async function updateBookingItem(id: string, input: Partial<BookingItem>): Promise<BookingItem> {
  const { data, error } = await supabase
    .from('booking_items')
    .update(input)
    .eq('id', id)
    .select()
    .maybeSingle()
  if (error) throw new Error(messageFromError(error, 'Failed to update booking item'))
  if (!data) throw new Error('Booking item not found')
  return data as BookingItem
}

export async function deleteBookingItem(id: string): Promise<void> {
  const { error } = await supabase.from('booking_items').delete().eq('id', id)
  if (error) throw new Error(messageFromError(error, 'Failed to delete booking item'))
}
