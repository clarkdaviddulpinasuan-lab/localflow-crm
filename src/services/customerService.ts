import { getStore, updateStore, nextId } from '@/services/demoStore'
import { isDemo, paginate, notFound, messageFromError, getCurrentBusinessId } from '@/lib/dataClient'
import { isDemoMode, supabase } from '@/lib/supabase'
import type { Customer, CustomerNote, PaginatedResponse } from '@/types'
import { applyQuery, type QueryParams } from '@/utils/query'

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
  if (error) throw new Error(messageFromError(error, 'Failed to load customers'))
  return paginate((data as Customer[]) ?? [], count ?? 0, page, perPage)
}

export async function listCustomers(params: QueryParams<Customer> = {}): Promise<PaginatedResponse<Customer>> {
  if (isDemo()) return applyQuery(getStore().customers, params)
  return listFromSupabase(params)
}

export async function getCustomer(id: string): Promise<Customer | undefined> {
  if (isDemo()) return getStore().customers.find((c) => c.id === id)
  const { data, error } = await supabase.from('customers').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(messageFromError(error, 'Failed to load customer'))
  return (data as Customer) ?? undefined
}

export async function createCustomer(
  input: Pick<Customer, 'first_name' | 'last_name'> &
    Partial<Pick<Customer, 'email' | 'phone' | 'type' | 'status'>>
): Promise<Customer> {
  if (isDemo()) {
    const now = new Date().toISOString()
    const customer: Customer = {
      id: nextId('cust'),
      business_id: getStore().business.id,
      first_name: input.first_name,
      last_name: input.last_name,
      email: input.email,
      phone: input.phone,
      type: input.type ?? 'regular',
      status: input.status ?? 'new',
      total_spent: 0,
      visit_count: 0,
      last_activity: now,
      created_at: now,
      updated_at: now,
    }
    updateStore((s) => {
      s.customers.unshift(customer)
      s.activities.unshift({
        id: nextId('act'),
        business_id: s.business.id,
        user_id: s.profile.user_id,
        action: 'created',
        entity_type: 'customer',
        entity_id: customer.id,
        description: `New customer ${customer.first_name} ${customer.last_name} added`,
        created_at: now,
      })
    })
    return customer
  }

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
  return data as Customer
}

export async function updateCustomer(id: string, input: Partial<Customer>): Promise<Customer> {
  if (isDemo()) {
    const existing = getStore().customers.find((c) => c.id === id)
    if (!existing) throw new Error('Customer not found')
    const updated: Customer = { ...existing, ...input, id, updated_at: new Date().toISOString() }
    updateStore((s) => {
      s.customers = s.customers.map((c) => (c.id === id ? updated : c))
      s.activities.unshift({
        id: nextId('act'),
        business_id: s.business.id,
        user_id: s.profile.user_id,
        action: 'updated',
        entity_type: 'customer',
        entity_id: id,
        description: `Customer ${updated.first_name} ${updated.last_name} updated`,
        created_at: updated.updated_at,
      })
    })
    return updated
  }

  const { data, error } = await supabase
    .from('customers')
    .update(input)
    .eq('id', id)
    .select()
    .maybeSingle()
  if (error) throw new Error(messageFromError(error, 'Failed to update customer'))
  if (!data) notFound('Customer')
  return data as Customer
}

export async function deleteCustomer(id: string): Promise<void> {
  if (isDemo()) {
    updateStore((s) => {
      s.customers = s.customers.filter((c) => c.id !== id)
    })
    return
  }
  const { error } = await supabase.from('customers').delete().eq('id', id)
  if (error) throw new Error(messageFromError(error, 'Failed to delete customer'))
}

export async function getCustomerNotes(customerId: string): Promise<CustomerNote[]> {
  if (isDemo()) {
    return getStore()
      .activities.filter((a) => a.entity_type === 'customer_note' && a.entity_id === customerId)
      .map((a) => ({
        id: a.id,
        customer_id: customerId,
        business_id: a.business_id,
        author_id: a.user_id,
        content: a.description,
        created_at: a.created_at,
        updated_at: a.created_at,
      }))
  }
  const { data, error } = await supabase
    .from('customer_notes')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(messageFromError(error, 'Failed to load customer notes'))
  return (data as CustomerNote[]) ?? []
}

export async function addCustomerNote(customerId: string, content: string): Promise<CustomerNote> {
  if (isDemo()) {
    const now = new Date().toISOString()
    const note: CustomerNote = {
      id: nextId('cnote'),
      customer_id: customerId,
      business_id: getStore().business.id,
      author_id: getStore().profile.user_id,
      content,
      created_at: now,
      updated_at: now,
    }
    updateStore((s) => {
      s.activities.unshift({
        id: nextId('act'),
        business_id: s.business.id,
        user_id: s.profile.user_id,
        action: 'note',
        entity_type: 'customer_note',
        entity_id: customerId,
        description: content,
        created_at: now,
      })
    })
    return note
  }

  const businessId = await getCurrentBusinessId()
  const { data, error } = await supabase
    .from('customer_notes')
    .insert({ business_id: businessId, customer_id: customerId, content })
    .select()
    .single()
  if (error) throw new Error(messageFromError(error, 'Failed to add note'))
  return data as CustomerNote
}

// Kept for any remaining synchronous internal use.
export function isSupabaseEnabled(): boolean {
  return !isDemoMode()
}

// Recompute a customer's total_spent from their non-cancelled, non-refunded
// bookings and orders. Called by booking/order services whenever a linked
// record changes so the amount is always in sync everywhere.
export async function recalcTotalSpent(customerId: string): Promise<void> {
  if (isDemo()) {
    const store = getStore()
    const bookingTotal = store.bookings
      .filter((b) => b.customer_id === customerId && b.status !== 'cancelled' && b.payment_status !== 'refunded')
      .reduce((sum, b) => sum + b.amount, 0)
    const orderTotal = store.orders
      .filter((o) => o.customer_id === customerId && o.status !== 'cancelled' && o.payment_status !== 'refunded')
      .reduce((sum, o) => sum + o.total, 0)
    updateStore((s) => {
      const c = s.customers.find((c) => c.id === customerId)
      if (c) {
        c.total_spent = bookingTotal + orderTotal
        c.updated_at = new Date().toISOString()
      }
    })
    return
  }

  const [bookingsRes, ordersRes] = await Promise.all([
    supabase.from('bookings').select('amount,status,payment_status').eq('customer_id', customerId),
    supabase.from('orders').select('total,status,payment_status').eq('customer_id', customerId),
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
  if (isDemo()) {
    const store = getStore()
    const visitDates = new Set<string>()
    store.bookings
      .filter((b) => b.customer_id === customerId && b.status !== 'cancelled' && b.status !== 'no_show')
      .forEach((b) => visitDates.add(b.date))
    store.orders
      .filter((o) => o.customer_id === customerId && o.status !== 'cancelled')
      .forEach((o) => visitDates.add(o.created_at.slice(0, 10)))
    updateStore((s) => {
      const c = s.customers.find((c) => c.id === customerId)
      if (c) {
        c.visit_count = visitDates.size
        c.updated_at = new Date().toISOString()
      }
    })
    return
  }

  const [bookingsRes, ordersRes] = await Promise.all([
    supabase.from('bookings').select('date,status').eq('customer_id', customerId),
    supabase.from('orders').select('created_at,status').eq('customer_id', customerId),
  ])
  if (bookingsRes.error) throw new Error(messageFromError(bookingsRes.error, 'Failed to load bookings'))
  if (ordersRes.error) throw new Error(messageFromError(ordersRes.error, 'Failed to load orders'))

  const visitDates = new Set<string>()
  ;(bookingsRes.data ?? [])
    .filter((b) => b.status !== 'cancelled' && b.status !== 'no_show')
    .forEach((b) => visitDates.add(String(b.date).slice(0, 10)))
  ;(ordersRes.data ?? [])
    .filter((o) => o.status !== 'cancelled')
    .forEach((o) => visitDates.add(String(o.created_at).slice(0, 10)))

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
