import { paginate, messageFromError, getCurrentBusinessId } from '@/lib/dataClient'
import { supabase } from '@/lib/supabase'
import { notify } from '@/services/notificationService'
import type { Communication, PaginatedResponse, TemplateChannel } from '@/types'
import type { QueryParams } from '@/utils/query'
import { getProfile } from '@/services/settingsService'

export function normalizeBody(body: string): string {
  return body.replace(/\r\n/g, '\n').replace(/\s{2,}/g, ' ').trim()
}

async function listFromSupabase(params: QueryParams<Communication> = {}): Promise<PaginatedResponse<Communication>> {
  let query = supabase.from('communications').select('*', { count: 'exact' })
  if (params.filters) {
    for (const [key, value] of Object.entries(params.filters)) {
      if (value !== undefined && value !== '' && value !== null) query = query.eq(key, value)
    }
  }
  if (params.sortBy) {
    query = query.order(String(params.sortBy), { ascending: params.sortDir !== 'desc' })
  } else {
    query = query.order('sent_at', { ascending: false })
  }
  const page = params.page ?? 1
  const perPage = params.perPage ?? 50
  const from = (page - 1) * perPage
  query = query.range(from, from + perPage - 1)
  const { data, count, error } = await query
  if (error) throw new Error(messageFromError(error, 'Failed to load communications.'))
  return paginate((data as Communication[]) ?? [], count ?? 0, page, perPage)
}

export async function listCommunications(params: QueryParams<Communication> = {}): Promise<PaginatedResponse<Communication>> {
  return listFromSupabase(params)
}

async function getCommunication(id: string): Promise<Communication | null> {
  const { data, error } = await supabase
    .from('communications')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(messageFromError(error, 'Failed to load communication.'))
  return (data as Communication) ?? null
}

async function markFailed(id: string, errorMessage: string): Promise<void> {
  const { error } = await supabase
    .from('communications')
    .update({ status: 'failed', error: errorMessage })
    .eq('id', id)
  if (error) throw new Error(messageFromError(error, 'Failed to update communication.'))
}

/**
 * Hand the queued communication to the send-message Edge Function, which ships
 * it through the configured provider and records the delivery result on the row.
 */
export async function dispatchCommunication(id: string): Promise<void> {
  await supabase.functions.invoke('send-message', { body: { communication_id: id } })
}

/**
 * Queue a message to a customer and dispatch it immediately. The inserted row
 * starts as 'pending'; the Edge Function flips it to 'delivered' or 'failed'.
 * Returns the refreshed row so callers see the delivery outcome.
 */
export async function sendCommunication(input: {
  customer_id: string
  channel: TemplateChannel
  subject?: string
  body: string
  template_id?: string
  booking_id?: string
}): Promise<Communication> {
  const body = normalizeBody(input.body)
  const now = new Date().toISOString()

  const businessId = await getCurrentBusinessId()
  const { data, error } = await supabase
    .from('communications')
    .insert({
      business_id: businessId,
      customer_id: input.customer_id,
      channel: input.channel,
      template_id: input.template_id ?? null,
      subject: input.channel === 'email' ? input.subject ?? null : null,
      body,
      status: 'pending',
      sent_at: now,
    })
    .select()
    .single()
  if (error) throw new Error(messageFromError(error, 'Failed to log communication.'))
  const queued = data as Communication

  try {
    await dispatchCommunication(queued.id)
  } catch (err) {
    await markFailed(queued.id, messageFromError(err as { message?: string }, 'Failed to send message.'))
    throw new Error(messageFromError(err as { message?: string }, 'Failed to send message.'))
  }

  const refreshed = await getCommunication(queued.id)
  const profile = await getProfile()
  await notify({
    user_id: profile.user_id,
    business_id: businessId,
    title: `${input.channel === 'email' ? 'Email' : 'SMS'} ${refreshed?.status === 'failed' ? 'failed to send' : 'sent'}`,
    message: body.slice(0, 160),
    type: 'customer',
    entity_type: 'customer',
    entity_id: input.customer_id,
  })
  return (refreshed ?? queued) as Communication
}

/**
 * Send a rendered message to an arbitrary address (used by "Test send"). No
 * customer row is required and nothing is persisted to the communications ledger.
 */
export async function sendTestEmail(input: { subject: string; body: string; to: string }): Promise<void> {
  await supabase.functions.invoke('send-test-email', { body: input })
}