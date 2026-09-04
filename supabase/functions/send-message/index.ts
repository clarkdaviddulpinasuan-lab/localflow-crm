// LocalFlow CRM — send-message
// Dispatches a queued `communications` row through the configured provider and
// records the outcome. Invoked by `sendCommunication()` after it inserts the
// row as 'pending'. The caller's JWT is forwarded so RLS scopes the work to
// their own business.
import { corsPreflight, json, authHeader } from '../_shared/cors.ts'
import { createSupabase, loadSenderConfig, sendEmail, type SendResult } from '../_shared/send.ts'
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'

interface CommunicationRow {
  id: string
  business_id: string
  customer_id: string
  channel: 'email' | 'sms'
  subject?: string | null
  body: string
  status: string
}

async function sendCommunication(
  supabase: SupabaseClient,
  com: CommunicationRow,
  config: Record<string, unknown>
): Promise<SendResult & { status: string }> {
  const now = new Date().toISOString()
  const patch: Record<string, unknown> = {}

  const { data: customer, error: custErr } = await supabase
    .from('customers')
    .select('email, phone')
    .eq('id', com.customer_id)
    .maybeSingle()
  if (custErr) return { ok: false, provider: '', error: custErr.message, status: 'failed' }

  if (com.channel === 'sms') {
    patch.status = 'failed'
    patch.error = 'SMS sending is not configured yet.'
    await supabase.from('communications').update(patch).eq('id', com.id)
    return { ok: false, provider: '', error: patch.error as string, status: 'failed' }
  }

  const to = customer?.email as string | null
  if (!to) {
    patch.status = 'failed'
    patch.error = 'Customer has no email address.'
    await supabase.from('communications').update(patch).eq('id', com.id)
    return { ok: false, provider: '', error: patch.error as string, status: 'failed' }
  }

  const result = await sendEmail({
    to,
    subject: com.subject ?? '',
    text: com.body,
    fromName: (config.sender_name as string) || 'LocalFlow CRM',
    fromEmail: (config.from_email as string) ?? '',
  })

  if (result.ok) {
    patch.status = 'delivered'
    patch.provider = result.provider
    patch.provider_message_id = result.id ?? null
    patch.delivered_at = now
  } else {
    patch.status = 'failed'
    patch.provider = result.provider
    patch.error = result.error ?? 'Send failed'
  }
  await supabase.from('communications').update(patch).eq('id', com.id)
  return { ...result, status: patch.status as string }
}

Deno.serve(async (req) => {
  const pre = corsPreflight(req)
  if (pre) return pre

  try {
    const auth = authHeader(req)
    const supabase = createSupabase(auth)

    const body = await req.json().catch(() => ({}))
    const communicationId: string | undefined = body?.communication_id
    if (!communicationId) return json({ ok: false, error: 'communication_id is required' }, 400)

    const { data: com, error } = await supabase
      .from('communications')
      .select('*')
      .eq('id', communicationId)
      .maybeSingle()
    if (error) return json({ ok: false, error: error.message }, 400)
    if (!com) return json({ ok: false, error: 'Communication not found' }, 404)

    // Already dispatched — never send twice.
    if (com.status === 'delivered' || com.status === 'failed') {
      return json({ ok: true, status: com.status })
    }

    const config = await loadSenderConfig(supabase, com.business_id as string)
    const result = await sendCommunication(supabase, com as unknown as CommunicationRow, config)
    return json({ ok: result.ok, ...result }, result.ok ? 200 : 400)
  } catch (err) {
    return json({ ok: false, error: err instanceof Error ? err.message : String(err) }, 500)
  }
})