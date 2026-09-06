import { paginate, notFound, messageFromError, getCurrentBusinessId } from '@/lib/dataClient'
import { supabase } from '@/lib/supabase'
import { withRetry } from '@/lib/withRetry'
import { recalcCustomerStats } from '@/services/customerService'
import { logActivity } from '@/services/activityService'
import type { Booking, PaginatedResponse } from '@/types'
import type { QueryParams } from '@/utils/query'

export const bookingSearchFields: (keyof Booking)[] = ['resource', 'notes']

// Human-friendly date range text: "on 2026-09-03" for a single day, or
// "from 2026-09-03 to 2026-09-05" for a multi-day span.
function dateSpan(start: string, end?: string | null): string {
  if (end && end > start) return ` from ${start} to ${end}`
  return ` on ${start}`
}

async function listFromSupabase(params: QueryParams<Booking> = {}): Promise<PaginatedResponse<Booking>> {
  let query = supabase.from('bookings').select('*', { count: 'exact' })

  if (params.filters) {
    for (const [key, value] of Object.entries(params.filters)) {
      if (value !== undefined && value !== '' && value !== null) {
        query = query.eq(key, value)
      }
    }
  }

  if (params.search) {
    const fields: (keyof Booking)[] = params.searchFields ?? bookingSearchFields
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
  if (error) throw new Error(messageFromError(error, 'Failed to load bookings'))
  return paginate((data as Booking[]) ?? [], count ?? 0, page, perPage)
}

export async function listBookings(params: QueryParams<Booking> = {}): Promise<PaginatedResponse<Booking>> {
  return listFromSupabase(params)
}

export async function getBooking(id: string): Promise<Booking | undefined> {
  const { data, error } = await withRetry(() => supabase.from('bookings').select('*').eq('id', id).maybeSingle())
  if (error) throw new Error(messageFromError(error, 'Failed to load booking'))
  return (data as Booking) ?? undefined
}

export async function createBooking(
  input: Omit<Booking, 'id' | 'business_id' | 'created_at' | 'updated_at'>
): Promise<Booking> {
  const businessId = await getCurrentBusinessId()
  const { data, error } = await supabase
    .from('bookings')
    .insert({
      business_id: businessId,
      customer_id: input.customer_id,
      resource: input.resource,
      date: input.date,
      end_date: input.end_date ? input.end_date : null,
      start_time: input.start_time,
      end_time: input.end_time,
      guests: input.guests,
      status: input.status ?? 'pending',
      amount: input.amount,
      payment_status: input.payment_status ?? 'pending',
      notes: input.notes ?? null,
    })
    .select()
    .single()
  if (error) throw new Error(messageFromError(error, 'Failed to create booking'))
  await recalcCustomerStats(input.customer_id)
  await logActivity({
    action: 'created',
    entity_type: 'booking',
    entity_id: input.customer_id,
    description: `Booking created${dateSpan(input.date, input.end_date)} (${input.resource})`,
  })
  return data as Booking
}

export async function updateBooking(id: string, input: Partial<Booking>): Promise<Booking> {
  // A cleared date input arrives as '', which Postgres rejects for a date
  // column. Match createBooking and store the absence as NULL.
  const payload: Partial<Booking> = { ...input }
  if ('end_date' in payload) payload.end_date = payload.end_date || null

  const { data, error } = await supabase
    .from('bookings')
    .update(payload)
    .eq('id', id)
    .select()
    .maybeSingle()
  if (error) throw new Error(messageFromError(error, 'Failed to update booking'))
  if (!data) notFound('Booking')
  await recalcCustomerStats(data.customer_id)
  await logActivity({
    action: 'updated',
    entity_type: 'booking',
    entity_id: data.customer_id,
    description: `Booking updated${dateSpan(data.date, data.end_date)} (${data.resource})`,
  })
  return data as Booking
}

export async function cancelBooking(id: string, reason?: string): Promise<Booking> {
  const { data, error } = await supabase
    .from('bookings')
    .update({ status: 'cancelled', notes: reason || undefined })
    .eq('id', id)
    .select()
    .maybeSingle()
  if (error) throw new Error(messageFromError(error, 'Failed to cancel booking'))
  if (!data) notFound('Booking')
  await recalcCustomerStats(data.customer_id)
  await logActivity({
    action: 'cancelled',
    entity_type: 'booking',
    entity_id: data.customer_id,
    description: `Booking cancelled (${data.resource})`,
  })
  return data as Booking
}

export async function checkIn(id: string): Promise<Booking> {
  const now = new Date()
  const { data, error } = await supabase
    .from('bookings')
    .update({
      status: 'checked_in',
      check_in_date: now.toISOString().slice(0, 10),
      check_in_time: now.toTimeString().slice(0, 5),
    })
    .eq('id', id)
    .select()
    .maybeSingle()
  if (error) throw new Error(messageFromError(error, 'Failed to check in'))
  if (!data) notFound('Booking')
  await recalcCustomerStats(data.customer_id)
  await logActivity({
    action: 'checked_in',
    entity_type: 'booking',
    entity_id: data.customer_id,
    description: `Customer checked in (${data.resource})`,
  })
  return data as Booking
}

export async function checkOut(id: string): Promise<Booking> {
  const now = new Date()
  const { data, error } = await supabase
    .from('bookings')
    .update({
      status: 'completed',
      check_out_date: now.toISOString().slice(0, 10),
      check_out_time: now.toTimeString().slice(0, 5),
    })
    .eq('id', id)
    .select()
    .maybeSingle()
  if (error) throw new Error(messageFromError(error, 'Failed to check out'))
  if (!data) notFound('Booking')
  await recalcCustomerStats(data.customer_id)
  await logActivity({
    action: 'checked_out',
    entity_type: 'booking',
    entity_id: data.customer_id,
    description: `Customer checked out (${data.resource})`,
  })
  return data as Booking
}

export async function deleteBooking(id: string): Promise<void> {
  const { data: existing, error: fetchErr } = await supabase
    .from('bookings')
    .select('customer_id')
    .eq('id', id)
    .maybeSingle()
  if (fetchErr) throw new Error(messageFromError(fetchErr, 'Failed to load booking'))
  const customerId = existing?.customer_id
  const { error } = await supabase.from('bookings').delete().eq('id', id)
  if (error) throw new Error(messageFromError(error, 'Failed to delete booking'))
  if (customerId) {
    await recalcCustomerStats(customerId)
    await logActivity({
      action: 'deleted',
      entity_type: 'booking',
      entity_id: customerId,
      description: 'Booking deleted',
    })
  }
}
