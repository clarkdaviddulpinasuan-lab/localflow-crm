import { getStore, updateStore, nextId, type DemoStore } from '@/services/demoStore'
import { isDemo, paginate, notFound, messageFromError, getCurrentBusinessId } from '@/lib/dataClient'
import { supabase } from '@/lib/supabase'
import { recalcCustomerStats } from '@/services/customerService'
import type { Order, PaginatedResponse } from '@/types'
import { applyQuery, type QueryParams } from '@/utils/query'

export const orderSearchFields: (keyof Order)[] = ['order_number', 'items', 'staff_member']

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

async function listFromSupabase(params: QueryParams<Order> = {}): Promise<PaginatedResponse<Order>> {
  let query = supabase.from('orders').select('*', { count: 'exact' })

  if (params.filters) {
    for (const [key, value] of Object.entries(params.filters)) {
      if (value !== undefined && value !== '' && value !== null) {
        query = query.eq(key, value)
      }
    }
  }

  if (params.search) {
    const fields: (keyof Order)[] = params.searchFields ?? orderSearchFields
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
  if (error) throw new Error(messageFromError(error, 'Failed to load orders'))
  return paginate((data as Order[]) ?? [], count ?? 0, page, perPage)
}

export async function listOrders(params: QueryParams<Order> = {}): Promise<PaginatedResponse<Order>> {
  if (isDemo()) return applyQuery(getStore().orders, params)
  return listFromSupabase(params)
}

export async function getOrder(id: string): Promise<Order | undefined> {
  if (isDemo()) return getStore().orders.find((o) => o.id === id)
  const { data, error } = await supabase.from('orders').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(messageFromError(error, 'Failed to load order'))
  return (data as Order) ?? undefined
}

export async function nextOrderNumber(): Promise<string> {
  if (isDemo()) {
    const existing = getStore().orders
    const year = new Date().getFullYear()
    const max = existing.reduce((mx, o) => {
      const match = o.order_number.match(new RegExp(`ORD-${year}-(\\d+)$`))
      if (match) return Math.max(mx, parseInt(match[1], 10))
      return mx
    }, 0)
    return `ORD-${year}-${String(max + 1).padStart(3, '0')}`
  }

  const year = new Date().getFullYear()
  const { data, error } = await supabase
    .from('orders')
    .select('order_number')
    .ilike('order_number', `ORD-${year}-%`)
    .order('order_number', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(messageFromError(error, 'Failed to generate order number'))

  let next = 1
  if (data?.order_number) {
    const match = (data.order_number as string).match(new RegExp(`ORD-${year}-(\\d+)$`))
    if (match) next = parseInt(match[1], 10) + 1
  }
  return `ORD-${year}-${String(next).padStart(3, '0')}`
}

export async function createOrder(
  input: Omit<Order, 'id' | 'business_id' | 'created_at' | 'updated_at' | 'order_number'> & {
    order_number?: string
  }
): Promise<Order> {
  if (isDemo()) {
    const now = new Date().toISOString()
    const order: Order = {
      id: nextId('ord'),
      business_id: getStore().business.id,
      order_number: input.order_number || (await nextOrderNumber()),
      ...input,
      created_at: now,
      updated_at: now,
    }
    updateStore((s) => {
      s.orders.unshift(order)
      logActivity(s, 'created', 'order', order.id, `Order ${order.order_number} created (${order.items})`)
    })
    await recalcCustomerStats(order.customer_id)
    return order
  }

  const order_number = input.order_number || (await nextOrderNumber())
  const businessId = await getCurrentBusinessId()
  const { data, error } = await supabase
    .from('orders')
    .insert({
      business_id: businessId,
      customer_id: input.customer_id,
      booking_id: input.booking_id ?? null,
      order_number,
      items: input.items,
      description: input.description ?? null,
      total: input.total,
      payment_status: input.payment_status ?? 'pending',
      status: input.status ?? 'new',
      staff_member: input.staff_member ?? '',
    })
    .select()
    .single()
  if (error) throw new Error(messageFromError(error, 'Failed to create order'))
  await recalcCustomerStats(input.customer_id)
  return data as Order
}

export async function updateOrder(id: string, input: Partial<Order>): Promise<Order> {
  if (isDemo()) {
    const existing = getStore().orders.find((o) => o.id === id)
    if (!existing) throw new Error('Order not found')
    const updated: Order = { ...existing, ...input, id, updated_at: new Date().toISOString() }
    updateStore((s) => {
      s.orders = s.orders.map((o) => (o.id === id ? updated : o))
      logActivity(s, 'updated', 'order', id, `Order ${updated.order_number} updated`)
    })
    await recalcCustomerStats(existing.customer_id)
    return updated
  }

  const { data, error } = await supabase
    .from('orders')
    .update(input)
    .eq('id', id)
    .select()
    .maybeSingle()
  if (error) throw new Error(messageFromError(error, 'Failed to update order'))
  if (!data) notFound('Order')
  await recalcCustomerStats(data.customer_id)
  return data as Order
}

export async function deleteOrder(id: string): Promise<void> {
  let customerId: string | undefined
  if (isDemo()) {
    const existing = getStore().orders.find((o) => o.id === id)
    customerId = existing?.customer_id
    updateStore((s) => {
      s.orders = s.orders.filter((o) => o.id !== id)
    })
    if (customerId) await recalcCustomerStats(customerId)
    return
  }
  const { data: existing, error: fetchErr } = await supabase
    .from('orders')
    .select('customer_id')
    .eq('id', id)
    .maybeSingle()
  if (fetchErr) throw new Error(messageFromError(fetchErr, 'Failed to load order'))
  customerId = existing?.customer_id
  const { error } = await supabase.from('orders').delete().eq('id', id)
  if (error) throw new Error(messageFromError(error, 'Failed to delete order'))
  if (customerId) await recalcCustomerStats(customerId)
}
