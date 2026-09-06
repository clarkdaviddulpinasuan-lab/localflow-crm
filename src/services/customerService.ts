import { paginate, notFound, messageFromError, getCurrentBusinessId } from '@/lib/dataClient'
import { supabase } from '@/lib/supabase'
import { withRetry } from '@/lib/withRetry'
import { logActivity } from '@/services/activityService'
import type { Customer, CustomerNote, PaginatedResponse } from '@/types'
import type { QueryParams } from '@/utils/query'

export const customerSearchFields: (keyof Customer)[] = ['first_name', 'last_name', 'email', 'phone']

async function listFromSupabase(params: QueryParams<Customer> = {}): Promise<PaginatedResponse<Customer>> {
  let query = supabase.from('customers').select('*', { count: 'exact' })

  if (params.filters) {
    for (const [key, value] of Object.entries(params.filters)) {
      if (value !== undefined && value !== '' && value !== null) {
        query = query.eq(key, value)
      }
    }
  }

  if (params.search) {
    const fields: (keyof Customer)[] = params.searchFields ?? customerSearchFields
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
  if (error) throw new Error(messageFromError(error, 'Failed to load customers'))
  return paginate((data as Customer[]) ?? [], count ?? 0, page, perPage)
}

export async function listCustomers(params: QueryParams<Customer> = {}): Promise<PaginatedResponse<Customer>> {
  return listFromSupabase(params)
}

export async function getCustomer(id: string): Promise<Customer | undefined> {
  const { data, error } = await withRetry(() => supabase.from('customers').select('*').eq('id', id).maybeSingle())
  if (error) throw new Error(messageFromError(error, 'Failed to load customer'))
  return (data as Customer) ?? undefined
}

export async function createCustomer(
  input: Pick<Customer, 'first_name' | 'last_name'> &
    Partial<Pick<Customer, 'email' | 'phone' | 'type' | 'status'>>
): Promise<Customer> {
  const businessId = await getCurrentBusinessId()
  const { data, error } = await supabase
    .from('customers')
    .insert({
      business_id: businessId,
      first_name: input.first_name,
      last_name: input.last_name,
      email: input.email ?? null,
      phone: input.phone ?? null,
      type: input.type ?? 'regular',
      status: input.status ?? 'new',
      total_spent: 0,
      visit_count: 0,
      last_activity: new Date().toISOString(),
    })
    .select()
    .single()
  if (error) throw new Error(messageFromError(error, 'Failed to create customer'))
  await logActivity({
    action: 'created',
    entity_type: 'customer',
    entity_id: data.id,
    description: `Customer created: ${data.first_name} ${data.last_name}`,
  })
  return data as Customer
}

export async function updateCustomer(id: string, input: Partial<Customer>): Promise<Customer> {
  const { data, error } = await supabase
    .from('customers')
    .update(input)
    .eq('id', id)
    .select()
    .maybeSingle()
  if (error) throw new Error(messageFromError(error, 'Failed to update customer'))
  if (!data) notFound('Customer')
  await logActivity({
    action: 'updated',
    entity_type: 'customer',
    entity_id: data.id,
    description: `Customer updated: ${data.first_name} ${data.last_name}`,
  })
  return data as Customer
}

export async function deleteCustomer(id: string): Promise<void> {
  const { data: existing, error: fetchErr } = await supabase
    .from('customers')
    .select('id,first_name,last_name')
    .eq('id', id)
    .maybeSingle()
  if (fetchErr) throw new Error(messageFromError(fetchErr, 'Failed to load customer'))
  const { error } = await supabase.from('customers').delete().eq('id', id)
  if (error) throw new Error(messageFromError(error, 'Failed to delete customer'))
  await logActivity({
    action: 'deleted',
    entity_type: 'customer',
    entity_id: id,
    description: `Customer deleted${existing ? `: ${existing.first_name} ${existing.last_name}` : ''}`,
  })
}

export async function getCustomerNotes(customerId: string): Promise<CustomerNote[]> {
  const { data, error } = await withRetry(() =>
    supabase.from('customer_notes').select('*').eq('customer_id', customerId).order('created_at', { ascending: false })
  )
  if (error) throw new Error(messageFromError(error, 'Failed to load customer notes'))
  return (data as CustomerNote[]) ?? []
}

export async function addCustomerNote(customerId: string, content: string): Promise<CustomerNote> {
  const businessId = await getCurrentBusinessId()
  const { data, error } = await supabase
    .from('customer_notes')
    .insert({ business_id: businessId, customer_id: customerId, content })
    .select()
    .single()
  if (error) throw new Error(messageFromError(error, 'Failed to add note'))
  await logActivity({
    action: 'note_added',
    entity_type: 'customer_note',
    entity_id: customerId,
    description: 'Note added',
  })
  return data as CustomerNote
}

// Recompute a customer's total_spent from their non-cancelled, non-refunded
// bookings and orders. Called by booking/order services whenever a linked
// record changes so the amount is always in sync everywhere.
export async function recalcTotalSpent(customerId: string): Promise<void> {
  const [bookingsRes, ordersRes] = await Promise.all([
    withRetry(() => supabase.from('bookings').select('amount,status,payment_status').eq('customer_id', customerId)),
    withRetry(() => supabase.from('orders').select('total,status,payment_status').eq('customer_id', customerId)),
  ])
  if (bookingsRes.error) throw new Error(messageFromError(bookingsRes.error, 'Failed to load bookings'))
  if (ordersRes.error) throw new Error(messageFromError(ordersRes.error, 'Failed to load orders'))

  const bookingTotal = (bookingsRes.data ?? [])
    .filter((b) => b.status !== 'cancelled' && b.payment_status !== 'refunded')
    .reduce((sum, b) => sum + (b.amount ?? 0), 0)
  const orderTotal = (ordersRes.data ?? [])
    .filter((o) => o.status !== 'cancelled' && o.payment_status !== 'refunded')
    .reduce((sum, o) => sum + (o.total ?? 0), 0)

  const { error } = await supabase
    .from('customers')
    .update({ total_spent: bookingTotal + orderTotal })
    .eq('id', customerId)
  if (error) throw new Error(messageFromError(error, 'Failed to update customer total spent'))
}

// Recompute a customer's visit_count from their non-cancelled bookings and
// orders. A visit is counted per distinct calendar date where the customer had
// a non-cancelled booking (or order). Kept in sync wherever total spent is.
export async function recalcVisitCount(customerId: string): Promise<void> {
  const [bookingsRes, ordersRes] = await Promise.all([
    withRetry(() => supabase.from('bookings').select('date,end_date,status').eq('customer_id', customerId)),
    withRetry(() => supabase.from('orders').select('start_date,end_date,status').eq('customer_id', customerId)),
  ])
  if (bookingsRes.error) throw new Error(messageFromError(bookingsRes.error, 'Failed to load bookings'))
  if (ordersRes.error) throw new Error(messageFromError(ordersRes.error, 'Failed to load orders'))

  const visitDates = new Set<string>()
  function dateKey(d: Date): string {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
  function addSpan(start: string, end?: string | null) {
    const from = new Date(start + 'T00:00:00')
    const to = end && end > start ? new Date(end + 'T00:00:00') : from
    const cur = new Date(from)
    while (cur <= to) {
      visitDates.add(dateKey(cur))
      cur.setDate(cur.getDate() + 1)
    }
  }
  ;(bookingsRes.data ?? [])
    .filter((b) => b.status !== 'cancelled' && b.status !== 'no_show')
    .forEach((b) => addSpan(String(b.date).slice(0, 10), b.end_date ? String(b.end_date).slice(0, 10) : null))
  ;(ordersRes.data ?? [])
    .filter((o) => o.status !== 'cancelled')
    .forEach((o) => {
      if (o.start_date) addSpan(String(o.start_date).slice(0, 10), o.end_date ? String(o.end_date).slice(0, 10) : null)
    })

  const { error } = await supabase
    .from('customers')
    .update({ visit_count: visitDates.size })
    .eq('id', customerId)
  if (error) throw new Error(messageFromError(error, 'Failed to update customer visits'))
}

// Keep a customer's total spent and visit count in sync. Called by booking and
// order services whenever a linked record changes.
export async function recalcCustomerStats(customerId: string): Promise<void> {
  await recalcTotalSpent(customerId)
  await recalcVisitCount(customerId)
}
