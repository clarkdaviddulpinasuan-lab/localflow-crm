import { paginate, messageFromError, getCurrentBusinessId } from '@/lib/dataClient'
import { supabase } from '@/lib/supabase'
import { withRetry } from '@/lib/withRetry'
import type { Booking, Customer, MessageTemplate, PaginatedResponse, TemplateChannel } from '@/types'
import type { QueryParams } from '@/utils/query'

export const CHANNEL_LABELS: Record<TemplateChannel, string> = { email: 'Email', sms: 'SMS' }

async function listFromSupabase(params: QueryParams<MessageTemplate> = {}): Promise<PaginatedResponse<MessageTemplate>> {
  let query = supabase.from('message_templates').select('*', { count: 'exact' })
  if (params.filters) {
    for (const [key, value] of Object.entries(params.filters)) {
      if (value !== undefined && value !== '' && value !== null) query = query.eq(key, value)
    }
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
  if (error) throw new Error(messageFromError(error, 'Failed to load templates.'))
  return paginate((data as MessageTemplate[]) ?? [], count ?? 0, page, perPage)
}

export async function listTemplates(params: QueryParams<MessageTemplate> = {}): Promise<PaginatedResponse<MessageTemplate>> {
  return listFromSupabase(params)
}

export async function createTemplate(input: Pick<MessageTemplate, 'name' | 'channel' | 'body'> & { subject?: string }): Promise<MessageTemplate> {
  const businessId = await getCurrentBusinessId()
  const { data, error } = await supabase
    .from('message_templates')
    .insert({
      business_id: businessId,
      name: input.name,
      channel: input.channel,
      subject: input.channel === 'email' ? input.subject ?? null : null,
      body: input.body,
    })
    .select()
    .single()
  if (error) throw new Error(messageFromError(error, 'Failed to create template.'))
  return data as MessageTemplate
}

export async function updateTemplate(id: string, patch: Partial<Pick<MessageTemplate, 'name' | 'channel' | 'subject' | 'body'>>): Promise<MessageTemplate> {
  const businessId = await getCurrentBusinessId()
  const { data, error } = await supabase
    .from('message_templates')
    .update({
      ...patch,
      subject: patch.channel === 'email' ? patch.subject ?? null : undefined,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('business_id', businessId)
    .select()
    .maybeSingle()
  if (error) throw new Error(messageFromError(error, 'Failed to update template.'))
  if (!data) throw new Error('Template not found')
  return data as MessageTemplate
}

export async function deleteTemplate(id: string): Promise<void> {
  const businessId = await getCurrentBusinessId()
  const { error } = await supabase.from('message_templates').delete().eq('id', id).eq('business_id', businessId)
  if (error) throw new Error(messageFromError(error, 'Failed to delete template.'))
}

/**
 * Placeholder values shared by every message: {{customer}}, {{first_name}},
 * {{last_name}}, {{email}}, {{phone}}, {{date}}, {{business}}.
 */
export function customerTemplateValues(
  customer: Pick<Customer, 'first_name' | 'last_name'> & { email?: string | null; phone?: string | null },
  business?: { name: string } | null
): Record<string, string> {
  return {
    customer: `${customer.first_name} ${customer.last_name}`.trim(),
    first_name: customer.first_name,
    last_name: customer.last_name,
    email: customer.email ?? '',
    phone: customer.phone ?? '',
    date: new Date().toISOString().slice(0, 10),
    business: business?.name ?? '',
  }
}

/**
 * Adds booking-specific placeholders on top of the shared ones:
 * {{booking_id}}, {{resource}}, {{date}}, {{start_time}}, {{end_time}},
 * {{guests}}, {{amount}}.
 */
export function bookingTemplateValues(
  customer: Pick<Customer, 'first_name' | 'last_name'> & { email?: string | null; phone?: string | null },
  booking: Pick<Booking, 'id' | 'resource' | 'date' | 'start_time' | 'end_time' | 'guests' | 'amount'>,
  business?: { name: string } | null
): Record<string, string> {
  return {
    ...customerTemplateValues(customer, business),
    booking_id: booking.id,
    resource: booking.resource,
    date: booking.date,
    start_time: booking.start_time,
    end_time: booking.end_time,
    guests: String(booking.guests),
    amount: String(booking.amount),
  }
}

/**
 * Renders {{placeholder}} values into a template body/subject. Pass the result
 * of {@link customerTemplateValues} / {@link bookingTemplateValues}; any
 * unknown placeholder simply unfolds to an empty string.
 */
export function renderTemplate(template: Pick<MessageTemplate, 'body'> & { subject?: string | null }, values: Record<string, string>): { subject?: string; body: string } {
  const apply = (text: string) =>
    Object.entries(values).reduce((acc, [key, value]) => acc.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), value), text)
  return {
    ...(template.subject ? { subject: apply(template.subject) } : {}),
    body: apply(template.body),
  }
}
