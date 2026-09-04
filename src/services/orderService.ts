import { paginate, notFound, messageFromError, getCurrentBusinessId } from '@/lib/dataClient'
import { supabase } from '@/lib/supabase'
import { recalcCustomerStats } from '@/services/customerService'
import { logActivity } from '@/services/activityService'
import type { Order, PaginatedResponse } from '@/types'
import type { QueryParams } from '@/utils/query'

export const orderSearchFields: (keyof Order)[] = ['order_number', 'items', 'staff_member']

// Human-friendly " for DD/MM/YYYY" or " from DD/MM/YYYY to DD/MM/YYYY" text.
function orderDates(input: { start_date?: string | null; end_date?: string | null }): string {
  const start = input.start_date
  const end = input.end_date
  if (start && end && end > start) return ` from ${start} to ${end}`
  if (start) return ` on ${start}`
  return ''
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
  return listFromSupabase(params)
}

export async function getOrder(id: string): Promise<Order | undefined> {
  const { data, error } = await supabase.from('orders').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(messageFromError(error, 'Failed to load order'))
  return (data as Order) ?? undefined
}

export async function nextOrderNumber(): Promise<string> {
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
      start_date: input.start_date ? input.start_date : null,
      end_date: input.end_date ? input.end_date : null,
      total: input.total,
      payment_status: input.payment_status ?? 'pending',
      status: input.status ?? 'new',
      staff_member: input.staff_member ?? '',
    })
    .select()
    .single()
  if (error) throw new Error(messageFromError(error, 'Failed to create order'))
  await recalcCustomerStats(input.customer_id)
  await logActivity({
    action: 'created',
    entity_type: 'order',
    entity_id: input.customer_id,
    description: `Order ${order_number} created${orderDates(input)}`,
  })
  return data as Order
}

export async function updateOrder(id: string, input: Partial<Order>): Promise<Order> {
  const { data, error } = await supabase
    .from('orders')
    .update(input)
    .eq('id', id)
    .select()
    .maybeSingle()
  if (error) throw new Error(messageFromError(error, 'Failed to update order'))
  if (!data) notFound('Order')
  await recalcCustomerStats(data.customer_id)
  await logActivity({
    action: 'updated',
    entity_type: 'order',
    entity_id: data.customer_id,
    description: `Order ${data.order_number} updated${orderDates(data)}`,
  })
  return data as Order
}

export async function deleteOrder(id: string): Promise<void> {
  const { data: existing, error: fetchErr } = await supabase
    .from('orders')
    .select('customer_id')
    .eq('id', id)
    .maybeSingle()
  if (fetchErr) throw new Error(messageFromError(fetchErr, 'Failed to load order'))
  const customerId = existing?.customer_id
  const { error } = await supabase.from('orders').delete().eq('id', id)
  if (error) throw new Error(messageFromError(error, 'Failed to delete order'))
  if (customerId) {
    await recalcCustomerStats(customerId)
    await logActivity({
      action: 'deleted',
      entity_type: 'order',
      entity_id: customerId,
      description: 'Order deleted',
    })
  }
}
