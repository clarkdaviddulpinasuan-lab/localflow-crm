import { getStore, updateStore, nextId, type DemoStore } from '@/services/demoStore'
import { isDemo, paginate, messageFromError, getCurrentBusinessId } from '@/lib/dataClient'
import { supabase } from '@/lib/supabase'
import type { MessageTemplate, PaginatedResponse, TemplateChannel } from '@/types'
import { applyQuery, type QueryParams } from '@/utils/query'

export const CHANNEL_LABELS: Record<TemplateChannel, string> = { email: 'Email', sms: 'SMS' }

function logActivity(s: DemoStore, action: string, templateId: string, name: string) {
  s.activities.unshift({
    id: nextId('act'),
    business_id: s.business.id,
    user_id: s.profile.user_id,
    action,
    entity_type: 'template',
    entity_id: templateId,
    description: `${action} template “${name}”`,
    created_at: new Date().toISOString(),
  })
}

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
  const { data, count, error } = await query
  if (error) throw new Error(messageFromError(error, 'Failed to load templates.'))
  return paginate((data as MessageTemplate[]) ?? [], count ?? 0, page, perPage)
}

export async function listTemplates(params: QueryParams<MessageTemplate> = {}): Promise<PaginatedResponse<MessageTemplate>> {
  if (isDemo()) return applyQuery(getStore().messageTemplates, params)
  return listFromSupabase(params)
}

export async function createTemplate(input: Pick<MessageTemplate, 'name' | 'channel' | 'body'> & { subject?: string }): Promise<MessageTemplate> {
  const now = new Date().toISOString()
  if (isDemo()) {
    const template: MessageTemplate = {
      id: nextId('tpl'),
      business_id: getStore().business.id,
      name: input.name,
      channel: input.channel,
      subject: input.channel === 'email' ? input.subject ?? null : null,
      body: input.body,
      created_at: now,
      updated_at: now,
    }
    updateStore((s) => {
      s.messageTemplates.unshift(template)
      logActivity(s, 'created', template.id, template.name)
    })
    return template
  }
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
  if (isDemo()) {
    const existing = getStore().messageTemplates.find((t) => t.id === id)
    if (!existing) throw new Error('Template not found')
    const updated: MessageTemplate = {
      ...existing,
      ...patch,
      subject: (patch.channel ?? existing.channel) === 'email' ? patch.subject ?? existing.subject ?? null : null,
      updated_at: new Date().toISOString(),
    }
    updateStore((s) => {
      s.messageTemplates = s.messageTemplates.map((t) => (t.id === id ? updated : t))
      logActivity(s, 'updated', id, updated.name)
    })
    return updated
  }
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
  if (isDemo()) {
    const template = getStore().messageTemplates.find((t) => t.id === id)
    updateStore((s) => {
      s.messageTemplates = s.messageTemplates.filter((t) => t.id !== id)
      if (template) logActivity(s, 'deleted', id, template.name)
    })
    return
  }
  const businessId = await getCurrentBusinessId()
  const { error } = await supabase.from('message_templates').delete().eq('id', id).eq('business_id', businessId)
  if (error) throw new Error(messageFromError(error, 'Failed to delete template.'))
}

/**
 * Renders {{placeholder}} values ({{customer}}, {{business}}, {{date}}) into a
 * template body/subject for a given customer.
 */
export function renderTemplate(template: Pick<MessageTemplate, 'body'> & { subject?: string | null }, values: Record<string, string>): { subject?: string; body: string } {
  const apply = (text: string) =>
    Object.entries(values).reduce((acc, [key, value]) => acc.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), value), text)
  return {
    ...(template.subject ? { subject: apply(template.subject) } : {}),
    body: apply(template.body),
  }
}