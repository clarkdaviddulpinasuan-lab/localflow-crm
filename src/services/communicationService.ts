import { getStore, updateStore, nextId, type DemoStore } from '@/services/demoStore'
import { isDemo, paginate, messageFromError, getCurrentBusinessId } from '@/lib/dataClient'
import { supabase } from '@/lib/supabase'
import { notify } from '@/services/notificationService'
import type { Communication, PaginatedResponse, TemplateChannel } from '@/types'
import { applyQuery, type QueryParams } from '@/utils/query'
import { getProfile } from '@/services/settingsService'

export function normalizeBody(body: string): string {
  return body.replace(/\r\n/g, '\n').replace(/\s{2,}/g, ' ').trim()
}

function logActivity(s: DemoStore, channel: TemplateChannel, customerId: string, body: string) {
  s.activities.unshift({
    id: nextId('act'),
    business_id: s.business.id,
    user_id: s.profile.user_id,
    action: 'sent',
    entity_type: 'communication',
    entity_id: customerId,
    description: `${channel === 'email' ? 'Email' : 'SMS'} sent: ${body.slice(0, 120)}`,
    created_at: new Date().toISOString(),
  })
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
  if (isDemo()) return applyQuery(getStore().communications, params)
  return listFromSupabase(params)
}

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

  if (isDemo()) {
    const communication: Communication = {
      id: nextId('com'),
      business_id: getStore().business.id,
      customer_id: input.customer_id,
      channel: input.channel,
      template_id: input.template_id ?? null,
      subject: input.channel === 'email' ? input.subject ?? null : null,
      body,
      status: 'sent',
      sent_at: now,
    }
    updateStore((s) => {
      s.communications.unshift(communication)
      logActivity(s, input.channel, input.customer_id, body)
    })
    const profile = getStore().profile
    await notify({
      user_id: profile.user_id,
      business_id: profile.business_id,
      title: `${input.channel === 'email' ? 'Email' : 'SMS'} sent`,
      message: body.slice(0, 160),
      type: 'customer',
      entity_type: 'customer',
      entity_id: input.customer_id,
    })
    return communication
  }

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
      status: 'sent',
      sent_at: now,
    })
    .select()
    .single()
  if (error) throw new Error(messageFromError(error, 'Failed to log communication.'))
  const profile = await getProfile()
  await notify({
    user_id: profile.user_id,
    business_id: businessId,
    title: `${input.channel === 'email' ? 'Email' : 'SMS'} sent`,
    message: body.slice(0, 160),
    type: 'customer',
    entity_type: 'customer',
    entity_id: input.customer_id,
  })
  return data as Communication
}