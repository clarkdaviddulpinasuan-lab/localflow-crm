import { getStore, updateStore, nextId, type DemoStore } from '@/services/demoStore'
import { isDemo, paginate, notFound, messageFromError, getCurrentBusinessId } from '@/lib/dataClient'
import { supabase } from '@/lib/supabase'
import { recalcCustomerStats } from '@/services/customerService'
import type { Booking, PaginatedResponse } from '@/types'
import { applyQuery, type QueryParams } from '@/utils/query'

export const bookingSearchFields: (keyof Booking)[] = ['resource', 'notes']

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

  const { data, count, error } = await query
  if (error) throw new Error(messageFromError(error, 'Failed to load bookings'))
  return paginate((data as Booking[]) ?? [], count ?? 0, page, perPage)
}

export async function listBookings(params: QueryParams<Booking> = {}): Promise<PaginatedResponse<Booking>> {
  if (isDemo()) return applyQuery(getStore().bookings, params)
  return listFromSupabase(params)
}

export async function getBooking(id: string): Promise<Booking | undefined> {
  if (isDemo()) return getStore().bookings.find((b) => b.id === id)
  const { data, error } = await supabase.from('bookings').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(messageFromError(error, 'Failed to load booking'))
  return (data as Booking) ?? undefined
}

export async function createBooking(
  input: Omit<Booking, 'id' | 'business_id' | 'created_at' | 'updated_at'>
): Promise<Booking> {
  if (isDemo()) {
    const now = new Date().toISOString()
    const booking: Booking = {
      id: nextId('bk'),
      business_id: getStore().business.id,
      ...input,
      created_at: now,
      updated_at: now,
    }
    updateStore((s) => {
      s.bookings.unshift(booking)
      logActivity(s, 'created', 'booking', booking.id, `New booking created - ${booking.resource} on ${booking.date}`)
    })
    await recalcCustomerStats(booking.customer_id)
    return booking
  }

  const businessId = await getCurrentBusinessId()
  const { data, error } = await supabase
    .from('bookings')
    .insert({
      business_id: businessId,
      customer_id: input.customer_id,
      resource: input.resource,
      date: input.date,
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
  return data as Booking
}

export async function updateBooking(id: string, input: Partial<Booking>): Promise<Booking> {
  if (isDemo()) {
    const existing = getStore().bookings.find((b) => b.id === id)
    if (!existing) throw new Error('Booking not found')
    const updated: Booking = { ...existing, ...input, id, updated_at: new Date().toISOString() }
    updateStore((s) => {
      s.bookings = s.bookings.map((b) => (b.id === id ? updated : b))
      logActivity(s, 'updated', 'booking', id, `Booking updated - ${updated.resource}`)
    })
    await recalcCustomerStats(existing.customer_id)
    return updated
  }

  const { data, error } = await supabase
    .from('bookings')
    .update(input)
    .eq('id', id)
    .select()
    .maybeSingle()
  if (error) throw new Error(messageFromError(error, 'Failed to update booking'))
  if (!data) notFound('Booking')
  await recalcCustomerStats(data.customer_id)
  return data as Booking
}

export async function cancelBooking(id: string, reason?: string): Promise<Booking> {
  if (isDemo()) {
    const existing = getStore().bookings.find((b) => b.id === id)
    if (!existing) throw new Error('Booking not found')
    return updateBooking(id, { status: 'cancelled', notes: reason || existing.notes })
  }
  const { data, error } = await supabase
    .from('bookings')
    .update({ status: 'cancelled', notes: reason || undefined })
    .eq('id', id)
    .select()
    .maybeSingle()
  if (error) throw new Error(messageFromError(error, 'Failed to cancel booking'))
  if (!data) notFound('Booking')
  await recalcCustomerStats(data.customer_id)
  return data as Booking
}

export async function deleteBooking(id: string): Promise<void> {
  let customerId: string | undefined
  if (isDemo()) {
    const existing = getStore().bookings.find((b) => b.id === id)
    customerId = existing?.customer_id
    updateStore((s) => {
      s.bookings = s.bookings.filter((b) => b.id !== id)
    })
    if (customerId) await recalcCustomerStats(customerId)
    return
  }
  const { data: existing, error: fetchErr } = await supabase
    .from('bookings')
    .select('customer_id')
    .eq('id', id)
    .maybeSingle()
  if (fetchErr) throw new Error(messageFromError(fetchErr, 'Failed to load booking'))
  customerId = existing?.customer_id
  const { error } = await supabase.from('bookings').delete().eq('id', id)
  if (error) throw new Error(messageFromError(error, 'Failed to delete booking'))
  if (customerId) await recalcCustomerStats(customerId)
}
