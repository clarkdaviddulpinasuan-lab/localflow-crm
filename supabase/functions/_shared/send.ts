import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

/**
 * Build a Supabase client bound to the calling user. When `serviceRole` is
 * false (the default) the caller's JWT is forwarded so Row Level Security
 * scopes every query to their own business. With `serviceRole` true the
 * function bypasses RLS (must never be used for caller-controlled data).
 */
export function createSupabase(auth: string | null, serviceRole = false): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const key = serviceRole
    ? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    : Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  return createClient(url, key, {
    global: { headers: auth && !serviceRole ? { Authorization: auth } : {} },
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export function hasProviderKey(name: string): boolean {
  return Boolean(Deno.env.get(name))
}

/**
 * Load the business's `message_from` settings row (sender identity shown to
 * customers). Reads through the caller's RLS-scoped client, so it can only
 * ever see the caller's own business.
 */
export async function loadSenderConfig(supabase: SupabaseClient, businessId: string): Promise<Record<string, unknown>> {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('business_id', businessId)
    .eq('key', 'message_from')
    .maybeSingle()
  if (error) return {}
  if (!data?.value) return {}
  try {
    return JSON.parse(data.value as string) as Record<string, unknown>
  } catch {
    return {}
  }
}

export interface SendResult {
  ok: boolean
  provider: string
  id?: string
  error?: string
}

export async function sendEmail(input: {
  to: string
  subject: string
  text: string
  fromName: string
  fromEmail: string
}, forceDryRun = false): Promise<SendResult> {
  if (forceDryRun || !hasProviderKey('RESEND_API_KEY')) {
    console.log(`[dryrun] would email ${input.to} — subject: ${input.subject}`)
    return { ok: true, provider: 'dryrun', id: `dryrun-${crypto.randomUUID()}` }
  }
  const apiKey = Deno.env.get('RESEND_API_KEY')!
  if (!input.fromEmail) {
    return { ok: false, provider: 'resend', error: 'No verified sender address set (Settings → Messaging).' }
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${input.fromName} <${input.fromEmail}>`,
      to: [input.to],
      subject: input.subject,
      text: input.text,
    }),
  })
  if (res.status >= 400) {
    const detail = (await res.text()).slice(0, 300)
    return { ok: false, provider: 'resend', error: detail || `Resend returned ${res.status}` }
  }
  const payload = await res.json()
  return { ok: true, provider: 'resend', id: payload.id }
}